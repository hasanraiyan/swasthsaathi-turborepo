/**
 * Check that the configured model can actually run the assistant.
 *
 *   node scripts/check-model.mjs                 check what .env is set to
 *   node scripts/check-model.mjs <model>         check one other model
 *   node scripts/check-model.mjs --compare       time every candidate
 *
 * Reads apps/api/.env directly -- no dependencies, no build step, so it can be
 * run before anything else works.
 *
 * The question it answers is not "is the key valid" but "does this model
 * support function calling". The assistant is nothing but tool calls, and a
 * model that ignores tools does not fail -- it answers confidently without
 * ever reading the health record, which is the worst outcome available here.
 * That is why the tool probe below asks a question it cannot possibly answer
 * from its own knowledge.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 60_000;

/** Enough to choose between; not so many that the run is never finished. */
const MAX_COMPARED = 20;

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(join(APP_ROOT, '.env'), 'utf8');
  } catch {
    fail(`No .env at ${join(APP_ROOT, '.env')}. Copy .env.example to .env first.`);
  }

  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** Every call goes through here so a hanging endpoint reports as one, not a stall. */
async function call(env, path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body, ms: Date.now() - startedAt };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: error.name === 'AbortError' ? `no response within ${TIMEOUT_MS / 1000}s` : error.message,
      ms: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

const TOOL = {
  type: 'function',
  function: {
    name: 'medicines__list',
    description: 'List the medicines on record for this user.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['active', 'paused', 'stopped'] },
      },
    },
  },
};

/**
 * Models on this gateway worth considering for the assistant.
 *
 * All are chat models plausibly capable of function calling -- embedding,
 * vision, safety and reward models are excluded because they cannot run it at
 * all. Whether each actually calls a tool, and how long it takes, is the
 * whole point of measuring rather than assuming.
 */
const CANDIDATES = [
  'deepseek-ai/deepseek-v4-flash-0731',
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'nvidia/nvidia-nemotron-nano-9b-v2',
  'mistralai/mistral-large-2-instruct',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'moonshotai/kimi-k2.6',
];

/**
 * Which models to time.
 *
 * Some gateways say in their catalogue whether a model supports tools --
 * Pollinations does, NVIDIA does not. Where that is published it is far
 * better than a list maintained here, which goes stale the moment the
 * gateway changes. Falls back to the hand-kept list otherwise.
 */
async function candidatesFor(env) {
  const listing = await call(env, '/models');
  if (listing.ok) {
    try {
      const parsed = JSON.parse(listing.body);
      const rows = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
      const declared = rows.filter(
        (row) => row.tools === true && row.category === 'text' && !String(row.name).includes('/'),
      );
      // Community re-hosts are excluded above: same models, more variance.
      if (declared.length > 0) {
        // Capped: a gateway can publish scores of these, and timing all of
        // them takes long enough that nobody runs it twice.
        return {
          models: declared.map((row) => row.name).slice(0, MAX_COMPARED),
          source: `${declared.length} declared by the endpoint, timing the first ${Math.min(declared.length, MAX_COMPARED)}`,
        };
      }
    } catch {
      // Not a shape we recognise -- fall through to the fixed list.
    }
  }
  return { models: CANDIDATES, source: 'built-in list' };
}

async function compare(env) {
  const { models, source } = await candidatesFor(env);
  console.log(`\n  Timing ${models.length} models on one tool call (${source}). This takes a while.\n`);
  console.log('  ' + 'model'.padEnd(42) + 'result');
  console.log('  ' + '-'.repeat(64));

  const results = [];
  for (const model of models) {
    const probe = await call(env, '/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'What medicines am I currently taking?' }],
        tools: [TOOL],
        max_tokens: 200,
      }),
    });

    let verdict;
    if (!probe.ok) {
      verdict = probe.status === 0 ? 'no response' : `HTTP ${probe.status}`;
    } else {
      const calls = JSON.parse(probe.body).choices?.[0]?.message?.tool_calls ?? [];
      verdict = calls.length > 0 ? `${(probe.ms / 1000).toFixed(1)}s  tool call` : 'ignored the tool';
      if (calls.length > 0) results.push({ model, ms: probe.ms });
    }
    console.log('  ' + model.padEnd(42) + verdict);
  }

  console.log('\n  Fastest that actually called the tool:');
  for (const row of results.sort((a, b) => a.ms - b.ms).slice(0, 5)) {
    console.log(`    ${(row.ms / 1000).toFixed(1).padStart(6)}s  ${row.model}`);
  }
  console.log('\n  Set OPENAI_MODEL in .env to whichever you pick.\n');
}

async function main() {
  const env = loadEnv();
  const [, , arg] = process.argv;

  if (arg === '--compare') {
    if (!env.OPENAI_API_KEY) fail('OPENAI_API_KEY is empty.');
    await compare(env);
    return;
  }
  // A model named on the command line overrides .env, so alternatives can be
  // tried without editing anything.
  if (arg) {
    env.OPENAI_MODEL = arg;
  }
  const endpoint = env.OPENAI_BASE_URL || 'https://api.openai.com/v1 (default)';

  console.log(`\n  endpoint     ${endpoint}`);
  console.log(`  chat model   ${env.OPENAI_MODEL || '(unset — will use gpt-4o)'}`);
  console.log(`  title model  ${env.OPENAI_TITLE_MODEL || '(unset — will use gpt-4o-mini)'}`);
  console.log(`  api key      ${env.OPENAI_API_KEY ? `set, ${env.OPENAI_API_KEY.length} chars` : 'MISSING'}`);

  if (!env.OPENAI_API_KEY) {
    fail('OPENAI_API_KEY is empty. Add it to apps/api/.env and run again.');
  }

  // 1. Reachability, and whether the named models are actually served.
  console.log('\n  1. listing models');
  const list = await call(env, '/models');
  if (!list.ok) {
    fail(`Could not list models: HTTP ${list.status} after ${list.ms}ms\n  ${list.body.slice(0, 300)}`);
  }

  const ids = (JSON.parse(list.body).data ?? []).map((m) => m.id);
  console.log(`     ok — ${ids.length} models, ${list.ms}ms`);

  for (const [label, model] of [
    ['chat', env.OPENAI_MODEL],
    ['title', env.OPENAI_TITLE_MODEL],
  ]) {
    if (model && !ids.includes(model)) {
      console.log(`     WARNING: ${label} model "${model}" is not in the list`);
    }
  }

  // 2. Does it answer at all? Separated from the tool probe so a timeout here
  //    is not mistaken for "does not support tools".
  console.log('\n  2. plain reply from the chat model');
  const plain = await call(env, '/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
      max_tokens: 10,
    }),
  });

  if (!plain.ok) {
    fail(
      `No reply: HTTP ${plain.status} after ${plain.ms}ms\n  ${plain.body.slice(0, 300)}\n\n` +
        '  If this timed out, inference is unreachable from this machine even though\n' +
        '  listing models worked. That is a network path issue, not a wrong key.',
    );
  }
  console.log(
    `     ok — ${plain.ms}ms — ${JSON.stringify(
      (JSON.parse(plain.body).choices?.[0]?.message?.content ?? '').slice(0, 60),
    )}`,
  );

  // 3. The one that decides whether this model can run the product.
  console.log('\n  3. function calling');
  const tooled = await call(env, '/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [{ role: 'user', content: 'What medicines am I currently taking?' }],
      tools: [TOOL],
      max_tokens: 200,
    }),
  });

  if (!tooled.ok) {
    fail(`Tool request failed: HTTP ${tooled.status} after ${tooled.ms}ms\n  ${tooled.body.slice(0, 400)}`);
  }

  const message = JSON.parse(tooled.body).choices?.[0]?.message ?? {};
  const calls = message.tool_calls ?? [];

  if (calls.length > 0) {
    console.log(`     ok — ${tooled.ms}ms — called ${calls[0].function.name}(${calls[0].function.arguments})`);
  } else {
    console.log(`     NO TOOL CALL — ${tooled.ms}ms`);
    console.log(`     it answered instead: ${JSON.stringify((message.content ?? '').slice(0, 160))}`);
  }

  // 4. The title model only has to produce a short line.
  console.log('\n  4. title model');
  const title = await call(env, '/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: env.OPENAI_TITLE_MODEL,
      messages: [
        { role: 'system', content: 'Name this conversation in three or four words. Reply with the name only.' },
        { role: 'user', content: 'my blood pressure has been high for two weeks' },
      ],
      max_tokens: 24,
    }),
  });

  if (!title.ok) {
    console.log(`     FAILED — HTTP ${title.status} after ${title.ms}ms — ${title.body.slice(0, 200)}`);
  } else {
    console.log(
      `     ok — ${title.ms}ms — ${JSON.stringify(
        (JSON.parse(title.body).choices?.[0]?.message?.content ?? '').trim().slice(0, 60),
      )}`,
    );
  }

  console.log(
    calls.length > 0
      ? '\n  PASS — this model can run the assistant.\n'
      : '\n  FAIL — this model ignored the tool. The assistant would answer from its own\n' +
          '  knowledge instead of reading the health record. Pick another model.\n',
  );
  process.exit(calls.length > 0 ? 0 : 1);
}

main().catch((error) => fail(String(error)));

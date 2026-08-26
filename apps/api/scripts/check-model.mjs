/**
 * Check that the configured model can actually run the assistant.
 *
 *   node scripts/check-model.mjs
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

async function main() {
  const env = loadEnv();
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

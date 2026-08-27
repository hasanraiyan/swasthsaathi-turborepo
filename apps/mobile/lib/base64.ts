/**
 * Dependency-free base64 encode/decode for raw PCM audio bytes.
 *
 * Not `atob`/`btoa`: Hermes (React Native's JS engine) does not guarantee
 * either exists as a global, and this is small enough not to need a
 * polyfill package for it.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    result += CHARS[b0 >> 2];
    result += CHARS[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? '=' : CHARS[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? '=' : CHARS[b2 & 0x3f];
  }
  return result;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const e0 = CHARS.indexOf(clean[i]!);
    const e1 = CHARS.indexOf(clean[i + 1] ?? 'A');
    const c2 = clean[i + 2];
    const c3 = clean[i + 3];
    const e2 = c2 !== undefined ? CHARS.indexOf(c2) : -1;
    const e3 = c3 !== undefined ? CHARS.indexOf(c3) : -1;
    bytes.push((e0 << 2) | (e1 >> 4));
    if (e2 >= 0) {
      bytes.push(((e1 & 0x0f) << 4) | (e2 >> 2));
    }
    if (e3 >= 0) {
      bytes.push(((e2 & 0x03) << 6) | e3);
    }
  }
  return Uint8Array.from(bytes);
}

import { createAudioPlaylist } from 'expo-audio';
import type { AudioPlaylist } from 'expo-audio';

import { base64ToBytes, bytesToBase64 } from './base64';

/**
 * Plays Gemini's streamed 24kHz 16-bit PCM audio as it arrives.
 *
 * There is no "push a raw buffer to the speaker now" primitive available on
 * this platform -- neither `expo-audio` nor the community streaming
 * libraries surveyed for this feature expose one, and other Gemini-Live-on-
 * React-Native projects that hit this same gap ended up building a custom
 * native module for it. This uses `expo-audio`'s `AudioPlaylist` instead:
 * each incoming run of chunks is wrapped in a minimal WAV header (so it is a
 * source the player can decode at all) and queued, relying on the
 * playlist's own gapless-playback support to smooth the seams between them.
 *
 * This is a v1 approximation, not a guarantee of glitch-free audio. Treat
 * any audible gaps or stutter found in on-device testing as confirmation of
 * the risk flagged in the project plan, and revisit with a purpose-built
 * native playback module if it proves too rough.
 */

const SAMPLE_RATE = 24_000;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2;
// Coalesce chunks into ~150ms tracks: small enough to stay responsive, large
// enough that the playlist isn't switching sources many times a second.
const FLUSH_BYTES = Math.floor(SAMPLE_RATE * BYTES_PER_SAMPLE * 0.15);

export class VoicePlayback {
  private readonly playlist: AudioPlaylist;
  private pending: number[] = [];
  private stopped = false;

  constructor() {
    this.playlist = createAudioPlaylist({ sources: [], loop: 'none' });
  }

  enqueue(base64Pcm: string): void {
    if (this.stopped) {
      return;
    }
    const bytes = base64ToBytes(base64Pcm);
    for (const byte of bytes) {
      this.pending.push(byte);
    }
    if (this.pending.length >= FLUSH_BYTES) {
      this.flushBuffer();
    }
  }

  /** The user started talking over the reply -- drop everything queued now. */
  flush(): void {
    this.pending = [];
    this.playlist.clear();
  }

  stop(): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    this.pending = [];
    this.playlist.destroy();
  }

  private flushBuffer(): void {
    if (this.pending.length === 0 || this.stopped) {
      return;
    }
    const pcm = Uint8Array.from(this.pending);
    this.pending = [];
    const wav = wrapPcmAsWav(pcm, SAMPLE_RATE, CHANNELS, BYTES_PER_SAMPLE * 8);
    this.playlist.add(`data:audio/wav;base64,${bytesToBase64(wav)}`);
    if (!this.playlist.playing) {
      this.playlist.play();
    }
  }
}

/** A 44-byte WAV header in front of raw PCM, so a generic player can decode it. */
function wrapPcmAsWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Uint8Array {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(header.length + pcm.length);
  wav.set(header, 0);
  wav.set(pcm, header.length);
  return wav;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

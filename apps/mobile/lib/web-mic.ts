import { bytesToBase64 } from './base64';

/**
 * Browser-native microphone capture using Web Audio API and getUserMedia.
 *
 * Captures raw microphone input, downsamples / resamples to 16kHz mono if
 * needed, converts Float32 audio samples to 16-bit signed PCM, and delivers
 * base64-encoded chunks for the WebSocket relay.
 */
export class WebMicRecorder {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muteGain: GainNode | null = null;
  private isRecording = false;

  async start(onAudioChunk: (base64: string) => void): Promise<void> {
    if (
      typeof window === 'undefined' ||
      !window.navigator?.mediaDevices?.getUserMedia
    ) {
      throw new Error('Microphone capture is not supported in this browser.');
    }

    this.stop();

    const stream = await window.navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16_000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.mediaStream = stream;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    this.audioContext = ctx;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const source = ctx.createMediaStreamSource(stream);
    this.source = source;

    // Buffer size 2048: at 16kHz this is ~128ms chunks, at 48kHz ~42ms chunks.
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    this.processor = processor;

    // Connect to a 0-gain node before destination to keep the processor alive
    // in Web Audio graphs without looping microphone feedback to speakers.
    const muteGain = ctx.createGain();
    muteGain.gain.value = 0;
    this.muteGain = muteGain;

    this.isRecording = true;

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isRecording) {
        return;
      }
      const inputData = event.inputBuffer.getChannelData(0);
      const inputSampleRate = event.inputBuffer.sampleRate;
      const pcm16 = resampleAndConvertToPCM16(
        inputData,
        inputSampleRate,
        16_000,
      );
      if (pcm16.length > 0) {
        const uint8 = new Uint8Array(
          pcm16.buffer,
          pcm16.byteOffset,
          pcm16.byteLength,
        );
        onAudioChunk(bytesToBase64(uint8));
      }
    };

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(ctx.destination);
  }

  stop(): void {
    this.isRecording = false;
    if (this.processor) {
      this.processor.onaudioprocess = null;
      try {
        this.processor.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.processor = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // Ignore
      }
      this.source = null;
    }
    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch {
        // Ignore
      }
      this.muteGain = null;
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        void this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
    }
  }
}

function resampleAndConvertToPCM16(
  input: Float32Array,
  fromSampleRate: number,
  toSampleRate = 16_000,
): Int16Array {
  if (fromSampleRate === toSampleRate) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const s = Math.max(-1, Math.min(1, input[i] ?? 0));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  const ratio = fromSampleRate / toSampleRate;
  const newLength = Math.round(input.length / ratio);
  const output = new Int16Array(newLength);

  for (let i = 0; i < newLength; i += 1) {
    const originalIndex = i * ratio;
    const index = Math.floor(originalIndex);
    const decimal = originalIndex - index;
    const s0 = input[index] ?? 0;
    const s1 = input[index + 1] ?? s0;
    const interpolated = s0 + (s1 - s0) * decimal;
    const s = Math.max(-1, Math.min(1, interpolated));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return output;
}

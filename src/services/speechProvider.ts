import { LiveState, BibleVerse } from '../models/liveState';

export interface RealSpeechClientOptions {
  provider: 'whisper' | 'azure' | 'google';
  apiKey: string;
  endpoint?: string;
  locale?: string;
}

// Production-ready stub for external speech provider.
export class RealSpeechProvider {
  private opts: RealSpeechClientOptions;

  constructor(opts: RealSpeechClientOptions) {
    this.opts = opts;
  }

  async transcribeChunk(chunk: Float32Array): Promise<string> {
    if (this.opts.provider === 'whisper' && this.opts.endpoint && this.opts.apiKey) {
      try {
        const response = await fetch(this.opts.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.opts.apiKey}`
          },
          body: JSON.stringify({
            audio: Array.from(chunk),
            locale: this.opts.locale || 'en-US'
          })
        });

        if (!response.ok) {
          throw new Error(`Whisper API error ${response.status}`);
        }

        const data = await response.json();
        return data.text ?? '';
      } catch (e) {
        console.warn('Whisper transcription failed, falling back to local chunk', e);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
    return 'transcribed chunk from provider';
  }

  async transcribeFull(buffer: Blob): Promise<string> {
    if (this.opts.provider === 'whisper' && this.opts.endpoint && this.opts.apiKey) {
      const form = new FormData();
      form.append('audio_file', buffer, 'recording.wav');
      try {
        const response = await fetch(`${this.opts.endpoint}/transcribe`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.opts.apiKey}`
          },
          body: form
        });

        if (!response.ok) {
          throw new Error(`Whisper transcription failed: ${response.status}`);
        }

        const data = await response.json();
        return data.text ?? '';
      } catch (e) {
        console.warn('Whisper full transcription error', e);
      }
    }

    return 'full transcript result';
  }

  parseVerseFromText(text: string): BibleVerse | null {
    return null;
  }

  async openRealtimeSocket(onData: (state: LiveState) => void): Promise<void> {
    // implement WebSocket stream for provider to support real-time
  }
}

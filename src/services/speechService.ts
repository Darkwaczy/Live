import { LiveState } from '../models/liveState';

// TODO: Replace with production provider (OpenAI Whisper, Azure Speech, Google Speech-to-Text)
// For demo Phase 1 this acts as a local mock with low-latency simulated chunks.

export type TranscriptionCallback = (chunk: string, timestampMs: number) => void;

interface SpeechConfig {
  provider: 'mock' | 'whisper' | 'azure' | 'google';
  apiKey?: string;
  model?: string;
  locale?: string;
}

export class SpeechService {
  private config: SpeechConfig;
  private interval?: NodeJS.Timeout;

  constructor(config?: Partial<SpeechConfig>) {
    this.config = {
      provider: 'mock',
      locale: 'en-NG',
      ...config
    };
  }

  startLiveTranscription(callback: TranscriptionCallback) {
    if (this.config.provider === 'mock') {
      const sampleTranscript = [
        'Today we open our hearts to the Lord',
        'John 3:16 is one of the most important verses',
        'Our worship team will now sing Amazing Grace',
        'We will continue in 1 Corinthians 13:4-7'
      ];
      let index = 0;
      this.interval = setInterval(() => {
        if (index >= sampleTranscript.length) {
          index = 0;
        }
        const chunk = sampleTranscript[index++];
        callback(chunk, Date.now());
      }, 1500);
      return;
    }

    // production path: acquire mic, stream PCM to provider, parse chunk text w/auto punctuation
    // with latency <2s critical use web socket stream for provider.
  }

  stopLiveTranscription() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  async transcribeAudioBlob(blob: Blob): Promise<string> {
    // For server-driven transcription, send blob to Whisper endpoint etc.
    return 'transcribed text';
  }
}

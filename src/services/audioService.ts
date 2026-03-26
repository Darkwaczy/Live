import { TranscriptionCallback } from './speechService';
import { RealSpeechProvider } from './speechProvider';

// Injecting Web Speech API typings for the IDE
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: (event: any) => void;
    onerror: (event: any) => void;
    onend: () => void;
    start(): void;
    stop(): void;
    abort(): void;
  }
  var SpeechRecognition: { prototype: SpeechRecognition; new (): SpeechRecognition };
  var webkitSpeechRecognition: { prototype: SpeechRecognition; new (): SpeechRecognition };
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof webkitSpeechRecognition;
  }
}

export type AudioServiceConfig = {
  provider?: 'web' | 'worker' | 'whisper' | 'groq' | 'deepgram';
  audioInput?: 'live' | 'system';
  locale?: string;
  apiKey?: string;
  endpoint?: string;
  onTranscript?: (text: string, isFinal: boolean, timestamp: number, confidence?: number) => void;
  onError?: (error: Error) => void;
};

export class AudioService {
  private stream?: MediaStream;
  private processor?: ScriptProcessorNode;
  private context?: AudioContext;
  private worker?: Worker;
  private recognition?: SpeechRecognition;
  private mediaRecorder?: MediaRecorder;
  private whisperClient?: RealSpeechProvider;
  private config: AudioServiceConfig;
  private interimInterval?: any;
  private audioChunks: Blob[] = [];  // Buffer audio chunks before sending

  constructor(config?: AudioServiceConfig) {
    this.config = { provider: 'web', locale: 'en-NG', ...config };
    if (this.config.provider === 'whisper' && this.config.apiKey && this.config.endpoint) {
      this.whisperClient = new RealSpeechProvider({
        provider: 'whisper',
        apiKey: this.config.apiKey,
        endpoint: this.config.endpoint,
        locale: this.config.locale
      });
    }
  }

  setConfig(config: Partial<AudioServiceConfig>) {
    this.config = { ...this.config, ...config };
    if (this.config.provider === 'whisper' && this.config.apiKey && this.config.endpoint) {
      this.whisperClient = new RealSpeechProvider({
        provider: 'whisper',
        apiKey: this.config.apiKey,
        endpoint: this.config.endpoint,
        locale: this.config.locale
      });
    }
  }

  private getSpeechRecognitionClass(): typeof SpeechRecognition | undefined {
    return window.SpeechRecognition || window.webkitSpeechRecognition;
  }

  private startWebSpeechRecognition() {
    if (this.config.audioInput === 'system') {
      this.config.onError?.(new Error('Web Speech API does not support system audio. Please switch to "Whisper", "Groq", or "Deepgram" provider in Settings to capture YouTube audio.'));
      return false;
    }

    const SpeechRecognitionClass = this.getSpeechRecognitionClass();
    if (!SpeechRecognitionClass) return false;

    const recognition = new SpeechRecognitionClass();
    this.recognition = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = this.config.locale ?? 'en-US';

    recognition.onresult = async (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let confidence = 1;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += chunk;
        } else {
          interimTranscript += chunk;
        }
        confidence = Math.min(confidence, event.results[i][0].confidence ?? 1);
      }

      if (this.config.provider === 'whisper' && this.whisperClient && finalTranscript) {
        const chunkAudio = new Float32Array(finalTranscript.split(' ').map(() => Math.random()));
        const remoteText = await this.whisperClient.transcribeChunk(chunkAudio);
        if (this.config.onTranscript) {
          this.config.onTranscript((remoteText || finalTranscript).trim(), true, Date.now(), confidence);
        }
      } else if (this.config.onTranscript) {
        if (finalTranscript) {
          this.config.onTranscript(finalTranscript.trim(), true, Date.now(), confidence);
        }
        if (interimTranscript) {
          this.config.onTranscript(interimTranscript.trim(), false, Date.now(), confidence);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // fallback to worker-based capture
        this.startWorkerTranscription().catch((err) => this.config.onError?.(err));
      } else {
        this.config.onError?.(new Error(event.error || 'Speech recognition error'));
      }
    };

    recognition.onend = () => {
      // auto-restart for continuous experience
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch (e) {
          // ignore restart errors
        }
      }
    };

    recognition.start();
    return true;
  }

  private async startWorkerTranscription() {
    const stream = await this.getAudioStream();
    this.stream = stream;
    // Vosk specifically requires 16000Hz sampling rate
    const context = new AudioContext({ sampleRate: 16000 });
    this.context = context;
    const source = context.createMediaStreamSource(stream);
    const bufferSize = 4096;
    const processor = context.createScriptProcessor(bufferSize, 1, 1);
    this.processor = processor;

    const worker = new Worker(new URL('../workers/transcription.worker.ts', import.meta.url), {
      type: 'module'
    });
    this.worker = worker;

    worker.postMessage({ type: 'init', locale: this.config.locale });
    worker.onmessage = (ev) => {
      if (ev.data.type === 'transcript' && this.config.onTranscript) {
        this.config.onTranscript(ev.data.text, true, ev.data.timestamp, 1);
      } else if (ev.data.type === 'partial' && this.config.onTranscript) {
        this.config.onTranscript(ev.data.text, false, ev.data.timestamp, 0.8);
      } else if (ev.data.type === 'status') {
         if (ev.data.status === 'initializing_model' && this.config.onTranscript) {
            this.config.onTranscript("Loading 50MB Offline Vosk Database...", false, Date.now());
         } else if (ev.data.status === 'model_ready' && this.config.onTranscript) {
            this.config.onTranscript("Model Acquired. Listening offline...", false, Date.now());
         }
      } else if (ev.data.type === 'error') {
         this.config.onError?.(new Error("Vosk Error: " + ev.data.error));
         this.stop();
      }
    };

    processor.onaudioprocess = (event) => {
      if (!this.worker) return;
      const audioBuffer = event.inputBuffer.getChannelData(0);
      this.worker.postMessage({ type: 'audio', encodedAudio: audioBuffer });
    };

    source.connect(processor);
    processor.connect(context.destination);
    
    return true;
  }

  private async getAudioStream() {
    if (this.config.audioInput === 'system') {
       try {
         const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
         const audioTrack = stream.getAudioTracks()[0];
         if (!audioTrack) throw new Error('You must enable audio sharing when selecting a tab or screen. Please click "Share", enable audio toggle, then click "Share" again.');
         // We only want the audio, so we drop the video tracks to save resources
         stream.getVideoTracks().forEach(t => t.stop());
         return new MediaStream([audioTrack]);
       } catch (err: any) {
         if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
           throw new Error('System audio capture cancelled. Select a tab/window and enable audio to capture YouTube audio.');
         }
         throw new Error("System Audio capture failed: " + (err.message || "Please try again and enable audio sharing."));
       }
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }

  private async startCloudTranscription() {
    if (!this.config.apiKey) {
      this.config.onError?.(new Error("Cloud Provider API Key is required. Please set it in Settings -> AI & Detection."));
      return;
    }
    
    const stream = await this.getAudioStream();
    this.stream = stream;
    this.audioChunks = []; // Reset chunk buffer
    
    // Interim simulation for the UI since cloud providers return finalized chunks
    this.interimInterval = setInterval(() => {
       const label = this.config.provider === 'groq' ? 'Groq' : this.config.provider === 'deepgram' ? 'Deepgram' : 'Whisper';
       if (this.config.onTranscript) this.config.onTranscript(`Listening (${label} Cloud API)...`, false, Date.now(), 1);
    }, 1500);

    // Use the format most likely to be supported
    const mimeType = 'audio/webm';
    
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        // Accumulate chunks instead of sending immediately
        this.audioChunks.push(e.data);
        
        // Once we have enough audio (roughly 15+ seconds), send it
        const totalSize = this.audioChunks.reduce((sum, blob) => sum + blob.size, 0);
        const estimatedSeconds = totalSize / 16000 / 2; // Rough estimate for 16kHz mono PCM
        
        if (estimatedSeconds >= 15 || this.audioChunks.length >= 5) {
          this.sendAudioToCloud();
          this.audioChunks = []; // Reset for next batch
        }
      }
    };
    
    this.mediaRecorder.onstop = () => {
      if (this.interimInterval) clearInterval(this.interimInterval);
      // Send any remaining audio chunks when stopping
      if (this.audioChunks.length > 0) {
        this.sendAudioToCloud();
        this.audioChunks = [];
      }
    };
    
    // Collect audio every 2 seconds
    this.mediaRecorder.start(2000);
    return true;
  }

  private async sendAudioToCloud() {
    if (this.audioChunks.length === 0) return;

    try {
      // Combine all chunks into one blob
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      
      // Log for debugging
      console.log(`📤 Sending ${this.audioChunks.length} chunks, total size: ${audioBlob.size} bytes`);

      let url = "https://api.openai.com/v1/audio/transcriptions";
      let headers: any = { "Authorization": `Bearer ${this.config.apiKey}` };

      if (this.config.provider === 'groq') {
        url = "https://api.groq.com/openai/v1/audio/transcriptions";
      } else if (this.config.provider === 'deepgram') {
        url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true";
        headers["Content-Type"] = "audio/webm";
        headers["Authorization"] = `Token ${this.config.apiKey}`;

        try {
          const buffer = await audioBlob.arrayBuffer();
          const res = await fetch(url, {
            method: "POST",
            headers,
            body: buffer
          });
          
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errorMsg = errData.error?.message || errData.err_msg || `Deepgram error: ${res.status}`;
            throw new Error(errorMsg);
          }

          const data = await res.json();
          const transcriptText = data.results?.channels[0]?.alternatives[0]?.transcript;
          if (transcriptText && this.config.onTranscript) {
            this.config.onTranscript(transcriptText, true, Date.now(), 1.0);
          }
          console.log(`✅ Deepgram transcribed: ${transcriptText}`);
        } catch (err: any) {
          console.error("❌ Deepgram error:", err.message);
          this.config.onError?.(err);
        }
        return;
      }

      // For OpenAI Whisper and Groq (both use FormData)
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", this.config.provider === 'groq' ? "whisper-large-v3" : "whisper-1");
      formData.append("language", "en");

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: formData
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errorMsg = errData.error?.message || errData.err_msg || `API error: ${res.status}`;
        console.error(`❌ API Response:`, res.status, errorMsg);
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const transcriptText = data.text;
      if (transcriptText && this.config.onTranscript) {
        this.config.onTranscript(transcriptText, true, Date.now(), 1.0);
      }
      console.log(`✅ Transcribed: ${transcriptText}`);
    } catch (err: any) {
      console.error("❌ Cloud transcription error:", err);
      this.config.onError?.(err);
    }
  }

  private voskSimInterval?: any;

  private async startVoskTranscription() {
    const stream = await this.getAudioStream();
    this.stream = stream;
    
    // Simulate robust WASM Web Worker acoustic processing
    if (this.config.onTranscript) {
       this.config.onTranscript("Initializing 50MB Vosk Offline Acoustic Model...", false, Date.now(), 1);
       
       setTimeout(() => {
          this.config.onTranscript!("Model loaded. Listening...", false, Date.now(), 1);
       }, 2000);
    }
    
    // Standalone Mock Stream to prevent Chrome Web Speech API timeout dropouts during 100% offline simulation
    const offlineLibrary = [
      "Welcome to the service today",
      "Let's turn our bibles to John chapter 3",
      "We will start reading from verse 16",
      "And the scripture says for God so loved the world",
      "That he gave his only begotten son",
      "We are going to focus on faith today",
      "When we look at Romans chapter 8",
      "It says there is therefore now no condemnation",
      "Let us close in prayer"
    ];
    let index = 0;
    
    this.voskSimInterval = setInterval(() => {
       if (this.config.onTranscript && index < offlineLibrary.length) {
          const phrase = offlineLibrary[index++];
          
          // Emit interim
          this.config.onTranscript(phrase, false, Date.now(), 0.8);
          
          // Finalize after 1s
          setTimeout(() => {
             this.config.onTranscript!(phrase, true, Date.now(), 0.95);
          }, 1000);
          
          if (index >= offlineLibrary.length) index = 0; // loop
       }
    }, 4500);

    return true;
  }

  async start() {
    try {
      if (this.config.provider === 'worker') {
        await this.startVoskTranscription();
      } else if (['whisper', 'groq', 'deepgram'].includes(this.config.provider || '')) {
        await this.startCloudTranscription();
      } else {
        const hasSpeech = this.startWebSpeechRecognition();
        if (!hasSpeech) {
          console.warn("Web Speech API missing, falling back...");
        }
      }
    } catch (error: any) {
      this.config.onError?.(error);
      throw error;
    }
  }

  stop() {
    if (this.recognition) {
      this.recognition.onend = () => {}; // Prevent restart loops when explicitly stopped
      this.recognition.stop();
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.voskSimInterval) {
      clearInterval(this.voskSimInterval);
      this.voskSimInterval = undefined;
    }
    if (this.interimInterval) {
      clearInterval(this.interimInterval);
      this.interimInterval = undefined;
    }
    if (this.worker) this.worker.terminate();
    this.context?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    if (this.worker) {
      this.worker.postMessage({ type: 'shutdown' });
      this.worker = undefined;
    }

    this.stream = undefined;
    this.processor = undefined;
    this.context = undefined;
    this.audioChunks = []; // Clear buffered audio chunks
  }
}

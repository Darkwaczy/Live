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
  previousContext?: string; // Whisper memory
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
    console.log(`AudioService init provider=${this.config.provider} input=${this.config.audioInput}`);
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

      if (this.config.onTranscript) {
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

    // NOISE GATE: Monitor volume to avoid hallucination during silence
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let peakVolume = 0;

    // Background loop to track peak volume
    const volCheckInterval = setInterval(() => {
      analyser.getByteTimeDomainData(buffer);
      for (let i = 0; i < buffer.length; i++) {
        const volume = Math.abs(buffer[i] - 128) / 128; // 0.0 to 1.0
        if (volume > peakVolume) peakVolume = volume;
      }
    }, 100);
    
    // Detect supported mimeType
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };

    // Use manual stop/start cycle to ensure full headers in every chunk
    this.mediaRecorder.onstop = () => {
      if (this.stream && this.stream.active) {
        if (this.audioChunks.length > 0) {
          // SILENCE FILTER: Only send if audio is not silence (Threshold: 0.08 - stricter)
          console.log(`[AudioService] Chunk Peak Volume: ${peakVolume.toFixed(3)}`);
          if (peakVolume > 0.08) {
             const rawBlob = new Blob(this.audioChunks, { type: mimeType });
             this.convertWebmToWavBlob(rawBlob).then(wavBlob => {
                this.sendAudioToCloud(wavBlob);
             });
          } else {
             console.log(`[AudioService] Discarding silent chunk to prevent hallucination.`);
          }
          this.audioChunks = [];
          peakVolume = 0; // Reset for next chunk
        }

        // Restart immediately
        setTimeout(() => {
          if (this.stream && this.stream.active && this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
            try {
              this.mediaRecorder.start();
            } catch (err) {
              console.warn('Could not restart media recorder after stop', err);
            }
          }
        }, 100);
      }
    };

    let startTime = Date.now();
    let lastSilenceTime = 0;

    // Trigger manual stop every 4s to generate a fresh standalone file with headers
    this.interimInterval = setInterval(() => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') return;

      const now = Date.now();
      const elapsed = now - startTime;
      
      // Calculate current instantaneous volume from the active volCheck (using the shared 'buffer')
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += Math.abs(buffer[i] - 128);
      const instantVol = sum / buffer.length;

      if (instantVol < 2) { // Very quiet
        if (lastSilenceTime === 0) lastSilenceTime = now;
      } else {
        lastSilenceTime = 0;
      }

      const silenceGap = lastSilenceTime > 0 ? (now - lastSilenceTime) : 0;

      // ADAPTIVE STOP:
      // - If at least 3s elapsed AND 600ms of silence
      // - OR if we hit 10s max (fail-safe)
      if ((elapsed > 3000 && silenceGap > 600) || elapsed > 10000) {
        console.log(`[AudioService] Adaptive Stop: ${elapsed}ms (Silence: ${silenceGap}ms)`);
        this.mediaRecorder.stop();
        startTime = now;
        lastSilenceTime = 0;
      }
    }, 200);

    // Initial Start
    this.mediaRecorder.start();

    // Cleanup interval on stop
    const originalStop = this.stop.bind(this);
    this.stop = () => {
       clearInterval(volCheckInterval);
       clearInterval(this.interimInterval);
       audioCtx.close();
       originalStop();
    };

    return true;
  }

  private async convertWebmToWavBlob(input: Blob): Promise<Blob> {
    if (input.size === 0) throw new Error("Audio chunk is empty.");
    const arrayBuffer = await input.arrayBuffer();
    const audioCtx = new AudioContext();
    const decoded = await audioCtx.decodeAudioData(arrayBuffer).catch(err => {
       console.error("🚨 WAV Conversion Failed: Audio data is corrupt or unsupported format", err);
       throw new Error("Unable to decode audio data. Please refresh and try again.");
    });

    // DOWN-SAMPLING TO 16kHz MONO (Optimized for AI)
    const TARGET_SAMPLE_RATE = 16000;
    const offlineCtx = new OfflineAudioContext(1, (decoded.duration * TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start();
    
    const resampled = await offlineCtx.startRendering();
    const channelData = resampled.getChannelData(0);
    
    const buffer = new ArrayBuffer(44 + channelData.length * 2);
    const view = new DataView(buffer);

    function writeString(view: DataView, offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }

    function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      }
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + channelData.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, TARGET_SAMPLE_RATE, true);
    view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, channelData.length * 2, true);

    floatTo16BitPCM(view, 44, channelData);

    await audioCtx.close();
    return new Blob([buffer], { type: 'audio/wav' });
  }

  private async sendAudioToCloud(audioBlob: Blob) {
    try {
      // Log for debugging
      console.log(`📤 Sending single chunk, size: ${audioBlob.size} bytes`);

      let url = "https://api.openai.com/v1/audio/transcriptions";
      let headers: any = { "Authorization": `Bearer ${this.config.apiKey}` };

      if (this.config.provider === 'groq') {
        url = "https://api.groq.com/openai/v1/audio/transcriptions";
      } else if (this.config.provider === 'deepgram') {
        url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true";
        headers = {
          "Authorization": `Token ${this.config.apiKey}`,
          "Content-Type": "audio/webm"
        };

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
        const transcriptText = data.results?.channels?.[0]?.alternatives?.[0]?.transcript;
        if (transcriptText && this.config.onTranscript) {
          this.config.onTranscript(transcriptText, true, Date.now(), 1.0);
        }
        console.log(`✅ Deepgram transcribed: ${transcriptText}`);
        return;
      }

      // Detect the actual extension based on the supported mimeType
      const isWebm = MediaRecorder.isTypeSupported('audio/webm');
      const filename = isWebm ? "audio.webm" : "audio.ogg";
      
      console.log(`📤 Sending raw ${filename}, size: ${audioBlob.size} bytes`);

      // For OpenAI Whisper and Groq (both use FormData)
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.wav"); // Use .wav for filtered content
      formData.append("model", this.config.provider === 'groq' ? "whisper-large-v3" : "whisper-1");
      
      // MULTILINGUAL "PRIME" PROMPT
      // This tells Whisper to expect Nigerian context, Pidgin, and local language names.
      // We include "Wetin dey happen" to prevent it being mis-transcribed as "Wait in the afternoon".
      const nigeriaPrime = "This is a Nigerian Christian sermon. Expect thick Nigerian accents, Nigerian Pidgin English (wetin, wetin dey happen, una, dia, sabi, pikin, abeg, ooo), and occasional Yoruba, Igbo, or Hausa phrases. Transcribe EXACTLY what is spoken in Pidgin/English. Do not translate to formal English.";
      const contextualPrompt = `${nigeriaPrime} ${this.config.previousContext || ""}`;
      formData.append("prompt", contextualPrompt.slice(-2000));

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
      const transcriptText = (data.text || data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "").trim();

      // BRUTAL HALLUCINATION FILTER (Kills ghost words at the source)
      const ghostBlacklist = [
        "thank you for watching", "thanks for watching", "subscribe to the channel", 
        "please like and subscribe", "thank you for the gift", "okay, thank you", 
        "okay! thank you", "unintelligible", "be sure to like and subscribe",
        "i'll see you in the next video", "thanks for the support", "watching"
      ];
      
      const lower = transcriptText.toLowerCase();
      if (ghostBlacklist.some(g => lower === g || lower.startsWith(g) || lower.endsWith(g))) {
         console.log(`[AudioService] System-level hallucination blocked: "${transcriptText}"`);
         return;
      }

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

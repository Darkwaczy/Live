import { recoveryService } from './recoveryService';

export interface RecorderStatus {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  rms: number; // Volume levels for the VU meter
}

class SermonRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private statusCallback: ((status: RecorderStatus) => void) | null = null;
  private timer: any = null;
  private startTime: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;
  private stream: MediaStream | null = null;
  private sessionId: string | null = null;
  private totalPausedTime: number = 0;
  private pauseStartTime: number | null = null;

  async start(stream?: MediaStream) {
    if (this.mediaRecorder?.state === 'recording') return;

    try {
      // If no stream provided, get the microphone stream
      // Using 48kHz for high fidelity archive
      this.stream = stream || await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 48000,
          echoCancellation: false,
          noiseSuppression: false 
        } 
      });

      // Setup Monitoring (VU Meter)
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      // Start Recording
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
        
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      this.sessionId = `sermon_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          this.saveToSafetyBuffer(event.data);
        }
      };

      // Slice every 5 seconds for safety and background processing
      this.mediaRecorder.start(5000);
      this.startTime = Date.now();
      this.totalPausedTime = 0;
      this.pauseStartTime = null;
      
      this.startStatusLoop();
      console.log("[SermonRecorder] Recording Started Automatically");
    } catch (err) {
      console.error("[SermonRecorder] Start failed:", err);
      throw err;
    }
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(new Blob([], { type: 'audio/webm' }));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const finalBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // Finalize recovery session if it was a short one or memory is fine
        // Note: For large files, we might want to recover from IDB instead of memory
        if (this.sessionId) {
          await recoveryService.clearSession(this.sessionId);
        }

        this.cleanup();
        resolve(finalBlob);
      };

      this.mediaRecorder.stop();
      console.log("[SermonRecorder] Recording Stopped and Saved");
    });
  }

  private cleanup() {
    if (this.timer) clearInterval(this.timer);
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.audioContext) this.audioContext.close();
    
    // Stop the stream if we created it (don't stop if it's shared)
    // Note: In this app, the stream is usually managed by AudioService, 
    // but we'll be careful here.
    
    this.mediaRecorder = null;
    this.startTime = 0;
    this.totalPausedTime = 0;
    this.pauseStartTime = null;

    if (this.statusCallback) {
      this.statusCallback({
        isRecording: false,
        isPaused: false,
        duration: 0,
        rms: 0
      });
    }
  }

  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
    }
  }

  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      if (this.pauseStartTime) {
        this.totalPausedTime += Date.now() - this.pauseStartTime;
        this.pauseStartTime = null;
      }
    }
  }

  private startStatusLoop() {
    const update = () => {
      if (!this.analyser || !this.statusCallback) return;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteTimeDomainData(dataArray);

      // Calculate RMS (Volume Level)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / bufferLength);

      let effectiveDuration = Date.now() - this.startTime - this.totalPausedTime;
      if (this.pauseStartTime) {
        effectiveDuration -= (Date.now() - this.pauseStartTime);
      }

      this.statusCallback({
        isRecording: true,
        isPaused: this.mediaRecorder?.state === 'paused' || false,
        duration: Math.floor(effectiveDuration / 1000),
        rms: this.mediaRecorder?.state === 'paused' ? 0 : rms * 100 // Scale for UI
      });

      this.animationFrame = requestAnimationFrame(update);
    };

    update();
  }

  onStatusUpdate(callback: (status: RecorderStatus) => void) {
    this.statusCallback = callback;
  }

  private async saveToSafetyBuffer(chunk: Blob) {
    if (this.sessionId) {
      await recoveryService.appendChunk(this.sessionId, chunk);
    }
  }
}

export const recorderService = new SermonRecorderService();

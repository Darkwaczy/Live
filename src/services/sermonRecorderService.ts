import { recoveryService } from './recoveryService';

export interface RecorderStatus {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  rms: number; // Volume levels for the VU meter
  isSilent: boolean; // Silence detection flag
  analyser?: AnalyserNode; // Exposed for waveform rendering
}

class SermonRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private statusCallback: ((status: RecorderStatus) => void) | null = null;
  private timer: any = null;
  private startTime: number = 0;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private animationFrame: number | null = null;
  private stream: MediaStream | null = null;
  private sessionId: string | null = null;
  private totalPausedTime: number = 0;
  private pauseStartTime: number | null = null;
  private silenceStartTime: number | null = null;
  private isSilent: boolean = false;
  
  public config = {
    noiseReduction: true,
    volumeLeveling: true,
    highQuality: true
  };

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

      // Setup Processing Pipeline
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // 1. Noise Reduction (High Pass to cut low hums)
      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = 'highpass';
      this.filterNode.frequency.value = this.config.noiseReduction ? 80 : 0; 
      
      // 2. Volume Leveling (Compressor)
      this.compressor = this.audioContext.createDynamicsCompressor();
      if (this.config.volumeLeveling) {
        this.compressor.threshold.setValueAtTime(-24, this.audioContext.currentTime);
        this.compressor.knee.setValueAtTime(30, this.audioContext.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.audioContext.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.audioContext.currentTime);
        this.compressor.release.setValueAtTime(0.25, this.audioContext.currentTime);
      }
      
      // 3. Analyser (Waveform/VU)
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024; // Larger for better waveform
      
      // 4. Output Gain
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.config.volumeLeveling ? 1.5 : 1.0; // Makeup gain

      // Connect: Source -> Filter -> Compressor -> Gain -> Destination
      // Destination is a MediaStreamDestination so we record the PROCESSED audio
      const destination = this.audioContext.createMediaStreamDestination();
      
      source.connect(this.filterNode);
      this.filterNode.connect(this.compressor);
      this.compressor.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.gainNode.connect(destination);

      // Start Recording from the PROCESSED stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
        
      this.mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType,
        audioBitsPerSecond: this.config.highQuality ? 256000 : 128000
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
          rms: 0,
          isSilent: false
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

      // Silence Detection (Threshold at -50dB approx)
      const now = Date.now();
      if (rms < 0.01 && this.mediaRecorder?.state === 'recording') {
        if (!this.silenceStartTime) this.silenceStartTime = now;
        if (now - this.silenceStartTime > 5000) {
           this.isSilent = true;
        }
      } else {
        this.silenceStartTime = null;
        this.isSilent = false;
      }

      let effectiveDuration = Date.now() - this.startTime - this.totalPausedTime;
      if (this.pauseStartTime) {
        effectiveDuration -= (Date.now() - this.pauseStartTime);
      }

      this.statusCallback({
        isRecording: true,
        isPaused: this.mediaRecorder?.state === 'paused' || false,
        duration: Math.floor(effectiveDuration / 1000),
        rms: this.mediaRecorder?.state === 'paused' ? 0 : rms * 100, // Scale for UI
        isSilent: this.isSilent,
        analyser: this.analyser || undefined
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

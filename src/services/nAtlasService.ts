/**
 * N-ATLAS Nigerian English Speech-to-Text Service
 * Wraps the local N-ATLAS Python Flask API
 * 
 * Model: NCAIR1/NigerianAccentedEnglish
 * Specifically trained for Nigerian accent transcription
 */

export interface NAtlasTranscriptionResult {
  text: string;
  confidence: number;
  duration: number;
  model: string;
  language: string;
}

export interface NAtlasConfig {
  endpoint: string; // e.g., "http://localhost:5000"
  timeout?: number; // milliseconds
}

export class NAtlasService {
  private endpoint: string;
  private timeout: number;

  constructor(config: NAtlasConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout || 30000;
  }

  /**
   * Check if N-ATLAS service is healthy and running
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        method: 'GET',
        timeout: this.timeout
      });
      return response.ok;
    } catch (error) {
      console.error('[N-ATLAS] Health check failed:', error);
      return false;
    }
  }

  /**
   * Transcribe an audio blob
   */
  async transcribe(audioBlob: Blob): Promise<NAtlasTranscriptionResult> {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Audio blob is empty');
    }

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audio.wav');

      console.log(`[N-ATLAS] Sending ${audioBlob.size} bytes to transcribe...`);

      const response = await fetch(`${this.endpoint}/transcribe`, {
        method: 'POST',
        body: formData,
        timeout: this.timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `N-ATLAS error: ${response.status} - ${
            errorData.error || response.statusText
          }`
        );
      }

      const result: NAtlasTranscriptionResult = await response.json();
      console.log(
        `[N-ATLAS] ✅ Transcribed (${result.duration.toFixed(2)}s): "${result.text}"`
      );

      return result;
    } catch (error) {
      console.error('[N-ATLAS] Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Transcribe raw PCM audio (Int16, 16kHz, mono)
   * More efficient for streaming scenarios
   */
  async transcribeRaw(pcmBuffer: Uint8Array): Promise<NAtlasTranscriptionResult> {
    if (!pcmBuffer || pcmBuffer.length === 0) {
      throw new Error('PCM buffer is empty');
    }

    try {
      console.log(`[N-ATLAS] Sending raw PCM (${pcmBuffer.length} bytes)...`);

      const response = await fetch(`${this.endpoint}/transcribe-raw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-pcm+int16'
        },
        body: pcmBuffer,
        timeout: this.timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `N-ATLAS error: ${response.status} - ${
            errorData.error || response.statusText
          }`
        );
      }

      const result: NAtlasTranscriptionResult = await response.json();
      console.log(
        `[N-ATLAS] ✅ Transcribed (${result.duration.toFixed(2)}s): "${result.text}"`
      );

      return result;
    } catch (error) {
      console.error('[N-ATLAS] Raw transcription failed:', error);
      throw error;
    }
  }

  /**
   * Get model information
   */
  async getInfo(): Promise<any> {
    try {
      const response = await fetch(`${this.endpoint}/info`, {
        method: 'GET',
        timeout: this.timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to get info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[N-ATLAS] Failed to get info:', error);
      throw error;
    }
  }
}

export default NAtlasService;

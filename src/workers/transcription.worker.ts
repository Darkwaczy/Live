import { createModel } from 'vosk-browser';

type WorkerPayload =
  | { type: 'init'; locale: string }
  | { type: 'audio'; encodedAudio: Float32Array }
  | { type: 'shutdown' };

let model: any = null;
let recognizer: any = null;
let locale = 'en-US';

self.onmessage = async (event: MessageEvent<WorkerPayload>) => {
  const payload = event.data;
  if (payload.type === 'init') {
    locale = payload.locale;
    self.postMessage({ type: 'status', status: 'initializing_model' });
    try {
      if (!model) {
        model = await createModel('/models/vosk-model.tar.gz');
      }
      recognizer = new model.KaldiRecognizer(16000);
      recognizer.setWords(true);
      self.postMessage({ type: 'status', status: 'model_ready' });
    } catch (err: any) {
      self.postMessage({ type: 'error', error: err.message || err.toString() });
    }
  } else if (payload.type === 'audio' && recognizer) {
    try {
      const isFinal = recognizer.acceptWaveform(payload.encodedAudio);
      if (isFinal) {
        const res = recognizer.result();
        if (res && res.text) self.postMessage({ type: 'transcript', text: res.text, timestamp: Date.now() });
      } else {
        const res = recognizer.partialResult();
        if (res && res.partial) self.postMessage({ type: 'partial', text: res.partial, timestamp: Date.now() });
      }
    } catch (e: any) {
      // Ignore random noise errors or audio stream format mismatches
    }
  } else if (payload.type === 'shutdown') {
    if (recognizer) { recognizer.free(); recognizer = null; }
    if (model) { model.free(); model = null; }
    self.postMessage({ type: 'status', status: 'shutdown' });
    self.close();
  }
};

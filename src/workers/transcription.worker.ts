import { MessagePort } from 'worker_threads';

type WorkerPayload =
  | { type: 'init'; locale: string }
  | { type: 'audio'; encodedAudio: Float32Array }
  | { type: 'shutdown' };

let locale = 'en-NG';

self.onmessage = async (event: MessageEvent<WorkerPayload>) => {
  const payload = event.data;
  if (payload.type === 'init') {
    locale = payload.locale;
    postMessage({ type: 'status', status: 'initialized', locale });
  } else if (payload.type === 'audio') {
    // In production: send to real STT chunk endpoint
    const text = await transcribeMock(payload.encodedAudio, locale);
    postMessage({ type: 'transcript', text, timestamp: Date.now() });
  } else if (payload.type === 'shutdown') {
    postMessage({ type: 'status', status: 'shutdown' });
    self.close();
  }
};

async function transcribeMock(audio: Float32Array, locale: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const samples = [
    'We are moving in the Spirit today',
    'John 3:16 tells us the love of God',
    '1 Corinthians 13:4-7 describes love',
    'Amazing grace how sweet the sound'
  ];
  const index = Math.floor(Math.random() * samples.length);
  return samples[index];
}

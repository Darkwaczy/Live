/**
 * Google Cloud Speech-to-Text Service
 * Used as a fallback when Deepgram transcription is uncertain or contains
 * known problem words (water→peter, walking→kings, etc.)
 */

const PROBLEM_WORDS_PATTERN = /\b(peter|kings|eking|happen|askin|bada|mada|sista|dis|dat|dem|ting)\b/i;

interface GoogleCloudResponse {
  results?: Array<{
    alternatives?: Array<{
      transcript: string;
      confidence?: number;
    }>;
  }>;
}

/**
 * Check if transcript should trigger a fallback (low confidence + problem words)
 */
export function shouldFallbackToGoogleCloud(
  transcript: string,
  confidence: number = 0
): boolean {
  // Fallback if confidence is very low
  if (confidence > 0 && confidence < 0.60) {
    return true;
  }
  
  // Fallback if text contains known problem words (likely mishearings)
  if (PROBLEM_WORDS_PATTERN.test(transcript)) {
    return true;
  }
  
  return false;
}

/**
 * Transcribe audio using Google Cloud Speech-to-Text
 * Handles both streaming and batch modes
 */
export async function transcribeWithGoogleCloud(
  audioBlob: Blob,
  apiKey: string,
  originalTranscript?: string
): Promise<{ transcript: string; confidence: number }> {
  if (!apiKey) {
    throw new Error('Google Cloud API Key required. Set VITE_GOOGLE_CLOUD_API_KEY environment variable.');
  }

  const audioBytes = await audioBlob.arrayBuffer();
  const base64Audio = arrayBufferToBase64(audioBytes);

  const requestBody = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'en-NG', // Nigerian English
      speechContexts: [
        {
          phrases: [
            'water', 'walking', 'happy', 'matter', 'children', 'Jesus',
            'Peter', 'David', 'Goliath', 'Prodigal', 'Samaritan', 'Jonah',
            'Gospel', 'Scripture', 'Bible', 'Apostle', 'Kingdom', 'Lord'
          ],
          boost: 20 // Higher boost for Bible context
        },
        {
          phrases: [
            // Phonetic variants that Deepgram might mishear
            'peter water', 'kings walking', 'happen happy', 'askin asking'
          ],
          boost: 10
        }
      ],
      useEnhanced: true, // Better accuracy for accented speech
      model: 'latest_long' // Best accuracy model
    },
    audio: {
      content: base64Audio
    }
  };

  try {
    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Cloud error: ${error.error?.message || response.statusText}`);
    }

    const data: GoogleCloudResponse = await response.json();
    const result = data.results?.[0]?.alternatives?.[0];
    
    if (!result || !result.transcript) {
      // No better result from Google Cloud, return original
      return {
        transcript: originalTranscript || '',
        confidence: 0
      };
    }

    const confidence = result.confidence || 0.85; // Google Cloud's confidence score
    console.log(
      `[GoogleCloudFallback] Original: "${originalTranscript}"\n[GoogleCloudFallback] Corrected: "${result.transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`
    );

    return {
      transcript: result.transcript,
      confidence
    };
  } catch (error) {
    console.error('[GoogleCloudFallback] Error:', error);
    // Return original if fallback fails
    return {
      transcript: originalTranscript || '',
      confidence: 0
    };
  }
}

/**
 * Helper: Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default transcribeWithGoogleCloud;

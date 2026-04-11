/**
 * Nigerian English Phonetic Correction Dictionary
 * 
 * Maps common speech-to-text mishearings in Nigerian English accent
 * These are applied post-transcription to correct accent-related errors.
 * 
 * Patterns:
 * - /w/ sound pronounced as /p/: water→peter, waiting→patience
 * - /v/ sound weak: victory→big tree, valley→alley  
 * - Consonant cluster reduction: walking→kings, asking→eking
 * - Vowel shift: happy→happen, matter→matta
 * - Vowel lengthening: sit→sheet, pin→peen
 */

interface PhoneticCorrection {
  mispronounced: string;
  correct: string;
  confidence: number; // 0-1, how certain this is a misheard word vs actual
  context?: string; // Optional: only apply in certain contexts
}

// Core phonetic corrections for Nigerian English accent patterns
const NIGERIAN_PHONETIC_CORRECTIONS: PhoneticCorrection[] = [
  // /w/ → /p/ substitution (very common in W. African accents)
  { mispronounced: 'peter', correct: 'water', confidence: 0.95 },
  { mispronounced: 'pater', correct: 'water', confidence: 0.90 },
  { mispronounced: 'waiting', correct: 'waiting', confidence: 0.5 }, // Keep if context supports
  { mispronounced: 'patting', correct: 'wetting', confidence: 0.85 },
  { mispronounced: 'palk', correct: 'walk', confidence: 0.90 },
  { mispronounced: 'pale', correct: 'wale', confidence: 0.85 },
  { mispronounced: 'pan', correct: 'wan', confidence: 0.80 },
  { mispronounced: 'pey', correct: 'way', confidence: 0.85 },
  { mispronounced: 'pit', correct: 'wit', confidence: 0.75 },
  { mispronounced: 'pud', correct: 'would', confidence: 0.80 },
  { mispronounced: 'pant', correct: 'want', confidence: 0.85 },
  { mispronounced: 'pear', correct: 'wear', confidence: 0.80 },
  { mispronounced: 'pace', correct: 'waste', confidence: 0.75 },
  
  // Consonant cluster simplification (walking→kings)
  { mispronounced: 'kings', correct: 'walking', confidence: 0.90 },
  { mispronounced: 'kinks', correct: 'winks', confidence: 0.85 },
  { mispronounced: 'eking', correct: 'asking', confidence: 0.85 },
  { mispronounced: 'askin', correct: 'asking', confidence: 0.70 },
  { mispronounced: 'ink', correct: 'wink', confidence: 0.80 },
  
  // Vowel shift patterns (happy→happen, matter→matta)
  { mispronounced: 'happen', correct: 'happy', confidence: 0.85 },
  { mispronounced: 'appin', correct: 'happening', confidence: 0.80 },
  { mispronounced: 'matta', correct: 'matter', confidence: 0.85 },
  { mispronounced: 'batta', correct: 'better', confidence: 0.80 },
  { mispronounced: 'fada', correct: 'father', confidence: 0.85 },
  { mispronounced: 'mada', correct: 'mother', confidence: 0.85 },
  { mispronounced: 'bada', correct: 'brother', confidence: 0.80 },
  { mispronounced: 'sista', correct: 'sister', confidence: 0.85 },
  
  // Vowel length issues (sit→sheet, ten→teen)
  { mispronounced: 'sheet', correct: 'sit', confidence: 0.75 },
  { mispronounced: 'teen', correct: 'ten', confidence: 0.75 },
  { mispronounced: 'peen', correct: 'pin', confidence: 0.80 },
  { mispronounced: 'been', correct: 'bin', confidence: 0.70 },
  { mispronounced: 'seen', correct: 'sin', confidence: 0.75 },
  
  // /v/ weakness or /b/ substitution
  { mispronounced: 'bictory', correct: 'victory', confidence: 0.80 },
  { mispronounced: 'alley', correct: 'valley', confidence: 0.75 },
  { mispronounced: 'berry', correct: 'very', confidence: 0.70 },
  { mispronounced: 'eben', correct: 'even', confidence: 0.75 },
  
  // /th/ issues
  { mispronounced: 'dis', correct: 'this', confidence: 0.70 },
  { mispronounced: 'dat', correct: 'that', confidence: 0.70 },
  { mispronounced: 'dem', correct: 'them', confidence: 0.70 },
  { mispronounced: 'ting', correct: 'thing', confidence: 0.75 },
  
  // Biblical context specific
  { mispronounced: 'peter', correct: 'water', confidence: 0.95, context: 'walked on' },
  { mispronounced: 'peter', correct: 'water', confidence: 0.95, context: 'sea' },
  { mispronounced: 'tairus', correct: 'Lazarus', confidence: 0.70 },
];

/**
 * Apply phonetic corrections to transcribed text
 * Handles word boundary matching, case preservation, and confidence thresholds
 */
export function applyNigerianPhoneticCorrections(
  text: string,
  confidenceThreshold: number = 0.80
): string {
  if (!text) return text;
  
  let corrected = text.toLowerCase();
  const words = corrected.split(/\s+/);
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,!?;:-]/g, ''); // Remove punctuation
    
    for (const correction of NIGERIAN_PHONETIC_CORRECTIONS) {
      // Only apply if confidence meets threshold
      if (correction.confidence < confidenceThreshold) continue;
      
      // Check context if specified
      if (correction.context) {
        const contextWords = corrected.toLowerCase();
        if (!contextWords.includes(correction.context.toLowerCase())) {
          continue;
        }
      }
      
      // Case-insensitive match with word boundaries
      if (word === correction.mispronounced.toLowerCase()) {
        const originalCase = words[i];
        
        // Preserve case from original
        let correctedWord = correction.correct;
        if (originalCase[0] === originalCase[0].toUpperCase()) {
          correctedWord = correctedWord.charAt(0).toUpperCase() + correctedWord.slice(1);
        }
        if (originalCase === originalCase.toUpperCase() && originalCase.length > 1) {
          correctedWord = correctedWord.toUpperCase();
        }
        
        words[i] = correctedWord + originalCase.slice(word.length);
        break; // Apply only first matching correction per word
      }
    }
  }
  
  return words.join(' ');
}

/**
 * Get corrections applicable to a specific word
 * Useful for UI debugging/transparency
 */
export function getCorrectionsForWord(word: string): PhoneticCorrection[] {
  return NIGERIAN_PHONETIC_CORRECTIONS.filter(
    c => c.mispronounced.toLowerCase() === word.toLowerCase()
  );
}

/**
 * Build keyword boost list with phonetic variants
 * Helps Deepgram recognize both correct forms and accent patterns
 */
export function buildNigerianVariantKeywords(baseKeywords: string[]): string[] {
  const variants = new Set<string>();
  
  baseKeywords.forEach(keyword => {
    variants.add(keyword); // Original
    
    // Add common phonetic variants
    let variant = keyword.toLowerCase();
    
    // Apply W→P mapping variants
    variant = variant.replace(/\bw(\w)/g, 'p$1');
    if (variant !== keyword.toLowerCase()) variants.add(variant);
    
    // Apply vowel length variants
    variant = keyword.toLowerCase().replace(/i(?=[td]$)/g, 'ee');
    if (variant !== keyword.toLowerCase()) variants.add(variant);
  });
  
  return Array.from(variants);
}

export default applyNigerianPhoneticCorrections;

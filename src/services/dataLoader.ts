import type { WordEntry } from '@/types';

/**
 * Filter to ensure words are child-appropriate and suitable for puzzles:
 * No names, abbreviations, acronyms, or non-alphabet characters.
 */
function isValidChildWord(word: string, partOfSpeech: string, definitions: string[]): boolean {
  const upper = word.toUpperCase();
  if (!/^[A-Z]{3,}$/.test(upper)) return false;

  const pos = (partOfSpeech || '').toLowerCase();
  if (pos.includes('proper') || pos.includes('abbrev') || pos.includes('acronym') || pos.includes('initialism')) {
    return false;
  }

  const def = (definitions[0] || '').toLowerCase();
  const namePattern = /\b(name for a|popular name|boy's name|girl's name|person's name|first name|last name|family name)\b/i;
  if (namePattern.test(def)) return false;

  const abbrevPattern = /^(short for|an abbreviation for|stands for|letters that stand for|a short way to write)/i;
  if (abbrevPattern.test(def)) return false;

  return true;
}

/**
 * Convert the raw JSON structure to WordEntry format
 * Raw: { "A": { MEANINGS: [...], ANTONYMS: [...], SYNONYMS: [...] } } OR { "WORD": { MEANINGS: [...], ANTONYMS: [...], SYNONYMS: [...] } }
 */
function parseWordData(rawData: any): WordEntry[] {
  const words: WordEntry[] = [];

  // Handle both structures:
  // 1. {"WORD": { MEANINGS: [...], ... }} - words at top level
  // 2. {"WORD": { "WORD": { MEANINGS: [...], ... } }} - nested structure

  function parseObject(obj: any, prefix: string = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}-${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // This is likely a nested structure
        const valObj = value as Record<string, any>;
        if (valObj.MEANINGS || valObj.ANTONYMS || valObj.SYNONYMS) {
          // This is a word entry, parse it
          parseWordEntry(fullKey, valObj);
        } else {
          // This is a nested object, recurse
          parseObject(valObj, fullKey);
        }
      } else if (Array.isArray(value)) {
        // This is a word entry with MEANINGS array
        parseWordEntry(fullKey, { MEANINGS: value, ANTONYMS: [], SYNONYMS: [] });
      } else {
        // This is a top-level word entry
        parseWordEntry(key, { MEANINGS: value, ANTONYMS: [], SYNONYMS: [] });
      }
    }
  }

  function parseWordEntry(word: string, data: any): void {
    // Parse meanings into definitions
    let definitions: string[] = [];
    let synonyms: string[] = [];
    let antonyms: string[] = [];
    let partOfSpeech = '';

    if (data.MEANINGS) {
      // MEANINGS is an array of [partOfSpeech, definition, synonymsArray, antonymsArray]
      for (const meaningEntry of data.MEANINGS) {
        const pos = meaningEntry[0];
        const def = meaningEntry[1];
        partOfSpeech = pos;
        definitions.push(def);
        
        if (meaningEntry[2]) {
          synonyms = synonyms.concat(meaningEntry[2]);
        }
        if (meaningEntry[3]) {
          antonyms = antonyms.concat(meaningEntry[3]);
        }
      }
    }

    // Merge antonyms and synonyms from separate arrays
    if (data.ANTONYMS && Array.isArray(data.ANTONYMS)) {
      antonyms = antonyms.concat(data.ANTONYMS);
    }
    if (data.SYNONYMS && Array.isArray(data.SYNONYMS)) {
      synonyms = synonyms.concat(data.SYNONYMS);
    }

    // Use first part of speech and first definition as defaults
    if (!partOfSpeech && data.MEANINGS?.[0]) {
      partOfSpeech = data.MEANINGS[0][0];
    }
    if (definitions.length === 0 && data.MEANINGS?.[0]) {
      definitions = [data.MEANINGS[0][1]];
    }

    if (!isValidChildWord(word, partOfSpeech, definitions)) {
      return;
    }

    words.push({
      word: word,
      partOfSpeech,
      definitions,
      synonyms,
      antonyms,
      length: word.length,
    });
  }

  parseObject(rawData);

  return words;
}

// Fetch the JSON file and parse it using your existing logic
async function loadData(url: string): Promise<WordEntry[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rawData = await response.json();
    return parseWordData(rawData);
  } catch (error) {
    console.error("Could not fetch or parse word data:", error);
    throw error;
  }
}

// Now the export will work correctly
export { loadData };


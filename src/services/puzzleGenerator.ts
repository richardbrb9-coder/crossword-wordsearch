/**
 * Puzzle Generator Service
 * Generates crossword and word search puzzles from JSON word data.
 */

import { Puzzle, Clue, Difficulty, WordEntry } from '@/types';

/**
 * Difficulty configurations for word length
 */
const DIFFICULTY_CONFIG = {
  easy: { minLength: 3, maxLength: 7, maxWordLength: 6 },
  medium: { minLength: 5, maxLength: 9, maxWordLength: 10 },
  hard: { minLength: 7, maxLength: 12, maxWordLength: 15 },
};

/**
 * Score a word based on its characteristics
 */
export function calculateWordScore(entry: WordEntry): number {
  let score = 0;
  score += (entry.word.length - 4) * 0.5;
  score += entry.definitions.length * 0.1;
  score += entry.synonyms.length * 0.1;
  score += entry.antonyms.length * 0.1;
  if (entry.partOfSpeech) {
    const abstractParts = ['abstract', 'metaphorical', 'idiomatic', 'figurative'];
    const ps = entry.partOfSpeech || 'noun';
    if (abstractParts.some(p => ps.toLowerCase().includes(p))) {
      score += 0.5;
    }
  }
  return score;
}

/**
 * Determine difficulty based on word characteristics
 */
export function getWordDifficulty(entry: WordEntry): Difficulty {
  const length = entry.word.length;
  const score = calculateWordScore(entry);
  if (length <= 6 || score < 1.5) return 'easy';
  if (length <= 9 || score < 2.5) return 'medium';
  return 'hard';
}

/**
 * Extract words filtered by difficulty
 */
export function extractWords(
  allData: WordEntry[],
  difficulty: Difficulty
): WordEntry[] {
  return allData.filter(entry => 
    entry.word.length >= DIFFICULTY_CONFIG[difficulty].minLength &&
    entry.word.length <= DIFFICULTY_CONFIG[difficulty].maxWordLength
  );
}

/**
 * Convert a word entry to a clue
 */
export function wordEntryToClue(
  entry: WordEntry, 
  direction: 'across' | 'down', 
  number: number,
  row: number = 0,
  col: number = 0
): Clue {
  let clueText = `A ${entry.partOfSpeech || 'noun'}.`;
  
  if (entry.definitions && entry.definitions.length > 0 && entry.definitions[0]) {
    const cleanDef = entry.definitions[0].replace(/\.+$/, '').trim();
    clueText = cleanDef ? `${cleanDef}.` : clueText;
  } else if (entry.synonyms && entry.synonyms.length > 0 && entry.synonyms[0]) {
    clueText = `Synonym for "${entry.synonyms[0]}".`;
  } else if (entry.antonyms && entry.antonyms.length > 0 && entry.antonyms[0]) {
    clueText = `Opposite of "${entry.antonyms[0]}".`;
  }
  
  return {
    id: `${direction}-${number}`,
    answer: entry.word,
    question: clueText,
    direction,
    number,
    length: entry.word.length,
    row,
    col
  };
}

export function generateCrossword(
  words: WordEntry[],
  difficulty: Difficulty,
  title: string,
  width: number = 15,
  height: number = 15,
  wordCount: number = 10
): Puzzle {
  const filteredWords = extractWords(words, difficulty);
  const shuffledWords = [...filteredWords].sort(() => 0.5 - Math.random());
  
  // We process the whole shuffled list to guarantee we hit the wordCount
  const candidateWords = shuffledWords.map(w => w.word.toUpperCase()); 

  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(''));
  const placedClues: Clue[] = [];

  const getCell = (r: number, c: number): string => {
    return grid[r]?.[c] ?? '';
  };

  const setCell = (r: number, c: number, val: string): void => {
    const row = grid[r];
    if (row && c >= 0 && c < width) {
      row[c] = val;
    }
  };

  // Strict Collision Engine
  const canPlace = (word: string, startRow: number, startCol: number, dir: 'across' | 'down') => {
    if (dir === 'across' && startCol + word.length > width) return false;
    if (dir === 'down' && startRow + word.length > height) return false;

    for (let i = 0; i < word.length; i++) {
      const r = dir === 'down' ? startRow + i : startRow;
      const c = dir === 'across' ? startCol + i : startCol;
      const cell = getCell(r, c);
      const letter = word[i] ?? '';
      
      if (cell !== '' && cell !== letter) return false;

      if (cell === '') {
        if (dir === 'across') {
          if (r > 0 && getCell(r - 1, c) !== '') return false;
          if (r < height - 1 && getCell(r + 1, c) !== '') return false;
        } else {
          if (c > 0 && getCell(r, c - 1) !== '') return false;
          if (c < width - 1 && getCell(r, c + 1) !== '') return false;
        }
      }
    }

    if (dir === 'across') {
      if (startCol > 0 && getCell(startRow, startCol - 1) !== '') return false;
      if (startCol + word.length < width && getCell(startRow, startCol + word.length) !== '') return false;
    } else {
      if (startRow > 0 && getCell(startRow - 1, startCol) !== '') return false;
      if (startRow + word.length < height && getCell(startRow + word.length, startCol) !== '') return false;
    }
    return true;
  };

  // Loop through candidate words until we hit exactly the requested wordCount
  for (const word of candidateWords) {
    if (placedClues.length >= wordCount) break;
    
    const entry = shuffledWords.find(w => w.word.toUpperCase() === word);
    if (!entry) continue;
    
    if (placedClues.length === 0) {
      const r = Math.floor(height / 2);
      const c = Math.floor((width - word.length) / 2);
      for (let i = 0; i < word.length; i++) {
        setCell(r, c + i, word[i] ?? '');
      }
      placedClues.push(wordEntryToClue(entry, 'across', 0, r, c));
    } else {
      let placed = false;
      for (let r = 0; r < height && !placed; r++) {
        for (let c = 0; c < width && !placed; c++) {
          const currentCell = getCell(r, c);
          if (currentCell !== '') {
            const matchIndex = word.indexOf(currentCell);
            if (matchIndex !== -1) {
              const startRowD = r - matchIndex;
              if (startRowD >= 0 && canPlace(word, startRowD, c, 'down')) {
                for (let i = 0; i < word.length; i++) {
                  setCell(startRowD + i, c, word[i] ?? '');
                }
                placedClues.push(wordEntryToClue(entry, 'down', 0, startRowD, c));
                placed = true;
              }
              if (!placed) {
                const startColA = c - matchIndex;
                if (startColA >= 0 && canPlace(word, r, startColA, 'across')) {
                  for (let i = 0; i < word.length; i++) {
                    setCell(r, startColA + i, word[i] ?? '');
                  }
                  placedClues.push(wordEntryToClue(entry, 'across', 0, r, startColA));
                  placed = true;
                }
              }
            }
          }
        }
      }
    }
  }

  // STANDARD CROSSWORD NUMBERING REWRITE
  // Group all starting coordinates, sort top-to-bottom, left-to-right, and assign correct sequential numbers
  const startPositions: { r: number, c: number }[] = [];
  placedClues.forEach(clue => {
    const clueR = clue.row ?? 0;
    const clueC = clue.col ?? 0;
    if (!startPositions.find(pos => pos.r === clueR && pos.c === clueC)) {
      startPositions.push({ r: clueR, c: clueC });
    }
  });
  
  startPositions.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r; // Top to bottom
    return a.c - b.c;                 // Left to right
  });

  startPositions.forEach((pos, index) => {
    const assignedNumber = index + 1;
    placedClues.filter(c => (c.row ?? 0) === pos.r && (c.col ?? 0) === pos.c).forEach(clue => {
      clue.number = assignedNumber;
      clue.id = `${clue.direction}-${assignedNumber}`;
    });
  });

  return {
    id: `crossword-${Date.now()}`,
    type: 'crossword',
    title,
    gridSize: { width, height },
    difficulty,
    clues: {
      across: placedClues.filter(c => c.direction === 'across').sort((a, b) => a.number - b.number),
      down: placedClues.filter(c => c.direction === 'down').sort((a, b) => a.number - b.number),
    },
    answers: {
      across: placedClues.filter(c => c.direction === 'across').map(c => c.answer),
      down: placedClues.filter(c => c.direction === 'down').map(c => c.answer),
    },
    theme: 'newspaper',
  };
}

/**
 * Generate a kid-friendly word search puzzle with a full 2D letter grid
 */
export function generateWordSearch(
  words: WordEntry[],
  difficulty: Difficulty,
  title: string,
  size: number = 12,
  wordCount: number = 10
): Puzzle {
  const filteredWords = extractWords(words, difficulty);
  // Shuffle and pick words that fit within the grid size
  const candidateWords = [...filteredWords]
    .sort(() => 0.5 - Math.random())
    .filter(w => w.word.length <= size);
    
  const selectedEntries = candidateWords.slice(0, wordCount);

  // 1. Initialize an empty grid
  const grid: string[][] = Array(size).fill(null).map(() => Array(size).fill(''));
  const placedClues: Clue[] = [];

  // Allowed kid-friendly directions: Horizontal (right), Vertical (down), Diagonal (down-right)
  const directions: Array<{ r: number; c: number; name: 'across' | 'down' | 'diagonal' }> = [
    { r: 0, c: 1, name: 'across' },     // Left to right
    { r: 1, c: 0, name: 'down' },       // Top to bottom
    { r: 1, c: 1, name: 'diagonal' }    // Top-left to bottom-right
  ];

  selectedEntries.forEach((entry, index) => {
    const word = entry.word.toUpperCase();
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 100) {
      attempts++;
      const dirIndex = Math.floor(Math.random() * directions.length);
      const dir = directions[dirIndex] ?? { r: 0, c: 1, name: 'across' };
      
      // Random starting coordinates ensuring the word fits
      const maxR = size - (dir.r * (word.length - 1));
      const maxC = size - (dir.c * (word.length - 1));
      
      if (maxR <= 0 || maxC <= 0) continue;

      const startR = Math.floor(Math.random() * maxR);
      const startC = Math.floor(Math.random() * maxC);

      // Check if path is clear or overlaps with matching letters
      let fits = true;
      for (let i = 0; i < word.length; i++) {
        const currR = startR + (i * dir.r);
        const currC = startC + (i * dir.c);
        const existingLetter = grid[currR]?.[currC] ?? '';
        
        if (existingLetter !== '' && existingLetter !== word[i]) {
          fits = false;
          break;
        }
      }

      if (fits) {
        // Place the word into the grid
        for (let i = 0; i < word.length; i++) {
          const currR = startR + (i * dir.r);
          const currC = startC + (i * dir.c);
          const rowArr = grid[currR];
          if (rowArr) {
            rowArr[currC] = word[i] ?? '';
          }
        }

        // Record the placed word details
        const questionText = entry.definitions && entry.definitions.length > 0 && entry.definitions[0]
          ? entry.definitions[0].replace(/\.+$/, '').trim() + '.'
          : `Find the word: ${word}`;

        placedClues.push({
          id: `ws-word-${index}`,
          answer: word,
          question: questionText,
          direction: dir.name,
          number: index + 1,
          length: word.length,
          row: startR,
          col: startC
        });
        placed = true;
      }
    }
  });

  // 2. Fill all remaining empty cells with random uppercase alphabet letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) {
    const rowArr = grid[r];
    if (!rowArr) continue;
    for (let c = 0; c < size; c++) {
      if (rowArr[c] === '') {
        const randLetter = alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'A';
        rowArr[c] = randLetter;
      }
    }
  }

  return {
    id: `wordsearch-${Date.now()}`,
    type: 'wordsearch',
    title,
    gridSize: { width: size, height: size },
    difficulty,
    clues: {
      across: placedClues,
      down: [],
    },
    answers: {
      across: placedClues.map(c => c.answer),
      down: [],
    },
    theme: 'newspaper',
    rawGrid: grid,
  };
}
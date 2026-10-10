/**
 * Puzzle Generator Service
 * Generates crossword and word search puzzles from JSON word data.
 */

import type { Puzzle, Clue, Difficulty, WordEntry } from '../types/index.ts';

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
  
  // Working canvas dimension: give ample space so words can branch out freely without hitting boundaries
  const canvasSize = Math.max(20, Math.ceil(wordCount * 1.35));
  const cWidth = canvasSize;
  const cHeight = canvasSize;

  interface AttemptResult {
    placedClues: Clue[];
    grid: string[][];
  }

  let bestResult: AttemptResult | null = null;
  const MAX_ATTEMPTS = 6;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const shuffledWords = [...filteredWords].sort(() => 0.5 - Math.random());
    const candidateWords = shuffledWords.map(w => w.word.toUpperCase());

    const grid: string[][] = Array(cHeight).fill(null).map(() => Array(cWidth).fill(''));
    const placedClues: Clue[] = [];

    const getCell = (r: number, c: number): string => grid[r]?.[c] ?? '';
    const setCell = (r: number, c: number, val: string): void => {
      const row = grid[r];
      if (row && c >= 0 && c < cWidth) row[c] = val;
    };

    const canPlace = (word: string, startRow: number, startCol: number, dir: 'across' | 'down') => {
      if (dir === 'across' && startCol + word.length > cWidth) return false;
      if (dir === 'down' && startRow + word.length > cHeight) return false;

      for (let i = 0; i < word.length; i++) {
        const r = dir === 'down' ? startRow + i : startRow;
        const c = dir === 'across' ? startCol + i : startCol;
        const cell = getCell(r, c);
        const letter = word[i] ?? '';

        if (cell !== '' && cell !== letter) return false;

        if (cell === '') {
          if (dir === 'across') {
            if (r > 0 && getCell(r - 1, c) !== '') return false;
            if (r < cHeight - 1 && getCell(r + 1, c) !== '') return false;
          } else {
            if (c > 0 && getCell(r, c - 1) !== '') return false;
            if (c < cWidth - 1 && getCell(r, c + 1) !== '') return false;
          }
        }
      }

      if (dir === 'across') {
        if (startCol > 0 && getCell(startRow, startCol - 1) !== '') return false;
        if (startCol + word.length < cWidth && getCell(startRow, startCol + word.length) !== '') return false;
      } else {
        if (startRow > 0 && getCell(startRow - 1, startCol) !== '') return false;
        if (startRow + word.length < cHeight && getCell(startRow + word.length, startCol) !== '') return false;
      }
      return true;
    };

    // Place seed word in the center
    const seedWord = candidateWords[0];
    const seedEntry = seedWord ? shuffledWords.find(w => w.word.toUpperCase() === seedWord) : null;
    if (seedWord && seedEntry) {
      const r = Math.floor(cHeight / 2);
      const c = Math.floor((cWidth - seedWord.length) / 2);
      for (let i = 0; i < seedWord.length; i++) {
        setCell(r, c + i, seedWord[i] ?? '');
      }
      placedClues.push(wordEntryToClue(seedEntry, 'across', 0, r, c));
    }

    // Remaining candidates to place
    const remainingCandidates = candidateWords.slice(1);
    const unplaced: string[] = [...remainingCandidates];

    // Multi-pass placement: run up to 4 passes over unplaced words as new letters get added
    for (let pass = 0; pass < 4 && placedClues.length < wordCount && unplaced.length > 0; pass++) {
      let placedAnyInPass = false;

      for (let i = unplaced.length - 1; i >= 0; i--) {
        if (placedClues.length >= wordCount) break;
        const word = unplaced[i];
        if (!word) continue;
        const entry = shuffledWords.find(w => w.word.toUpperCase() === word);
        if (!entry) continue;

        let placed = false;
        for (let r = 0; r < cHeight && !placed; r++) {
          for (let c = 0; c < cWidth && !placed; c++) {
            const currentCell = getCell(r, c);
            if (currentCell !== '') {
              const matchIndex = word.indexOf(currentCell);
              if (matchIndex !== -1) {
                const startRowD = r - matchIndex;
                if (startRowD >= 0 && canPlace(word, startRowD, c, 'down')) {
                  for (let k = 0; k < word.length; k++) {
                    setCell(startRowD + k, c, word[k] ?? '');
                  }
                  placedClues.push(wordEntryToClue(entry, 'down', 0, startRowD, c));
                  placed = true;
                }
                if (!placed) {
                  const startColA = c - matchIndex;
                  if (startColA >= 0 && canPlace(word, r, startColA, 'across')) {
                    for (let k = 0; k < word.length; k++) {
                      setCell(r, startColA + k, word[k] ?? '');
                    }
                    placedClues.push(wordEntryToClue(entry, 'across', 0, r, startColA));
                    placed = true;
                  }
                }
              }
            }
          }
        }

        if (placed) {
          unplaced.splice(i, 1);
          placedAnyInPass = true;
        }
      }

      if (!placedAnyInPass) break;
    }

    if (!bestResult || placedClues.length > bestResult.placedClues.length) {
      bestResult = { placedClues, grid };
    }

    // If we successfully placed the full requested word count, stop trying!
    if (placedClues.length >= wordCount) {
      break;
    }
  }

  const finalGrid = bestResult?.grid ?? Array(cHeight).fill(null).map(() => Array(cWidth).fill(''));
  const finalClues = bestResult?.placedClues ?? [];

  // Bounding Box Cropping: calculate min and max coordinates containing letters
  let minRow = cHeight;
  let maxRow = -1;
  let minCol = cWidth;
  let maxCol = -1;

  for (let r = 0; r < cHeight; r++) {
    for (let c = 0; c < cWidth; c++) {
      if (finalGrid[r]?.[c] && finalGrid[r]![c] !== '') {
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
        if (c < minCol) minCol = c;
        if (c > maxCol) maxCol = c;
      }
    }
  }

  if (minRow > maxRow || minCol > maxCol) {
    minRow = 0;
    maxRow = height - 1;
    minCol = 0;
    maxCol = width - 1;
  }

  const croppedWidth = maxCol - minCol + 1;
  const croppedHeight = maxRow - minRow + 1;

  // Offset clue coordinates by bounding box origin
  finalClues.forEach(clue => {
    clue.row = (clue.row ?? 0) - minRow;
    clue.col = (clue.col ?? 0) - minCol;
  });

  // Crossword numbering: sort top-to-bottom, left-to-right
  const startPositions: { r: number; c: number }[] = [];
  finalClues.forEach(clue => {
    const clueR = clue.row ?? 0;
    const clueC = clue.col ?? 0;
    if (!startPositions.find(pos => pos.r === clueR && pos.c === clueC)) {
      startPositions.push({ r: clueR, c: clueC });
    }
  });

  startPositions.sort((a, b) => {
    if (a.r !== b.r) return a.r - b.r;
    return a.c - b.c;
  });

  startPositions.forEach((pos, index) => {
    const assignedNumber = index + 1;
    finalClues.filter(c => (c.row ?? 0) === pos.r && (c.col ?? 0) === pos.c).forEach(clue => {
      clue.number = assignedNumber;
      clue.id = `${clue.direction}-${assignedNumber}`;
    });
  });

  return {
    id: `crossword-${Date.now()}`,
    type: 'crossword',
    title,
    gridSize: { width: croppedWidth, height: croppedHeight },
    difficulty,
    clues: {
      across: finalClues.filter(c => c.direction === 'across').sort((a, b) => a.number - b.number),
      down: finalClues.filter(c => c.direction === 'down').sort((a, b) => a.number - b.number),
    },
    answers: {
      across: finalClues.filter(c => c.direction === 'across').map(c => c.answer),
      down: finalClues.filter(c => c.direction === 'down').map(c => c.answer),
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
  
  // Dynamic grid size: ensure plenty of space for 14-16 words, especially on Hard
  const actualSize = wordCount >= 16 ? Math.max(size, 15) : (wordCount >= 14 ? Math.max(size, 14) : size);

  // Shuffle and pick words that fit within grid size
  const candidateWords = [...filteredWords]
    .sort(() => 0.5 - Math.random())
    .filter(w => w.word.length <= actualSize);

  // 1. Initialize empty grid
  const grid: string[][] = Array(actualSize).fill(null).map(() => Array(actualSize).fill(''));
  const placedClues: Clue[] = [];

  // Allowed kid-friendly directions: Horizontal (right), Vertical (down), Diagonal (down-right)
  const directions: Array<{ r: number; c: number; name: 'across' | 'down' | 'diagonal' }> = [
    { r: 0, c: 1, name: 'across' },     // Left to right
    { r: 1, c: 0, name: 'down' },       // Top to bottom
    { r: 1, c: 1, name: 'diagonal' }    // Top-left to bottom-right
  ];

  // Iterate through candidates until we hit wordCount or exhaust candidates
  for (let candidateIdx = 0; candidateIdx < candidateWords.length && placedClues.length < wordCount; candidateIdx++) {
    const entry = candidateWords[candidateIdx];
    if (!entry) continue;
    const word = entry.word.toUpperCase();
    let placed = false;
    let attempts = 0;

    while (!placed && attempts < 250) {
      attempts++;
      const dirIndex = Math.floor(Math.random() * directions.length);
      const dir = directions[dirIndex] ?? { r: 0, c: 1, name: 'across' };

      const maxR = actualSize - (dir.r * (word.length - 1));
      const maxC = actualSize - (dir.c * (word.length - 1));

      if (maxR <= 0 || maxC <= 0) continue;

      const startR = Math.floor(Math.random() * maxR);
      const startC = Math.floor(Math.random() * maxC);

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
        for (let i = 0; i < word.length; i++) {
          const currR = startR + (i * dir.r);
          const currC = startC + (i * dir.c);
          const rowArr = grid[currR];
          if (rowArr) {
            rowArr[currC] = word[i] ?? '';
          }
        }

        const questionText = entry.definitions && entry.definitions.length > 0 && entry.definitions[0]
          ? entry.definitions[0].replace(/\.+$/, '').trim() + '.'
          : `Find the word: ${word}`;

        placedClues.push({
          id: `ws-word-${placedClues.length}`,
          answer: word,
          question: questionText,
          direction: dir.name,
          number: placedClues.length + 1,
          length: word.length,
          row: startR,
          col: startC
        });
        placed = true;
      }
    }
  }

  // 2. Fill all remaining empty cells with random uppercase alphabet letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < actualSize; r++) {
    const rowArr = grid[r];
    if (!rowArr) continue;
    for (let c = 0; c < actualSize; c++) {
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
    gridSize: { width: actualSize, height: actualSize },
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
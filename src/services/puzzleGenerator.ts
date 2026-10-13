/**
 * Puzzle Generator Service
 * Generates crossword and word search puzzles from JSON word data.
 */

import type { Puzzle, Clue, Difficulty, WordEntry, PlayMode } from '../types/index.ts';
import { getWordEmoji } from '../data/emojis.ts';

/**
 * Difficulty configurations for word length
 */
const DIFFICULTY_CONFIG = {
  easy: { minLength: 3, maxLength: 7, maxWordLength: 6 },
  medium: { minLength: 5, maxLength: 9, maxWordLength: 10 },
  hard: { minLength: 7, maxLength: 12, maxWordLength: 15 },
};

const CROSSWORD_BASE_SIZE: Record<Difficulty, { width: number; height: number }> = {
  easy: { width: 11, height: 10 },
  medium: { width: 13, height: 12 },
  hard: { width: 15, height: 14 },
};

/**
 * Largest crossword grid allowed for a puzzle. Close to square to match the
 * board area beside the clue panel on a landscape tablet, so cells stay
 * finger-sized; puzzles with more words get a little extra room.
 */
export function getCrosswordMaxSize(difficulty: Difficulty, wordCount: number): { width: number; height: number } {
  const base = CROSSWORD_BASE_SIZE[difficulty];
  const extraWords = Math.max(0, wordCount - 10);
  return {
    width: base.width + Math.ceil(extraWords / 4),
    height: base.height + Math.ceil(extraWords / 4),
  };
}

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
 * Extract words filtered by difficulty, dropping repeated words
 * (themed words are merged with the dictionary, which can contain the same word)
 */
export function extractWords(
  allData: WordEntry[],
  difficulty: Difficulty
): WordEntry[] {
  const seen = new Set<string>();
  return allData.filter(entry => {
    const key = entry.word.toUpperCase();
    if (seen.has(key)) return false;
    if (entry.word.length < DIFFICULTY_CONFIG[difficulty].minLength ||
        entry.word.length > DIFFICULTY_CONFIG[difficulty].maxWordLength) return false;
    seen.add(key);
    return true;
  });
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

  const emoji = entry.emoji || getWordEmoji(entry.word);
  
  return {
    id: `${direction}-${number}`,
    answer: entry.word,
    question: clueText,
    direction,
    number,
    length: entry.word.length,
    row,
    col,
    emoji,
  };
}

export function generateCrossword(
  words: WordEntry[],
  difficulty: Difficulty,
  title: string,
  width: number = CROSSWORD_BASE_SIZE[difficulty].width,
  height: number = CROSSWORD_BASE_SIZE[difficulty].height,
  wordCount: number = 10,
  playMode: PlayMode = 'zen'
): Puzzle {
  // width/height are the largest grid allowed; longer words can never fit across
  const filteredWords = extractWords(words, difficulty).filter(w => w.word.length <= width);

  // If not every word fits, one retry is allowed this much extra room
  const EXTRA_WIDTH = 1;
  const EXTRA_HEIGHT = 1;

  // Working canvas: the seed word sits in the middle so the puzzle can grow in any
  // direction up to the size limit, then the used area is cropped out
  const canvasSize = Math.max(width + EXTRA_WIDTH, height + EXTRA_HEIGHT) * 2 + 2;

  interface Placement {
    entry: WordEntry;
    row: number;
    col: number;
    dir: 'across' | 'down';
  }

  interface Bounds {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
  }

  interface AttemptResult {
    placements: Placement[];
    bounds: Bounds;
  }

  const boundsArea = (b: Bounds) => (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1);

  const MAX_ATTEMPTS = 20;
  // Only consider a slice of a large dictionary per attempt to keep generation fast
  const CANDIDATE_LIMIT = 250;

  const findBestLayout = (maxWidth: number, maxHeight: number): AttemptResult | null => {
    let bestResult: AttemptResult | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const shuffledWords = [...filteredWords].sort(() => 0.5 - Math.random()).slice(0, CANDIDATE_LIMIT);

      const grid: string[][] = Array(canvasSize).fill(null).map(() => Array(canvasSize).fill(''));
      // Which direction(s) each cell is already used in, so words never overlap a parallel word
      const usedAcross: boolean[][] = Array(canvasSize).fill(null).map(() => Array(canvasSize).fill(false));
      const usedDown: boolean[][] = Array(canvasSize).fill(null).map(() => Array(canvasSize).fill(false));
      const occupied: { r: number; c: number }[] = [];
      const placements: Placement[] = [];
      const bounds: Bounds = { minRow: Infinity, maxRow: -Infinity, minCol: Infinity, maxCol: -Infinity };

      const getCell = (r: number, c: number): string => grid[r]?.[c] ?? '';

      // Returns the number of crossings with existing words, or -1 if the word can't go here
      const checkPlacement = (word: string, startRow: number, startCol: number, dir: 'across' | 'down'): number => {
        const dr = dir === 'down' ? 1 : 0;
        const dc = dir === 'across' ? 1 : 0;
        const endRow = startRow + dr * (word.length - 1);
        const endCol = startCol + dc * (word.length - 1);
        if (startRow < 0 || startCol < 0 || endRow >= canvasSize || endCol >= canvasSize) return -1;

        // Cells just before and after the word must be empty
        if (getCell(startRow - dr, startCol - dc) !== '' || getCell(endRow + dr, endCol + dc) !== '') return -1;

        const used = dir === 'across' ? usedAcross : usedDown;
        let crossings = 0;
        for (let i = 0; i < word.length; i++) {
          const r = startRow + dr * i;
          const c = startCol + dc * i;
          const cell = getCell(r, c);
          if (cell === '') {
            // New letters must not sit side-by-side with other words
            if (getCell(r + dc, c + dr) !== '' || getCell(r - dc, c - dr) !== '') return -1;
          } else {
            if (cell !== word[i] || used[r]?.[c]) return -1;
            crossings++;
          }
        }
        return crossings;
      };

      const placeWord = (entry: WordEntry, startRow: number, startCol: number, dir: 'across' | 'down'): void => {
        const word = entry.word.toUpperCase();
        const used = dir === 'across' ? usedAcross : usedDown;
        for (let i = 0; i < word.length; i++) {
          const r = dir === 'down' ? startRow + i : startRow;
          const c = dir === 'across' ? startCol + i : startCol;
          const row = grid[r];
          const usedRow = used[r];
          if (!row || !usedRow) continue;
          if (row[c] === '') occupied.push({ r, c });
          row[c] = word[i] ?? '';
          usedRow[c] = true;
          bounds.minRow = Math.min(bounds.minRow, r);
          bounds.maxRow = Math.max(bounds.maxRow, r);
          bounds.minCol = Math.min(bounds.minCol, c);
          bounds.maxCol = Math.max(bounds.maxCol, c);
        }
        placements.push({ entry, row: startRow, col: startCol, dir });
      };

      // Place seed word across the center
      const seedEntry = shuffledWords[0];
      if (seedEntry) {
        const r = Math.floor(canvasSize / 2);
        const c = Math.floor((canvasSize - seedEntry.word.length) / 2);
        placeWord(seedEntry, r, c, 'across');
      }

      // Multi-pass placement: words that didn't fit may fit once more letters are on the grid
      const unplaced = shuffledWords.slice(1);
      for (let pass = 0; pass < 3 && placements.length < wordCount && unplaced.length > 0; pass++) {
        let placedAnyInPass = false;

        for (let i = 0; i < unplaced.length && placements.length < wordCount; ) {
          const entry = unplaced[i];
          if (!entry) break;
          const word = entry.word.toUpperCase();

          // Try every crossing with every placed letter; keep the spot that keeps the grid smallest
          let bestSpot: { row: number; col: number; dir: 'across' | 'down'; score: number } | null = null;
          for (const { r, c } of occupied) {
            const letter = getCell(r, c);
            for (let k = 0; k < word.length; k++) {
              if (word[k] !== letter) continue;
              for (const dir of ['across', 'down'] as const) {
                const row = dir === 'down' ? r - k : r;
                const col = dir === 'across' ? c - k : c;
                const crossings = checkPlacement(word, row, col, dir);
                if (crossings < 0) continue;

                const endRow = dir === 'down' ? row + word.length - 1 : row;
                const endCol = dir === 'across' ? col + word.length - 1 : col;
                const newWidth = Math.max(bounds.maxCol, endCol) - Math.min(bounds.minCol, col) + 1;
                const newHeight = Math.max(bounds.maxRow, endRow) - Math.min(bounds.minRow, row) + 1;
                if (newWidth > maxWidth || newHeight > maxHeight) continue;

                const score = newWidth * newHeight - crossings * 6;
                if (!bestSpot || score < bestSpot.score) {
                  bestSpot = { row, col, dir, score };
                }
              }
            }
          }

          if (bestSpot) {
            placeWord(entry, bestSpot.row, bestSpot.col, bestSpot.dir);
            unplaced.splice(i, 1);
            placedAnyInPass = true;
          } else {
            i++;
          }
        }

        if (!placedAnyInPass) break;
      }

      // Prefer the attempt with the most words, then the most compact grid
      if (!bestResult ||
          placements.length > bestResult.placements.length ||
          (placements.length === bestResult.placements.length && boundsArea(bounds) < boundsArea(bestResult.bounds))) {
        bestResult = { placements, bounds };
      }
    }

    return bestResult;
  };

  let bestResult = findBestLayout(width, height);
  // Small themed word lists can't always fit every word in the limit; give them a little more room
  if ((bestResult?.placements.length ?? 0) < wordCount) {
    const roomier = findBestLayout(width + EXTRA_WIDTH, height + EXTRA_HEIGHT);
    if (roomier && roomier.placements.length > (bestResult?.placements.length ?? 0)) {
      bestResult = roomier;
    }
  }

  const placements = bestResult?.placements ?? [];
  const usedBounds = placements.length > 0 ? bestResult?.bounds : undefined;
  const minRow = usedBounds?.minRow ?? 0;
  const minCol = usedBounds?.minCol ?? 0;
  const croppedWidth = usedBounds ? usedBounds.maxCol - minCol + 1 : width;
  const croppedHeight = usedBounds ? usedBounds.maxRow - minRow + 1 : height;

  // Build clues with coordinates relative to the cropped grid
  const finalClues: Clue[] = placements.map(p =>
    wordEntryToClue(p.entry, p.dir, 0, p.row - minRow, p.col - minCol)
  );

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
    playMode,
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
  wordCount: number = 10,
  playMode: PlayMode = 'zen'
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

        const emoji = entry.emoji || getWordEmoji(word);

        placedClues.push({
          id: `ws-word-${placedClues.length}`,
          answer: word,
          question: questionText,
          direction: dir.name,
          number: placedClues.length + 1,
          length: word.length,
          row: startR,
          col: startC,
          emoji,
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
    theme: 'wordsearch',
    rawGrid: grid,
    playMode,
  };
}
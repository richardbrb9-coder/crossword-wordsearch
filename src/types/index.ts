// Data structures for the Word Puzzle App

export type Difficulty = 'easy' | 'medium' | 'hard';
export type PuzzleTheme = 'all' | 'animals' | 'space' | 'food' | 'fantasy' | 'sports';
export type PlayMode = 'zen' | 'timed';

export type WordEntry = {
  word: string;
  partOfSpeech?: string;
  definitions: string[];
  synonyms: string[];
  antonyms: string[];
  length: number;
  emoji?: string;
};

export type Clue = {
  id: string;
  answer: string;
  question: string;
  direction: 'across' | 'down' | 'diagonal';
  number: number;
  length: number;
  row?: number;
  col?: number;
  difficulty?: Difficulty;
  emoji?: string;
};

export type Puzzle = {
  id: string;
  type: 'crossword' | 'wordsearch';
  title: string;
  gridSize: {
    width: number;
    height: number;
  };
  difficulty: Difficulty;
  clues: {
    across: Clue[];
    down: Clue[];
  };
  answers: {
    across: string[];
    down: string[];
  };
  theme?: string;
  rawGrid?: string[][];
  playMode?: PlayMode;
};

export type GridPosition = {
  row: number;
  col: number;
};

export type CellValue = string | null;

export type Sticker = {
  id: string;
  title: string;
  emoji: string;
  theme: PuzzleTheme | 'general';
  description: string;
};

export type UserStats = {
  totalStars: number;
  puzzlesSolved: number;
  unlockedStickers: string[];
};

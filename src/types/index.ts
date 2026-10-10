// Data structures for the Word Puzzle App

export type Difficulty = 'easy' | 'medium' | 'hard';
export type PuzzleTheme = 'all' | 'animals' | 'space' | 'food' | 'fantasy' | 'sports';

export type WordEntry = {
  word: string;
  partOfSpeech?: string;
  definitions: string[];
  synonyms: string[];
  antonyms: string[];
  length: number;
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
};

export type GridPosition = {
  row: number;
  col: number;
};

export type CellValue = string | null;

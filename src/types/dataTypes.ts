// Data structure for word clues - to be loaded from JSON files

export type ClueDictionary = {
  [word: string]: {
    meanings: Array<[string, string, Array<string>, Array<string>]>;
    antonyms: string[];
    synonyms: string[];
  };
};

export interface DifficultySettings {
  easy: {
    minLength: number;
    maxLength: number;
    maxWordLength: number;
  };
  medium: {
    minLength: number;
    maxLength: number;
    maxWordLength: number;
  };
  hard: {
    minLength: number;
    maxLength: number;
    maxWordLength: number;
  };
}

import type { Difficulty } from './index';

export type Settings = {
  puzzleType: 'crossword' | 'wordsearch';
  difficulty: Difficulty;
  wordCount: number;
  gridSize: {
    width: number;
    height: number;
  };
  theme?: string;
};

export interface Clue {
  id: string;
  answer: string;
  question: string;
  direction: 'across' | 'down';
  number: number;
  length: number;
  row: number; // NEW
  col: number; // NEW
}
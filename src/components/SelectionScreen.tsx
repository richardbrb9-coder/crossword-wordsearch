import { useState } from 'react';
import type { Difficulty, PuzzleTheme, PlayMode } from '../types/index.ts';
import { soundService } from '../services/soundService';
import { THEMES } from '../data/themes';

interface SelectionScreenProps {
  onStartGame: (settings: { 
    puzzleType: 'crossword' | 'wordsearch'; 
    difficulty: Difficulty; 
    wordCount: number; 
    theme: PuzzleTheme;
    playMode: PlayMode;
  }) => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onStartGame }) => {
  const [puzzleType, setPuzzleType] = useState<'crossword' | 'wordsearch'>('crossword');
  const [theme, setTheme] = useState<PuzzleTheme>('animals');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [wordCount, setWordCount] = useState(10);
  const [playMode, setPlayMode] = useState<PlayMode>('zen');

  const validate = () => {
    if (!puzzleType || !difficulty || wordCount < 10 || wordCount > 16) {
      alert('Please select all options: puzzle type, difficulty, and word count (10-16)');
      return false;
    }
    return true;
  };

  const handleStartGame = () => {
    soundService.playTap();
    if (validate()) {
      onStartGame({ puzzleType, difficulty, wordCount, theme, playMode });
    }
  };

  return (
    <div className="selection-screen">
      <h1>Create Your Puzzle</h1>
      
      {/* 1. Puzzle Type Selection */}
      <div className="form-group">
        <label htmlFor="puzzle-type">Game Type:</label>
        <select
          id="puzzle-type"
          value={puzzleType}
          onChange={(e) => {
            soundService.playTap();
            setPuzzleType(e.target.value as 'crossword' | 'wordsearch');
          }}
        >
          <option value="crossword">✏️ Crossword Puzzle</option>
          <option value="wordsearch">🔍 Word Search Grid</option>
        </select>
      </div>

      {/* 2. Theme Selection */}
      <div className="form-group">
        <label>Pick a Fun Theme:</label>
        <div className="theme-options-grid">
          {Object.values(THEMES).map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`theme-card-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  soundService.playTap();
                  setTheme(t.id);
                }}
              >
                <span className="theme-card-icon">{t.icon}</span>
                <span className="theme-card-label">{t.name}</span>
              </button>
            );
          })}
        </div>
        <p className="theme-desc-text">
          {THEMES[theme]?.description}
        </p>
      </div>

      {/* 3. Difficulty */}
      <div className="form-group">
        <label htmlFor="difficulty">Difficulty Level:</label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(e) => {
            soundService.playTap();
            setDifficulty(e.target.value as Difficulty);
          }}
        >
          <option value="easy">🟢 Easy (Ages 5–7: shorter words)</option>
          <option value="medium">🟡 Medium (Ages 8–10: medium words)</option>
          <option value="hard">🔴 Hard (Ages 11–12: challenge words)</option>
        </select>
      </div>

      {/* 4. Word Count */}
      <div className="form-group">
        <label htmlFor="word-count">Number of Words to Solve:</label>
        <select
          id="word-count"
          value={wordCount}
          onChange={(e) => {
            soundService.playTap();
            setWordCount(Number(e.target.value));
          }}
        >
          <option value="10">10 Words (Quick & Fun)</option>
          <option value="14">14 Words (Standard)</option>
          <option value="16">16 Words (Mega Puzzle)</option>
        </select>
      </div>

      {/* 5. Play Mode (Zen vs Timed Challenge) */}
      <div className="form-group">
        <label>Play Mode:</label>
        <div className="playmode-options-grid">
          <button
            type="button"
            className={`playmode-card-btn ${playMode === 'zen' ? 'selected-zen' : ''}`}
            onClick={() => { soundService.playTap(); setPlayMode('zen'); }}
          >
            <span className="playmode-icon">🧘</span>
            <span className="playmode-title">Relaxed Zen</span>
            <span className="playmode-desc">No time limit</span>
          </button>

          <button
            type="button"
            className={`playmode-card-btn ${playMode === 'timed' ? 'selected-timed' : ''}`}
            onClick={() => { soundService.playTap(); setPlayMode('timed'); }}
          >
            <span className="playmode-icon">⏱️</span>
            <span className="playmode-title">Speed Challenge</span>
            <span className="playmode-desc">Track your time!</span>
          </button>
        </div>
      </div>

      <button onClick={handleStartGame} className="start-game-button">
        Start Game 🎯
      </button>
    </div>
  );
};

export default SelectionScreen;
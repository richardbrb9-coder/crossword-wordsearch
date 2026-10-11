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
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
          gap: '10px', 
          marginTop: '6px' 
        }}>
          {Object.values(THEMES).map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  soundService.playTap();
                  setTheme(t.id);
                }}
                style={{
                  background: isSelected ? 'linear-gradient(135deg, #feca57, #ff6b6b)' : 'rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#1a1a2e' : '#fff',
                  border: isSelected ? '2px solid #feca57' : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '10px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                  boxShadow: isSelected ? '0 4px 15px rgba(254, 202, 87, 0.4)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '1.8rem' }}>{t.icon}</span>
                <span style={{ fontSize: '0.9rem', textAlign: 'center' }}>{t.name}</span>
              </button>
            );
          })}
        </div>
        <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '6px', textAlign: 'center' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => { soundService.playTap(); setPlayMode('zen'); }}
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              border: playMode === 'zen' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
              background: playMode === 'zen' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-main)',
              fontWeight: playMode === 'zen' ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>🧘</span>
            <span style={{ fontSize: '0.9rem' }}>Relaxed Zen</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>No time limit</span>
          </button>

          <button
            type="button"
            onClick={() => { soundService.playTap(); setPlayMode('timed'); }}
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              border: playMode === 'timed' ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.15)',
              background: playMode === 'timed' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-main)',
              fontWeight: playMode === 'timed' ? 'bold' : 'normal',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: '1.4rem' }}>⏱️</span>
            <span style={{ fontSize: '0.9rem' }}>Speed Challenge</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Track your time!</span>
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
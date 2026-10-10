import { useState } from 'react';
import type { Difficulty } from '@/types';
import { soundService } from '../services/soundService';

interface SelectionScreenProps {
  onStartGame: (settings: { puzzleType: 'crossword' | 'wordsearch'; difficulty: Difficulty; wordCount: number }) => void;
}

const SelectionScreen: React.FC<SelectionScreenProps> = ({ onStartGame }) => {
  const [puzzleType, setPuzzleType] = useState<'crossword' | 'wordsearch'>('crossword');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [wordCount, setWordCount] = useState(10);

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
      onStartGame({ puzzleType, difficulty, wordCount });
    }
  };

  return (
    <div className="selection-screen">
      <h1>Select Your Puzzle Type</h1>
      
      <div className="form-group">
        <label htmlFor="puzzle-type">Puzzle Type:</label>
        <select
          id="puzzle-type"
          value={puzzleType}
          onChange={(e) => setPuzzleType(e.target.value as 'crossword' | 'wordsearch')}
        >
          <option value="crossword">Crossword</option>
          <option value="wordsearch">Word Search</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="difficulty">Difficulty:</label>
        <select
          id="difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="word-count">Number of Words:</label>
        <select
          id="word-count"
          value={wordCount}
          onChange={(e) => setWordCount(Number(e.target.value))}
        >
          <option value="10">10</option>
          <option value="14">14</option>
          <option value="16">16</option>
        </select>
      </div>

      <button onClick={handleStartGame} className="start-game-button">
Start Game
      </button>
    </div>
  );
};

export default SelectionScreen;
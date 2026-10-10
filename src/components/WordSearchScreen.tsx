import { useState, useEffect } from 'react';
import { Puzzle } from '@/types';
import confetti from 'canvas-confetti';
import { soundService } from '../services/soundService';
import './WordSearchScreen.css';

interface WordSearchScreenProps {
  puzzle: Puzzle & { rawGrid?: string[][] };
  onExit: () => void;
}

const RAINBOW_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#F3FF33', '#FF33F3', '#33FFF3', '#FF9133', '#9B33FF', '#FF3366', '#33FFB5', '#FFD133', '#B233FF'];

export default function WordSearchScreen({ puzzle, onExit }: WordSearchScreenProps) {
  const wordsList = puzzle.clues.across;
  const grid = puzzle.rawGrid || [];

  const [selectedCells, setSelectedCells] = useState<{ row: number; col: number }[]>([]);
  const [activeColor, setActiveColor] = useState<string>('#FFEB3B');
  const [foundWords, setFoundWords] = useState<Record<string, { color: string; cells: { row: number; col: number }[] }>>({});
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const totalWords = wordsList.length;
    const foundCount = Object.keys(foundWords).length;
    const currentProgress = totalWords > 0 ? Math.round((foundCount / totalWords) * 100) : 0;
    setProgress(currentProgress);

    if (currentProgress === 100 && !isCompleted && totalWords > 0) {
      setIsCompleted(true);
      soundService.playFanfare();
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, zIndex: 9999 });
    }
  }, [foundWords, wordsList.length, isCompleted]);

  const checkMatch = (cells: { row: number; col: number }[]): boolean => {
    if (cells.length === 0) return false;
    const currentAttempt = cells.map(c => grid[c.row]?.[c.col] ?? '').join('').toUpperCase();
    const reversedAttempt = currentAttempt.split('').reverse().join('');

    const matchedClue = wordsList.find(clue => {
      if (foundWords[clue.answer]) return false;
      const target = clue.answer.toUpperCase();
      return currentAttempt === target || reversedAttempt === target;
    });

    if (matchedClue) {
      soundService.playSuccess();
      setFoundWords(prev => ({
        ...prev,
        [matchedClue.answer]: { color: activeColor, cells }
      }));
      setSelectedCells([]);
      return true;
    }
    return false;
  };

  const handleCellClick = (row: number, col: number) => {
    soundService.playTap();

    let newSelection = [...selectedCells];

    if (selectedCells.length === 0) {
      // Start a new selection sequence
      newSelection = [{ row, col }];
      const colorIndex = Object.keys(foundWords).length % RAINBOW_COLORS.length;
      setActiveColor(RAINBOW_COLORS[colorIndex] ?? '#FFEB3B');
    } else if (selectedCells.length === 1) {
      const firstCell = selectedCells[0]!;
      if (firstCell.row === row && firstCell.col === col) {
        // Deselect
        newSelection = [];
      } else {
        const dRow = row - firstCell.row;
        const dCol = col - firstCell.col;
        const stepR = Math.sign(dRow);
        const stepC = Math.sign(dCol);
        const steps = Math.max(Math.abs(dRow), Math.abs(dCol));

        const isCollinear = (dRow === 0 || dCol === 0 || Math.abs(dRow) === Math.abs(dCol));

        if (isCollinear && steps <= 15) {
          // Generate full line between first tap and current tap
          const line: { row: number; col: number }[] = [];
          for (let s = 0; s <= steps; s++) {
            line.push({ row: firstCell.row + s * stepR, col: firstCell.col + s * stepC });
          }

          if (checkMatch(line)) {
            return;
          }
          newSelection = line;
        } else {
          // Not in a straight line: start new selection here
          newSelection = [{ row, col }];
          const colorIndex = Object.keys(foundWords).length % RAINBOW_COLORS.length;
          setActiveColor(RAINBOW_COLORS[colorIndex] ?? '#FFEB3B');
        }
      }
    } else {
      // Already selecting multiple tiles: check if clicking last tile to undo
      const lastCell = selectedCells[selectedCells.length - 1];
      if (lastCell && lastCell.row === row && lastCell.col === col) {
        newSelection.pop();
      } else if (lastCell) {
        // Check collinear continuation
        const prevCell = selectedCells[selectedCells.length - 2];
        const dirR = prevCell ? lastCell.row - prevCell.row : (row - lastCell.row);
        const dirC = prevCell ? lastCell.col - prevCell.col : (col - lastCell.col);

        const nextR = row - lastCell.row;
        const nextC = col - lastCell.col;

        const isTouching = Math.abs(nextR) <= 1 && Math.abs(nextC) <= 1;
        const isSameDirection = Math.sign(nextR) === Math.sign(dirR) && Math.sign(nextC) === Math.sign(dirC);

        if (isTouching && isSameDirection && !selectedCells.some(c => c.row === row && c.col === col)) {
          newSelection.push({ row, col });
        } else {
          // Start fresh from clicked cell
          newSelection = [{ row, col }];
          const colorIndex = Object.keys(foundWords).length % RAINBOW_COLORS.length;
          setActiveColor(RAINBOW_COLORS[colorIndex] ?? '#FFEB3B');
        }
      }
    }

    setSelectedCells(newSelection);

    // Validate if current chain matches any word
    if (newSelection.length > 1) {
      checkMatch(newSelection);
    }
  };

  const getCellStyle = (row: number, col: number) => {
    if (selectedCells.some(c => c.row === row && c.col === col)) {
      return { backgroundColor: activeColor, color: '#000', fontWeight: 'bold', transform: 'scale(1.08)', boxShadow: `0 0 8px ${activeColor}` };
    }

    for (const [, data] of Object.entries(foundWords)) {
      if (data.cells.find(c => c.row === row && c.col === col)) {
        return { backgroundColor: data.color, color: '#fff', fontWeight: 'bold' };
      }
    }
    
    return {};
  };

  const currentSpelling = selectedCells.map(c => grid[c.row]?.[c.col] ?? '').join('');

  return (
    <div className="game-screen wordsearch-screen">
      <div className="game-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', alignItems: 'center', width: '100%', maxWidth: '900px' }}>
        <button onClick={onExit} style={{ background: '#ff4444', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          Back to Menu
        </button>
        {progress > 0 && (
          <div className="progress-indicator" style={{ flexGrow: 1, margin: '0 20px' }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{progress}% found</span>
          </div>
        )}
      </div>

      <div style={{ margin: '10px 0', fontSize: '1.2rem', color: activeColor, height: '30px', fontWeight: 'bold', letterSpacing: '2px', textAlign: 'center' }}>
        {currentSpelling ? `Spelling: ${currentSpelling}` : 'Tap start & end letters to find a word'}
      </div>

      <div className="game-content wordsearch-content">
        <div className="ws-grid" style={{ gridTemplateColumns: `repeat(${grid[0]?.length || 10}, 1fr)` }}>
          {grid.map((rowArr, rowIndex) => rowArr.map((letter, colIndex) => (
            <button 
              key={`${rowIndex}-${colIndex}`} 
              type="button" 
              className="ws-cell" 
              style={getCellStyle(rowIndex, colIndex)} 
              onClick={() => handleCellClick(rowIndex, colIndex)}
            >
              {letter}
            </button>
          )))}
        </div>

        <div className="clues-section ws-wordbank">
          <h3>Words to Find</h3>
          <ul>
            {wordsList.map((clue) => {
              const isFound = !!foundWords[clue.answer];
              return (
                <li 
                  key={clue.id} 
                  className={isFound ? 'correct ws-found-word' : ''} 
                  style={{ color: isFound ? foundWords[clue.answer]?.color : 'inherit', fontWeight: isFound ? 'bold' : 'normal' }}
                >
                  {clue.answer} {isFound ? '✓' : ''}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {isCompleted && (
        <div className="modal-overlay" style={{ zIndex: 9998 }}>
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#28a745', marginBottom: '1rem' }}>🎉 Word Search Complete!</h2>
            <p style={{ color: '#fff', marginBottom: '1.5rem' }}>Fantastic job! You found all the hidden words.</p>
            <button className="start-button" onClick={onExit} style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem' }}>Back to Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
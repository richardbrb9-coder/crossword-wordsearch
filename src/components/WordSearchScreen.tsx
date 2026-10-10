import React, { useState, useEffect, useRef } from 'react';
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
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintCell, setHintCell] = useState<{ row: number; col: number } | null>(null);

  // Drag tracking refs & state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const lastHoveredCellRef = useRef<{ row: number; col: number } | null>(null);

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

  /**
   * Helper to compute a straight line between two grid cells
   */
  const computeLine = (start: { row: number; col: number }, end: { row: number; col: number }): { row: number; col: number }[] => {
    const dRow = end.row - start.row;
    const dCol = end.col - start.col;
    const absR = Math.abs(dRow);
    const absC = Math.abs(dCol);

    let stepR = 0;
    let stepC = 0;
    let steps = 0;

    // Strict collinear check: horizontal, vertical, or 45-degree diagonal
    if (absR === 0 && absC > 0) {
      stepC = Math.sign(dCol);
      steps = absC;
    } else if (absC === 0 && absR > 0) {
      stepR = Math.sign(dRow);
      steps = absR;
    } else if (absR === absC && absR > 0) {
      stepR = Math.sign(dRow);
      stepC = Math.sign(dCol);
      steps = absR;
    } else {
      // Snap to nearest dominant axis if dragged slightly off-axis
      if (absC >= 2 * absR) {
        stepC = Math.sign(dCol);
        steps = absC;
      } else if (absR >= 2 * absC) {
        stepR = Math.sign(dRow);
        steps = absR;
      } else {
        stepR = Math.sign(dRow);
        stepC = Math.sign(dCol);
        steps = Math.min(absR, absC);
      }
    }

    if (steps > 15) steps = 15;

    const line: { row: number; col: number }[] = [];
    for (let s = 0; s <= steps; s++) {
      line.push({ row: start.row + s * stepR, col: start.col + s * stepC });
    }
    return line;
  };

  // Pointer Down - start drag or initial tap
  const handlePointerDown = (row: number, col: number, e: React.PointerEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { row, col };
    lastHoveredCellRef.current = { row, col };

    const colorIndex = Object.keys(foundWords).length % RAINBOW_COLORS.length;
    const newColor = RAINBOW_COLORS[colorIndex] ?? '#FFEB3B';
    setActiveColor(newColor);
    setSelectedCells([{ row, col }]);
    soundService.playTap();
  };

  // Pointer Move across the grid container
  const handleGridPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;

    // Find cell currently under pointer
    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ws-cell') as HTMLElement | null;
    if (!targetEl) return;

    const row = Number(targetEl.getAttribute('data-row'));
    const col = Number(targetEl.getAttribute('data-col'));
    if (isNaN(row) || isNaN(col)) return;

    if (lastHoveredCellRef.current?.row === row && lastHoveredCellRef.current?.col === col) {
      return;
    }

    lastHoveredCellRef.current = { row, col };
    const line = computeLine(dragStartRef.current, { row, col });
    setSelectedCells(line);
  };

  // Pointer Up - check match
  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (selectedCells.length > 1) {
      const matched = checkMatch(selectedCells);
      if (!matched) {
        // Clear non-matching dragged selection
        setSelectedCells([]);
      }
    }
  };

  // Fallback / alternate click handler for tap-start & tap-end
  const handleCellClick = (row: number, col: number) => {
    if (isDraggingRef.current) return;

    // If a single cell is currently selected and player clicks another cell
    if (selectedCells.length === 1 && (selectedCells[0]?.row !== row || selectedCells[0]?.col !== col)) {
      const startCell = selectedCells[0]!;
      const line = computeLine(startCell, { row, col });
      if (checkMatch(line)) {
        return;
      }
      setSelectedCells(line);
    }
  };

  // Provide a friendly hint for young players
  const handleShowHint = () => {
    const unfound = wordsList.find(c => !foundWords[c.answer]);
    if (!unfound) return;

    setHintsUsed(prev => prev + 1);
    soundService.playReveal();

    const startR = unfound.row ?? 0;
    const startC = unfound.col ?? 0;
    setHintCell({ row: startR, col: startC });

    setTimeout(() => {
      setHintCell(null);
    }, 3500);
  };

  const getCellStyle = (row: number, col: number) => {
    if (selectedCells.some(c => c.row === row && c.col === col)) {
      return { 
        backgroundColor: activeColor, 
        color: '#000', 
        fontWeight: 'bold', 
        transform: 'scale(1.1)', 
        boxShadow: `0 0 10px ${activeColor}`,
        zIndex: 5
      };
    }

    for (const [, data] of Object.entries(foundWords)) {
      if (data.cells.find(c => c.row === row && c.col === col)) {
        return { backgroundColor: data.color, color: '#fff', fontWeight: 'bold' };
      }
    }
    
    return {};
  };

  const calculateStars = (): number => {
    if (hintsUsed === 0) return 3;
    if (hintsUsed <= 2) return 2;
    return 1;
  };

  const currentSpelling = selectedCells.map(c => grid[c.row]?.[c.col] ?? '').join('');

  return (
    <div 
      className="game-screen wordsearch-screen"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="game-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', alignItems: 'center', width: '100%', maxWidth: '950px' }}>
        <button onClick={onExit} style={{ background: '#ff4444', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          Back to Menu
        </button>

        {progress > 0 && (
          <div className="progress-indicator" style={{ flexGrow: 1, margin: '0 20px' }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{progress}% found ({Object.keys(foundWords).length}/{wordsList.length})</span>
          </div>
        )}

        <button 
          onClick={handleShowHint}
          style={{ background: '#ffc107', color: '#1a1a2e', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Get a hint for an unfound word"
        >
          💡 Hint
        </button>
      </div>

      <div style={{ margin: '8px 0 14px', fontSize: '1.25rem', color: activeColor, minHeight: '32px', fontWeight: 'bold', letterSpacing: '2px', textAlign: 'center' }}>
        {currentSpelling ? `Spelling: ${currentSpelling}` : '👆 Drag or tap letters to find hidden words!'}
      </div>

      <div className="game-content wordsearch-content">
        <div 
          className="ws-grid" 
          style={{ gridTemplateColumns: `repeat(${grid[0]?.length || 10}, 1fr)` }}
          onPointerMove={handleGridPointerMove}
        >
          {grid.map((rowArr, rowIndex) => rowArr.map((letter, colIndex) => {
            const isHint = hintCell?.row === rowIndex && hintCell?.col === colIndex;
            return (
              <button 
                key={`${rowIndex}-${colIndex}`} 
                type="button" 
                data-row={rowIndex}
                data-col={colIndex}
                className={`ws-cell ${isHint ? 'hint-active' : ''}`} 
                style={getCellStyle(rowIndex, colIndex)} 
                onPointerDown={(e) => handlePointerDown(rowIndex, colIndex, e)}
                onClick={() => handleCellClick(rowIndex, colIndex)}
              >
                {letter}
              </button>
            );
          }))}
        </div>

        <div className="clues-section ws-wordbank">
          <h3>Words to Find ({wordsList.length - Object.keys(foundWords).length} left)</h3>
          <ul>
            {wordsList.map((clue) => {
              const isFound = !!foundWords[clue.answer];
              return (
                <li 
                  key={clue.id} 
                  className={isFound ? 'correct ws-found-word' : ''} 
                  style={{ 
                    backgroundColor: isFound ? `${foundWords[clue.answer]?.color}22` : 'transparent',
                    color: isFound ? foundWords[clue.answer]?.color : 'inherit', 
                    fontWeight: isFound ? 'bold' : 'normal' 
                  }}
                >
                  <span>{clue.answer}</span>
                  {isFound ? <span>✓</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {isCompleted && (
        <div className="modal-overlay" style={{ zIndex: 9998 }}>
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#28a745', marginBottom: '0.5rem', fontSize: '2rem' }}>🎉 Word Search Solved!</h2>
            
            {/* Animated Stars */}
            <div style={{ fontSize: '3rem', margin: '1rem 0', letterSpacing: '8px' }}>
              {'⭐'.repeat(calculateStars())}
              <span style={{ opacity: 0.2 }}>{'⭐'.repeat(3 - calculateStars())}</span>
            </div>
            
            <p style={{ color: '#feca57', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {calculateStars() === 3 ? '🏆 Master Word Hunter! Perfect Score!' : calculateStars() === 2 ? '🌟 Super Job! Well Solved!' : '👍 Great Effort! Keep Practicing!'}
            </p>

            <p style={{ color: '#ccc', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              You found all {wordsList.length} words using {hintsUsed} hint{hintsUsed === 1 ? '' : 's'}.
            </p>

            <button className="start-button" onClick={onExit} style={{ width: '100%', padding: '0.8rem' }}>
              Play Another Puzzle 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
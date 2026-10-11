import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Puzzle, Sticker } from '../types/index.ts';
import confetti from 'canvas-confetti';
import { soundService } from '../services/soundService';
import { stickerService } from '../services/stickerService';
import { StickerBookModal } from './StickerBookModal';
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [unlockedStickers, setUnlockedStickers] = useState<Sticker[]>([]);
  const [isStickerBookModalOpen, setIsStickerBookModalOpen] = useState(false);

  // Drag tracking refs & state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);
  const lastHoveredCellRef = useRef<{ row: number; col: number } | null>(null);

  // Friendly stopwatch timer for timed mode
  useEffect(() => {
    if (isCompleted || puzzle.playMode !== 'timed') return;
    const interval = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCompleted, puzzle.playMode]);

  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  const calculateStars = useCallback((): number => {
    if (hintsUsed === 0) return 3;
    if (hintsUsed <= 2) return 2;
    return 1;
  }, [hintsUsed]);

  useEffect(() => {
    const totalWords = wordsList.length;
    const foundCount = Object.keys(foundWords).length;
    const currentProgress = totalWords > 0 ? Math.round((foundCount / totalWords) * 100) : 0;
    setProgress(currentProgress);

    if (currentProgress === 100 && !isCompleted && totalWords > 0) {
      setIsCompleted(true);
      soundService.playFanfare();
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, zIndex: 9999 });

      const stars = calculateStars();
      const { newStickers } = stickerService.recordPuzzleWin((puzzle.theme as any) || 'all', stars);
      if (newStickers.length > 0) {
        setUnlockedStickers(newStickers);
      }
    }
  }, [foundWords, wordsList.length, isCompleted, calculateStars, puzzle.theme]);

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

  const currentSpelling = selectedCells.map(c => grid[c.row]?.[c.col] ?? '').join('');

  return (
    <div 
      className="game-screen wordsearch-screen"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Printable Worksheet Header (Only visible when printed) */}
      <div className="print-header">
        <h1>{puzzle.title}</h1>
        <p style={{ margin: '4px 0', fontSize: '11pt' }}>Find and circle all hidden words in the puzzle grid below.</p>
        <div className="student-info">
          <span>Name: _____________________________________</span>
          <span>Date: ____________________</span>
        </div>
      </div>

      <div className="game-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', alignItems: 'center', width: '100%', maxWidth: '950px', flexWrap: 'wrap', gap: '10px' }}>
        <button onClick={onExit} style={{ background: '#ff4444', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          Back to Menu
        </button>

        {/* Timer or Zen Mode Badge */}
        <div style={{
          background: puzzle.playMode === 'timed' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
          border: `1px solid ${puzzle.playMode === 'timed' ? '#f59e0b' : '#10b981'}`,
          borderRadius: '20px',
          padding: '6px 14px',
          fontWeight: 'bold',
          fontSize: '0.95rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          {puzzle.playMode === 'timed' ? `⏱️ ${formatTime(elapsedSeconds)}` : '🧘 Relaxed Mode'}
        </div>

        {progress > 0 && (
          <div className="progress-indicator" style={{ flexGrow: 1, margin: '0 12px', minWidth: '160px' }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{progress}% found ({Object.keys(foundWords).length}/{wordsList.length})</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={handleShowHint}
            style={{ background: '#ffc107', color: '#1a1a2e', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Get a hint for an unfound word"
          >
            💡 Hint
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.9rem'
            }}
            title="Print this puzzle as a worksheet or save as PDF"
          >
            🖨️ Print
          </button>
        </div>
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
                    fontWeight: isFound ? 'bold' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {clue.emoji && puzzle.difficulty === 'easy' && (
                      <span style={{ fontSize: '1.25rem' }}>{clue.emoji}</span>
                    )}
                    <span>{clue.answer}</span>
                  </span>
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

            {puzzle.playMode === 'timed' && (
              <p style={{ color: '#48dbfb', fontWeight: 'bold', margin: '4px 0', fontSize: '1.05rem' }}>
                ⏱️ Finished in {formatTime(elapsedSeconds)}! ⚡ Speed Bonus!
              </p>
            )}

            <p style={{ color: '#ccc', marginBottom: '1rem', fontSize: '0.95rem' }}>
              You found all {wordsList.length} words using {hintsUsed} hint{hintsUsed === 1 ? '' : 's'}.
            </p>

            {/* Newly Unlocked Sticker Notification */}
            {unlockedStickers.length > 0 && (
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(254, 202, 87, 0.25), rgba(255, 107, 107, 0.25))', 
                border: '2px solid #feca57', 
                borderRadius: '16px', 
                padding: '12px', 
                margin: '12px 0' 
              }}>
                <div style={{ fontSize: '0.85rem', color: '#feca57', fontWeight: 'bold' }}>🎉 NEW STICKER UNLOCKED!</div>
                <div style={{ fontSize: '2.5rem', margin: '4px 0' }}>{unlockedStickers[0]?.emoji}</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--text-main)' }}>{unlockedStickers[0]?.title}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{unlockedStickers[0]?.description}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '1rem' }}>
              <button 
                type="button" 
                onClick={() => setIsStickerBookModalOpen(true)} 
                style={{ 
                  background: 'linear-gradient(135deg, #feca57, #ff9f43)', 
                  color: '#1a1a2e', 
                  border: 'none', 
                  padding: '10px', 
                  borderRadius: '12px', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                View Sticker Album 🏆
              </button>

              <button className="start-button" onClick={onExit} style={{ width: '100%', padding: '0.8rem' }}>
                Play Another Puzzle 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Game Sticker Album Modal */}
      <StickerBookModal isOpen={isStickerBookModalOpen} onClose={() => setIsStickerBookModalOpen(false)} />
    </div>
  );
}
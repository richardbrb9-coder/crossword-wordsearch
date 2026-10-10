import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Puzzle, Clue } from '@/types';
import confetti from 'canvas-confetti';
import { soundService } from '../services/soundService';
import { speechService } from '../services/speechService';
import './GameScreen.css';

interface GameScreenProps {
  puzzle: Puzzle;
  onExit: () => void;
}

interface GridCell {
  row: number;
  col: number;
  isBlocked: boolean;
  number?: number;
  acrossClue?: Clue;
  downClue?: Clue;
  correctLetter?: string;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['HINT', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE']
];

const GameScreen: React.FC<GameScreenProps> = ({ puzzle, onExit }) => {
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [userGridLetters, setUserGridLetters] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [gridData, setGridData] = useState<GridCell[][]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  // In-grid active cursor & direction
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [activeDirection, setActiveDirection] = useState<'across' | 'down'>('across');

  // Big modal fallback (optional view)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInput, setModalInput] = useState('');
  const [modalMessage, setModalMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Build grid data from puzzle definition
  useEffect(() => {
    if (puzzle.type === 'crossword') {
      const { gridSize, clues } = puzzle;
      const newGrid: GridCell[][] = Array(gridSize.height).fill(null).map((_, r) => 
        Array(gridSize.width).fill(null).map((_, c) => ({ row: r, col: c, isBlocked: true, correctLetter: '' }))
      );

      const allClues = [...clues.across, ...clues.down];
      let firstPlayable: { row: number; col: number } | null = null;

      allClues.forEach(clue => {
        const word = clue.answer.toUpperCase();
        const startR = clue.row ?? 0;
        const startC = clue.col ?? 0;
        for (let i = 0; i < clue.length; i++) {
          const r = clue.direction === 'down' ? startR + i : startR;
          const c = clue.direction === 'across' ? startC + i : startC;
          
          const rowArr = newGrid[r];
          if (!rowArr) continue;
          const cell = rowArr[c];
          if (!cell) continue;

          cell.isBlocked = false;
          cell.correctLetter = word[i] ?? '';
          if (clue.direction === 'across') cell.acrossClue = clue;
          if (clue.direction === 'down') cell.downClue = clue;
          if (i === 0) cell.number = clue.number;

          if (!firstPlayable) {
            firstPlayable = { row: r, col: c };
          }
        }
      });

      setGridData(newGrid);
      if (firstPlayable) {
        setActiveCell(firstPlayable);
      }
    }
  }, [puzzle]);

  const totalClues = puzzle.type === 'crossword' ? puzzle.clues.across.length + puzzle.clues.down.length : 0;

  // Active Clue derived from activeCell and activeDirection
  const activeClue = useMemo<Clue | null>(() => {
    if (!activeCell || !gridData[activeCell.row]) return null;
    const cell = gridData[activeCell.row]?.[activeCell.col];
    if (!cell || cell.isBlocked) return null;

    if (activeDirection === 'across' && cell.acrossClue) return cell.acrossClue;
    if (activeDirection === 'down' && cell.downClue) return cell.downClue;
    return cell.acrossClue || cell.downClue || null;
  }, [activeCell, activeDirection, gridData]);

  // Check progress and completion
  useEffect(() => {
    const correctCount = Object.keys(userAnswers).length;
    const currentProgress = totalClues > 0 ? Math.round((correctCount / totalClues) * 100) : 0;
    setProgress(currentProgress);

    if (currentProgress === 100 && !isCompleted && totalClues > 0) {
      setIsCompleted(true);
      soundService.playFanfare();
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, zIndex: 9999 });
    }
  }, [userAnswers, isCompleted, totalClues]);

  // Helper to get visible letter in any cell
  const getCellLetter = useCallback((r: number, c: number): string => {
    const cell = gridData[r]?.[c];
    if (!cell || cell.isBlocked) return '';

    // If word is solved, show correct letter
    if (cell.acrossClue && userAnswers[cell.acrossClue.id]) return cell.correctLetter ?? '';
    if (cell.downClue && userAnswers[cell.downClue.id]) return cell.correctLetter ?? '';

    // Otherwise show whatever letter is typed in grid
    return userGridLetters[`${r}-${c}`] ?? '';
  }, [gridData, userAnswers, userGridLetters]);

  // Check if a clue is fully and correctly filled in the grid
  const checkClueCompletion = useCallback((clue: Clue, updatedGridLetters: Record<string, string>) => {
    const word = clue.answer.toUpperCase();
    const startR = clue.row ?? 0;
    const startC = clue.col ?? 0;
    let filled = '';

    for (let i = 0; i < clue.length; i++) {
      const r = clue.direction === 'down' ? startR + i : startR;
      const c = clue.direction === 'across' ? startC + i : startC;
      const key = `${r}-${c}`;
      filled += (updatedGridLetters[key] || '');
    }

    if (filled.length === word.length && filled === word) {
      soundService.playSuccess();
      setUserAnswers(prev => ({ ...prev, [clue.id]: word }));
      return true;
    }
    return false;
  }, []);

  // Enter a letter at current activeCell
  const handleEnterLetter = useCallback((letter: string) => {
    if (!activeCell || !activeClue) return;
    const { row, col } = activeCell;
    const key = `${row}-${col}`;

    soundService.playTap();
    const updated = { ...userGridLetters, [key]: letter.toUpperCase() };
    setUserGridLetters(updated);

    // Check if current word is now solved
    const solved = checkClueCompletion(activeClue, updated);

    // Advance to next cell in current word
    const startR = activeClue.row ?? 0;
    const startC = activeClue.col ?? 0;
    const currentIndex = activeClue.direction === 'across' ? (col - startC) : (row - startR);

    if (currentIndex < activeClue.length - 1) {
      const nextR = activeClue.direction === 'down' ? row + 1 : row;
      const nextC = activeClue.direction === 'across' ? col + 1 : col;
      setActiveCell({ row: nextR, col: nextC });
    } else if (solved) {
      // Find next unsolved clue
      const allClues = [...puzzle.clues.across, ...puzzle.clues.down];
      const nextClue = allClues.find(c => !userAnswers[c.id] && c.id !== activeClue.id);
      if (nextClue) {
        setActiveCell({ row: nextClue.row ?? 0, col: nextClue.col ?? 0 });
        setActiveDirection(nextClue.direction as 'across' | 'down');
      }
    }
  }, [activeCell, activeClue, userGridLetters, checkClueCompletion, puzzle.clues, userAnswers]);

  // Backspace handler
  const handleBackspace = useCallback(() => {
    if (!activeCell || !activeClue) return;
    const { row, col } = activeCell;
    const key = `${row}-${col}`;

    // If current cell has a letter, erase it
    if (userGridLetters[key]) {
      const updated = { ...userGridLetters };
      delete updated[key];
      setUserGridLetters(updated);
      soundService.playTap();
      return;
    }

    // Step back to previous cell in the word and erase
    const startR = activeClue.row ?? 0;
    const startC = activeClue.col ?? 0;
    const currentIndex = activeClue.direction === 'across' ? (col - startC) : (row - startR);

    if (currentIndex > 0) {
      const prevR = activeClue.direction === 'down' ? row - 1 : row;
      const prevC = activeClue.direction === 'across' ? col - 1 : col;
      const prevKey = `${prevR}-${prevC}`;

      const updated = { ...userGridLetters };
      delete updated[prevKey];
      setUserGridLetters(updated);
      setActiveCell({ row: prevR, col: prevC });
      soundService.playTap();
    }
  }, [activeCell, activeClue, userGridLetters]);

  // Toggle direction between Across and Down
  const handleToggleDirection = useCallback(() => {
    if (!activeCell) return;
    const cell = gridData[activeCell.row]?.[activeCell.col];
    if (!cell) return;

    soundService.playTap();
    if (activeDirection === 'across' && cell.downClue) {
      setActiveDirection('down');
    } else if (activeDirection === 'down' && cell.acrossClue) {
      setActiveDirection('across');
    }
  }, [activeCell, activeDirection, gridData]);

  // Reveal 1 Letter hint for active clue
  const handleHintOneLetter = useCallback(() => {
    if (!activeClue) return;
    const answer = activeClue.answer.toUpperCase();
    const startR = activeClue.row ?? 0;
    const startC = activeClue.col ?? 0;

    // Find first empty or incorrect cell in the clue
    for (let i = 0; i < activeClue.length; i++) {
      const r = activeClue.direction === 'down' ? startR + i : startR;
      const c = activeClue.direction === 'across' ? startC + i : startC;
      const key = `${r}-${c}`;
      const current = userGridLetters[key] ?? '';

      if (current !== answer[i]) {
        const updated = { ...userGridLetters, [key]: answer[i] ?? '' };
        setUserGridLetters(updated);
        setActiveCell({ row: r, col: c });
        setHintsUsed(prev => prev + 1);
        soundService.playReveal();

        checkClueCompletion(activeClue, updated);
        return;
      }
    }
  }, [activeClue, userGridLetters, checkClueCompletion]);

  // Physical Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen || isCompleted) return;

      const key = e.key.toUpperCase();
      if (/^[A-Z]$/.test(key)) {
        e.preventDefault();
        handleEnterLetter(key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggleDirection();
      } else if (activeCell && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let nextR = activeCell.row;
        let nextC = activeCell.col;
        if (e.key === 'ArrowUp') nextR--;
        if (e.key === 'ArrowDown') nextR++;
        if (e.key === 'ArrowLeft') nextC--;
        if (e.key === 'ArrowRight') nextC++;

        const target = gridData[nextR]?.[nextC];
        if (target && !target.isBlocked) {
          setActiveCell({ row: nextR, col: nextC });
          soundService.playTap();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleEnterLetter, handleBackspace, handleToggleDirection, activeCell, gridData, isModalOpen, isCompleted]);

  // Cell Click Handler
  const handleCellClick = (cell: GridCell) => {
    if (cell.isBlocked) return;
    soundService.playTap();

    if (activeCell?.row === cell.row && activeCell?.col === cell.col) {
      // Tapping same cell toggles direction
      handleToggleDirection();
    } else {
      setActiveCell({ row: cell.row, col: cell.col });
      // If cell only supports one direction, switch to it
      if (cell.acrossClue && !cell.downClue) {
        setActiveDirection('across');
      } else if (cell.downClue && !cell.acrossClue) {
        setActiveDirection('down');
      }
    }
  };

  // Select Clue from Clues List
  const handleSelectClue = (clue: Clue) => {
    soundService.playTap();
    setActiveCell({ row: clue.row ?? 0, col: clue.col ?? 0 });
    setActiveDirection(clue.direction as 'across' | 'down');
  };

  // Open Full Modal View (if player taps modal icon)
  const openModal = () => {
    if (!activeClue) return;
    setModalInput('');
    setModalMessage(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    speechService.stop();
    setIsModalOpen(false);
    setModalInput('');
    setModalMessage(null);
  };

  const handleModalCheck = () => {
    if (!activeClue) return;
    if (modalInput.trim().toUpperCase() === activeClue.answer.toUpperCase()) {
      soundService.playSuccess();
      setModalMessage({ text: '✓ Correct! Well done!', type: 'success' });
      setUserAnswers(prev => ({ ...prev, [activeClue.id]: activeClue.answer.toUpperCase() }));
      setTimeout(() => closeModal(), 1200);
    } else {
      soundService.playError();
      setModalMessage({ text: 'Not quite, try again!', type: 'error' });
      setModalInput('');
    }
  };

  const calculateStars = (): number => {
    if (hintsUsed === 0) return 3;
    if (hintsUsed <= 2) return 2;
    return 1;
  };

  // Check if a cell is in active clue
  const isCellInActiveClue = (r: number, c: number): boolean => {
    if (!activeClue) return false;
    const startR = activeClue.row ?? 0;
    const startC = activeClue.col ?? 0;
    if (activeClue.direction === 'across') {
      return r === startR && c >= startC && c < startC + activeClue.length;
    }
    return c === startC && r >= startR && r < startR + activeClue.length;
  };

  return (
    <div className="game-screen">
      <div className="game-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', alignItems: 'center' }}>
        <button 
          onClick={onExit} 
          style={{ background: '#ff4444', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Back to Menu
        </button>

        {progress > 0 && (
          <div className="progress-indicator" style={{ flexGrow: 1, margin: '0 20px' }}>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{progress}% solved ({Object.keys(userAnswers).length}/{totalClues})</span>
          </div>
        )}
      </div>

      {/* Pinned Active Clue Banner Above Grid */}
      {activeClue && (
        <div className="active-clue-banner">
          <div className="acb-top">
            <button 
              type="button"
              className="acb-badge" 
              onClick={handleToggleDirection}
              title="Click to switch between Across and Down"
            >
              <span>{activeClue.direction === 'across' ? '➡️ Across' : '⬇️ Down'} {activeClue.number}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>({activeClue.length} letters) ⇄</span>
            </button>

            <div className="acb-actions">
              <button 
                type="button"
                className="acb-btn"
                onClick={() => speechService.speak(activeClue.question)}
                title="Read clue aloud"
              >
                🔊 Read
              </button>
              <button 
                type="button"
                className="acb-btn"
                onClick={handleHintOneLetter}
                title="Reveal 1 letter in this word"
                style={{ color: '#f59e0b', fontWeight: 'bold' }}
              >
                💡 Hint 1 Letter
              </button>
              <button 
                type="button"
                className="acb-btn"
                onClick={openModal}
                title="Open popup card view"
              >
                🔍 Expand
              </button>
            </div>
          </div>

          <p className="acb-question">
            {activeClue.question}
          </p>
        </div>
      )}

      <div className="game-content">
        <div className="crossword-container">
          {/* Crossword Grid with Direct Typing */}
          <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${puzzle.gridSize.width}, 1fr)` }}>
            {gridData.map((row, rowIndex) => row.map((cell, colIndex) => {
              const letter = getCellLetter(rowIndex, colIndex);
              const isActive = activeCell?.row === rowIndex && activeCell?.col === colIndex;
              const inActiveWord = isCellInActiveClue(rowIndex, colIndex);
              const isSolved = (cell.acrossClue && userAnswers[cell.acrossClue.id]) || (cell.downClue && userAnswers[cell.downClue.id]);

              return (
                <div 
                  key={`${rowIndex}-${colIndex}`} 
                  className={`crossword-cell ${cell.isBlocked ? 'blocked' : ''} ${cell.number ? 'has-number' : ''} ${isActive ? 'active-cursor' : ''} ${inActiveWord ? 'in-active-word' : ''} ${isSolved ? 'solved' : ''}`} 
                  onClick={() => handleCellClick(cell)}
                >
                  {cell.number && <span className="cell-number">{cell.number}</span>}
                  {!cell.isBlocked && <div className="cell-content">{letter}</div>}
                </div>
              );
            }))}
          </div>

          {/* On-Screen Virtual Keyboard for Tablet & Mobile Kids */}
          <div className="virtual-keyboard">
            {KEYBOARD_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="vk-row">
                {row.map(key => {
                  if (key === 'HINT') {
                    return (
                      <button 
                        key={key} 
                        type="button" 
                        className="vk-key special-key" 
                        onClick={handleHintOneLetter}
                        title="Reveal 1 letter"
                        style={{ color: '#f59e0b', fontWeight: 'bold' }}
                      >
                        💡 Hint
                      </button>
                    );
                  }
                  if (key === 'BACKSPACE') {
                    return (
                      <button 
                        key={key} 
                        type="button" 
                        className="vk-key special-key" 
                        onClick={handleBackspace}
                        title="Delete letter"
                      >
                        ⌫
                      </button>
                    );
                  }
                  return (
                    <button 
                      key={key} 
                      type="button" 
                      className="vk-key" 
                      onClick={() => handleEnterLetter(key)}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Clues Section Below */}
          <div className="clues-section">
            <div className="across-clues">
              <h3>Across</h3>
              <ul>
                {puzzle.clues.across.map((clue) => {
                  const isSelected = activeClue?.id === clue.id;
                  const isSolved = !!userAnswers[clue.id];
                  return (
                    <li 
                      key={clue.id} 
                      className={`${isSolved ? 'correct' : ''} ${isSelected ? 'active-clue-item' : ''}`} 
                      onClick={() => handleSelectClue(clue)} 
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>{clue.number}. {clue.question}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speechService.speak(clue.question);
                        }}
                        title="Read clue"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', opacity: 0.8 }}
                      >
                        🔊
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="down-clues">
              <h3>Down</h3>
              <ul>
                {puzzle.clues.down.map((clue) => {
                  const isSelected = activeClue?.id === clue.id;
                  const isSolved = !!userAnswers[clue.id];
                  return (
                    <li 
                      key={clue.id} 
                      className={`${isSolved ? 'correct' : ''} ${isSelected ? 'active-clue-item' : ''}`} 
                      onClick={() => handleSelectClue(clue)} 
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span>{clue.number}. {clue.question}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speechService.speak(clue.question);
                        }}
                        title="Read clue"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', opacity: 0.8 }}
                      >
                        🔊
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Expanded Clue Modal */}
      {isModalOpen && activeClue && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{activeClue.direction === 'across' ? 'Across' : 'Down'} {activeClue.number} ({activeClue.length} letters)</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '1.15rem', textAlign: 'center' }}>
                {activeClue.question}
              </p>
              <button
                type="button"
                onClick={() => speechService.speak(activeClue.question)}
                title="Read clue aloud"
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                🔊
              </button>
            </div>
            
            <div className="answer-input">
              <input 
                id="modal-input"
                type="text" 
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                maxLength={activeClue.length}
                placeholder={`Type ${activeClue.length} letters...`}
                autoFocus 
              />
            </div>

            {modalMessage && <div className={`result-message ${modalMessage.type}`}>{modalMessage.text}</div>}

            <div className="button-group" style={{ marginTop: '1.5rem', display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button 
                className="btn-validate" 
                onClick={handleModalCheck} 
                disabled={modalInput.trim().length === 0}
                style={{ background: '#28a745', color: 'white', padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Check Answer
              </button>
              <button 
                className="btn-cancel" 
                onClick={closeModal} 
                style={{ background: '#6c757d', color: 'white', padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Star Victory Celebration Modal */}
      {isCompleted && (
        <div className="modal-overlay" style={{ zIndex: 9998 }}>
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#28a745', marginBottom: '0.5rem', fontSize: '2rem' }}>🎉 Crossword Solved!</h2>
            
            <div style={{ fontSize: '3.2rem', margin: '1rem 0', letterSpacing: '8px' }}>
              {'⭐'.repeat(calculateStars())}
              <span style={{ opacity: 0.2 }}>{'⭐'.repeat(3 - calculateStars())}</span>
            </div>
            
            <p style={{ color: '#feca57', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {calculateStars() === 3 ? '🏆 Crossword Master! 3 Stars!' : calculateStars() === 2 ? '🌟 Super Detective! 2 Stars!' : '👍 Great Effort! 1 Star!'}
            </p>

            <p style={{ color: '#ccc', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              You solved all {totalClues} clues using {hintsUsed} hint{hintsUsed === 1 ? '' : 's'}.
            </p>

            <button className="start-button" onClick={onExit} style={{ width: '100%', padding: '0.8rem' }}>
              Play Another Puzzle 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameScreen;
import React, { useState, useEffect } from 'react';
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

const GameScreen: React.FC<GameScreenProps> = ({ puzzle, onExit }) => {
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [gridData, setGridData] = useState<GridCell[][]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);

  const [activeClue, setActiveClue] = useState<Clue | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [modalMessage, setModalMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const [isRevealing, setIsRevealing] = useState(false);

  useEffect(() => {
    if (puzzle.type === 'crossword') {
      const { gridSize, clues } = puzzle;
      const newGrid: GridCell[][] = Array(gridSize.height).fill(null).map((_, r) => 
        Array(gridSize.width).fill(null).map((_, c) => ({ row: r, col: c, isBlocked: true, correctLetter: '' }))
      );

      const allClues = [...clues.across, ...clues.down];
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
        }
      });
      setGridData(newGrid);
    }
  }, [puzzle]);

  const totalClues = puzzle.type === 'crossword' ? puzzle.clues.across.length + puzzle.clues.down.length : 0;

  useEffect(() => {
    const correctCount = Object.keys(userAnswers).length;
    const currentProgress = totalClues > 0 ? Math.round((correctCount / totalClues) * 100) : 0;
    setProgress(currentProgress);

    if (currentProgress === 100 && !isCompleted && totalClues > 0) {
      setIsCompleted(true);
      soundService.playFanfare();
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 }, zIndex: 9999 });
    }
  }, [userAnswers, puzzle, isCompleted, totalClues]);

  const getVisibleLetter = (cell: GridCell): string => {
    if (cell.isBlocked) return '';
    if (cell.acrossClue && userAnswers[cell.acrossClue.id]) return cell.correctLetter ?? '';
    if (cell.downClue && userAnswers[cell.downClue.id]) return cell.correctLetter ?? '';
    return '';
  };

  const getDiscoveredPattern = (clue: Clue): string => {
    const letters: string[] = [];
    const startR = clue.row ?? 0;
    const startC = clue.col ?? 0;
    for (let i = 0; i < clue.length; i++) {
      const r = clue.direction === 'down' ? startR + i : startR;
      const c = clue.direction === 'across' ? startC + i : startC;
      const cell = gridData[r]?.[c];
      if (cell) {
        const vis = getVisibleLetter(cell);
        letters.push(vis ? vis : '_');
      } else {
        letters.push('_');
      }
    }
    return letters.join(' ');
  };

  const handleCellClick = (cell: GridCell) => {
    if (cell.isBlocked) return;
    soundService.playTap();

    let targetClue = cell.acrossClue || cell.downClue;
    if (cell.acrossClue && cell.downClue) {
      if (activeClue && activeClue.id === cell.acrossClue.id) {
        targetClue = cell.downClue;
      } else {
        targetClue = cell.acrossClue;
      }
    }
    if (targetClue) openModal(targetClue);
  };

  const openModal = (clue: Clue) => {
    setActiveClue(clue);
    setModalInput(''); 
    setModalMessage(null);
  };

  const closeModal = () => {
    if (isRevealing) return;
    speechService.stop();
    setActiveClue(null);
    setModalInput('');
    setModalMessage(null);
  };

  const handleCheckAnswer = () => {
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
      setTimeout(() => document.getElementById('clue-input')?.focus(), 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCheckAnswer();
    }
  };

  // Hint: Reveal just 1 letter
  const handleRevealOneLetter = () => {
    if (!activeClue || isRevealing) return;
    const answer = activeClue.answer.toUpperCase();
    let current = modalInput.toUpperCase();

    if (current.length < answer.length) {
      current += answer[current.length];
    } else {
      for (let i = 0; i < answer.length; i++) {
        if (current[i] !== answer[i]) {
          current = current.slice(0, i) + answer[i] + current.slice(i + 1);
          break;
        }
      }
    }

    setModalInput(current);
    setHintsUsed(prev => prev + 1);
    soundService.playReveal();

    if (current === answer) {
      soundService.playSuccess();
      setModalMessage({ text: '✓ Fully Solved with Hint!', type: 'success' });
      setUserAnswers(prev => ({ ...prev, [activeClue.id]: answer }));
      setTimeout(() => closeModal(), 1200);
    }
  };

  // Typewriter Reveal Entire Word
  const handleRevealAnswer = () => {
    if (!activeClue || isRevealing) return;
    
    setIsRevealing(true);
    setHintsUsed(prev => prev + 3);
    soundService.playReveal();
    setModalInput('');
    setModalMessage({ text: 'Revealing word...', type: 'info' });
    
    const answer = activeClue.answer.toUpperCase();
    let currentSpelling = '';
    let letterIndex = 0;
    
    const typingInterval = setInterval(() => {
      currentSpelling += answer[letterIndex];
      setModalInput(currentSpelling);
      letterIndex++;
      
      if (letterIndex >= answer.length) {
        clearInterval(typingInterval);
        soundService.playSuccess();
        setModalMessage({ text: '⭐ Word Revealed!', type: 'success' });
        setUserAnswers(prev => ({ ...prev, [activeClue.id]: answer }));
        setIsRevealing(false);
        setTimeout(() => closeModal(), 1800); 
      }
    }, 300);
  };

  const calculateStars = (): number => {
    if (hintsUsed === 0) return 3;
    if (hintsUsed <= 2) return 2;
    return 1;
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

      <div className="game-content">
        <div className="crossword-container">
          <div className="crossword-grid" style={{ gridTemplateColumns: `repeat(${puzzle.gridSize.width}, 1fr)` }}>
            {gridData.map((row, rowIndex) => row.map((cell, colIndex) => {
              const visibleLetter = getVisibleLetter(cell);
              return (
                <div 
                  key={`${rowIndex}-${colIndex}`} 
                  className={`crossword-cell ${cell.isBlocked ? 'blocked' : ''} ${cell.number ? 'has-number' : ''}`} 
                  onClick={() => handleCellClick(cell)}
                >
                  {cell.number && <span className="cell-number">{cell.number}</span>}
                  {!cell.isBlocked && <div className="cell-content">{visibleLetter}</div>}
                </div>
              );
            }))}
          </div>

          <div className="clues-section">
            <div className="across-clues">
              <h3>Across</h3>
              <ul>
                {puzzle.clues.across.map((clue) => (
                  <li 
                    key={clue.id} 
                    className={userAnswers[clue.id] ? 'correct' : ''} 
                    onClick={() => { soundService.playTap(); openModal(clue); }} 
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
                ))}
              </ul>
            </div>
            <div className="down-clues">
              <h3>Down</h3>
              <ul>
                {puzzle.clues.down.map((clue) => (
                  <li 
                    key={clue.id} 
                    className={userAnswers[clue.id] ? 'correct' : ''} 
                    onClick={() => { soundService.playTap(); openModal(clue); }} 
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
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {activeClue && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>{activeClue.direction === 'across' ? 'Across' : 'Down'} {activeClue.number} ({activeClue.length} letters)</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, color: '#f1f2f6', fontSize: '1.15rem', textAlign: 'center' }}>
                {activeClue.question}
              </p>
              <button
                type="button"
                onClick={() => speechService.speak(activeClue.question)}
                title="Read clue aloud"
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '1.2rem', cursor: 'pointer', color: '#fff' }}
              >
                🔊
              </button>
            </div>

            {/* Visual clue of discovered crossing letters */}
            <div style={{ margin: '1rem 0 0.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '4px' }}>Known Letters:</div>
              <div style={{ fontSize: '1.3rem', color: '#feca57', letterSpacing: '6px', fontWeight: 'bold' }}>
                {getDiscoveredPattern(activeClue)}
              </div>
            </div>
            
            <div className="answer-input">
              <input 
                id="clue-input"
                type="text" 
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={activeClue.length}
                placeholder={`Type ${activeClue.length} letters...`}
                disabled={isRevealing}
                autoFocus 
              />
            </div>

            {modalMessage && <div className={`result-message ${modalMessage.type}`}>{modalMessage.text}</div>}

            <div className="button-group" style={{ marginTop: '1.5rem', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button 
                className="btn-validate" 
                onClick={handleCheckAnswer} 
                disabled={isRevealing || modalInput.trim().length === 0}
                style={{ background: '#28a745', color: 'white', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: isRevealing ? 'not-allowed' : 'pointer', opacity: isRevealing ? 0.6 : 1, fontWeight: 'bold' }}
              >
                Check Answer
              </button>
              <button 
                type="button"
                onClick={handleRevealOneLetter} 
                disabled={isRevealing}
                style={{ background: '#17a2b8', color: 'white', padding: '10px 14px', borderRadius: '8px', border: 'none', cursor: isRevealing ? 'not-allowed' : 'pointer', opacity: isRevealing ? 0.6 : 1, fontWeight: 'bold' }}
                title="Reveals the next letter"
              >
                💡 Hint 1 Letter
              </button>
              <button 
                className="btn-reveal" 
                onClick={handleRevealAnswer} 
                disabled={isRevealing}
                style={{ background: '#ffc107', color: 'black', padding: '10px 14px', borderRadius: '8px', border: 'none', cursor: isRevealing ? 'not-allowed' : 'pointer', opacity: isRevealing ? 0.6 : 1, fontWeight: 'bold' }}
              >
                Reveal Word
              </button>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '15px' }}>
              <button 
                className="btn-cancel" 
                onClick={closeModal} 
                disabled={isRevealing}
                style={{ 
                  background: '#6c757d', 
                  color: 'white', 
                  padding: '8px 24px', 
                  borderRadius: '6px', 
                  border: 'none', 
                  cursor: isRevealing ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: isRevealing ? 0.6 : 1 
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="modal-overlay" style={{ zIndex: 9998 }}>
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#28a745', marginBottom: '0.5rem', fontSize: '2rem' }}>🎉 Crossword Solved!</h2>
            
            {/* Animated Stars */}
            <div style={{ fontSize: '3rem', margin: '1rem 0', letterSpacing: '8px' }}>
              {'⭐'.repeat(calculateStars())}
              <span style={{ opacity: 0.2 }}>{'⭐'.repeat(3 - calculateStars())}</span>
            </div>
            
            <p style={{ color: '#feca57', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {calculateStars() === 3 ? '🏆 Crossword Champion! Perfect 3 Stars!' : calculateStars() === 2 ? '🌟 Super Detective! Well Solved!' : '👍 Great Effort! Keep Practicing!'}
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
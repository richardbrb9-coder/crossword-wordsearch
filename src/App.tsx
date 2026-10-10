import { useState, useEffect } from 'react';
import { Puzzle, Difficulty, PuzzleTheme } from '@/types';
import OpeningScreen from './components/OpeningScreen';
import SelectionScreen from './components/SelectionScreen';
import GameScreen from './components/GameScreen';
import WordSearchScreen from './components/WordSearchScreen';
import './App.css';

import { loadData } from './services/dataLoader.ts';
import { generateCrossword, generateWordSearch } from './services/puzzleGenerator';
import { soundService } from './services/soundService';
import { THEMES } from './data/themes';

function App() {
  const [screen, setScreen] = useState<'opening' | 'selection' | 'loading' | 'game'>('opening');
  const [selectedPuzzle, setSelectedPuzzle] = useState<Puzzle | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // State to store the loaded words
  const [wordBank, setWordBank] = useState<any[]>([]);

  const handleStart = () => {
    setScreen('selection');
  };

  // Load data when component mounts
  useEffect(() => {
    loadData('/words.json')
      .then(words => {
        console.log('Data loaded:', words.length, 'words');
        setWordBank(words);
        setIsDataLoaded(true);
      })
      .catch(error => {
        console.error('Failed to load data:', error);
        // Fallback to mock data
        const mockWords = [
          { word: 'CAT', definitions: ['A common domestic pet'], synonyms: ['feline'], antonyms: ['dog'], length: 3 },
          { word: 'DOG', definitions: ['A loyal companion animal'], synonyms: ['canine'], antonyms: ['cat'], length: 3 },
          { word: 'HOUSE', definitions: ['A place where people live'], synonyms: ['home', 'residence'], antonyms: ['shack'], length: 5 },
        ];
        setWordBank(mockWords);
        setIsDataLoaded(true);
        console.warn('Using mock data as fallback');
      });
  }, []);

  const [isMuted, setIsMuted] = useState(soundService.isMuted());

  const toggleSound = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  const handleSelect = async (
    settings: {
      puzzleType: 'crossword' | 'wordsearch';
      difficulty: Difficulty;
      wordCount: number;
      theme: PuzzleTheme;
    }
  ): Promise<void> => {
    let activeWords = wordBank;

    if (!isDataLoaded || activeWords.length === 0) {
      setScreen('loading');
      setLoadingMessage('Loading word dictionary...');
      try {
        const loaded = await loadData('/words.json');
        activeWords = loaded;
        setWordBank(loaded);
        setIsDataLoaded(true);
      } catch (error: any) {
        console.error('Failed to load data:', error);
        const mockWords = [
          { word: 'CAT', definitions: ['A common domestic pet.'], synonyms: ['feline'], antonyms: ['dog'], length: 3 },
          { word: 'DOG', definitions: ['A loyal companion animal.'], synonyms: ['canine'], antonyms: ['cat'], length: 3 },
          { word: 'HOUSE', definitions: ['A place where people live.'], synonyms: ['home', 'residence'], antonyms: ['shack'], length: 5 },
        ];
        activeWords = mockWords;
        setWordBank(mockWords);
        setIsDataLoaded(true);
      }
    }
    
    try {
      const selectedTheme = settings.theme || 'all';
      const themeData = THEMES[selectedTheme];
      const wordsPool = (selectedTheme !== 'all' && themeData && themeData.words.length > 0)
        ? themeData.words
        : activeWords;

      const themeTitle = themeData ? `${themeData.icon} ${themeData.name}` : '🎯 Kids';

      if (settings.puzzleType === 'crossword') {
        const puzzle = generateCrossword(
          wordsPool,
          settings.difficulty,
          `${themeTitle} Crossword`,
          15,
          15,
          settings.wordCount
        );
        puzzle.theme = selectedTheme;
        setSelectedPuzzle(puzzle);
        setScreen('game');
      } else {
        const puzzle = generateWordSearch(
          wordsPool,
          settings.difficulty,
          `${themeTitle} Word Search`,
          12,
          settings.wordCount
        );
        puzzle.theme = selectedTheme;
        setSelectedPuzzle(puzzle);
        setScreen('game');
      }
    } catch (error: any) {
      console.error('Error generating puzzle:', error);
      setScreen('selection');
      alert(`Could not generate puzzle: ${error.message || 'Please try again'}`);
    }
  };

  return (
    <div className="app">
      {/* Sound Mute/Unmute Toggle */}
      <button 
        type="button"
        onClick={toggleSound}
        className="sound-toggle-btn"
        title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        style={{
          position: 'fixed',
          top: '12px',
          right: '16px',
          zIndex: 9999,
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '50%',
          width: '42px',
          height: '42px',
          cursor: 'pointer',
          fontSize: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          transition: 'transform 0.2s ease',
        }}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {screen === 'opening' && (
        <OpeningScreen onStart={handleStart} />
      )}
      
      {screen === 'loading' && (
        <div className="loading-screen" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '1.5rem', fontSize: '1.2rem', color: '#feca57' }}>{loadingMessage}</p>
        </div>
      )}
      
      {screen === 'selection' && (
        <SelectionScreen onStartGame={handleSelect} />
      )}
      
      {screen === 'game' && selectedPuzzle && selectedPuzzle.type === 'crossword' && (
        <GameScreen puzzle={selectedPuzzle} onExit={handleStart} />
      )}

      {screen === 'game' && selectedPuzzle && selectedPuzzle.type === 'wordsearch' && (
        <WordSearchScreen puzzle={selectedPuzzle} onExit={handleStart} />
      )}
    </div>
  );
}

export default App;
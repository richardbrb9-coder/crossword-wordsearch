import { useState, useEffect } from 'react';
import type { Puzzle, Difficulty, PuzzleTheme, PlayMode, WordEntry } from './types/index.ts';
import OpeningScreen from './components/OpeningScreen';
import SelectionScreen from './components/SelectionScreen';
import GameScreen from './components/GameScreen';
import WordSearchScreen from './components/WordSearchScreen';
import { StickerBookModal } from './components/StickerBookModal';
import './App.css';

import { loadData } from './services/dataLoader.ts';
import { generateCrossword, generateWordSearch, getCrosswordMaxSize } from './services/puzzleGenerator';
import { soundService } from './services/soundService';
import { THEMES } from './data/themes';

function App() {
  const [screen, setScreen] = useState<'opening' | 'selection' | 'loading' | 'game'>('opening');
  const [selectedPuzzle, setSelectedPuzzle] = useState<Puzzle | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isStickerBookOpen, setIsStickerBookOpen] = useState(false);
  
  // State to store the loaded words
  const [wordBank, setWordBank] = useState<WordEntry[]>([]);

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
  const [colorTheme, setColorTheme] = useState<'bright' | 'dark'>(() => {
    try {
      return (localStorage.getItem('puzzle_color_theme') as 'bright' | 'dark') || 'bright';
    } catch {
      return 'bright';
    }
  });

  const toggleSound = () => {
    const muted = soundService.toggleMute();
    setIsMuted(muted);
  };

  const toggleColorTheme = () => {
    soundService.playTap();
    const next = colorTheme === 'bright' ? 'dark' : 'bright';
    setColorTheme(next);
    try {
      localStorage.setItem('puzzle_color_theme', next);
    } catch {}
  };

  const handleSelect = async (
    settings: {
      puzzleType: 'crossword' | 'wordsearch';
      difficulty: Difficulty;
      wordCount: number;
      theme: PuzzleTheme;
      playMode: PlayMode;
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
      const themeWords = (selectedTheme !== 'all' && themeData && themeData.words.length > 0)
        ? themeData.words
        : activeWords;

      const fitsDifficulty = (w: WordEntry) => {
        const len = w.word.length;
        if (settings.difficulty === 'easy') return len >= 3 && len <= 6;
        if (settings.difficulty === 'medium') return len >= 5 && len <= 10;
        return len >= 7 && len <= 15;
      };
      const diffMatches = themeWords.filter(fitsDifficulty);

      // Themed puzzles use only their own words. Merging in the whole dictionary
      // left almost no on-theme words, so only top up a theme that is short.
      const shortfall = settings.wordCount - diffMatches.length;
      const wordsPool = (shortfall > 0 && activeWords.length > 0)
        ? [...themeWords, ...activeWords.filter(fitsDifficulty).sort(() => 0.5 - Math.random()).slice(0, shortfall * 2)]
        : themeWords;

      const themeTitle = themeData ? `${themeData.icon} ${themeData.name}` : '🎯 Kids';

      if (settings.puzzleType === 'crossword') {
        const maxSize = getCrosswordMaxSize(settings.difficulty, settings.wordCount);
        const puzzle = generateCrossword(
          wordsPool,
          settings.difficulty,
          `${themeTitle} Crossword`,
          maxSize.width,
          maxSize.height,
          settings.wordCount,
          settings.playMode
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
          settings.wordCount,
          settings.playMode
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
    <div className="app" data-theme={colorTheme}>
      {/* Top Action Controls: Stickers, Theme & Sound */}
      <div className="top-controls no-print">
        <button 
          type="button"
          onClick={() => { soundService.playTap(); setIsStickerBookOpen(true); }}
          className="control-btn sticker-btn"
          title="Open My Sticker Album 🏆"
        >
          🏆 Stickers
        </button>
        <button 
          type="button"
          onClick={toggleColorTheme}
          className="control-btn"
          title={colorTheme === 'bright' ? 'Switch to Dark Mode 🌙' : 'Switch to Bright Mode ☀️'}
        >
          {colorTheme === 'bright' ? '🌙' : '☀️'}
        </button>
        <button 
          type="button"
          onClick={toggleSound}
          className="control-btn"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </div>

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

      {/* Global Sticker Album Modal */}
      <StickerBookModal isOpen={isStickerBookOpen} onClose={() => setIsStickerBookOpen(false)} />
    </div>
  );
}

export default App;
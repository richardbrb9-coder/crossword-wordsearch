import React from 'react';
import { soundService } from '../services/soundService';

interface OpeningScreenProps {
  onStart: () => void;
}

const OpeningScreen: React.FC<OpeningScreenProps> = ({ onStart }) => {
  const handleClick = () => {
    soundService.playTap();
    onStart();
  };

  return (
    <div className="opening-screen">
      <div className="content">
        <h1>Word Puzzle Master</h1>
        <p>Fun and educational crosswords and word searches for kids!</p>
        <button onClick={handleClick} className="start-button">
          Start Adventure!
        </button>
      </div>
    </div>
  );
};

export default OpeningScreen;

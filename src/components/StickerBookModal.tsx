import React, { useState } from 'react';
import { stickerService, ALL_STICKERS } from '../services/stickerService';
import type { PuzzleTheme } from '../types/index.ts';
import { soundService } from '../services/soundService';
import './StickerBookModal.css';

interface StickerBookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StickerBookModal: React.FC<StickerBookModalProps> = ({ isOpen, onClose }) => {
  const [selectedTheme, setSelectedTheme] = useState<PuzzleTheme | 'all'>('all');

  if (!isOpen) return null;

  const stats = stickerService.getUserStats();
  const unlockedSet = new Set(stats.unlockedStickers);

  const filteredStickers = ALL_STICKERS.filter(s => {
    if (selectedTheme === 'all') return true;
    return s.theme === selectedTheme;
  });

  const unlockedCount = stats.unlockedStickers.length;
  const totalCount = ALL_STICKERS.length;

  return (
    <div className="sticker-modal-overlay" onClick={onClose}>
      <div className="sticker-modal-content" onClick={e => e.stopPropagation()}>
        <div className="sticker-modal-header">
          <div>
            <h2>🏆 My Sticker Album</h2>
            <p className="sticker-subtitle">Collect shiny badges by solving puzzles with 3 stars!</p>
          </div>
          <button className="sticker-close-btn" onClick={() => { soundService.playTap(); onClose(); }}>
            ✕
          </button>
        </div>

        {/* Stats Overview Pill Bar */}
        <div className="sticker-stats-bar">
          <div className="stat-pill">
            <span className="stat-icon">⭐</span>
            <div className="stat-content">
              <div className="stat-val">{stats.totalStars}</div>
              <div className="stat-lbl">Stars Earned</div>
            </div>
          </div>
          <div className="stat-pill">
            <span className="stat-icon">🧩</span>
            <div className="stat-content">
              <div className="stat-val">{stats.puzzlesSolved}</div>
              <div className="stat-lbl">Puzzles Solved</div>
            </div>
          </div>
          <div className="stat-pill">
            <span className="stat-icon">🎨</span>
            <div className="stat-content">
              <div className="stat-val">{unlockedCount} / {totalCount}</div>
              <div className="stat-lbl">Stickers Collected</div>
            </div>
          </div>
        </div>

        {/* Category Filters */}
        <div className="sticker-filters">
          {[
            { id: 'all', icon: '🌈', label: 'All' },
            { id: 'animals', icon: '🦁', label: 'Animals' },
            { id: 'space', icon: '🚀', label: 'Space' },
            { id: 'food', icon: '🍕', label: 'Food' },
            { id: 'fantasy', icon: '🏰', label: 'Fantasy' },
            { id: 'sports', icon: '⚽', label: 'Sports' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`filter-btn ${selectedTheme === tab.id ? 'active' : ''}`}
              onClick={() => {
                soundService.playTap();
                setSelectedTheme(tab.id as any);
              }}
            >
              <span className="filter-emoji">{tab.icon}</span>
              <span className="filter-label">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Sticker Cards Grid */}
        <div className="stickers-grid">
          {filteredStickers.map(sticker => {
            const isUnlocked = unlockedSet.has(sticker.id);
            return (
              <div
                key={sticker.id}
                className={`sticker-card ${isUnlocked ? 'unlocked' : 'locked'}`}
                title={isUnlocked ? sticker.description : `🔒 Locked - Solve puzzles to unlock!`}
              >
                <div className="sticker-badge">
                  {isUnlocked ? (
                    <span className="sticker-emoji">{sticker.emoji}</span>
                  ) : (
                    <span className="sticker-locked-icon">🔒</span>
                  )}
                </div>
                <div className="sticker-name">
                  {isUnlocked ? sticker.title : '???'}
                </div>
                <p className="sticker-desc">
                  {isUnlocked ? sticker.description : 'Earn 3 stars to reveal!'}
                </p>
                {isUnlocked && <span className="unlocked-tag">UNLOCKED 🎉</span>}
              </div>
            );
          })}
        </div>

        <div className="sticker-modal-footer">
          <button className="sticker-done-btn" onClick={() => { soundService.playTap(); onClose(); }}>
            Back to Adventure 🎯
          </button>
        </div>
      </div>
    </div>
  );
};

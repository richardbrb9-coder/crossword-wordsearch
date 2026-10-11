import type { Sticker, UserStats, PuzzleTheme } from '../types/index.ts';

const STATS_STORAGE_KEY = 'kids_puzzle_user_stats';

export const ALL_STICKERS: Sticker[] = [
  // Animals
  {
    id: 'lion',
    title: 'King of Jungle',
    emoji: '🦁',
    theme: 'animals',
    description: 'Awarded for a perfect 3-star Animals puzzle!',
  },
  {
    id: 'dolphin',
    title: 'Ocean Dolphin',
    emoji: '🐬',
    theme: 'animals',
    description: 'Awarded for solving an Animals challenge with 3 stars.',
  },
  {
    id: 'panda',
    title: 'Bamboo Panda',
    emoji: '🐼',
    theme: 'animals',
    description: 'Awarded for solving 3 or more animal puzzles.',
  },
  {
    id: 'butterfly',
    title: 'Rainbow Wings',
    emoji: '🦋',
    theme: 'animals',
    description: 'Awarded for finding all words without any hints.',
  },

  // Space
  {
    id: 'rocket',
    title: 'Cosmic Rocket',
    emoji: '🚀',
    theme: 'space',
    description: 'Awarded for a stellar 3-star Space mission!',
  },
  {
    id: 'astronaut',
    title: 'Star Astronaut',
    emoji: '👨‍🚀',
    theme: 'space',
    description: 'Awarded for brave exploration of the cosmos.',
  },
  {
    id: 'saturn',
    title: 'Rings of Saturn',
    emoji: '🪐',
    theme: 'space',
    description: 'Awarded for solving a challenging space puzzle.',
  },
  {
    id: 'alien',
    title: 'Cosmic Friend',
    emoji: '🛸',
    theme: 'space',
    description: 'Awarded for spotting secret words across galaxies.',
  },

  // Food
  {
    id: 'pizza',
    title: 'Master Chef Pizza',
    emoji: '🍕',
    theme: 'food',
    description: 'Awarded for baking a delicious 3-star Food puzzle!',
  },
  {
    id: 'cupcake',
    title: 'Sweet Cupcake',
    emoji: '🧁',
    theme: 'food',
    description: 'Awarded for solving food treats without asking for hints.',
  },
  {
    id: 'icecream',
    title: 'Sundae Delight',
    emoji: '🍦',
    theme: 'food',
    description: 'Awarded for great detective skills on food words.',
  },
  {
    id: 'strawberry',
    title: 'Berry Sweet',
    emoji: '🍓',
    theme: 'food',
    description: 'Awarded for healthy food puzzle mastery.',
  },

  // Fantasy
  {
    id: 'dragon',
    title: 'Dragon Tamer',
    emoji: '🐉',
    theme: 'fantasy',
    description: 'Awarded for conquering a magical 3-star Fantasy realm!',
  },
  {
    id: 'unicorn',
    title: 'Magic Unicorn',
    emoji: '🦄',
    theme: 'fantasy',
    description: 'Awarded for solving an enchanted fairytale puzzle.',
  },
  {
    id: 'wizard',
    title: 'Grand Sorcerer',
    emoji: '🧙',
    theme: 'fantasy',
    description: 'Awarded for casting spells on tricky puzzle clues.',
  },
  {
    id: 'crown',
    title: 'Royal Crown',
    emoji: '👑',
    theme: 'fantasy',
    description: 'Awarded for royal puzzle problem-solving excellence.',
  },

  // Sports
  {
    id: 'trophy',
    title: 'Golden Champion',
    emoji: '🏆',
    theme: 'sports',
    description: 'Awarded for achieving 1st place 3-star Sports victory!',
  },
  {
    id: 'soccer',
    title: 'Soccer Striker',
    emoji: '⚽',
    theme: 'sports',
    description: 'Awarded for kicking puzzle goals with precision.',
  },
  {
    id: 'medal',
    title: 'Olympic Gold',
    emoji: '🥇',
    theme: 'sports',
    description: 'Awarded for lightning-fast sports puzzle action.',
  },
  {
    id: 'basketball',
    title: 'Slam Dunk',
    emoji: '🏀',
    theme: 'sports',
    description: 'Awarded for athletic puzzle determination.',
  },

  // Milestones
  {
    id: 'star_collector',
    title: 'Star Collector',
    emoji: '⭐',
    theme: 'general',
    description: 'Earned 10 total stars across your puzzles!',
  },
  {
    id: 'puzzle_prodigy',
    title: 'Puzzle Prodigy',
    emoji: '🎯',
    theme: 'general',
    description: 'Earned 25 total stars across your adventure!',
  },
  {
    id: 'grand_master',
    title: 'Legendary Master',
    emoji: '🌟',
    theme: 'general',
    description: 'Earned 50 total stars! You are an ultimate word genius!',
  },
];

class StickerService {
  private getInitialStats(): UserStats {
    return {
      totalStars: 0,
      puzzlesSolved: 0,
      unlockedStickers: [],
    };
  }

  public getUserStats(): UserStats {
    try {
      const data = localStorage.getItem(STATS_STORAGE_KEY);
      if (!data) return this.getInitialStats();
      const parsed = JSON.parse(data);
      return {
        totalStars: Number(parsed.totalStars) || 0,
        puzzlesSolved: Number(parsed.puzzlesSolved) || 0,
        unlockedStickers: Array.isArray(parsed.unlockedStickers) ? parsed.unlockedStickers : [],
      };
    } catch {
      return this.getInitialStats();
    }
  }

  private saveUserStats(stats: UserStats): void {
    try {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('Could not save user stats to localStorage:', e);
    }
  }

  public recordPuzzleWin(
    theme: PuzzleTheme,
    stars: number
  ): { newStickers: Sticker[]; stats: UserStats } {
    const stats = this.getUserStats();
    const prevUnlocked = new Set(stats.unlockedStickers);

    stats.puzzlesSolved += 1;
    stats.totalStars += stars;

    const newlyUnlockedIds: string[] = [];

    // 1. Theme-specific unlocks for 3-star wins
    if (stars === 3) {
      if (theme === 'animals' && !prevUnlocked.has('lion')) newlyUnlockedIds.push('lion');
      else if (theme === 'space' && !prevUnlocked.has('rocket')) newlyUnlockedIds.push('rocket');
      else if (theme === 'food' && !prevUnlocked.has('pizza')) newlyUnlockedIds.push('pizza');
      else if (theme === 'fantasy' && !prevUnlocked.has('dragon')) newlyUnlockedIds.push('dragon');
      else if (theme === 'sports' && !prevUnlocked.has('trophy')) newlyUnlockedIds.push('trophy');
      else if (theme === 'all' && !prevUnlocked.has('butterfly')) newlyUnlockedIds.push('butterfly');
    }

    // 2. Play count unlocks
    if (stats.puzzlesSolved >= 2 && !prevUnlocked.has('cupcake')) newlyUnlockedIds.push('cupcake');
    if (stats.puzzlesSolved >= 3 && !prevUnlocked.has('dolphin')) newlyUnlockedIds.push('dolphin');
    if (stats.puzzlesSolved >= 5 && !prevUnlocked.has('astronaut')) newlyUnlockedIds.push('astronaut');
    if (stats.puzzlesSolved >= 7 && !prevUnlocked.has('soccer')) newlyUnlockedIds.push('soccer');
    if (stats.puzzlesSolved >= 10 && !prevUnlocked.has('unicorn')) newlyUnlockedIds.push('unicorn');
    if (stats.puzzlesSolved >= 12 && !prevUnlocked.has('panda')) newlyUnlockedIds.push('panda');
    if (stats.puzzlesSolved >= 15 && !prevUnlocked.has('saturn')) newlyUnlockedIds.push('saturn');

    // 3. Star milestone unlocks
    if (stats.totalStars >= 10 && !prevUnlocked.has('star_collector')) newlyUnlockedIds.push('star_collector');
    if (stats.totalStars >= 25 && !prevUnlocked.has('puzzle_prodigy')) newlyUnlockedIds.push('puzzle_prodigy');
    if (stats.totalStars >= 50 && !prevUnlocked.has('grand_master')) newlyUnlockedIds.push('grand_master');

    // Fallback: If 3 stars achieved and nothing unlocked, give next available theme sticker
    if (stars === 3 && newlyUnlockedIds.length === 0) {
      const candidates = ALL_STICKERS.filter(s => s.theme === theme && !prevUnlocked.has(s.id));
      if (candidates.length > 0 && candidates[0]) {
        newlyUnlockedIds.push(candidates[0].id);
      }
    }

    // Update stats
    newlyUnlockedIds.forEach(id => prevUnlocked.add(id));
    stats.unlockedStickers = Array.from(prevUnlocked);
    this.saveUserStats(stats);

    const newStickers = ALL_STICKERS.filter(s => newlyUnlockedIds.includes(s.id));
    return { newStickers, stats };
  }

  public getAllStickers(): Sticker[] {
    return ALL_STICKERS;
  }

  public isStickerUnlocked(id: string): boolean {
    const stats = this.getUserStats();
    return stats.unlockedStickers.includes(id);
  }
}

export const stickerService = new StickerService();

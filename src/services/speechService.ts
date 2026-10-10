/**
 * Text-to-speech helper for young readers and kids under 12.
 * Uses browser native SpeechSynthesis API.
 */

class SpeechService {
  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public speak(text: string): void {
    if (!this.isAvailable()) return;

    try {
      window.speechSynthesis.cancel(); // Stop any active utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower, clearer rate for children
      utterance.pitch = 1.1; // Friendly tone

      // Try to pick an English voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis failed silently
    }
  }

  public stop(): void {
    if (!this.isAvailable()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

export const speechService = new SpeechService();

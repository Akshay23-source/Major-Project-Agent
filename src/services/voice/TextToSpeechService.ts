import * as Speech from 'expo-speech';
import { TTSProvider } from './VoiceProvider';

class ExpoTextToSpeechService implements TTSProvider {
  isSpeaking: boolean = false;
  private timer: any = null;

  async speak(text: string, languageCode: string, onDone?: () => void, onError?: (error: any) => void): Promise<void> {
    try {
      this.stop();
      this.isSpeaking = true;
      const normalizedLanguage = languageCode ? (languageCode.includes('-') ? languageCode : `${languageCode}-IN`) : 'en-IN';

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this.isSpeaking = false;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (onDone) onDone();
      };

      // Safeguard: auto-finish if speech synthesis fails to fire onDone (known browser quirk)
      const maxDurationMs = Math.max(2500, (text?.length || 20) * 90);
      this.timer = setTimeout(finish, maxDurationMs);

      Speech.speak(text, {
        language: normalizedLanguage,
        onDone: finish,
        onError: (error) => {
          this.isSpeaking = false;
          if (this.timer) clearTimeout(this.timer);
          if (onError) onError(error);
          else finish();
        },
        onStopped: finish,
      });
    } catch (error) {
      this.isSpeaking = false;
      if (onError) onError(error);
      if (onDone) onDone();
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.isSpeaking) {
      try {
        await Speech.stop();
      } catch {}
      this.isSpeaking = false;
    }
  }
}

export const ttsService = new ExpoTextToSpeechService();

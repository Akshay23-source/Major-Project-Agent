import * as Speech from 'expo-speech';
import { TTSProvider } from './VoiceProvider';

class ExpoTextToSpeechService implements TTSProvider {
  isSpeaking: boolean = false;

  async speak(text: string, languageCode: string, onDone?: () => void, onError?: (error: any) => void): Promise<void> {
    try {
      this.isSpeaking = true;
      const normalizedLanguage = languageCode ? (languageCode.includes('-') ? languageCode : `${languageCode}-IN`) : 'en-IN';
      Speech.speak(text, {
        language: normalizedLanguage,
        onDone: () => {
          this.isSpeaking = false;
          if (onDone) onDone();
        },
        onError: (error) => {
          this.isSpeaking = false;
          if (onError) onError(error);
        },
        onStopped: () => {
          this.isSpeaking = false;
          if (onDone) onDone();
        }
      });
    } catch (error) {
      this.isSpeaking = false;
      if (onError) onError(error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.isSpeaking) {
      await Speech.stop();
      this.isSpeaking = false;
    }
  }
}

export const ttsService = new ExpoTextToSpeechService();

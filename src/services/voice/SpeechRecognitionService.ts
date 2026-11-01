import { Platform } from 'react-native';
import { STTProvider } from './VoiceProvider';
import { api } from '../../lib/api';

const LANGUAGE_BCP47_MAP: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  bn: 'bn-IN',
  pa: 'pa-IN',
  ml: 'ml-IN',
};

class UnifiedSTTService implements STTProvider {
  isListening: boolean = false;
  private recording: any | null = null;
  private webRecognition: any | null = null;
  private webMediaRecorder: any | null = null;
  private webAudioChunks: Blob[] = [];
  private accumulatedTranscript: string = '';
  private onPartialResultCallback?: (text: string) => void;
  private currentLanguageCode: string = 'en';
  private lastDetectedLanguage: string = 'en';

  getLastDetectedLanguage(): string {
    return this.lastDetectedLanguage;
  }

  async startListening(languageCode: string, onPartialResult?: (text: string) => void): Promise<void> {
    this.currentLanguageCode = languageCode || 'en';
    this.lastDetectedLanguage = languageCode || 'en';
    this.onPartialResultCallback = onPartialResult;
    this.accumulatedTranscript = '';

    if (Platform.OS === 'web') {
      await this.startWebListening();
    } else {
      await this.startNativeListening();
    }
  }

  async stopListening(): Promise<string> {
    if (!this.isListening && !this.accumulatedTranscript) {
      return '';
    }

    if (Platform.OS === 'web') {
      return await this.stopWebListening();
    } else {
      return await this.stopNativeListening();
    }
  }

  async cancelListening(): Promise<void> {
    this.isListening = false;
    this.accumulatedTranscript = '';

    if (this.webRecognition) {
      try {
        this.webRecognition.abort();
      } catch {}
      this.webRecognition = null;
    }

    if (this.webMediaRecorder) {
      try {
        if (this.webMediaRecorder.stream) {
          this.webMediaRecorder.stream.getTracks().forEach((track: any) => track.stop());
        }
        this.webMediaRecorder.stop();
      } catch {}
      this.webMediaRecorder = null;
    }

    if (this.recording) {
      try {
        await this.recording.stop();
      } catch {}
      this.recording = null;
    }
  }

  // ─────────────────────────────────────────────
  // Web Speech & Audio Recording
  // ─────────────────────────────────────────────
  private async startWebListening(): Promise<void> {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        const bcp47 = LANGUAGE_BCP47_MAP[this.currentLanguageCode] || `${this.currentLanguageCode}-IN`;
        recognition.lang = bcp47;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let current = '';
          for (let i = 0; i < event.results.length; i++) {
            current += event.results[i][0].transcript;
          }
          this.accumulatedTranscript = current;
          if (this.onPartialResultCallback) {
            this.onPartialResultCallback(current);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('[stt] Web Speech recognition error:', event?.error);
        };

        recognition.onend = () => {
          // If stopped externally or silent
          this.isListening = false;
        };

        recognition.start();
        this.webRecognition = recognition;
        this.isListening = true;
        return;
      } catch (err: any) {
        console.warn('[stt] SpeechRecognition start failed, trying MediaRecorder:', err);
      }
    }

    // Fallback: browser MediaRecorder for sending to backend
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new (window as any).MediaRecorder(stream);
        this.webAudioChunks = [];

        mediaRecorder.ondataavailable = (e: any) => {
          if (e.data && e.data.size > 0) {
            this.webAudioChunks.push(e.data);
          }
        };

        mediaRecorder.start();
        this.webMediaRecorder = mediaRecorder;
        this.isListening = true;
      } catch (err: any) {
        this.isListening = false;
        throw new Error('Microphone permission denied or not available. Please allow mic access in your browser.');
      }
    } else {
      throw new Error('Speech recognition is not supported in this browser. Please use Chrome, Edge or Safari.');
    }
  }

  private async stopWebListening(): Promise<string> {
    this.isListening = false;

    if (this.webRecognition) {
      try {
        this.webRecognition.stop();
      } catch {}
      this.webRecognition = null;
      return this.accumulatedTranscript.trim();
    }

    if (this.webMediaRecorder) {
      return new Promise<string>((resolve) => {
        const recorder = this.webMediaRecorder;
        this.webMediaRecorder = null;

        recorder.onstop = async () => {
          try {
            if (recorder.stream) {
              recorder.stream.getTracks().forEach((track: any) => track.stop());
            }

            const audioBlob = new Blob(this.webAudioChunks, { type: recorder.mimeType || 'audio/webm' });
            this.webAudioChunks = [];

            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              try {
                const base64Data = (reader.result as string)?.split(',')[1];
                if (!base64Data) {
                  resolve('');
                  return;
                }
                const data = await api.post<{ transcription?: string; detectedLanguage?: string }>('/ai/transcribe', {
                  audioData: base64Data,
                  languageCode: this.currentLanguageCode
                });
                if (data?.detectedLanguage) {
                  this.lastDetectedLanguage = data.detectedLanguage;
                }
                resolve(data?.transcription || '');
              } catch (err: any) {
                console.error('[stt] Transcribe error:', err);
                resolve('');
              }
            };
            reader.onerror = () => resolve('');
          } catch {
            resolve('');
          }
        };

        try {
          recorder.stop();
        } catch {
          resolve('');
        }
      });
    }

    return this.accumulatedTranscript.trim();
  }

  // ─────────────────────────────────────────────
  // Native (iOS / Android)
  // ─────────────────────────────────────────────
  private async startNativeListening(): Promise<void> {
    try {
      const { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } = await import('expo-audio');
      const permission = await requestRecordingPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      this.recording = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await this.recording.prepareToRecordAsync();
      this.recording.record();
      this.isListening = true;
    } catch (error) {
      this.isListening = false;
      throw error;
    }
  }

  private async stopNativeListening(): Promise<string> {
    if (!this.recording) return '';
    try {
      await this.recording.stop();
      const uri = this.recording.uri;
      this.isListening = false;
      this.recording = null;

      if (!uri) throw new Error('Failed to get recording URI');
      return await this.processAudioFile(uri);
    } catch (error) {
      this.isListening = false;
      this.recording = null;
      throw error;
    }
  }

  private async processAudioFile(uri: string): Promise<string> {
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error('Audio file not found');

      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const data = await api.post<{ transcription?: string; detectedLanguage?: string }>('/ai/transcribe', {
        audioData: base64Audio,
        languageCode: this.currentLanguageCode,
      });

      if (data?.detectedLanguage) {
        this.lastDetectedLanguage = data.detectedLanguage;
      }

      return data?.transcription || '';
    } catch (error: any) {
      console.error('[stt] Error processing audio:', error);
      throw new Error(error.message || 'Voice service is temporarily unavailable. Please try again.');
    }
  }
}

export const sttService = new UnifiedSTTService();

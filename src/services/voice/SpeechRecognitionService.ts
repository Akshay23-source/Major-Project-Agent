import { AudioModule, requestRecordingPermissionsAsync, setAudioModeAsync, RecordingPresets } from 'expo-audio';
import { STTProvider } from './VoiceProvider';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';

class ExpoAudioSTTService implements STTProvider {
  isListening: boolean = false;
  private recording: any | null = null;
  private onPartialResultCallback?: (text: string) => void;

  async startListening(languageCode: string, onPartialResult?: (text: string) => void): Promise<void> {
    try {
      this.onPartialResultCallback = onPartialResult;
      
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

  async stopListening(): Promise<string> {
    if (!this.recording) {
      throw new Error('Not currently listening');
    }

    try {
      await this.recording.stop();
      const uri = this.recording.uri;
      this.isListening = false;
      this.recording = null;

      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      return await this.processAudioFile(uri);
    } catch (error) {
      this.isListening = false;
      this.recording = null;
      throw error;
    }
  }

  async cancelListening(): Promise<void> {
    if (this.recording) {
      await this.recording.stop();
      this.isListening = false;
      this.recording = null;
    }
  }

  private async processAudioFile(uri: string): Promise<string> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) throw new Error("Audio file not found");

      // Read audio file as base64 to send via JSON payload
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Securely invoke the edge function, which has the Sarvam API key server-side
      const { data, error } = await supabase.functions.invoke('agri-ai', {
        body: { audioData: base64Audio }
      });

      if (error) {
        console.error("Edge Function STT Error:", error.message);
        throw new Error("Voice service is temporarily unavailable. Please try again.");
      }

      return data?.transcription || '';

    } catch (error: any) {
      console.error('Error processing audio:', error);
      throw new Error(error.message || "Voice service is temporarily unavailable. Please try again.");
    }
  }
}

export const sttService = new ExpoAudioSTTService();

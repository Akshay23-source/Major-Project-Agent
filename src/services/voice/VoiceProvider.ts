export interface STTProvider {
  startListening: (languageCode: string, onPartialResult?: (text: string) => void) => Promise<void>;
  stopListening: () => Promise<string>;
  cancelListening: () => Promise<void>;
  isListening: boolean;
}

export interface TTSProvider {
  speak: (text: string, languageCode: string, onDone?: () => void, onError?: (error: any) => void) => Promise<void>;
  stop: () => Promise<void>;
  isSpeaking: boolean;
}

export interface VoiceIntent {
  intent: string;
  parameters: Record<string, any>;
  confidence: number;
}

export interface NLPProvider {
  analyzeIntent: (text: string, languageCode: string) => Promise<VoiceIntent>;
}

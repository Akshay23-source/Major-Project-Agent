import { sttService } from './SpeechRecognitionService';
import { ttsService } from './TextToSpeechService';
import { intentService } from './VoiceIntentService';
import { VoiceIntent } from './VoiceProvider';

export type VoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR' | 'CONFIRMING';

export interface VoiceServiceOptions {
  languageCode: string;
  onStateChange?: (state: VoiceState) => void;
  onTranscriptUpdate?: (text: string) => void;
  onAssistantResponse?: (text: string) => void;
  onActionRequired?: (intent: VoiceIntent) => void;
  onError?: (error: string) => void;
}

class VoiceService {
  private state: VoiceState = 'IDLE';
  private options?: VoiceServiceOptions;
  
  init(options: VoiceServiceOptions) {
    this.options = options;
  }

  private setState(state: VoiceState) {
    this.state = state;
    if (this.options?.onStateChange) {
      this.options.onStateChange(state);
    }
  }

  async startInteraction() {
    try {
      if (!this.options) throw new Error('VoiceService not initialized');
      this.setState('LISTENING');
      await sttService.startListening(this.options.languageCode, (text) => {
        if (this.options?.onTranscriptUpdate) this.options.onTranscriptUpdate(text);
      });
    } catch (error: any) {
      this.setState('ERROR');
      if (this.options?.onError) this.options.onError(error.message);
    }
  }

  async stopListeningAndProcess() {
    try {
      if (!this.options) return;
      this.setState('THINKING');
      
      const transcript = await sttService.stopListening();
      if (this.options?.onTranscriptUpdate) this.options.onTranscriptUpdate(transcript);

      if (!transcript || transcript.trim() === '') {
        this.setState('IDLE');
        return;
      }

      const intent = await intentService.analyzeIntent(transcript, this.options.languageCode);
      
      if (intent.confidence < 0.6) {
        // Low confidence, ask to repeat
        const msg = "Sorry, I couldn't understand that clearly. Can you please repeat?";
        await this.speakResponse(msg);
        return;
      }

      if (this.isDestructiveAction(intent.intent)) {
        this.setState('CONFIRMING');
        if (this.options?.onActionRequired) this.options.onActionRequired(intent);
        return;
      }

      // Execute read actions immediately
      await this.executeAction(intent);

    } catch (error: any) {
      this.setState('ERROR');
      if (this.options?.onError) this.options.onError(error.message);
    }
  }

  private isDestructiveAction(intent: string): boolean {
    const destructiveIntents = ['CANCEL_ORDER', 'DELETE_FARMER', 'ADD_FARMER'];
    return destructiveIntents.includes(intent);
  }

  async executeAction(intent: VoiceIntent) {
    if (!this.options) return;
    
    // Here we would connect to existing services. For now we simulate success.
    console.log('Executing Intent:', intent);
    
    // Simulate processing time
    await new Promise(r => setTimeout(r, 1000));
    
    const responseText = `Executed ${intent.intent}`;
    if (this.options.onAssistantResponse) {
      this.options.onAssistantResponse(responseText);
    }
    
    await this.speakResponse(responseText);
  }

  async speakResponse(text: string) {
    if (!this.options) return;
    this.setState('SPEAKING');
    try {
      await ttsService.speak(text, this.options.languageCode, () => {
        this.setState('IDLE');
      });
    } catch (error) {
       this.setState('ERROR');
    }
  }

  async cancel() {
    await sttService.cancelListening();
    await ttsService.stop();
    this.setState('IDLE');
  }
}

export const voiceService = new VoiceService();

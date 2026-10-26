import { useState, useEffect, useCallback } from 'react';
import { voiceService, VoiceState } from '../services/voice/VoiceService';
import { VoiceIntent } from '../services/voice/VoiceProvider';
import { useLocalization } from './useLocalization';

export const useVoiceAssistant = () => {
  const [state, setState] = useState<VoiceState>('IDLE');
  const [transcript, setTranscript] = useState<string>('');
  const [assistantResponse, setAssistantResponse] = useState<string>('');
  const [pendingAction, setPendingAction] = useState<VoiceIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const { locale } = useLocalization();

  useEffect(() => {
    voiceService.init({
      languageCode: locale,
      onStateChange: (newState) => {
        setState(newState);
        if (newState !== 'IDLE') {
          setIsOpen(true);
        } else {
          setTimeout(() => {
            setIsOpen(false);
          }, 1200);
        }
      },
      onTranscriptUpdate: setTranscript,
      onAssistantResponse: setAssistantResponse,
      onActionRequired: setPendingAction,
      onError: (err) => {
        setError(err);
        setIsOpen(true);
      }
    });
  }, [locale]);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript('');
    setAssistantResponse('');
    setPendingAction(null);
    setIsOpen(true);
    await voiceService.startInteraction();
  }, []);

  const stopListening = useCallback(async () => {
    await voiceService.stopListeningAndProcess();
  }, []);

  const cancel = useCallback(async () => {
    setIsOpen(false);
    setTranscript('');
    setAssistantResponse('');
    setPendingAction(null);
    setError(null);
    setState('IDLE');
    await voiceService.cancel();
  }, []);

  const confirmAction = useCallback(async () => {
    if (pendingAction) {
      setPendingAction(null);
      await voiceService.executeAction(pendingAction);
    }
  }, [pendingAction]);

  const cancelAction = useCallback(async () => {
    setPendingAction(null);
    setState('IDLE');
    await voiceService.speakResponse('Action cancelled');
  }, []);

  return {
    isOpen,
    state,
    transcript,
    assistantResponse,
    pendingAction,
    error,
    startListening,
    stopListening,
    cancel,
    confirmAction,
    cancelAction
  };
};

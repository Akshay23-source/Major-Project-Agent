import { Stack } from "expo-router";
import { View } from "react-native";
import { Sidebar } from "../../src/components/ui/Sidebar";
import { VoiceAssistantButton } from "../../src/components/voice/VoiceAssistantButton";
import { VoiceAssistantModal } from "../../src/components/voice/VoiceAssistantModal";
import { useVoiceAssistant } from "../../src/hooks/useVoiceAssistant";

export default function AgentLayout() {
  const {
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
  } = useVoiceAssistant();

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <Sidebar />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
        <VoiceAssistantButton 
          onPress={startListening} 
          isListening={state === 'LISTENING'} 
        />
        {(state !== 'IDLE' || transcript !== '') && (
          <VoiceAssistantModal
            visible={true}
            state={state}
            transcript={transcript}
            assistantResponse={assistantResponse}
            pendingAction={pendingAction}
            error={error}
            onClose={cancel}
            onStopListening={stopListening}
            onCancel={cancel}
            onConfirmAction={confirmAction}
            onCancelAction={cancelAction}
          />
        )}
      </View>
    </View>
  );
}

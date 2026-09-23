import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalization } from '../../hooks/useLocalization';
import { VoiceState } from '../../services/voice/VoiceService';
import { VoiceIntent } from '../../services/voice/VoiceProvider';

interface VoiceAssistantModalProps {
  visible: boolean;
  state: VoiceState;
  transcript: string;
  assistantResponse: string;
  pendingAction: VoiceIntent | null;
  error: string | null;
  onClose: () => void;
  onStopListening: () => void;
  onCancel: () => void;
  onConfirmAction: () => void;
  onCancelAction: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  visible,
  state,
  transcript,
  assistantResponse,
  pendingAction,
  error,
  onClose,
  onStopListening,
  onCancel,
  onConfirmAction,
  onCancelAction,
}) => {
  const { t } = useLocalization();

  const getStatusText = () => {
    switch (state) {
      case 'LISTENING': return t('voice.listening') || 'Listening...';
      case 'THINKING': return t('voice.processing') || 'Thinking...';
      case 'SPEAKING': return t('voice.speaking') || 'Speaking...';
      case 'CONFIRMING': return 'Action Required';
      case 'ERROR': return 'Error';
      default: return '';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          
          <View style={styles.header}>
            <Text style={styles.title}>AgriAgent AI</Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.status}>{getStatusText()}</Text>

            {state === 'LISTENING' && (
              <View style={styles.waveformContainer}>
                <MaterialCommunityIcons name="microphone" size={48} color="#DC2626" />
                <TouchableOpacity onPress={onStopListening} style={styles.stopListenBtn}>
                  <Text style={styles.stopListenText}>Done Speaking</Text>
                </TouchableOpacity>
              </View>
            )}

            {state === 'THINKING' && (
              <ActivityIndicator size="large" color="#059669" style={styles.loader} />
            )}

            {transcript ? (
              <View style={styles.bubbleUser}>
                <Text style={styles.bubbleUserText}>"{transcript}"</Text>
              </View>
            ) : null}

            {assistantResponse ? (
              <View style={styles.bubbleAssistant}>
                <Text style={styles.bubbleAssistantText}>{assistantResponse}</Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {state === 'CONFIRMING' && pendingAction && (
              <View style={styles.confirmationBox}>
                <Text style={styles.confirmText}>
                  Do you want to proceed with: {pendingAction.intent.replace('_', ' ')}?
                </Text>
                <View style={styles.confirmActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onCancelAction}>
                    <Text style={styles.cancelBtnText}>{t('common.cancel') || 'Cancel'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmBtn} onPress={onConfirmAction}>
                    <Text style={styles.confirmBtnText}>{t('common.confirm') || 'Confirm'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  status: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
  },
  waveformContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  stopListenBtn: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  stopListenText: {
    color: '#374151',
    fontWeight: '500',
  },
  loader: {
    marginVertical: 20,
  },
  bubbleUser: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    marginBottom: 16,
  },
  bubbleUserText: {
    color: '#111827',
    fontSize: 16,
  },
  bubbleAssistant: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginBottom: 16,
  },
  bubbleAssistantText: {
    color: '#065F46',
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#DC2626',
  },
  confirmationBox: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  confirmText: {
    color: '#92400E',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#374151',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});

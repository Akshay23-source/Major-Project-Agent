import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface VoiceAssistantButtonProps {
  onPress: () => void;
  isListening?: boolean;
}

export const VoiceAssistantButton: React.FC<VoiceAssistantButtonProps> = ({ onPress, isListening }) => {
  return (
    <TouchableOpacity 
      style={[styles.button, isListening && styles.listening]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons 
        name={isListening ? "microphone" : "microphone-outline"} 
        size={28} 
        color="#fff" 
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669', // Emerald 600
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
  },
  listening: {
    backgroundColor: '#DC2626', // Red 600 for recording state
  }
});

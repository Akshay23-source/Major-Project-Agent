import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function VoiceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🎙️</Text>

      <Text style={styles.title}>Agri Voice Agent</Text>

      <Text style={styles.subtitle}>
        Speak with your agricultural assistant
      </Text>

      <View style={styles.languageBox}>
        <Text style={styles.languageTitle}>
          🇮🇳 23 Indian Languages
        </Text>

        <Text style={styles.languageText}>
          Choose your preferred language
        </Text>
      </View>

      <TouchableOpacity style={styles.micButton}>
        <Text style={styles.mic}>🎤</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Tap the microphone to start speaking
      </Text>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FBF7",
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },

  icon: {
    fontSize: 65,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1B5E20",
    marginTop: 15,
  },

  subtitle: {
    color: "#666",
    fontSize: 15,
    marginTop: 8,
  },

  languageBox: {
    width: "100%",
    padding: 20,
    borderRadius: 18,
    backgroundColor: "#E8F5E9",
    marginTop: 30,
    alignItems: "center",
  },

  languageTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B5E20",
  },

  languageText: {
    marginTop: 6,
    color: "#666",
  },

  micButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#2E7D32",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 35,
  },

  mic: {
    fontSize: 45,
  },

  hint: {
    marginTop: 18,
    color: "#777",
  },

  backButton: {
    marginTop: 35,
  },

  backText: {
    color: "#2E7D32",
    fontWeight: "700",
    fontSize: 16,
  },
});

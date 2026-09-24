import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, errorMessage } from "../../../src/lib/api";
import { createOrder } from "../../../src/services/orders";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  proposedAction?: any;
};

export default function AIAssistantScreen() {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: "Hello! I am Agri AI, your agricultural assistant.\n\nI can help you with:\n• Farmer insights (e.g. 'Tell me about Ramesh')\n• Order risks (e.g. 'Show pending orders')\n• Dashboard summaries\n• General agricultural advice\n\nHow can I help you today?",
      timestamp: new Date().toISOString(),
    }
  ]);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const addMessage = (msg: Message) => setMessages((prev) => [...prev, msg]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInputText("");
    setLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      conversationHistory.push({ role: "user", content: text });

      // The Agri Agent backend holds the AI keys and answers from this agent's data only
      const data = await api.post<{ reply: string; proposedAction?: any }>("/ai/chat", { messages: conversationHistory });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || "I didn't understand that.",
        timestamp: new Date().toISOString(),
        proposedAction: data.proposedAction
      };
      
      addMessage(aiMessage);

    } catch (error: any) {
      console.error("AI Assistant Error:", error);
      
      addMessage({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `AI Assistant is unavailable: ${errorMessage(error, "please try again later.")}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = async (action: any, msgId: string) => {
    if (action.intent === "CREATE_ORDER") {
      try {
        setLoading(true);
        const orderData = {
          farmer_id: action.farmer_id,
          product: action.product,
          quantity: action.quantity,
          unit: action.unit,
          price: action.price,
          total_amount: action.quantity * action.price,
          delivery_location: "",
          notes: "Created via AI Assistant",
          status: "Pending" as const,
        };
        
        const created = await createOrder(orderData);
        if (!created) throw new Error("Order was not created");
        
        addMessage({
          id: Date.now().toString(),
          role: "assistant",
          content: `✅ Order confirmed and created for ${action.farmer_name}.`,
          timestamp: new Date().toISOString(),
        });
        
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, proposedAction: null } : m));
      } catch (error) {
        Alert.alert("Error", "Failed to create order.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#14532D" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Agri AI</Text>
            <Text style={styles.subtitle}>Your Agricultural Assistant</Text>
          </View>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
        >
          {messages.map((msg) => (
            <View key={msg.id} style={[styles.messageBubble, msg.role === "user" ? styles.userBubble : styles.aiBubble]}>
              <Text style={[styles.messageText, msg.role === "user" ? styles.userText : styles.aiText]}>
                {msg.content}
              </Text>
              
              {msg.proposedAction && msg.proposedAction.intent === "CREATE_ORDER" && (
                <View style={styles.actionCard}>
                  <Text style={styles.actionTitle}>Proposed Order</Text>
                  <Text style={styles.actionDetail}>Farmer: {msg.proposedAction.farmer_name}</Text>
                  <Text style={styles.actionDetail}>Product: {msg.proposedAction.quantity} {msg.proposedAction.unit} of {msg.proposedAction.product}</Text>
                  <Text style={styles.actionDetail}>Price: ₹{msg.proposedAction.price}/{msg.proposedAction.unit}</Text>
                  
                  <TouchableOpacity 
                    style={styles.confirmButton}
                    onPress={() => handleConfirmAction(msg.proposedAction, msg.id)}
                  >
                    <Text style={styles.confirmButtonText}>Confirm Order</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
          
          {loading && (
            <View style={[styles.messageBubble, styles.aiBubble, { width: 100 }]}>
              <Text style={[styles.messageText, styles.aiText]}>Thinking...</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.suggestionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={styles.suggestionChip} onPress={() => sendMessage("Give me a dashboard summary")}>
              <Text style={styles.suggestionText}>Dashboard summary</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.suggestionChip} onPress={() => sendMessage("Show recent orders")}>
              <Text style={styles.suggestionText}>Recent orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.suggestionChip} onPress={() => sendMessage("Tell me about my farmers")}>
              <Text style={styles.suggestionText}>Farmer insights</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type your question..."
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <TouchableOpacity 
            style={[styles.sendButton, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F8F3" },
  header: { flexDirection: "row", alignItems: "center", padding: 20, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  backButton: { marginRight: 15 },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: "700", color: "#14532D" },
  subtitle: { fontSize: 13, color: "#64748B" },
  chatArea: { flex: 1, padding: 15 },
  chatContent: { paddingBottom: 20 },
  messageBubble: { maxWidth: "85%", padding: 15, borderRadius: 16, marginBottom: 15 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#15803D", borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderBottomLeftRadius: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: "#FFFFFF" },
  aiText: { color: "#1F2937" },
  actionCard: { marginTop: 12, backgroundColor: "#F9FAFB", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  actionTitle: { fontWeight: "700", color: "#111827", marginBottom: 6 },
  actionDetail: { color: "#4B5563", fontSize: 13, marginBottom: 2 },
  confirmButton: { backgroundColor: "#2563EB", padding: 10, borderRadius: 8, alignItems: "center", marginTop: 10 },
  confirmButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 14 },
  suggestionsContainer: { paddingHorizontal: 15, paddingVertical: 10 },
  suggestionChip: { backgroundColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginRight: 8 },
  suggestionText: { color: "#4B5563", fontSize: 13, fontWeight: "500" },
  inputArea: { flexDirection: "row", padding: 15, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E5E7EB", alignItems: "center" },
  input: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 20, paddingHorizontal: 15, paddingTop: 10, paddingBottom: 10, minHeight: 40, maxHeight: 100, color: "#1F2937" },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#15803D", justifyContent: "center", alignItems: "center", marginLeft: 10 }
});

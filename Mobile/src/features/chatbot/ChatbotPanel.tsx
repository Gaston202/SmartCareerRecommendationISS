import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatbot } from './hooks';
import { homeColors } from '../../screens/homeTheme';
import type { ChatMessage } from './types';

interface ChatbotPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function ChatbotPanel({ visible, onClose }: ChatbotPanelProps) {
  const { messages, isLoading, sendMessage, resetConversation } = useChatbot();
  const [inputValue, setInputValue] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!inputValue.trim() || isLoading) return;
    const messageToSend = inputValue;
    setInputValue('');
    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles" size={20} color={homeColors.onPrimary} />
              <Text style={styles.headerTitle}>Career Assistant</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable onPress={resetConversation} style={styles.headerBtn}>
                <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.8)" />
              </Pressable>
              <Pressable onPress={onClose} style={styles.headerBtn}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {messages.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubble-ellipses" size={48} color={homeColors.primaryLight} />
                <Text style={styles.emptyTitle}>How can I help you?</Text>
                <Text style={styles.emptySubtitle}>
                  Ask me about careers, mentor bookings, or skill recommendations.
                </Text>
              </View>
            ) : (
              <>
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isLoading && <LoadingBubble />}
              </>
            )}
          </ScrollView>

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Type a message..."
              placeholderTextColor={homeColors.textLight}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              blurOnSubmit={false}
              editable={!isLoading}
            />
            <Pressable
              onPress={handleSubmit}
              disabled={!inputValue.trim() || isLoading}
              style={({ pressed }) => [
                styles.sendButton,
                (!inputValue.trim() || isLoading) && styles.sendButtonDisabled,
                pressed && styles.sendButtonPressed,
              ]}
            >
              <Ionicons name="send" size={18} color={homeColors.onPrimary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowBot]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleBot,
        ]}
      >
        {renderMarkdown(message.content, isUser)}
        <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeBot]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Lightweight markdown renderer for chatbot messages.
 * Supports **bold**, bullet lists (- item), and line breaks.
 */
function renderMarkdown(text: string, isUser: boolean): React.ReactNode {
  const baseStyle = isUser ? styles.bubbleTextUser : styles.bubbleTextBot;
  const boldStyle = [baseStyle, { fontWeight: '700' as const }];

  // Split by double newlines to preserve paragraph spacing
  const paragraphs = text.split(/\n\n/);

  return paragraphs.map((paragraph, pIndex) => {
    // Split paragraph by line breaks for bullet handling
    const lines = paragraph.split('\n');
    const lineNodes = lines.map((line, lIndex) => {
      let content: React.ReactNode[] = [];
      let isBullet = false;

      // Detect bullet list items
      const bulletMatch = line.match(/^(\s*)([-•])\s+(.*)$/);
      if (bulletMatch) {
        isBullet = true;
        line = bulletMatch[3];
      }

      // Parse **bold** segments
      const segments = line.split(/(\*\*.*?\*\*)/g);
      segments.forEach((segment, sIndex) => {
        if (segment.startsWith('**') && segment.endsWith('**')) {
          const boldText = segment.slice(2, -2);
          content.push(
            <Text key={`s${sIndex}`} style={boldStyle}>
              {boldText}
            </Text>
          );
        } else if (segment) {
          content.push(
            <Text key={`s${sIndex}`} style={baseStyle}>
              {segment}
            </Text>
          );
        }
      });

      const lineKey = `l${lIndex}`;
      if (isBullet) {
        return (
          <View key={lineKey} style={styles.bulletRow}>
            <Text style={[baseStyle, styles.bulletDot]}>•</Text>
            <Text style={baseStyle}>{content}</Text>
          </View>
        );
      }

      return <Text key={lineKey}>{content}</Text>;
    });

    return (
      <View key={`p${pIndex}`} style={pIndex > 0 ? styles.paragraphGap : undefined}>
        {lineNodes}
      </View>
    );
  });
}

function LoadingBubble() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowBot]}>
      <View style={[styles.bubble, styles.bubbleBot]}>
        <View style={styles.typingIndicator}>
          <View style={styles.typingDot} />
          <View style={[styles.typingDot, styles.typingDotDelay1]} />
          <View style={[styles.typingDot, styles.typingDotDelay2]} />
        </View>
      </View>
    </View>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '50%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: homeColors.primary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: homeColors.onPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBtn: {
    padding: 6,
    borderRadius: 20,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F9F9FB',
  },
  messagesContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: homeColors.onSurface,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: homeColors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  bubbleRow: {
    flexDirection: 'row',
    width: '100%',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowBot: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 4,
  },
  bubbleUser: {
    backgroundColor: homeColors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: homeColors.onPrimary,
  },
  bubbleTextBot: {
    color: homeColors.onSurface,
  },
  bubbleTime: {
    fontSize: 10,
    marginTop: 2,
  },
  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'right',
  },
  bubbleTimeBot: {
    color: homeColors.textLight,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: homeColors.textLight,
    opacity: 0.4,
  },
  typingDotDelay1: {
    opacity: 0.7,
  },
  typingDotDelay2: {
    opacity: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: homeColors.cardBorder,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: homeColors.onSurface,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: homeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: homeColors.primaryLight + '60',
  },
  sendButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginVertical: 1,
  },
  bulletDot: {
    marginTop: 1,
  },
  paragraphGap: {
    marginTop: 8,
  },
});

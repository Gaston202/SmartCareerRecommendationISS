import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroupChat, useChatMessages } from '../../features/mentors/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';
import type { ChatMessage } from '../../types/mentor';
import { AppLogo } from '../../ui/AppLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

type MentorsStackParamList = {
  MentorsList: undefined;
  MentorDetail: { mentorId?: string; userId?: string };
  GroupChats: undefined;
  GroupChat: { chatId: string };
};

type GroupChatScreenNavigationProp = NativeStackNavigationProp<MentorsStackParamList, 'GroupChat'>;

export function GroupChatScreen() {
  const route = useRoute();
  const navigation = useNavigation<GroupChatScreenNavigationProp>();
  const { chatId } = route.params as { chatId: string };
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const user = state.user;

  const { chat, loading: chatLoading } = useGroupChat(chatId);
  const { messages, loading: messagesLoading, sendMessage } = useChatMessages(chatId);

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const sendButtonScale = useRef(new Animated.Value(1)).current;

  const canSend = messageText.trim().length > 0;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: !isInitialLoad });
        if (isInitialLoad) {
          setIsInitialLoad(false);
        }
      }, 150);
    }
  }, [messages.length, isInitialLoad]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user) return;

    try {
      setSending(true);
      const avatarUrl = user.avatar ?? `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(user.email ?? user.id)}`;
      await sendMessage(user.id, user.email || 'Anonymous', avatarUrl, messageText);
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  if (chatLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C4DFF" />
      </View>
    );
  }

  if (!chat) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Chat not found</Text>
      </View>
    );
  }

  const renderMessage = (message: any) => {
    const isCurrentUser = message.sender_id === user?.id;

    return (
      <View
        key={message.id}
        style={[styles.messageRow, isCurrentUser ? styles.messageRowRight : styles.messageRowLeft]}
      >
        {!isCurrentUser && (
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => {
              navigation.navigate('MentorDetail', { userId: message.sender_id });
            }}
            activeOpacity={0.7}
          >
            {message.sender_avatar && message.sender_avatar.trim() !== '' ? (
              <Image
                source={{ uri: message.sender_avatar }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {message.sender_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.messageContent}>
          <View
            style={[
              styles.messageBubble,
              isCurrentUser ? styles.messageBubbleOwn : styles.messageBubbleOther,
            ]}
          >
            {!isCurrentUser && (
              <TouchableOpacity
                onPress={() => {
                  navigation.navigate('MentorDetail', { userId: message.sender_id });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.senderName}>
                  {message.sender_name}
                </Text>
              </TouchableOpacity>
            )}
            <Text style={isCurrentUser ? styles.messageTextOwn : styles.messageTextOther}>
              {message.message}
            </Text>
            <Text
              style={isCurrentUser ? styles.timestampOwn : styles.timestampOther}
            >
              {new Date(message.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={({ pressed }) => [
              styles.backBtn, 
              pressed && { backgroundColor: '#E2E8F0' }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#7C4DFF" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {chat.title || 'Group Chat'}
            </Text>
          </View>

          <View style={styles.headerRight} />
        </View>

        {chat.mentor && (
          <View style={styles.mentorInfo}>
            <View style={styles.mentorIconBg}>
              <Ionicons name="person" size={14} color="#7C4DFF" />
            </View>
            <View style={styles.mentorTextContainer}>
              <Text style={styles.mentorLabel}>Led by</Text>
              <Text style={styles.mentorName}>{chat.mentor.name}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Messages */}
      {messagesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C4DFF" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={({ item }) => renderMessage(item)}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="chatbubbles-outline" size={52} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                Start the conversation!
              </Text>
            </View>
          }
        />
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              numberOfLines={1}
              maxLength={500}
              editable={!sending}
              style={styles.textInput}
              placeholderTextColor="#94A3B8"
            />

            {/* Char counter badge */}
            {messageText.length > 400 && (
              <View style={styles.charBadge}>
                <Text style={[
                  styles.charText, 
                  messageText.length > 480 && { color: '#DC2626' }
                ]}>
                  {500 - messageText.length}
                </Text>
              </View>
            )}

            {/* Send button */}
            <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
              <Pressable
                onPress={handleSendMessage}
                disabled={!canSend && !sending}
                style={({ pressed }) => [
                  styles.sendBtn, 
                  !canSend && !sending && styles.sendBtnDisabled,
                  pressed && canSend && { transform: [{ scale: 0.92 }] }
                ]}
                accessibilityRole="button"
                accessibilityLabel={canSend ? 'Send message' : 'Message empty'}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  errorText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500',
  },

  // ========== HEADER ==========
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
  },
  mentorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mentorIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorTextContainer: {
    flex: 1,
  },
  mentorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mentorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  // ========== MESSAGES ==========
  messagesList: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: 16,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
  },
  messageRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 34,
    height: 34,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C4DFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#CBD5E1',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  messageContent: {
    flexDirection: 'row',
    maxWidth: '78%',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleOwn: {
    backgroundColor: '#7C4DFF',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 3,
  },
  messageTextOwn: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  messageTextOther: {
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  timestampOwn: {
    fontSize: 11,
    marginTop: 4,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '400',
    textAlign: 'right',
  },
  timestampOther: {
    fontSize: 11,
    marginTop: 4,
    color: '#94A3B8',
    fontWeight: '400',
  },

  // ========== INPUT ==========
  inputContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  inputWrapper: {
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: '#0F172A',
    maxHeight: 100,
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C4DFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  charBadge: {
    position: 'absolute',
    right: 60,
    bottom: 16,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  charText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
});

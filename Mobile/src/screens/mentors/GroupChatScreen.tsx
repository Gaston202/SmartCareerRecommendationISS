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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
      // Generate avatar URL using user's email or id
      const avatarSeed = user.email?.split('@')[0] || user.id;
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${avatarSeed}`;
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
        <ActivityIndicator size="large" color="#3b82f6" />
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
      {/* Header with gradient */}
      <LinearGradient
        colors={[homeColors.primary, homeColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>

          <View style={styles.headerAvatarWrapper}>
            <AppLogo size={18} />
          </View>
        </View>
        {chat.mentor && (
          <View style={styles.mentorInfo}>
            <Ionicons name="person-circle-outline" size={16} color="rgba(255,255,255,0.9)" />
            <Text style={styles.mentorText}>Led by {chat.mentor.name}</Text>
          </View>
        )}
      </LinearGradient>

      {/* Messages */}
      {messagesLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={homeColors.primary} />
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
              <Text style={styles.emptyText}>
                No messages yet. Start the conversation!
              </Text>
            </View>
          }
        />
      )}

      {/* Message Input */}
      <View style={styles.inputContainer}>
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
            placeholderTextColor={homeColors.textLight}
          />

          {/* Char counter badge */}
          {messageText.length > 400 && (
            <View style={styles.charBadge}>
              <Text style={[styles.charText, messageText.length > 480 && { color: '#ef4444' }]}>
                {500 - messageText.length}
              </Text>
            </View>
          )}

          {/* Send / mic button */}
          <Animated.View style={{ transform: [{ scale: sendButtonScale }] }}>
            <Pressable
              onPress={handleSendMessage}
              disabled={!canSend && !sending}
              style={({ pressed }) => [styles.sendBtn, pressed && canSend && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={canSend ? 'Send message' : 'Voice input unavailable'}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeColors.backgroundMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: homeColors.backgroundMuted,
  },
  errorText: {
    color: homeColors.textMuted,
    fontSize: 18,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  mentorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  mentorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 4,
  },
  messagesList: {
    paddingVertical: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: homeColors.textMuted,
    textAlign: 'center',
    fontSize: 15,
  },
  messageRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: homeColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  messageContent: {
    flexDirection: 'row',
    maxWidth: '75%',
  },
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleOwn: {
    backgroundColor: homeColors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: homeColors.cardBg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: homeColors.textDark,
    marginBottom: 4,
  },
  messageTextOwn: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOther: {
    color: homeColors.textDark,
    fontSize: 15,
    lineHeight: 20,
  },
  timestampOwn: {
    fontSize: 10,
    marginTop: 4,
    color: 'rgba(255,255,255,0.7)',
  },
  timestampOther: {
    fontSize: 10,
    marginTop: 4,
    color: homeColors.textLight,
  },
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: homeColors.cardBorder,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: homeColors.backgroundMuted,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: homeColors.textDark,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButtonWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

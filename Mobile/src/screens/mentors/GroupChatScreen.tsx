import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  Animated,
  Pressable,
  Vibration,
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

// ─── Types ────────────────────────────────────────────────────────────────────

type MentorsStackParamList = {
  MentorsList: undefined;
  MentorDetail: { mentorId?: string; userId?: string };
  GroupChats: undefined;
  GroupChat: { chatId: string };
};
type Nav = NativeStackNavigationProp<MentorsStackParamList, 'GroupChat'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// Inject date separators between messages from different days
function injectDateSeparators(messages: ChatMessage[]): (ChatMessage | { type: 'date'; label: string; id: string })[] {
  const result: (ChatMessage | { type: 'date'; label: string; id: string })[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const day = msg.created_at ? new Date(msg.created_at).toDateString() : '';
    if (day && day !== lastDate) {
      result.push({ type: 'date', label: formatDateLabel(msg.created_at), id: `date-${day}` });
      lastDate = day;
    }
    result.push(msg);
  }
  return result;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const Avatar = React.memo(({ uri, name, size = 34 }: { uri?: string; name: string; size?: number }) => {
  const letter = name?.charAt(0)?.toUpperCase() ?? '?';
  const r = size / 2;
  if (uri && uri.trim()) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r, backgroundColor: '#E0E0E0' }} resizeMode="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: homeColors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.42 }}>{letter}</Text>
    </View>
  );
});

// ─── Date separator ───────────────────────────────────────────────────────────

const DateSeparator = React.memo(({ label }: { label: string }) => (
  <View style={sepStyles.row}>
    <View style={sepStyles.line} />
    <Text style={sepStyles.label}>{label}</Text>
    <View style={sepStyles.line} />
  </View>
));
const sepStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, marginHorizontal: 16 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: homeColors.cardBorder },
  label: { marginHorizontal: 10, fontSize: 11, fontWeight: '600', color: homeColors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
});

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingDot = ({ delay }: { delay: number }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: -5, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[typStyles.dot, { transform: [{ translateY: anim }] }]} />;
};
const TypingIndicator = () => (
  <View style={typStyles.row}>
    <View style={typStyles.bubble}>
      <TypingDot delay={0} />
      <TypingDot delay={150} />
      <TypingDot delay={300} />
    </View>
  </View>
);
const typStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 4 },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: homeColors.cardBg, borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: homeColors.cardBorder },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: homeColors.textLight },
});

// ─── Message bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  showAvatar: boolean;
  showName: boolean;
  isLastInGroup: boolean;
  onAvatarPress: () => void;
  onNamePress: () => void;
  onLongPress: () => void;
}

const MessageBubble = React.memo(({
  message,
  isCurrentUser,
  showAvatar,
  showName,
  isLastInGroup,
  onAvatarPress,
  onNamePress,
  onLongPress,
}: BubbleProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isCurrentUser ? 16 : -16)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 12, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const handlePressIn = () =>
    Animated.spring(pressAnim, { toValue: 0.96, tension: 200, friction: 10, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(pressAnim, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }).start();

  const bubbleBorderRadius = {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: isCurrentUser ? 18 : (isLastInGroup ? 4 : 18),
    borderBottomRightRadius: isCurrentUser ? (isLastInGroup ? 4 : 18) : 18,
  };

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isCurrentUser ? styles.messageRowRight : styles.messageRowLeft,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleAnim }] },
        !isLastInGroup && { marginBottom: 2 },
        isLastInGroup && { marginBottom: 8 },
      ]}
    >
      {/* Avatar slot — always takes space to align bubbles in a group */}
      {!isCurrentUser && (
        <View style={styles.avatarSlot}>
          {showAvatar ? (
            <Pressable onPress={onAvatarPress}>
              <Avatar uri={message.sender_avatar} name={message.sender_name} size={32} />
            </Pressable>
          ) : null}
        </View>
      )}

      <Animated.View style={{ transform: [{ scale: pressAnim }], maxWidth: '75%' }}>
        <Pressable
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={350}
        >
          {/* Sender name — only on first message in a group */}
          {!isCurrentUser && showName && (
            <Pressable onPress={onNamePress}>
              <Text style={styles.senderName}>{message.sender_name}</Text>
            </Pressable>
          )}

          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.messageBubbleOwn : styles.messageBubbleOther,
            bubbleBorderRadius,
          ]}>
            <Text style={isCurrentUser ? styles.messageTextOwn : styles.messageTextOther}>
              {message.message}
            </Text>
            <View style={styles.timestampRow}>
              <Text style={isCurrentUser ? styles.timestampOwn : styles.timestampOther}>
                {formatTime(message.created_at)}
              </Text>
              {isCurrentUser && (
                <Ionicons
                  name="checkmark-done"
                  size={12}
                  color="rgba(255,255,255,0.6)"
                  style={{ marginLeft: 3 }}
                />
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
});

// ─── Scroll-to-bottom button ──────────────────────────────────────────────────

const ScrollToBottomBtn = ({ visible, onPress }: { visible: boolean; onPress: () => void }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, tension: 120, friction: 10, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Animated.View style={[styles.scrollToBottomBtn, { opacity: anim, transform: [{ scale: anim }] }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Pressable onPress={onPress} style={styles.scrollToBottomInner}>
        <LinearGradient colors={[homeColors.primary, homeColors.primaryDark]} style={styles.scrollToBottomGrad}>
          <Ionicons name="chevron-down" size={18} color="#fff" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export function GroupChatScreen() {
  const route = useRoute();
  const navigation = useNavigation<Nav>();
  const { chatId } = route.params as { chatId: string };
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const user = state.user;

  const { chat, loading: chatLoading } = useGroupChat(chatId);
  const { messages, loading: messagesLoading, sendMessage } = useChatMessages(chatId);

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // simulated — wire to realtime if available
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const sendButtonScale = useRef(new Animated.Value(1)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;
  const sendIconAnim = useRef(new Animated.Value(0)).current;
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Input focus border animation
  useEffect(() => {
    Animated.timing(inputBorderAnim, { toValue: inputFocused ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [inputFocused]);

  const borderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [homeColors.cardBorder, homeColors.primary],
  });

  // ── Send icon swap animation (mic ↔ send)
  const canSend = messageText.trim().length > 0 && !sending;
  useEffect(() => {
    Animated.spring(sendIconAnim, { toValue: canSend ? 1 : 0, tension: 160, friction: 10, useNativeDriver: true }).start();
  }, [canSend]);

  // ── Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      const delay = isInitialLoad ? 200 : 80;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: !isInitialLoad });
        if (isInitialLoad) setIsInitialLoad(false);
      }, delay);
    }
  }, [messages.length, isInitialLoad]);

  // ── Inject date separators
  const feedItems = useMemo(() => injectDateSeparators(messages), [messages]);

  // ── Group messages (consecutive from same sender get no avatar repeat)
  const groupedMeta = useMemo(() => {
    const meta: Record<string, { showAvatar: boolean; showName: boolean; isLastInGroup: boolean }> = {};
    const msgs = messages;
    for (let i = 0; i < msgs.length; i++) {
      const curr = msgs[i];
      const next = msgs[i + 1];
      const prev = msgs[i - 1];
      const sameAsPrev = prev && prev.sender_id === curr.sender_id;
      const sameAsNext = next && next.sender_id === curr.sender_id;
      meta[curr.id] = {
        showAvatar: !sameAsNext,       // only last in a group shows avatar
        showName: !sameAsPrev,         // only first in a group shows name
        isLastInGroup: !sameAsNext,
      };
    }
    return meta;
  }, [messages]);

  // ── Send
  const animateSend = useCallback(() => {
    Animated.sequence([
      Animated.spring(sendButtonScale, { toValue: 0.8, tension: 300, friction: 5, useNativeDriver: true }),
      Animated.spring(sendButtonScale, { toValue: 1, tension: 300, friction: 5, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!canSend || !user) return;
    const textToSend = messageText.trim();
    animateSend();
    Vibration.vibrate(8);
    setMessageText('');

    try {
      setSending(true);
      const avatarSeed = user.email?.split('@')[0] || user.id;
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${avatarSeed}`;
      const displayName = user.name?.trim() || user.email?.split('@')[0] || 'Anonymous';
      await sendMessage(user.id, displayName, avatarUrl, textToSend);
    } catch {
      setMessageText(textToSend);
    } finally {
      setSending(false);
    }
  }, [canSend, messageText, user, animateSend, sendMessage]);

  // ── Scroll detection
  const handleScroll = useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  // ── Long press reaction stub
  const handleLongPress = useCallback((messageId: string) => {
    Vibration.vibrate(30);
    setReactionTarget(messageId);
  }, []);

  // ── Render item
  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'date') {
      return <DateSeparator label={item.label} />;
    }
    const msg = item as ChatMessage;
    const isCurrentUser = msg.sender_id === user?.id;
    const meta = groupedMeta[msg.id] ?? { showAvatar: true, showName: true, isLastInGroup: true };
    return (
      <MessageBubble
        message={msg}
        isCurrentUser={isCurrentUser}
        showAvatar={meta.showAvatar}
        showName={meta.showName}
        isLastInGroup={meta.isLastInGroup}
        onAvatarPress={() => navigation.navigate('MentorDetail', { userId: msg.sender_id })}
        onNamePress={() => navigation.navigate('MentorDetail', { userId: msg.sender_id })}
        onLongPress={() => handleLongPress(msg.id)}
      />
    );
  }, [user?.id, groupedMeta, navigation, handleLongPress]);

  const keyExtractor = useCallback((item: any) => item.id, []);

  // ── Loading / error states
  if (chatLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={homeColors.primary} />
      </View>
    );
  }
  if (!chat) {
    return (
      <View style={styles.centered}>
        <Ionicons name="chatbubbles-outline" size={56} color={homeColors.textMuted} />
        <Text style={styles.errorTitle}>Chat not found</Text>
        <Text style={styles.errorSub}>This chat may have been removed.</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const memberCount = (chat as any).member_count ?? null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      style={styles.container}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={[homeColors.primary, homeColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>

          <View style={styles.headerAvatarWrapper}>
            <Ionicons name="chatbubbles" size={18} color="#fff" />
          </View>

          <View style={styles.headerMeta}>
            <Text style={styles.headerTitle} numberOfLines={1}>{chat.title}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {chat.specialty}{memberCount ? `  ·  ${memberCount} members` : ''}
            </Text>
          </View>

          {chat.is_moderated && (
            <View style={styles.moderatedBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#fff" />
              <Text style={styles.moderatedText}>Moderated</Text>
            </View>
          )}
        </View>

        {chat.mentor && (
          <Pressable
            style={styles.mentorRow}
            onPress={() => navigation.navigate('MentorDetail', { userId: chat.mentor!.user_id })}
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <Avatar uri={chat.mentor.avatar} name={chat.mentor.name} size={20} />
            <Text style={styles.mentorText}>Led by <Text style={styles.mentorName}>{chat.mentor.name}</Text></Text>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.6)" style={{ marginLeft: 2 }} />
          </Pressable>
        )}
      </LinearGradient>

      {/* ── Messages ── */}
      <View style={{ flex: 1 }}>
        {messagesLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={homeColors.primary} />
            <Text style={styles.loadingText}>Loading messages…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={feedItems}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.messagesList, feedItems.length === 0 && { flex: 1 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={handleScroll}
            scrollEventThrottle={60}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={20}
            windowSize={12}
            initialNumToRender={20}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <LinearGradient
                  colors={[homeColors.primary + '22', homeColors.primaryDark + '11']}
                  style={styles.emptyIconBg}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color={homeColors.primary} />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>Be the first to start the conversation in <Text style={{ color: homeColors.primary, fontWeight: '600' }}>{chat.title}</Text></Text>
              </View>
            }
            ListFooterComponent={isTyping ? <TypingIndicator /> : null}
          />
        )}

        {/* Scroll-to-bottom FAB */}
        <ScrollToBottomBtn
          visible={showScrollBtn}
          onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </View>

      {/* ── Input bar ── */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Animated.View style={[styles.inputPill, { borderColor }]}>
          <TextInput
            placeholder="Message…"
            value={messageText}
            onChangeText={setMessageText}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onSubmitEditing={handleSendMessage}
            blurOnSubmit={false}
            multiline
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
            >
              <LinearGradient
                colors={canSend ? [homeColors.primary, homeColors.primaryDark] : ['#e5e7eb', '#d1d5db']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendBtnGrad}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name={canSend ? 'send' : 'mic-outline'}
                    size={16}
                    color={canSend ? '#fff' : '#9ca3af'}
                    style={canSend ? { marginLeft: 2 } : undefined}
                  />
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeColors.backgroundMuted,
  },

  // States
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: homeColors.backgroundMuted,
  },
  loadingText: { color: homeColors.textMuted, fontSize: 14 },
  errorTitle: { color: homeColors.textDark, fontSize: 18, fontWeight: '700', marginTop: 8 },
  errorSub: { color: homeColors.textMuted, fontSize: 14 },
  errorBtn: {
    marginTop: 16,
    backgroundColor: homeColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  errorBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: { marginLeft: -4 },
  headerAvatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.1 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  moderatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  moderatedText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  mentorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    marginLeft: 42,
  },
  mentorText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  mentorName: { fontWeight: '700', color: '#fff' },

  // Messages
  messagesList: {
    paddingTop: 8,
    paddingBottom: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: homeColors.textDark },
  emptyText: { fontSize: 14, color: homeColors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Bubbles
  messageRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 1,
  },
  messageRowLeft: { justifyContent: 'flex-start', alignItems: 'flex-end' },
  messageRowRight: { justifyContent: 'flex-end' },
  avatarSlot: {
    width: 34,
    height: 34,
    marginRight: 6,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: homeColors.primary,
    marginBottom: 3,
    marginLeft: 2,
    letterSpacing: 0.1,
  },
  messageBubble: {
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
  },
  messageBubbleOwn: {
    backgroundColor: homeColors.primary,
  },
  messageBubbleOther: {
    backgroundColor: homeColors.cardBg,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  messageTextOwn: { color: '#fff', fontSize: 15, lineHeight: 21 },
  messageTextOther: { color: homeColors.textDark, fontSize: 15, lineHeight: 21 },
  timestampRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  timestampOwn: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  timestampOther: { fontSize: 10, color: homeColors.textLight },

  // Scroll to bottom
  scrollToBottomBtn: {
    position: 'absolute',
    bottom: 12,
    right: 16,
  },
  scrollToBottomInner: { borderRadius: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  scrollToBottomGrad: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Input
  inputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: homeColors.cardBorder,
  },
  inputPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: homeColors.backgroundMuted,
    borderWidth: 1.5,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 4,
  },
  textInput: {
    flex: 1,
    color: homeColors.textDark,
    fontSize: 15,
    maxHeight: 100,
    paddingTop: Platform.OS === 'ios' ? 5 : 3,
    paddingBottom: Platform.OS === 'ios' ? 5 : 3,
    lineHeight: 20,
  },
  charBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: homeColors.backgroundMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  charText: { fontSize: 11, fontWeight: '700', color: homeColors.textMuted },
  sendBtn: { marginBottom: 3 },
  sendBtnGrad: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
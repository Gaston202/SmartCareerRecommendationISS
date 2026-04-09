import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Animated,
  Alert,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroupChats } from '../../features/mentors/hooks';
import { joinGroupChat, leaveGroupChat } from '../../api/mentor';
import { GroupChat } from '../../types/mentor';
import { homeColors } from '../homeTheme';
import { AppBrand } from '../../ui/AppBrand';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../api/supabase';

type MentorsStackParamList = {
  MentorsList: undefined;
  MentorDetail: { mentorId?: string; userId?: string };
  GroupChats: undefined;
  GroupChat: { chatId: string };
  SessionBooking: { mentorId: string; mentorName: string };
  MySessions: undefined;
};

type GroupChatsScreenNavigationProp = NativeStackNavigationProp<MentorsStackParamList, 'GroupChats'>;

const SPECIALTY_ICONS: Record<string, string> = {
  'AI/Machine Learning': 'hardware-chip',
  'Cybersecurity': 'shield',
  'Web Development': 'globe',
  'Mobile Development': 'phone-portrait',
  'Cloud Architecture': 'cloud',
  'DevOps': 'git-branch',
  'Data Science': 'bar-chart',
  'Full Stack': 'layers',
};

const SPECIALTY_COLORS: Record<string, [string, string]> = {
  'AI/Machine Learning': ['#7C4DFF', '#5E35B1'],
  'Cybersecurity': ['#E53935', '#B71C1C'],
  'Web Development': ['#0D9488', '#065F46'],
  'Mobile Development': ['#0284C7', '#075985'],
  'Cloud Architecture': ['#7C3AED', '#4C1D95'],
  'DevOps': ['#D97706', '#92400E'],
  'Data Science': ['#059669', '#064E3B'],
  'Full Stack': ['#2563EB', '#1E3A8A'],
};

const specialties = Object.keys(SPECIALTY_ICONS);

// Fetches joined chat IDs from Supabase and keeps them in sync
function useJoinedGroupChats(userId?: string) {
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loadingJoined, setLoadingJoined] = useState(false);

  useEffect(() => {
    if (!userId) {
      setJoinedIds(new Set());
      return;
    }

    const fetchJoined = async () => {
      setLoadingJoined(true);
      try {
        const { data, error } = await supabase
          .from('group_chat_members')
          .select('group_chat_id')
          .eq('user_id', userId);

        if (error) throw error;
        const ids = (data || []).map((row: any) => row.group_chat_id as string);
        setJoinedIds(new Set(ids));
      } catch (e) {
        console.warn('Failed to fetch joined chats:', e);
      } finally {
        setLoadingJoined(false);
      }
    };

    fetchJoined();
  }, [userId]);

  const markJoined = useCallback((chatId: string) => {
    setJoinedIds((prev) => {
      const next = new Set(prev);
      next.add(chatId);
      return next;
    });
  }, []);

  const markLeft = useCallback((chatId: string) => {
    setJoinedIds((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  }, []);

  return { joinedIds, loadingJoined, markJoined, markLeft };
}

function JoinButton({
  isJoined,
  isLoading,
  onPress,
}: {
  isJoined: boolean;
  isLoading: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  if (isJoined) {
    return (
      <Animated.View style={[styles.joinedButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.joinedButton}>
          <Ionicons name="checkmark-circle" size={17} color={homeColors.accentGreen} />
          <Text style={styles.joinedButtonText}>Joined</Text>
          <View style={styles.leaveHint}>
            <Text style={styles.leaveHintText}>Tap to leave</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.joinButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.joinButtonTouchable}>
        <LinearGradient
          colors={[homeColors.primary, homeColors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.joinButton}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.joinButtonText}>Join Chat</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ChatCard({
  chat,
  isJoined,
  onToggleJoin,
  joiningId,
  onOpen,
}: {
  chat: GroupChat;
  isJoined: boolean;
  onToggleJoin: (chatId: string, currentlyJoined: boolean) => void;
  joiningId: string | null;
  onOpen: () => void;
}) {
  const gradientColors = (SPECIALTY_COLORS[chat.specialty] ?? [homeColors.primary, homeColors.primaryDark]) as [string, string];
  const iconName = (SPECIALTY_ICONS[chat.specialty] ?? 'chatbubbles') as any;
  const isLoadingThis = joiningId === chat.id;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onOpen}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        styles.chatCard, 
        isJoined && styles.chatCardJoined,
        pressed && styles.chatCardPressed
      ]}
    >
      {isJoined && <View style={styles.joinedStrip} />}

      <View style={styles.chatCardHeader}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircle}
        >
          <Ionicons name={iconName} size={20} color="#fff" />
        </LinearGradient>

        <View style={styles.chatCardHeaderContent}>
          <View style={styles.titleRow}>
            <Text style={styles.chatTitle} numberOfLines={1}>{chat.title}</Text>
            {isJoined && (
              <View style={styles.memberBadge}>
                <Ionicons name="checkmark-circle" size={13} color={homeColors.accentGreen} />
                <Text style={styles.memberBadgeText}>Member</Text>
              </View>
            )}
          </View>
          <Text style={[styles.chatSpecialty, { color: gradientColors[0] }]}>{chat.specialty}</Text>
        </View>

        {chat.is_moderated && (
          <View style={styles.moderatedBadge}>
            <Ionicons name="shield-checkmark" size={12} color={homeColors.accentGreen} />
          </View>
        )}
      </View>

      {chat.description && (
        <Text style={styles.chatDescription} numberOfLines={2}>{chat.description}</Text>
      )}

      {chat.mentor && (
        <View style={styles.mentorSection}>
          <Ionicons name="person-circle-outline" size={16} color={homeColors.primary} />
          <View style={styles.mentorInfo}>
            <Text style={styles.mentorName}>{chat.mentor.name}</Text>
            {chat.mentor.role && <Text style={styles.mentorRole}> · {chat.mentor.role}</Text>}
          </View>
          {chat.is_moderated && (
            <View style={styles.moderatedLabel}>
              <Text style={styles.moderatedLabelText}>Moderated</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.cardFooter}>
        <JoinButton
          isJoined={isJoined}
          isLoading={isLoadingThis}
          onPress={() => onToggleJoin(chat.id, isJoined)}
        />
        {isJoined && (
          <TouchableOpacity onPress={onOpen} style={styles.openChatButton}>
            <Ionicons name="chatbubble-ellipses" size={16} color={homeColors.primary} />
            <Text style={styles.openChatText}>Open</Text>
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
}

export function GroupChatsScreen() {
  const navigation = useNavigation<GroupChatsScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const userId = state.user?.id;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [selectedSpecialty, setSelectedSpecialty] = useState<string | undefined>();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'joined'>('all');

  const { chats, loading, error, refetch } = useGroupChats(selectedSpecialty);
  const { joinedIds, loadingJoined, markJoined, markLeft } = useJoinedGroupChats(userId);

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleTabChange = (tab: 'all' | 'joined') => {
    animatePress();
    setActiveTab(tab);
  };

  const handleToggleJoin = useCallback(
    async (chatId: string, currentlyJoined: boolean) => {
      if (!userId) {
        Alert.alert('Sign in required', 'Please sign in to join group chats.');
        return;
      }
      if (joiningId) return;

      if (currentlyJoined) {
        Alert.alert(
          'Leave chat?',
          'You will no longer receive updates from this group.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                setJoiningId(chatId);
                try {
                  await leaveGroupChat(chatId, userId);
                  markLeft(chatId);
                } catch {
                  Alert.alert('Error', 'Could not leave the chat. Try again.');
                } finally {
                  setJoiningId(null);
                }
              },
            },
          ]
        );
      } else {
        setJoiningId(chatId);
        try {
          await joinGroupChat(chatId, userId);
          markJoined(chatId);
        } catch (e: any) {
          // code 23505 = unique constraint = already a member, just mark as joined
          if (e?.code === '23505' || e?.message?.includes('duplicate key')) {
            markJoined(chatId);
          } else {
            Alert.alert('Error', 'Could not join the chat. Try again.');
          }
        } finally {
          setJoiningId(null);
        }
      }
    },
    [userId, joiningId, markJoined, markLeft]
  );

  const displayedChats = activeTab === 'joined'
    ? chats.filter((c) => joinedIds.has(c.id))
    : chats;

  const joinedCount = chats.filter((c) => joinedIds.has(c.id)).length;

  if ((loading && !chats.length) || loadingJoined) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={homeColors.primary} />
        <Text style={styles.loadingText}>Loading group chats…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={homeColors.primary} />}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { paddingTop: Math.max(insets.top, 20), transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerIconRow}>
              <LinearGradient
                colors={[homeColors.primary, homeColors.primaryDark]}
                style={styles.headerIconBg}
              >
                <Ionicons name="chatbubbles" size={26} color="#fff" />
              </LinearGradient>
            </View>
            <Pressable 
              style={({ pressed }) => [
                styles.mySessionsButton,
                pressed && styles.mySessionsButtonPressed
              ]}
              onPress={() => navigation.navigate('MySessions')}
            >
              <Ionicons name="calendar" size={20} color={homeColors.primary} />
              <Text style={styles.mySessionsText}>My Sessions</Text>
            </Pressable>
          </View>
          <Text style={styles.headerTitle}>Group Chats</Text>
          <Text style={styles.headerSubtitle}>Connect with peers and mentors</Text>

          {joinedCount > 0 && (
            <Animated.View style={styles.statsBadge}>
              <Ionicons name="people" size={14} color={homeColors.primary} />
              <Text style={styles.statsBadgeText}>
                You joined {joinedCount} chat{joinedCount !== 1 ? 's' : ''}
              </Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Tab Toggle */}
        <View style={styles.tabContainer}>
          <View style={styles.tabRow}>
            <Pressable
              style={({ pressed }) => [
                styles.tab, 
                activeTab === 'all' && styles.tabActive,
                pressed && styles.tabPressed
              ]}
              onPress={() => handleTabChange('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>All Chats</Text>
              <View style={[styles.tabCount, activeTab === 'all' && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, activeTab === 'all' && styles.tabCountTextActive]}>
                  {chats.length}
                </Text>
              </View>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.tab, 
                activeTab === 'joined' && styles.tabActive,
                pressed && styles.tabPressed
              ]}
              onPress={() => handleTabChange('joined')}
            >
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={activeTab === 'joined' ? homeColors.accentGreen : homeColors.textMuted}
              />
              <Text style={[styles.tabText, activeTab === 'joined' && styles.tabTextActive]}>Joined</Text>
              {joinedCount > 0 && (
                <View style={[styles.tabCount, styles.tabCountGreen, activeTab === 'joined' && styles.tabCountGreenActive]}>
                  <Text style={[styles.tabCountText, activeTab === 'joined' && styles.tabCountTextActive]}>
                    {joinedCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
          <View style={[styles.tabIndicator, { left: activeTab === 'all' ? '2%' : '52%' }]} />
        </View>

        {/* Specialty Filter */}
        {activeTab === 'all' && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Filter by Specialty</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              <TouchableOpacity
                onPress={() => setSelectedSpecialty(undefined)}
                style={[styles.filterChip, !selectedSpecialty && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, !selectedSpecialty && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {specialties.map((specialty) => (
                <TouchableOpacity
                  key={specialty}
                  onPress={() => setSelectedSpecialty(specialty)}
                  style={[styles.filterChip, selectedSpecialty === specialty && styles.filterChipActive]}
                >
                  <Ionicons
                    name={(SPECIALTY_ICONS[specialty] ?? 'code') as any}
                    size={13}
                    color={selectedSpecialty === specialty ? '#fff' : homeColors.textMuted}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.filterChipText, selectedSpecialty === specialty && styles.filterChipTextActive]}>
                    {specialty}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Chats List */}
        <View style={styles.chatsList}>
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#991b1b" />
              <Text style={styles.errorText}>Error loading group chats. Pull to refresh.</Text>
            </View>
          )}

          {displayedChats.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'joined' ? 'people-outline' : 'chatbubbles-outline'}
                size={52}
                color={homeColors.textLight}
              />
              <Text style={styles.emptyTitle}>
                {activeTab === 'joined'
                  ? "You haven't joined any chats yet"
                  : 'No group chats found'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'joined'
                  ? 'Browse all chats and hit Join Chat to get started'
                  : 'Check back soon for new chats!'}
              </Text>
              {activeTab === 'joined' && (
                <TouchableOpacity style={styles.emptyAction} onPress={() => setActiveTab('all')}>
                  <Text style={styles.emptyActionText}>Browse all chats</Text>
                  <Ionicons name="arrow-forward" size={15} color={homeColors.primary} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.chatsCount}>
                {displayedChats.length} Chat{displayedChats.length !== 1 ? 's' : ''}
                {activeTab === 'joined'
                  ? ' Joined'
                  : selectedSpecialty
                  ? ` in ${selectedSpecialty}`
                  : ' Available'}
              </Text>
              {displayedChats.map((chat) => (
                <ChatCard
                  key={chat.id}
                  chat={chat}
                  isJoined={joinedIds.has(chat.id)}
                  onToggleJoin={handleToggleJoin}
                  joiningId={joiningId}
                  onOpen={() => navigation.navigate('GroupChat', { chatId: chat.id })}
                />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: homeColors.textMuted, fontSize: 15, marginTop: 4 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  headerIconRow: { marginBottom: 0 },
  mySessionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(124, 77, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 28,
  },
  mySessionsButtonPressed: {
    backgroundColor: 'rgba(124, 77, 255, 0.18)',
    transform: [{ scale: 0.97 }],
  },
  mySessionsText: {
    color: '#7C4DFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: homeColors.textDark,
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  headerSubtitle: { 
    color: homeColors.textMuted, 
    fontSize: 16, 
    marginBottom: 16,
    fontWeight: '500',
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 77, 255, 0.12)',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 8,
    marginTop: 8,
  },
  statsBadgeText: { 
    color: '#7C4DFF', 
    fontWeight: '700', 
    fontSize: 14,
  },
  tabContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    position: 'relative',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 8,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    zIndex: 1,
  },
  tabPressed: {
    opacity: 0.92,
  },
  tabText: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#64748B' 
  },
  tabTextActive: { 
    color: '#0F172A', 
    fontWeight: '700' 
  },
  tabCount: {
    backgroundColor: homeColors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  tabCountActive: { backgroundColor: homeColors.primary },
  tabCountGreen: { backgroundColor: '#d1fae5' },
  tabCountGreenActive: { backgroundColor: homeColors.accentGreen },
  tabCountText: { fontSize: 11, fontWeight: '700', color: homeColors.textMuted },
  tabCountTextActive: { color: '#fff' },
  filterSection: { paddingHorizontal: 16, paddingVertical: 16 },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: homeColors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterScroll: { flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  filterChipActive: { backgroundColor: homeColors.primary, borderColor: homeColors.primary },
  filterChipText: { color: homeColors.textDark, fontSize: 13 },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  chatsList: { paddingHorizontal: 16, paddingVertical: 8 },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: { color: '#991b1b', flex: 1 },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    color: homeColors.textMuted,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    color: homeColors.textLight,
    textAlign: 'center',
    fontSize: 14,
    maxWidth: 260,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 77, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    marginTop: 8,
  },
  emptyActionText: { color: homeColors.primary, fontWeight: '600', fontSize: 14 },
  chatsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: homeColors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chatCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  chatCardJoined: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
    shadowColor: '#10B981',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
  },
  chatCardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
  },
  joinedStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: homeColors.accentGreen,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  chatCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatCardHeaderContent: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: homeColors.textDark,
    flexShrink: 1,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  memberBadgeText: { fontSize: 11, fontWeight: '700', color: homeColors.accentGreen },
  chatSpecialty: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  moderatedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatDescription: {
    fontSize: 14,
    color: homeColors.textMuted,
    marginBottom: 10,
    lineHeight: 20,
  },
  mentorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 77, 255, 0.07)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  mentorInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  mentorName: { fontSize: 13, fontWeight: '600', color: homeColors.textDark },
  mentorRole: { fontSize: 13, color: homeColors.textMuted },
  moderatedLabel: {
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  moderatedLabelText: { fontSize: 11, fontWeight: '600', color: homeColors.accentGreen },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  joinButtonWrapper: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  joinButtonTouchable: { borderRadius: 12, overflow: 'hidden' },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  joinButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  joinedButtonWrapper: { flex: 1 },
  joinedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: homeColors.accentGreen,
    backgroundColor: '#ecfdf5',
    gap: 6,
  },
  joinedButtonText: { color: homeColors.accentGreen, fontWeight: '700', fontSize: 14 },
  leaveHint: { marginLeft: 2 },
  leaveHintText: { fontSize: 11, color: homeColors.textLight },
  openChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: homeColors.primary,
    backgroundColor: 'rgba(124, 77, 255, 0.07)',
    gap: 5,
  },
  openChatText: { color: homeColors.primary, fontWeight: '600', fontSize: 13 },
});
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
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
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../api/supabase';
import { MainTopBar } from '../../ui/MainTopBar';

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

const DESIGN_COLORS = {
  surface: homeColors.backgroundMuted,
  surfaceLow: homeColors.cardBg,
  surfaceMid: `rgba(124, 77, 255, 0.08)`,
  surfaceHigh: `rgba(124, 77, 255, 0.12)`,
  primary: homeColors.primary,
  primaryDeep: homeColors.primaryDark,
  primaryContainer: homeColors.primary,
  onSurface: homeColors.textDark,
  onSurfaceMuted: homeColors.textMuted,
  tertiary: homeColors.accentTeal,
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
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  if (isJoined) {
    return (
      <Animated.View style={[styles.joinedButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable onPress={handlePress} style={styles.joinedButton}>
          <Ionicons name="checkmark-circle" size={16} color={DESIGN_COLORS.primaryDeep} />
          <Text style={styles.joinedButtonText}>{isLoading ? 'Please wait…' : 'Joined • Leave'}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.joinButtonWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable onPress={handlePress} style={{ borderRadius: 10, overflow: 'hidden' }}>
        <LinearGradient
          colors={[DESIGN_COLORS.primaryDeep, DESIGN_COLORS.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.joinButton}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.joinButtonText}>Join Chat</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </>
          )}
        </LinearGradient>
      </Pressable>
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
  const iconName = (SPECIALTY_ICONS[chat.specialty] ?? 'chatbubbles') as any;
  const isLoadingThis = joiningId === chat.id;

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.chatCard,
        isJoined && styles.chatCardJoined,
        pressed && styles.chatCardPressed
      ]}
    >
      <View style={styles.chatCardHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name={iconName} size={24} color={DESIGN_COLORS.primary} />
        </View>

        <View style={styles.chatCardHeaderContent}>
          <View style={styles.chatCardTitleRow}>
            <Text style={styles.chatTitle} numberOfLines={1}>{chat.title}</Text>
            {isJoined && (
              <View style={styles.memberBadge}>
                <Ionicons name="checkmark-circle" size={12} color={DESIGN_COLORS.primaryDeep} />
                <Text style={styles.memberBadgeText}>Joined</Text>
              </View>
            )}
          </View>
          <View style={styles.specialtyChip}>
            <Text style={styles.chatSpecialty}>{chat.specialty}</Text>
          </View>
        </View>
      </View>

      {chat.description && (
        <Text style={styles.chatDescription} numberOfLines={2}>{chat.description}</Text>
      )}

      {chat.mentor && (
        <View style={styles.mentorSection}>
          <Ionicons name="person-circle-outline" size={18} color={DESIGN_COLORS.primary} />
          <View style={styles.mentorInfo}>
            <Text style={styles.mentorName}>{chat.mentor.name}</Text>
            {chat.mentor.role && (
              <Text style={styles.mentorRole}>{chat.mentor.role}</Text>
            )}
          </View>
          {chat.is_moderated && (
            <View style={styles.moderatedBadge}>
              <Ionicons name="shield-checkmark" size={12} color={DESIGN_COLORS.tertiary} />
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
          <Pressable onPress={onOpen} style={styles.openChatButton}>
            <Ionicons name="chatbubble-ellipses" size={14} color={homeColors.primary} />
            <Text style={styles.openChatText}>Open</Text>
          </Pressable>
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
        <ActivityIndicator size="large" color={homeColors.primary} />
        <Text style={styles.loadingText}>Loading group chats…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MainTopBar
        topPadding={Math.max(insets.top, 12)}
        onProfilePress={() => (navigation as any).navigate('Profile')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} tintColor={homeColors.primary} />}
      >
        <View style={styles.pageContent}>
          <View style={styles.heroSection}>
            <Text style={styles.heroSupertitle}>Community</Text>
            <Text style={styles.heroTitle}>Group Chats</Text>
            <Text style={styles.heroSubtitle}>
              Discover mentor-led discussions, join rooms, and stay connected with your learning community.
            </Text>
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStatPill}>
                <Ionicons name="chatbubbles-outline" size={14} color={DESIGN_COLORS.primary} />
                <Text style={styles.quickStatText}>{chats.length} total</Text>
              </View>
              <View style={styles.quickStatPill}>
                <Ionicons name="checkmark-circle-outline" size={14} color={DESIGN_COLORS.primaryDeep} />
                <Text style={styles.quickStatText}>{joinedCount} joined</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabSection}>
            <View style={styles.tabBackground}>
              <View style={[styles.tabSlider, { left: activeTab === 'all' ? '0%' : '50%' }]} />
              <Pressable
                style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
                onPress={() => handleTabChange('all')}
              >
                <Text style={[styles.tabLabel, activeTab === 'all' && styles.tabLabelActive]}>All Chats</Text>
                <View style={[styles.tabBadge, activeTab === 'all' && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, activeTab === 'all' && styles.tabBadgeTextActive]}>
                    {chats.length}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={[styles.tabButton, activeTab === 'joined' && styles.tabButtonActive]}
                onPress={() => handleTabChange('joined')}
              >
                <Text style={[styles.tabLabel, activeTab === 'joined' && styles.tabLabelActive]}>My Chats</Text>
                <View style={[styles.tabBadge, activeTab === 'joined' && styles.tabBadgeActiveGreen]}>
                  <Text style={[styles.tabBadgeText, activeTab === 'joined' && styles.tabBadgeTextActive]}>
                    {joinedCount}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {activeTab === 'all' && (
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Filter by Specialty</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollContent}>
                <Pressable
                  onPress={() => setSelectedSpecialty(undefined)}
                  style={[styles.filterChip, !selectedSpecialty && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, !selectedSpecialty && styles.filterChipTextActive]}>All</Text>
                </Pressable>
                {specialties.map((specialty) => (
                  <Pressable
                    key={specialty}
                    onPress={() => setSelectedSpecialty(specialty)}
                    style={[styles.filterChip, selectedSpecialty === specialty && styles.filterChipActive]}
                  >
                    <Ionicons
                      name={(SPECIALTY_ICONS[specialty] ?? 'code') as any}
                      size={12}
                      color={selectedSpecialty === specialty ? '#fff' : homeColors.textMuted}
                    />
                    <Text style={[styles.filterChipText, selectedSpecialty === specialty && styles.filterChipTextActive]}>
                      {specialty}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={styles.contentSection}>
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.errorTitle}>Unable to load chats</Text>
                  <Text style={styles.errorText}>Pull down to refresh and try again.</Text>
                </View>
              </View>
            )}

            {displayedChats.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name={activeTab === 'joined' ? 'people-outline' : 'chatbubbles-outline'}
                    size={44}
                    color={homeColors.textLight}
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'joined' ? 'No joined chats yet' : 'No chats available'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {activeTab === 'joined'
                    ? 'Join a discussion from All Chats to start connecting.'
                    : 'Try a different specialty or check back soon.'}
                </Text>
                {activeTab === 'joined' && (
                  <Pressable style={styles.emptyActionButton} onPress={() => setActiveTab('all')}>
                    <LinearGradient
                      colors={[DESIGN_COLORS.primaryDeep, DESIGN_COLORS.primaryContainer]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.emptyActionGradient}
                    >
                      <Text style={styles.emptyActionText}>Browse all chats</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.resultsLabel}>
                  {displayedChats.length} discussion{displayedChats.length !== 1 ? 's' : ''}
                </Text>
                <View style={styles.chatsList}>
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
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: homeColors.backgroundMuted,
  },
  loadingText: {
    color: DESIGN_COLORS.onSurfaceMuted,
    fontSize: 16,
    fontWeight: '500',
  },

  heroSection: {
    marginBottom: 16,
  },
  heroSupertitle: {
    fontSize: 11,
    fontWeight: '700',
    color: homeColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: DESIGN_COLORS.onSurface,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: DESIGN_COLORS.onSurfaceMuted,
    lineHeight: 21,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  quickStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: homeColors.cardBg,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  quickStatText: {
    fontSize: 12,
    color: homeColors.textMuted,
    fontWeight: '700',
  },

  tabSection: {
    marginBottom: 14,
  },
  tabBackground: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 14,
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  tabSlider: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '50%',
    backgroundColor: homeColors.primary,
    borderRadius: 10,
    shadowColor: homeColors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  tabButtonActive: {},
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: DESIGN_COLORS.onSurfaceMuted,
  },
  tabLabelActive: {
    color: DESIGN_COLORS.onSurface,
    fontWeight: '700',
  },
  tabBadge: {
    marginLeft: 8,
    backgroundColor: homeColors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: DESIGN_COLORS.primary,
  },
  tabBadgeActiveGreen: {
    backgroundColor: DESIGN_COLORS.primaryDeep,
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },

  filterSection: {
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: homeColors.textMuted,
    marginBottom: 10,
  },
  filterScrollContent: {
    paddingRight: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 22,
    backgroundColor: homeColors.cardBg,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: DESIGN_COLORS.primary,
  },
  filterChipText: {
    color: DESIGN_COLORS.onSurfaceMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentSection: {
    paddingBottom: 8,
  },
  resultsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: homeColors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  chatsList: {
    gap: 10,
  },

  chatCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  chatCardJoined: {
    backgroundColor: `rgba(124, 77, 255, 0.06)`,
    borderColor: homeColors.primary,
  },
  chatCardPressed: {
    transform: [{ scale: 0.995 }],
  },
  chatCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: DESIGN_COLORS.surfaceMid,
  },
  chatCardHeaderContent: {
    flex: 1,
  },
  chatCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: DESIGN_COLORS.onSurface,
    flex: 1,
  },
  specialtyChip: {
    alignSelf: 'flex-start',
    backgroundColor: `rgba(124, 77, 255, 0.1)`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chatSpecialty: {
    fontSize: 11,
    fontWeight: '600',
    color: homeColors.primary,
  },
  memberBadge: {
    backgroundColor: `rgba(124, 77, 255, 0.1)`,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: DESIGN_COLORS.primaryDeep,
  },
  chatDescription: {
    fontSize: 13,
    fontWeight: '400',
    color: DESIGN_COLORS.onSurfaceMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  mentorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: homeColors.backgroundMuted,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 10,
    gap: 8,
  },
  mentorInfo: {
    flex: 1,
  },
  mentorName: {
    fontSize: 13,
    fontWeight: '700',
    color: DESIGN_COLORS.onSurface,
  },
  mentorRole: {
    fontSize: 11,
    color: DESIGN_COLORS.onSurfaceMuted,
    marginTop: 2,
  },
  moderatedBadge: {
    backgroundColor: `rgba(13, 148, 136, 0.1)`,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moderatedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: homeColors.accentTeal,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  joinButtonWrapper: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  joinedButtonWrapper: {
    flex: 1,
  },
  joinedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: DESIGN_COLORS.surfaceHigh,
    gap: 6,
  },
  joinedButtonText: {
    color: DESIGN_COLORS.primaryDeep,
    fontWeight: '700',
    fontSize: 13,
  },
  openChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: homeColors.cardBg,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    gap: 5,
  },
  openChatText: {
    color: DESIGN_COLORS.primary,
    fontWeight: '600',
    fontSize: 12,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: `rgba(244, 67, 54, 0.1)`,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: homeColors.error,
    marginBottom: 2,
  },
  errorText: {
    fontSize: 13,
    color: homeColors.error,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 54,
    gap: 12,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: homeColors.cardBg,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DESIGN_COLORS.onSurface,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: DESIGN_COLORS.onSurfaceMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 19,
  },
  emptyActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  emptyActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
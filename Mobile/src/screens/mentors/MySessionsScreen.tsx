import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { useMentorSessions } from '../../features/mentors/hooks';
import { useMentor } from '../../features/mentors/hooks';
import { homeColors } from '../homeTheme';
import type { MentorSession } from '../../types/mentor';

type TabType = 'upcoming' | 'pending' | 'past';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  scheduled: '#10B981',
  completed: '#3B82F6',
  cancelled: '#EF4444',
  'no-show': '#6B7280',
};

export function MySessionsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const userId = state.user?.id || '';
  const { sessions, loading, refetch } = useMentorSessions(userId);
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const now = new Date();
  const upcoming: MentorSession[] = [];
  const pending: MentorSession[] = [];
  const past: MentorSession[] = [];

  sessions.forEach((s) => {
    if (s.confirmation_status === 'pending') {
      pending.push(s);
    } else if (s.status === 'completed' || s.status === 'cancelled' || s.status === 'no-show') {
      past.push(s);
    } else if (s.scheduled_at && new Date(s.scheduled_at) >= now) {
      upcoming.push(s);
    } else {
      past.push(s);
    }
  });

  const displaySessions = activeTab === 'upcoming' ? upcoming : activeTab === 'pending' ? pending : past;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={homeColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Sessions</Text>
      </View>

      <View style={styles.tabBar}>
        {(['upcoming', 'pending', 'past'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'pending' && pending.length > 0 && ` (${pending.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={homeColors.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={homeColors.primary} />
          }
        >
          {displaySessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-clear-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming' && 'No upcoming sessions'}
                {activeTab === 'pending' && 'No pending requests'}
                {activeTab === 'past' && 'No past sessions'}
              </Text>
            </View>
          ) : (
            displaySessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SessionCard({ session }: { session: MentorSession }) {
  const { mentor } = useMentor(session.mentor_id);
  const statusColor = STATUS_COLORS[session.status] || '#6B7280';

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Date TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.mentorName}>{mentor?.name || 'Mentor'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {session.status === 'no-show' ? 'No Show' : session.status.charAt(0).toUpperCase() + session.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.sessionTitle}>{session.title}</Text>

      <View style={styles.cardDetails}>
        <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
        <Text style={styles.detailText}>{formatDate(session.scheduled_at)}</Text>
      </View>
      {session.scheduled_at && (
        <View style={styles.cardDetails}>
          <Ionicons name="time-outline" size={16} color="#9CA3AF" />
          <Text style={styles.detailText}>{formatTime(session.scheduled_at)}</Text>
        </View>
      )}
      {session.description && (
        <Text style={styles.description} numberOfLines={2}>{session.description}</Text>
      )}
      {session.confirmation_status === 'pending' && (
        <View style={styles.pendingBanner}>
          <Ionicons name="hourglass-outline" size={14} color="#F59E0B" />
          <Text style={styles.pendingText}>Awaiting mentor confirmation</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginLeft: 12 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { marginRight: 16, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  tabActive: { backgroundColor: homeColors.primary + '15' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: homeColors.primary },
  loader: { marginTop: 40 },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mentorName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  sessionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  cardDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailText: { fontSize: 13, color: '#6B7280' },
  description: { fontSize: 13, color: '#4B5563', marginTop: 6, lineHeight: 18 },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, padding: 8, backgroundColor: '#FEF3C7', borderRadius: 8 },
  pendingText: { fontSize: 12, color: '#92400E', fontWeight: '500' },
});

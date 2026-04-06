import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { useMentorSessionManagement } from '../../features/mentors/hooks';
import { useUserProfile } from '../../features/mentors/hooks';
import { fetchMentorByUserId } from '../../api/mentor';
import { homeColors } from '../homeTheme';
import type { MentorSession } from '../../types/mentor';

type TabType = 'requests' | 'scheduled' | 'history';

export function MentorSessionsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadMentor = async () => {
      if (!state.user?.id) return;
      const mentor = await fetchMentorByUserId(state.user.id);
      if (mentor) setMentorId(mentor.id);
    };
    loadMentor();
  }, [state.user?.id]);

  const { sessions, loading, confirmSession, rejectSession, completeSession, refetch } =
    useMentorSessionManagement(mentorId || '');

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleConfirm = (sessionId: string) => {
    Alert.alert('Confirm Session', 'Confirm this session request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: () => confirmSession(sessionId) },
    ]);
  };

  const handleReject = (sessionId: string) => {
    Alert.alert('Reject Session', 'Reject this session request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => rejectSession(sessionId) },
    ]);
  };

  const handleComplete = (sessionId: string) => {
    Alert.alert('Complete Session', 'Mark this session as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => completeSession(sessionId) },
    ]);
  };

  const requests = sessions.filter((s) => s.confirmation_status === 'pending');
  const scheduled = sessions.filter((s) => s.confirmation_status === 'confirmed' && s.status === 'scheduled');
  const history = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'cancelled' || s.status === 'no-show'
  );

  const displaySessions =
    activeTab === 'requests' ? requests : activeTab === 'scheduled' ? scheduled : history;

  if (!mentorId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={homeColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sessions</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('AvailabilitySettings')}
          >
            <Ionicons name="settings-outline" size={22} color={homeColors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>Mentor profile not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={homeColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sessions</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('AvailabilitySettings')}
        >
          <Ionicons name="settings-outline" size={22} color={homeColors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {(['requests', 'scheduled', 'history'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'requests' && requests.length > 0 && ` (${requests.length})`}
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
                {activeTab === 'requests' && 'No pending requests'}
                {activeTab === 'scheduled' && 'No scheduled sessions'}
                {activeTab === 'history' && 'No session history'}
              </Text>
            </View>
          ) : (
            displaySessions.map((session) => (
              <MentorSessionCard
                key={session.id}
                session={session}
                onConfirm={() => handleConfirm(session.id)}
                onReject={() => handleReject(session.id)}
                onComplete={() => handleComplete(session.id)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function MentorSessionCard({
  session,
  onConfirm,
  onReject,
  onComplete,
}: {
  session: MentorSession;
  onConfirm: () => void;
  onReject: () => void;
  onComplete: () => void;
}) {
  const { user } = useUserProfile(session.user_id);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Date TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const statusColors: Record<string, string> = {
    pending: '#F59E0B',
    scheduled: '#10B981',
    completed: '#3B82F6',
    cancelled: '#EF4444',
    'no-show': '#6B7280',
  };
  const statusColor = statusColors[session.status] || '#6B7280';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.studentInfo}>
          <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.studentName}>{user?.name || user?.email || 'Student'}</Text>
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
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
            <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      )}

      {session.status === 'scheduled' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.completeButton} onPress={onComplete}>
            <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
            <Text style={styles.completeButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  settingsButton: { padding: 4 },
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
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  sessionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  cardDetails: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailText: { fontSize: 13, color: '#6B7280' },
  description: { fontSize: 13, color: '#4B5563', marginTop: 6, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  confirmButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12, gap: 6 },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  rejectButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, paddingVertical: 12, gap: 6, borderWidth: 1, borderColor: '#FECACA' },
  rejectButtonText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
  completeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 12, gap: 6 },
  completeButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

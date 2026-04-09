import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { useMentorSessions } from '../../features/mentors/hooks';
import { fetchAvailableSlots, fetchMentorById } from '../../api/mentor';
import { homeColors } from '../homeTheme';
import type { MentorWithSpecialties } from '../../types/mentor';

const { width } = Dimensions.get('window');
const DAY_CARD_WIDTH = 52;

interface AvailableSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export function SessionBookingScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const user = state.user;

  const params = route.params as { mentorId: string; mentorName: string };
  const { scheduleSession } = useMentorSessions(user?.id || '');

  const [mentor, setMentor] = useState<MentorWithSpecialties | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [booking, setBooking] = useState(false);
  const [calendarDays, setCalendarDays] = useState<{ date: string; dayName: string; dayNum: number }[]>([]);

  useEffect(() => {
    const loadMentor = async () => {
      try {
        const data = await fetchMentorById(params.mentorId);
        setMentor(data);
      } catch (e) {
        console.error(e);
      }
    };
    loadMentor();

    const days: { date: string; dayName: string; dayNum: number }[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        date: d.toISOString().split('T')[0],
        dayName: dayNames[d.getDay()],
        dayNum: d.getDate(),
      });
    }
    setCalendarDays(days);
  }, [params.mentorId]);

  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      return;
    }
    const loadSlots = async () => {
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const slots = await fetchAvailableSlots(params.mentorId, selectedDate);
        setAvailableSlots(slots);
      } catch (e) {
        console.error('Error loading slots:', e);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    loadSlots();
  }, [selectedDate, params.mentorId]);

  const handleBook = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      Alert.alert('Error', 'Please select a date and time slot');
      return;
    }
    if (!sessionTitle.trim()) {
      Alert.alert('Error', 'Please enter a session title');
      return;
    }

    try {
      setBooking(true);
      const [year, month, day] = selectedDate.split('-').map(Number);
      const [hour, minute] = selectedSlot.startTime.split(':').map(Number);
      const scheduledAt = new Date(year, month - 1, day, hour, minute).toISOString();
      await scheduleSession(params.mentorId, sessionTitle, sessionDescription, scheduledAt, 30);
      Alert.alert(
        'Success!',
        'Your session request has been sent to the mentor. You can view and manage your sessions in the Mentors tab.',
        [
          { text: 'Back to Mentor', onPress: () => navigation.goBack() },
          { text: 'View My Sessions', onPress: () => navigation.navigate('MySessions') },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to book session. Please try again.');
      console.error(error);
    } finally {
      setBooking(false);
    }
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const isToday = (dateStr: string) => {
    const today = new Date();
    return dateStr === today.toISOString().split('T')[0];
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[homeColors.primary, homeColors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book a Session</Text>
        <Text style={styles.headerSubtitle}>with {mentor?.name || params.mentorName}</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip}>
          {calendarDays.map((d) => {
            const isSelected = selectedDate === d.date;
            const isTodayDate = isToday(d.date);
            return (
              <TouchableOpacity
                key={d.date}
                style={[
                  styles.dayCard,
                  isSelected && styles.dayCardSelected,
                  isTodayDate && !isSelected && styles.dayCardToday,
                ]}
                onPress={() => setSelectedDate(d.date)}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>{d.dayName}</Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{d.dayNum}</Text>
                {isTodayDate && !isSelected && <Text style={styles.todayLabel}>Today</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedDate && (
          <>
            <Text style={styles.sectionTitle}>Available Time Slots</Text>
            {slotsLoading ? (
              <ActivityIndicator color={homeColors.primary} style={styles.loader} />
            ) : availableSlots.length === 0 ? (
              <View style={styles.emptySlots}>
                <Ionicons name="calendar-clear-outline" size={32} color="#9CA3AF" />
                <Text style={styles.emptySlotsText}>No available slots for this date</Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <TouchableOpacity
                      key={slot.startTime}
                      style={[styles.slotChip, isSelected && styles.slotChipSelected]}
                      onPress={() => setSelectedSlot(slot)}
                    >
                      <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                        {formatTime(slot.startTime)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Session Details</Text>
        <TextInput
          placeholder="Session Title"
          placeholderTextColor="#9CA3AF"
          value={sessionTitle}
          onChangeText={setSessionTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Description (optional)"
          placeholderTextColor="#9CA3AF"
          value={sessionDescription}
          onChangeText={setSessionDescription}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.textArea]}
          textAlignVertical="top"
        />

        <TouchableOpacity
          onPress={handleBook}
          disabled={booking || !selectedDate || !selectedSlot || !sessionTitle.trim()}
          style={[
            styles.bookButton,
            (!selectedDate || !selectedSlot || !sessionTitle.trim()) && styles.bookButtonDisabled,
          ]}
        >
          <LinearGradient
            colors={[homeColors.primary, homeColors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookButtonGradient}
          >
            {booking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.bookButtonText}>Book Session</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { marginBottom: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  calendarStrip: { marginBottom: 20 },
  dayCard: {
    width: DAY_CARD_WIDTH,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayCardSelected: { backgroundColor: homeColors.primary, borderColor: homeColors.primary },
  dayCardToday: { borderColor: homeColors.primary },
  dayName: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  dayNameSelected: { color: '#fff' },
  dayNum: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  dayNumSelected: { color: '#fff' },
  todayLabel: { fontSize: 9, color: homeColors.primary, marginTop: 2, fontWeight: '600' },
  loader: { marginVertical: 20 },
  emptySlots: { alignItems: 'center', paddingVertical: 24 },
  emptySlotsText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  slotChipSelected: { backgroundColor: homeColors.primary, borderColor: homeColors.primary },
  slotText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  slotTextSelected: { color: '#fff' },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    fontSize: 15,
    color: '#1F2937',
  },
  textArea: { minHeight: 80 },
  bookButton: { borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  bookButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  bookButtonDisabled: { opacity: 0.5 },
  bookButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

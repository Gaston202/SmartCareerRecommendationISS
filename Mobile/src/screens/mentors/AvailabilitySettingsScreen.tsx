import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { useMentorAvailability } from '../../features/mentors/hooks';
import { fetchMentorByUserId } from '../../api/mentor';
import { homeColors } from '../homeTheme';
import type { MentorAvailabilityRule } from '../../types/mentor';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface DaySchedule {
  dayOfWeek: number;
  enabled: boolean;
  slots: { start: string; end: string }[];
}

export function AvailabilitySettingsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [saving, setSaving] = useState(false);

  const { rules, loading, saveRules } = useMentorAvailability(mentorId || '');

  useEffect(() => {
    const loadMentor = async () => {
      if (!state.user?.id) return;
      const mentor = await fetchMentorByUserId(state.user.id);
      if (mentor) setMentorId(mentor.id);
    };
    loadMentor();
  }, [state.user?.id]);

  useEffect(() => {
    if (rules.length === 0 && !loading) {
      const initial: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
        dayOfWeek: i,
        enabled: false,
        slots: [],
      }));
      setDaySchedules(initial);
      return;
    }

    const byDay = new Map<number, { start: string; end: string }[]>();
    rules.forEach((r) => {
      const existing = byDay.get(r.day_of_week) || [];
      existing.push({ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) });
      byDay.set(r.day_of_week, existing);
    });

    const schedules: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      enabled: byDay.has(i) && byDay.get(i)!.length > 0,
      slots: byDay.get(i) || [],
    }));
    setDaySchedules(schedules);
  }, [rules, loading]);

  const toggleDay = (dayIndex: number) => {
    setDaySchedules((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        if (!d.enabled) {
          return { ...d, enabled: true, slots: [{ start: '09:00', end: '17:00' }] };
        }
        return { ...d, enabled: false, slots: [] };
      })
    );
  };

  const addSlot = (dayIndex: number) => {
    setDaySchedules((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        return { ...d, slots: [...d.slots, { start: '09:00', end: '17:00' }] };
      })
    );
  };

  const removeSlot = (dayIndex: number, slotIndex: number) => {
    setDaySchedules((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const newSlots = d.slots.filter((_, j) => j !== slotIndex);
        return { ...d, slots: newSlots, enabled: newSlots.length > 0 };
      })
    );
  };

  const updateSlot = (dayIndex: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    setDaySchedules((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const newSlots = d.slots.map((s, j) => (j === slotIndex ? { ...s, [field]: value } : s));
        return { ...d, slots: newSlots };
      })
    );
  };

  const handleSave = async () => {
    if (!mentorId) return;
    const newRules: Omit<MentorAvailabilityRule, 'id' | 'mentor_id' | 'created_at'>[] = [];
    daySchedules.forEach((d) => {
      if (d.enabled) {
        d.slots.forEach((slot) => {
          newRules.push({
            day_of_week: d.dayOfWeek,
            start_time: `${slot.start}:00`,
            end_time: `${slot.end}:00`,
          });
        });
      }
    });

    const hasInvalid = newRules.some((r) => r.start_time >= r.end_time);
    if (hasInvalid) {
      Alert.alert('Invalid Time', 'End time must be after start time for all slots.');
      return;
    }

    try {
      setSaving(true);
      await saveRules(newRules);
      Alert.alert('Success', 'Availability updated successfully');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to save availability');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!mentorId || loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={homeColors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Availability</Text>
        </View>
        <ActivityIndicator color={homeColors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={homeColors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Availability</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={homeColors.primary} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionDesc}>Set your available hours for each day of the week.</Text>

        {daySchedules.map((day, dayIndex) => (
          <View key={day.dayOfWeek} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{DAY_NAMES[day.dayOfWeek]}</Text>
              <Switch
                value={day.enabled}
                onValueChange={() => toggleDay(dayIndex)}
                trackColor={{ false: '#D1D5DB', true: homeColors.primary + '60' }}
                thumbColor={day.enabled ? homeColors.primary : '#F3F4F6'}
              />
            </View>

            {day.enabled && (
              <View style={styles.slotsContainer}>
                {day.slots.map((slot, slotIndex) => (
                  <View key={slotIndex} style={styles.slotRow}>
                    <TimePicker
                      value={slot.start}
                      onChange={(v) => updateSlot(dayIndex, slotIndex, 'start', v)}
                    />
                    <Text style={styles.slotSeparator}>to</Text>
                    <TimePicker
                      value={slot.end}
                      onChange={(v) => updateSlot(dayIndex, slotIndex, 'end', v)}
                    />
                    {day.slots.length > 1 && (
                      <TouchableOpacity onPress={() => removeSlot(dayIndex, slotIndex)} style={styles.removeSlotBtn}>
                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                <TouchableOpacity style={styles.addSlotBtn} onPress={() => addSlot(dayIndex)}>
                  <Ionicons name="add-circle-outline" size={18} color={homeColors.primary} />
                  <Text style={styles.addSlotText}>Add Time Slot</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TouchableOpacity
      style={styles.timePicker}
      onPress={() => {
        if (Platform.OS === 'ios') {
          Alert.prompt(
            'Set Time',
            'Enter time (HH:MM)',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'OK',
                onPress: (v) => {
                  if (v && /^\d{2}:\d{2}$/.test(v)) onChange(v);
                },
              },
            ],
            'plain-text',
            value
          );
        } else {
          Alert.prompt(
            'Set Time',
            'Enter time (HH:MM)',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'OK',
                onPress: (v) => {
                  if (v && /^\d{2}:\d{2}$/.test(v)) onChange(v);
                },
              },
            ],
            'plain-text',
            value
          );
        }
      }}
    >
      <Text style={styles.timeText}>{value}</Text>
      <Ionicons name="time-outline" size={16} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff' },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  saveButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, backgroundColor: homeColors.primary + '15' },
  saveButtonText: { fontSize: 14, fontWeight: '700', color: homeColors.primary },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionDesc: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  dayCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  slotsContainer: { marginTop: 14 },
  slotRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  timePicker: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  timeText: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  slotSeparator: { fontSize: 13, color: '#9CA3AF' },
  removeSlotBtn: { padding: 4 },
  addSlotBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingVertical: 8 },
  addSlotText: { fontSize: 14, fontWeight: '600', color: homeColors.primary },
});

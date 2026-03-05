import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';

// Mock data generator for jobs based on specialty
const generateMockJobs = (specialty: string) => {
    return [
        {
            id: '1',
            title: `Senior ${specialty} Specialist`,
            company: 'Tech Innovators Inc.',
            location: 'Remote',
            type: 'Full-time',
            salary: '$120k - $150k',
            posted: '2 days ago',
        },
        {
            id: '2',
            title: `Lead ${specialty} Consultant`,
            company: 'Global Solutions',
            location: 'New York, NY (Hybrid)',
            type: 'Contract',
            salary: '$80/hr - $110/hr',
            posted: '1 week ago',
        },
        {
            id: '3',
            title: `${specialty} Director`,
            company: 'FutureWorks',
            location: 'San Francisco, CA',
            type: 'Full-time',
            salary: '$160k - $200k',
            posted: '3 days ago',
        },
    ];
};

export function MentorJobSuggestionsScreen() {
    const { state } = useAuth();
    const insets = useSafeAreaInsets();
    const specialty = state.user?.mentorSpecialty || 'General';
    const jobs = generateMockJobs(specialty);

    const handleApply = () => {
        // Mock apply action
        alert('This would open the job application page.');
    };

    return (
        <View style={styles.container}>
            <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 20) }]}>
                <View>
                    <Text style={styles.headerTitle}>Job Suggestions</Text>
                    <Text style={styles.headerSubtitle}>
                        Roles matching your <Text style={{ fontWeight: '700', color: homeColors.primary }}>{specialty}</Text> expertise
                    </Text>
                </View>
                <Ionicons name="briefcase" size={32} color={homeColors.primary} style={{ opacity: 0.8 }} />
            </View>

            <ScrollView contentContainerStyle={styles.listContent}>
                {jobs.map((job) => (
                    <View key={job.id} style={styles.jobCard}>
                        <View style={styles.jobHeader}>
                            <Text style={styles.jobTitle}>{job.title}</Text>
                            <Text style={styles.jobPosted}>{job.posted}</Text>
                        </View>
                        <Text style={styles.jobCompany}>{job.company}</Text>

                        <View style={styles.tagsRow}>
                            <View style={styles.tag}>
                                <Ionicons name="location-outline" size={14} color={homeColors.textMuted} />
                                <Text style={styles.tagText}>{job.location}</Text>
                            </View>
                            <View style={styles.tag}>
                                <Ionicons name="time-outline" size={14} color={homeColors.textMuted} />
                                <Text style={styles.tagText}>{job.type}</Text>
                            </View>
                            <View style={styles.tag}>
                                <Ionicons name="cash-outline" size={14} color={homeColors.primary} />
                                <Text style={[styles.tagText, { color: homeColors.primary, fontWeight: '600' }]}>{job.salary}</Text>
                            </View>
                        </View>

                        <Pressable
                            style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed]}
                            onPress={handleApply}
                        >
                            <Text style={styles.applyBtnText}>View Details</Text>
                        </Pressable>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: homeColors.backgroundStart,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: homeColors.cardBorder,
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: homeColors.textDark,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: homeColors.textMuted,
    },
    listContent: {
        padding: 20,
        gap: 16,
    },
    jobCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: homeColors.cardBorder,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    jobHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    jobTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: homeColors.textDark,
        marginRight: 8,
    },
    jobPosted: {
        fontSize: 12,
        color: homeColors.textMuted,
    },
    jobCompany: {
        fontSize: 15,
        color: homeColors.textDark,
        marginBottom: 12,
        fontWeight: '500',
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: homeColors.backgroundStart,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    tagText: {
        fontSize: 12,
        color: homeColors.textMuted,
    },
    applyBtn: {
        backgroundColor: homeColors.primary + '15',
        borderWidth: 1,
        borderColor: homeColors.primary + '30',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    applyBtnText: {
        color: homeColors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    pressed: {
        opacity: 0.8,
    },
});

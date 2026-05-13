import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';
import { MainTopBar } from '../../ui/MainTopBar';
import { useMentorByUserId, useMentorSessionManagement } from '../../features/mentors/hooks';
import { uploadCvToBackend } from '../../features/cv/api-backend';
import * as DocumentPicker from 'expo-document-picker';

export function MentorHomeScreen() {
    const { state } = useAuth();
    const navigation = useNavigation<any>();

    const rawName = state.user?.fullName || state.user?.email?.split('@')[0] || 'Mentor';
    const userName = (rawName.split(/[\s.]/)[0] ?? 'Mentor').replace(/^\w/, (c: string) => c.toUpperCase());
    const specialty = state.user?.mentorSpecialty || 'General';

    // Load real mentor profile data for stats
    const { mentor } = useMentorByUserId(state.user?.id || '');
    const mentorId = mentor?.id || '';
    const { sessions } = useMentorSessionManagement(mentorId);

    const avgRating = mentor?.rating != null ? Number(mentor.rating).toFixed(1) : '—';
    const studentsHelped = sessions.filter(s => s.status === 'completed').length;
    const totalReviews = mentor?.total_reviews ?? 0;

    const [cvUploading, setCvUploading] = useState(false);

    const handleUploadCv = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            setCvUploading(true);
            await uploadCvToBackend({
                uri: asset.uri,
                name: asset.name ?? 'cv.pdf',
                mimeType: asset.mimeType ?? 'application/pdf',
            });
            Alert.alert(
                'CV uploaded ✅',
                'Your CV is being analyzed. Job recommendations in the "For You" tab will update shortly.',
            );
        } catch (e: any) {
            Alert.alert('Upload failed', e?.message ?? 'Could not upload CV. Please try again.');
        } finally {
            setCvUploading(false);
        }
    };

    const goToGroupChats = () => navigation.navigate('MentorGroupChats');
    const goToSessions = () => navigation.navigate('MentorSessions');
    const goToJobSuggestions = () => navigation.navigate('JobSuggestions');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <MainTopBar onProfilePress={() => (navigation as any).navigate('Profile')} />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Dashboard greeting — matches HomeScreen style */}
                <View style={styles.dashboardHero}>
                    <Text style={styles.dashboardGreeting}>Hello, {userName}!</Text>
                    <Text style={styles.dashboardSubtext}>
                        You're mentoring in{' '}
                        <Text style={{ color: homeColors.primary, fontWeight: '700' }}>
                            {specialty}
                        </Text>
                        .
                    </Text>
                </View>

                {/* Action cards — same layout as HomeScreen */}
                <View style={styles.actionGrid}>
                    {/* Sessions card — primary gradient */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionCardLarge,
                            pressed && { transform: [{ scale: 1.01 }] },
                        ]}
                        onPress={goToSessions}
                    >
                        <LinearGradient
                            colors={[homeColors.primary, homeColors.primaryDark]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.actionCardGradient}
                        >
                            <View style={styles.decorativeIconBg}>
                                <Ionicons
                                    name="calendar"
                                    size={160}
                                    color={homeColors.onPrimary}
                                    style={{ opacity: 0.1, transform: [{ rotate: '12deg' }] }}
                                />
                            </View>
                            <View style={styles.actionCardContent}>
                                <View>
                                    <Text style={styles.actionCardTitle}>My Sessions</Text>
                                    <Text style={styles.actionCardDescription}>
                                        Review pending requests, confirm bookings, and manage your upcoming sessions.
                                    </Text>
                                </View>
                                <View style={styles.actionCardButton}>
                                    <Text style={styles.actionCardButtonText}>View Sessions</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </Pressable>

                    {/* Group Chats card */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionCardSmall,
                            pressed && { opacity: 0.9 },
                        ]}
                        onPress={goToGroupChats}
                    >
                        <View style={styles.actionCardSmallContent}>
                            <View style={[styles.actionCardIcon, { backgroundColor: homeColors.primary + '15' }]}>
                                <Ionicons name="chatbubbles" size={24} color={homeColors.primary} />
                            </View>
                            <Text style={styles.actionCardSmallTitle}>Group Chats</Text>
                            <Text style={styles.actionCardSmallDescription}>
                                Join and moderate specialty discussions with your students.
                            </Text>
                        </View>
                        <View style={[styles.actionCardSmallButton, { backgroundColor: homeColors.primary + '15' }]}>
                            <Text style={styles.actionCardSmallButtonText}>Open Chats</Text>
                        </View>
                    </Pressable>

                    {/* Job Suggestions card */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionCardSmall,
                            pressed && { opacity: 0.9 },
                        ]}
                        onPress={goToJobSuggestions}
                    >
                        <View style={styles.actionCardSmallContent}>
                            <View style={[styles.actionCardIcon, { backgroundColor: homeColors.accentTeal + '15' }]}>
                                <Ionicons name="briefcase" size={24} color={homeColors.accentTeal} />
                            </View>
                            <Text style={styles.actionCardSmallTitle}>Job Suggestions</Text>
                            <Text style={styles.actionCardSmallDescription}>
                                Explore roles that match your expertise and share them with mentees.
                            </Text>
                        </View>
                        <View style={[styles.actionCardSmallButton, { backgroundColor: homeColors.accentTeal + '15' }]}>
                            <Text style={[styles.actionCardSmallButtonText, { color: homeColors.accentTeal }]}>
                                Browse Jobs
                            </Text>
                        </View>
                    </Pressable>

                    {/* CV Upload card */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionCardSmall,
                            cvUploading && { opacity: 0.7 },
                            pressed && !cvUploading && { opacity: 0.9 },
                        ]}
                        onPress={handleUploadCv}
                        disabled={cvUploading}
                    >
                        <View style={styles.actionCardSmallContent}>
                            <View style={[styles.actionCardIcon, { backgroundColor: homeColors.primary + '15' }]}>
                                {cvUploading ? (
                                    <ActivityIndicator size="small" color={homeColors.primary} />
                                ) : (
                                    <Ionicons name="document-attach-outline" size={24} color={homeColors.primary} />
                                )}
                            </View>
                            <Text style={styles.actionCardSmallTitle}>
                                {cvUploading ? 'Analyzing CV…' : 'Upload Your CV'}
                            </Text>
                            <Text style={styles.actionCardSmallDescription}>
                                Upload your CV to unlock personalized job recommendations in the For You tab.
                            </Text>
                        </View>
                        <View style={[styles.actionCardSmallButton, { backgroundColor: homeColors.primary + '15' }]}>
                            <Text style={styles.actionCardSmallButtonText}>
                                {cvUploading ? 'Processing…' : 'Upload PDF'}
                            </Text>
                        </View>
                    </Pressable>
                </View>

                {/* Stats section */}
                <View style={styles.dashboardSection}>
                    <Text style={styles.sectionTitle}>Your Impact</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{totalReviews}</Text>
                            <Text style={styles.statLabel}>Reviews</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{avgRating}</Text>
                            <Text style={styles.statLabel}>Avg Rating</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{studentsHelped}</Text>
                            <Text style={styles.statLabel}>Sessions Done</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: homeColors.pageBg,
    },
    scroll: { flex: 1 },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },

    // Dashboard greeting — matches HomeScreen
    dashboardHero: {
        marginBottom: 28,
    },
    dashboardGreeting: {
        fontSize: 32,
        fontWeight: '800',
        color: homeColors.textDark,
        marginBottom: 8,
    },
    dashboardSubtext: {
        fontSize: 16,
        color: homeColors.onSurfaceVariant,
        lineHeight: 22,
    },

    // Action cards — matches HomeScreen
    actionGrid: {
        gap: 16,
        marginBottom: 28,
    },
    actionCardLarge: {
        borderRadius: 24,
        overflow: 'hidden',
    },
    actionCardGradient: {
        padding: 24,
        justifyContent: 'space-between',
        minHeight: 180,
        position: 'relative',
    },
    decorativeIconBg: {
        position: 'absolute',
        bottom: -20,
        right: -20,
        zIndex: 0,
    },
    actionCardContent: {
        zIndex: 10,
        justifyContent: 'space-between',
        flex: 1,
    },
    actionCardTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: homeColors.onPrimary,
        marginBottom: 8,
    },
    actionCardDescription: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.85)',
        lineHeight: 21,
    },
    actionCardButton: {
        backgroundColor: homeColors.onPrimary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginTop: 16,
    },
    actionCardButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: homeColors.primary,
    },

    actionCardSmall: {
        backgroundColor: homeColors.cardBg,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: homeColors.cardBorder,
        padding: 20,
        shadowColor: homeColors.cardShadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 16,
        elevation: 3,
    },
    actionCardSmallContent: {
        gap: 12,
    },
    actionCardIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionCardSmallTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: homeColors.onSurface,
    },
    actionCardSmallDescription: {
        fontSize: 14,
        color: homeColors.onSurfaceVariant,
        lineHeight: 20,
    },
    actionCardSmallButton: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    actionCardSmallButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: homeColors.primary,
    },

    // Stats section
    dashboardSection: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: homeColors.onSurface,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    statBox: {
        flex: 1,
        backgroundColor: homeColors.cardBg,
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: homeColors.cardBorder,
        shadowColor: homeColors.cardShadowColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
        color: homeColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: homeColors.onSurfaceVariant,
        textAlign: 'center',
        fontWeight: '500',
    },

    bottomSpacer: { height: 120 },
});

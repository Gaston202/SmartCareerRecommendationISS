import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthProvider';
import { homeColors } from '../homeTheme';

export function MentorHomeScreen() {
    const { state } = useAuth();
    const navigation = useNavigation<any>();

    const userName = state.user?.email ? state.user.email.split('@')[0] : 'Mentor';
    const specialty = state.user?.mentorSpecialty || 'General';

    const goToGroupChats = () => {
        navigation.navigate('MentorGroupChats');
    };

    const goToJobSuggestions = () => {
        navigation.navigate('JobSuggestions');
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
                style={StyleSheet.absoluteFill}
            />
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.hero}>
                    <View style={styles.logoBox}>
                        <FontAwesome5 name="chalkboard-teacher" size={26} color="#fff" />
                    </View>
                    <Text style={styles.heroTitle}>
                        Welcome back,{"\n"}
                        <Text style={styles.heroTitleHighlight}>{userName}</Text>
                    </Text>
                    <Text style={styles.heroSubtitle}>
                        Your specialty: <Text style={{ fontWeight: 'bold', color: homeColors.primary }}>{specialty}</Text>
                    </Text>
                </View>

                <View style={styles.dashboardGrid}>
                    <Pressable
                        style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}
                        onPress={goToGroupChats}
                    >
                        <View style={styles.cardContent}>
                            <View style={[styles.iconBox, { backgroundColor: homeColors.primary + '20' }]}>
                                <Ionicons name="chatbubbles" size={28} color={homeColors.primary} />
                            </View>
                            <Text style={styles.cardTitle}>My Group Chats</Text>
                            <Text style={styles.cardDesc}>Join and engage in your specialty discussions.</Text>
                        </View>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}
                        onPress={goToJobSuggestions}
                    >
                        <View style={styles.cardContent}>
                            <View style={[styles.iconBox, { backgroundColor: homeColors.accentTeal + '20' }]}>
                                <Ionicons name="briefcase" size={28} color={homeColors.accentTeal} />
                            </View>
                            <Text style={styles.cardTitle}>Job Suggestions</Text>
                            <Text style={styles.cardDesc}>View recommended roles matching your expertise.</Text>
                        </View>
                    </Pressable>
                </View>

                <View style={styles.statsContainer}>
                    <Text style={styles.sectionTitle}>Dashboard Stats</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>12</Text>
                            <Text style={styles.statLabel}>Active Chats</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>4.9/5</Text>
                            <Text style={styles.statLabel}>Avg Rating</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>82</Text>
                            <Text style={styles.statLabel}>Students Helped</Text>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 32 },
    pressed: { opacity: 0.9 },

    hero: {
        alignItems: "center",
        marginBottom: 36,
    },
    logoBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: homeColors.primary,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        shadowColor: homeColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    heroTitle: {
        fontSize: 26,
        fontWeight: "700",
        color: homeColors.textDark,
        textAlign: "center",
        lineHeight: 34,
        marginBottom: 8,
    },
    heroTitleHighlight: {
        color: homeColors.primary,
    },
    heroSubtitle: {
        fontSize: 16,
        color: homeColors.textMuted,
        textAlign: "center",
    },

    dashboardGrid: {
        gap: 16,
        marginBottom: 32,
    },
    cardWrap: {
        backgroundColor: homeColors.cardBg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: homeColors.cardBorder,
        overflow: "hidden",
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    cardContent: {
        padding: 20,
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: homeColors.textDark,
        marginBottom: 4,
    },
    cardDesc: {
        fontSize: 14,
        color: homeColors.textMuted,
        lineHeight: 20,
    },

    statsContainer: {
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: homeColors.textDark,
        marginBottom: 16,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    statBox: {
        flex: 1,
        backgroundColor: homeColors.cardBg,
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: homeColors.cardBorder,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: homeColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: homeColors.textMuted,
        textAlign: 'center',
        fontWeight: '500',
    },
});

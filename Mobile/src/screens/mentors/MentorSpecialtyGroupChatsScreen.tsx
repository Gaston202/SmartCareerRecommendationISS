import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroupChats } from '../../features/mentors/hooks';
import { GroupChat } from '../../types/mentor';
import { homeColors } from '../homeTheme';
import { useAuth } from '../../auth/AuthProvider';

type MentorsStackParamList = {
    MentorGroupChats: undefined;
    MentorGroupChatDetail: { chatId: string };
};

type MentorGroupChatsScreenNavigationProp = NativeStackNavigationProp<MentorsStackParamList, 'MentorGroupChats'>;

export function MentorSpecialtyGroupChatsScreen() {
    const navigation = useNavigation<MentorGroupChatsScreenNavigationProp>();
    const insets = useSafeAreaInsets();
    const { state } = useAuth();

    // Mentor's explicit specialty
    const specialty = state.user?.mentorSpecialty || 'General';

    const { chats, loading, error, refetch } = useGroupChats(specialty);

    const renderChatCard = (chat: GroupChat) => (
        <TouchableOpacity
            key={chat.id}
            onPress={() => navigation.navigate('MentorGroupChatDetail', { chatId: chat.id })}
            style={styles.chatCard}
            activeOpacity={0.7}
        >
            <View style={styles.chatCardHeader}>
                <View style={styles.iconCircle}>
                    <Ionicons name="chatbubbles" size={20} color="#fff" />
                </View>
                <View style={styles.chatCardHeaderContent}>
                    <Text style={styles.chatTitle}>{chat.title}</Text>
                    <Text style={styles.chatSpecialty}>{chat.specialty}</Text>
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
                        {chat.mentor.role && <Text style={styles.mentorRole}> • {chat.mentor.role}</Text>}
                    </View>
                </View>
            )}

            <View style={styles.joinButtonGradient}>
                <LinearGradient
                    colors={[homeColors.primary, homeColors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.joinButton}
                >
                    <Text style={styles.joinButtonText}>Enter Chat</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
            </View>
        </TouchableOpacity>
    );

    if (loading && !chats.length) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
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
                refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
            >
                {/* Header */}
                <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
                    <Ionicons name="chatbubbles" size={32} color={homeColors.primary} />
                    <Text style={styles.headerTitle}>{specialty} Chats</Text>
                    <Text style={styles.headerSubtitle}>Engage with users learning about your field</Text>
                </View>

                {/* Chats List */}
                <View style={styles.chatsList}>
                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Error loading group chats. Please try again.</Text>
                        </View>
                    )}

                    {chats.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>
                                No group chats found for {specialty}.
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                Create one or check back later!
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.chatsCount}>
                                {chats.length} Chat{chats.length !== 1 ? 's' : ''} Available
                            </Text>
                            {chats.map(renderChatCard)}
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: homeColors.textDark,
        marginTop: 8,
        marginBottom: 4,
        textAlign: 'center',
    },
    headerSubtitle: {
        color: homeColors.textMuted,
        fontSize: 15,
        textAlign: 'center',
    },
    chatsList: {
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    errorContainer: {
        backgroundColor: '#fee2e2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#991b1b',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
    },
    emptyTitle: {
        color: homeColors.textMuted,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtitle: {
        color: homeColors.textLight,
        textAlign: 'center',
        fontSize: 14,
        marginTop: 8,
    },
    chatsCount: {
        fontSize: 16,
        fontWeight: '600',
        color: homeColors.textDark,
        marginBottom: 16,
    },
    chatCard: {
        backgroundColor: homeColors.cardBg,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: homeColors.cardBorder,
    },
    chatCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: homeColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    chatCardHeaderContent: {
        flex: 1,
    },
    chatTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: homeColors.textDark,
    },
    chatSpecialty: {
        fontSize: 13,
        color: homeColors.primary,
        marginTop: 2,
        fontWeight: '500',
    },
    moderatedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#d1fae5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatDescription: {
        fontSize: 14,
        color: homeColors.textMuted,
        marginBottom: 12,
        lineHeight: 20,
    },
    mentorSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(124, 77, 255, 0.08)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 12,
    },
    mentorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginLeft: 8,
    },
    mentorName: {
        fontSize: 13,
        fontWeight: '600',
        color: homeColors.textDark,
    },
    mentorRole: {
        fontSize: 13,
        color: homeColors.textMuted,
    },
    joinButtonGradient: {
        borderRadius: 10,
        overflow: 'hidden',
    },
    joinButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    joinButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
        marginRight: 6,
    },
});

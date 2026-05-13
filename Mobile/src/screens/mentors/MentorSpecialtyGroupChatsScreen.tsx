import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
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
import { MainTopBar } from '../../ui/MainTopBar';

type MentorsStackParamList = {
    MentorGroupChats: undefined;
    MentorGroupChatDetail: { chatId: string };
};

type MentorGroupChatsScreenNavigationProp = NativeStackNavigationProp<MentorsStackParamList, 'MentorGroupChats'>;

export function MentorSpecialtyGroupChatsScreen() {
    const navigation = useNavigation<MentorGroupChatsScreenNavigationProp>();
    const insets = useSafeAreaInsets();
    const { state } = useAuth();

    // Load all chats — specialty filtering happens via search below
    const { chats, loading, error, refetch } = useGroupChats();
    const [search, setSearch] = useState('');

    const filteredChats = search.trim()
        ? chats.filter(chat =>
            chat.mentor?.name?.toLowerCase().includes(search.toLowerCase()) ||
            chat.title?.toLowerCase().includes(search.toLowerCase()) ||
            chat.specialty?.toLowerCase().includes(search.toLowerCase())
          )
        : chats;

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

            {/* Consistent gradient top bar */}
            <MainTopBar
                title="Group Chats"
                onProfilePress={() => navigation.navigate('Profile' as any)}
                topPadding={insets.top}
            />

            {/* Search bar */}
            <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={18} color={homeColors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by mentor name, title or specialty…"
                    placeholderTextColor={homeColors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    clearButtonMode="while-editing"
                />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} />}
            >
                {/* Chats List */}
                <View style={styles.chatsList}>
                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>Error loading group chats. Please try again.</Text>
                        </View>
                    )}

                    {filteredChats.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={48} color={homeColors.textMuted} />
                            <Text style={styles.emptyTitle}>
                                {search ? `No chats matching "${search}"` : 'No group chats available'}
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {search ? 'Try a different search term.' : 'Check back later!'}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.chatsCount}>
                                {filteredChats.length} Chat{filteredChats.length !== 1 ? 's' : ''}
                                {search ? ` for "${search}"` : ' Available'}
                            </Text>
                            {filteredChats.map(renderChatCard)}
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
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: homeColors.cardBg,
        borderBottomWidth: 1,
        borderBottomColor: homeColors.cardBorder,
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: homeColors.textDark,
        paddingVertical: 6,
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

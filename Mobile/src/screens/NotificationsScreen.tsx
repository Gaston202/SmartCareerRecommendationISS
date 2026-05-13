import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useNotifications } from '../features/notifications/hooks';
import { useAuth } from '../auth/AuthProvider';
import { AppNotification } from '../api/notifications';

export function NotificationsScreen() {
  const { notifications, loading, refresh, markRead, markAllRead } = useNotifications();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { state } = useAuth();
  const isMentor = state.user?.role === 'mentor';

  const handlePressNotification = (item: AppNotification) => {
    if (!item.is_read) {
      markRead(item.id);
    }
    
    if (item.link) {
      if (item.link.startsWith('GroupChat:')) {
        const chatId = item.link.split(':')[1];
        if (isMentor) {
          navigation.navigate('MentorRoot', {
            screen: 'MentorGroupChats',
            params: { screen: 'MentorGroupChatDetail', params: { chatId } },
          });
        } else {
          navigation.navigate('UserRoot', {
            screen: 'Chats',
            params: { screen: 'GroupChat', params: { chatId } },
          });
        }
      } else if (item.link.startsWith('LearningRoadmap:')) {
        const [, careerId, title] = item.link.split(':');
        navigation.navigate('UserRoot', {
          screen: 'Home',
          params: { screen: 'LearningRoadmap', params: { careerId, careerTitle: title, careerDescription: '' } },
        });
      } else if (item.link === 'CVAnalysis') {
        navigation.navigate('UserRoot', {
          screen: 'Home',
          params: { screen: 'CVAnalysis' },
        });
      } else if (item.link === 'MentorSessions') {
        if (isMentor) {
          navigation.navigate('MentorRoot', {
            screen: 'MentorSessions',
            params: { screen: 'MentorSessionsMain' },
          });
        } else {
          navigation.navigate('UserRoot', {
            screen: 'Mentors',
            params: { screen: 'MySessions' },
          });
        }
      }
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'cv_analysis': return 'document-text';
      case 'roadmap': return 'map';
      case 'chat_message': return 'chatbubbles';
      case 'mentor_session': return 'calendar';
      default: return 'notifications';
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'cv_analysis': return '#3B82F6';
      case 'roadmap': return '#10B981';
      case 'chat_message': return '#7C4DFF';
      case 'mentor_session': return '#F59E0B';
      default: return '#64748B';
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const isUnread = !item.is_read;
    const iconColor = getColorForType(item.type);

    return (
      <TouchableOpacity 
        style={[styles.notificationCard, isUnread && styles.unreadCard]} 
        onPress={() => handlePressNotification(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
          <Ionicons name={getIconForType(item.type) as any} size={20} color={iconColor} />
        </View>
        
        <View style={styles.textContainer}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isUnread && styles.unreadText]}>{item.title}</Text>
            {isUnread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.some(n => !n.is_read) ? (
          <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
            <Ionicons name="checkmark-done" size={20} color="#7C4DFF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholderBtn} />
        )}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7C4DFF" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>You don't have any notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refresh(false)} tintColor="#7C4DFF" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderBtn: {
    width: 40,
  },
  markAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  unreadCard: {
    backgroundColor: '#F4F6FF',
    borderColor: '#E0E7FF',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
    paddingRight: 10,
  },
  unreadText: {
    color: '#0F172A',
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#64748B',
  },
});

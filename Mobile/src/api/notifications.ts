import { supabase } from './supabase';

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string; // 'cv_analysis', 'roadmap', 'chat_message', 'mentor_session'
  link?: string;
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Error fetching notifications:', error.message);
    return [];
  }
  return data as AppNotification[];
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.warn('Error marking notification read:', error.message);
  }
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.warn('Error marking all notifications read:', error.message);
  }
}

export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert([{ user_id: userId, title, message, type, link }]);

  if (error) {
    console.warn('Error sending notification:', error.message);
  }
}

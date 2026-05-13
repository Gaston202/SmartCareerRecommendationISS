import { useEffect, useState, useCallback, useRef } from 'react';
import { AppNotification, fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../api/notifications';
import { useAuth } from '../../auth/AuthProvider';

export function useNotifications() {
  const { state } = useAuth();
  const user = state.user;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Use a ref to prevent overlapping polls from causing race conditions
  const isFetchingRef = useRef(false);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!user || isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      if (!silent) setLoading(true);
      
      const data = await fetchNotifications(user.id);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (e) {
      console.warn(e);
    } finally {
      if (!silent) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user]);

  // Initial load & Polling (e.g. every 15 seconds) for background updates
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const markRead = async (notificationId: string) => {
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    await markNotificationAsRead(notificationId);
  };

  const markAllRead = async () => {
    if (!user) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await markAllNotificationsAsRead(user.id);
  };

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: loadNotifications };
}

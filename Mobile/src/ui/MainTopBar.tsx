import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { homeColors } from '../screens/homeTheme';
import { useAuth } from '../auth/AuthProvider';
import { useNotifications } from '../features/notifications/hooks';
import { AppLogo } from './AppLogo';

type MainTopBarProps = {
  onProfilePress: () => void;
  topPadding?: number;
  /** If provided, replaces the brand with a back-chevron + title */
  title?: string;
  onBack?: () => void;
  /** Extra action shown on the right (replaces notifications bell) */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
};

function getInitials(name: string): string {
  const result = name
    .split(' ')
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return result || '?';
}

export function MainTopBar({
  onProfilePress,
  topPadding = 0,
  title,
  onBack,
  rightIcon,
  onRightPress,
}: MainTopBarProps): React.ReactElement {
  const { state: authState } = useAuth();
  const navigation = useNavigation<any>();
  const { unreadCount } = useNotifications();
  
  const name = authState.user?.fullName || authState.user?.email?.split('@')[0] || 'U';
  const initials = getInitials(name);

  const isSubScreen = !!title || !!onBack;

  return (
    <LinearGradient
      colors={[homeColors.primaryDark, homeColors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.bar, { paddingTop: topPadding }]}
    >
      {/* Left: back button (sub-screens) or brand (home) */}
      {isSubScreen ? (
        <View style={styles.leftSection}>
          {onBack && (
            <Pressable
              style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.95)" />
            </Pressable>
          )}
          {title ? (
            <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.brand}>
          <View style={styles.logoIconWrap}>
            <AppLogo size={18} />
          </View>
          <Text style={styles.brandText}>MyPath</Text>
        </View>
      )}

      {/* Right actions */}
      <View style={styles.actions}>
        {rightIcon ? (
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            onPress={onRightPress ?? (() => {})}
            accessibilityRole="button"
          >
            <Ionicons name={rightIcon} size={21} color="rgba(255,255,255,0.9)" />
          </Pressable>
        ) : !isSubScreen ? (
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={21} color="rgba(255,255,255,0.9)" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        ) : null}

        <Pressable
          onPress={onProfilePress}
          style={({ pressed }) => [styles.avatarWrap, pressed && styles.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Sub-screen left section (back + title)
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    flexShrink: 1,
  },

  // Brand
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.93 }],
  },
  notifBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: homeColors.primary,
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarWrap: {
    borderRadius: 11,
    overflow: 'hidden',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

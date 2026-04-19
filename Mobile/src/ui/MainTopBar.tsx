import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeColors } from '../screens/homeTheme';

type MainTopBarProps = {
  onProfilePress: () => void;
  topPadding?: number;
};

export function MainTopBar({ onProfilePress, topPadding = 0 }: MainTopBarProps): React.ReactElement {
  return (
    <View style={[styles.fixedHeader, { paddingTop: topPadding }]}> 
      <Image
        source={require('../assets/logoandtitle.png')}
        style={styles.headerLogo}
        resizeMode="contain"
      />
      <Pressable style={styles.profileButton} onPress={onProfilePress}>
        <Ionicons name="person-circle-outline" size={28} color={homeColors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fixedHeader: {
    backgroundColor: homeColors.tabBarBg,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: '#f2e2ff',
    borderBottomWidth: 1,
  },
  profileButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f2e2ff',
  },
  headerLogo: {
    height: 32,
    width: 110,
  },
});

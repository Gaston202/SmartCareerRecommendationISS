import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type AppBrandProps = {
  width?: number;
  height?: number;
};

export function AppBrand({ width = 132, height = 28 }: AppBrandProps): React.ReactElement {
  return (
    <View
      style={[styles.container, { width, height }]}
      accessibilityRole="image"
      accessibilityLabel="MyPath brand logo"
    >
      <Image
        source={require('../assets/logoandtitle.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

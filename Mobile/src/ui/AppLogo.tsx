import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

type AppLogoProps = {
  size?: number;
  rounded?: boolean;
};

export function AppLogo({ size = 48, rounded = true }: AppLogoProps): React.ReactElement {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: rounded ? size / 5 : 0,
        },
      ]}
      accessibilityRole="image"
      accessibilityLabel="MyPath logo"
    >
      <Image
        source={require('../assets/logo.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

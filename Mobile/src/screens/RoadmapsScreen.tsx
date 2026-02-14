import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { homeColors } from "./homeTheme";

export default function RoadmapsScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Roadmaps</Text>
      <Text style={styles.subtitle}>Career roadmaps coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: homeColors.backgroundMuted,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: homeColors.textDark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: homeColors.textMuted,
  },
});

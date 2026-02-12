import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";

export default function HomeScreen(): React.ReactElement {

  const [cvName, setCvName] = useState<string | null>(null);

  const pickCV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
      });

      if (result.canceled) return;

      const file = result.assets[0];

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        Alert.alert("Invalid file", "Please upload PDF only.");
        return;
      }

      setCvName(file.name);
    } catch {
      Alert.alert("Error", "Failed to pick file.");
    }
  };

  const deleteCV = () => {
    Alert.alert("Remove CV", "Delete your uploaded CV?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => setCvName(null),
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>

      {/* HERO */}
      <View style={styles.hero}>
        <Text style={styles.title}>Smart Career 🚀</Text>
        <Text style={styles.subtitle}>
          AI-powered career guidance for students and graduates.
        </Text>
      </View>

      {/* PROGRESS STEPS */}
      <View style={styles.stepsContainer}>
        <Step label="Upload CV" done={!!cvName} />
        <Step label="Take Test" done={false} />
        <Step label="AI Results" done={false} />
      </View>

      {/* CV CARD */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Resume</Text>

        {!cvName ? (
          <Pressable style={styles.primaryButton} onPress={pickCV}>
            <Text style={styles.primaryText}>Upload PDF CV</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Uploaded ✅</Text>
            </View>

            <Text style={styles.fileName}>{cvName}</Text>

            <View style={styles.row}>
              <Pressable style={styles.changeButton} onPress={pickCV}>
                <Text style={styles.changeText}>Change</Text>
              </Pressable>

              <Pressable style={styles.deleteButton} onPress={deleteCV}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* AI RECOMMENDATION CTA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>AI Career Suggestions</Text>

        <Pressable
          disabled={!cvName}
          style={[
            styles.secondaryButton,
            { opacity: cvName ? 1 : 0.4 },
          ]}
          onPress={() => Alert.alert("Coming Soon")}
        >
          <Text style={styles.secondaryText}>
            Generate Recommendations
          </Text>
        </Pressable>
      </View>

    </ScrollView>
  );
}

const Step = ({ label, done }: { label: string; done: boolean }) => (
  <View style={styles.step}>
    <View style={[styles.circle, done && styles.circleDone]} />
    <Text style={styles.stepText}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    padding: 20,
  },

  hero: {
    marginTop: 40,
    marginBottom: 30,
  },

  title: {
    fontSize: 30,
    fontWeight: "bold",
  },

  subtitle: {
    marginTop: 8,
    color: "#64748B",
  },

  stepsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },

  step: {
    alignItems: "center",
  },

  circle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#CBD5F5",
    marginBottom: 5,
  },

  circleDone: {
    backgroundColor: "#22C55E",
  },

  stepText: {
    fontSize: 12,
    color: "#475569",
  },

  card: {
    backgroundColor: "white",
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },

  primaryButton: {
    backgroundColor: "#2563EB",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: {
    color: "white",
    fontWeight: "600",
  },

  badge: {
    backgroundColor: "#DCFCE7",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 10,
  },

  badgeText: {
    color: "#166534",
    fontWeight: "600",
  },

  fileName: {
    marginBottom: 15,
    fontWeight: "500",
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  changeButton: {
    flex: 1,
    backgroundColor: "#E2E8F0",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  changeText: {
    fontWeight: "600",
  },

  deleteButton: {
    flex: 1,
    backgroundColor: "#EF4444",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  deleteText: {
    color: "white",
    fontWeight: "600",
  },

  secondaryButton: {
    backgroundColor: "#16A34A",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  secondaryText: {
    color: "white",
    fontWeight: "600",
  },

});

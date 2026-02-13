import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
import { useUploadCv, useTriggerCvAnalysis, useLatestCvUpload, useUserSkills } from "../features/cv/hooks";

export default function HomeScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { data: latestUpload, isLoading: loadingUpload } = useLatestCvUpload();
  const { data: skills = [], isLoading: loadingSkills } = useUserSkills();
  const { mutate: uploadCv, isPending: isUploading } = useUploadCv();
  const { mutate: triggerAnalysis, isPending: isAnalyzing } = useTriggerCvAnalysis();

  const [localCvName, setLocalCvName] = useState<string | null>(null);

  // Use latest upload from DB or local state
  const cvName = latestUpload?.filename || localCvName;
  const isProcessing = isUploading || isAnalyzing;

  const pickCV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets[0];

      if (!file.name.toLowerCase().endsWith(".pdf")) {
        Alert.alert("Invalid file", "Please upload PDF only.");
        return;
      }

      setLocalCvName(file.name);

      // Upload to Supabase
      uploadCv(
        {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
        },
        {
          onSuccess: (uploaded) => {
            Alert.alert("Success", "CV uploaded successfully!");
            
            // Trigger AI analysis
            triggerAnalysis(uploaded.id, {
              onSuccess: () => {
                Alert.alert("Analysis Complete", "Your CV has been analyzed!");
              },
              onError: (error) => {
                console.error("Analysis error:", error);
                Alert.alert("Analysis Failed", "Could not analyze CV. Check console.");
              },
            });
          },
          onError: (error) => {
            console.error("Upload error:", error);
            Alert.alert("Upload Failed", "Could not upload CV. Try again.");
            setLocalCvName(null);
          },
        }
      );
    } catch (error) {
      console.error("Pick error:", error);
      Alert.alert("Error", "Failed to pick file.");
    }
  };

  const deleteCV = () => {
    Alert.alert("Remove CV", "Delete your uploaded CV?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => setLocalCvName(null),
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
        <Step label="Upload CV" done={!!cvName && latestUpload?.status === 'done'} />
        <Step label="Extract Skills" done={skills.length > 0} />
        <Step label="AI Analysis" done={latestUpload?.status === 'done'} />
      </View>

      {/* CV CARD */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Resume</Text>

        {isProcessing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>
              {isUploading ? "Uploading..." : "Analyzing..."}
            </Text>
          </View>
        )}

        {!cvName && !isProcessing ? (
          <Pressable style={styles.primaryButton} onPress={pickCV} disabled={isProcessing}>
            <Text style={styles.primaryText}>Upload PDF CV</Text>
          </Pressable>
        ) : cvName && !isProcessing ? (
          <>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {latestUpload?.status === 'done' ? 'Analyzed ✅' : 'Uploaded ✅'}
              </Text>
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
        ) : null}
      </View>

      {/* AI RECOMMENDATION CTA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Review Your Skills</Text>
        <Text style={styles.cardSubtitle}>
          {skills.length > 0 
            ? `${skills.length} skills extracted from your CV` 
            : "Upload CV to extract skills"}
        </Text>

        <Pressable
          disabled={skills.length === 0}
          style={[
            styles.secondaryButton,
            { opacity: skills.length > 0 ? 1 : 0.4 },
          ]}
          onPress={() => navigation.navigate('SkillsReview' as never)}
        >
          <Text style={styles.secondaryText}>
            Review & Confirm Skills
          </Text>
        </Pressable>
      </View>

      {/* CV ANALYSIS CTA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>CV Analysis Results</Text>
        <Text style={styles.cardSubtitle}>
          {latestUpload?.status === 'done'
            ? "View ATS score and career suggestions"
            : "Upload and analyze CV first"}
        </Text>

        <Pressable
          disabled={!cvName || latestUpload?.status !== 'done'}
          style={[
            styles.tertiaryButton,
            { opacity: cvName && latestUpload?.status === 'done' ? 1 : 0.4 },
          ]}
          onPress={() => navigation.navigate('CVAnalysis' as never)}
        >
          <Text style={styles.tertiaryText}>
            View Analysis
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

  cardSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 12,
  },

  loadingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },

  loadingText: {
    marginTop: 10,
    color: "#64748B",
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

  tertiaryButton: {
    backgroundColor: "#7D10B9",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },

  tertiaryText: {
    color: "white",
    fontWeight: "600",
  },

});

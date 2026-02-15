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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, FontAwesome5 } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useUploadCv, useTriggerCvAnalysis, useLatestCvUpload, useDeleteCv, cvQueryKeys } from "../features/cv/hooks";
import { homeColors } from "./homeTheme";

const TESTIMONIALS = [
  { quote: "This helped me choose computer science!", author: "Sarah", age: 18 },
  { quote: "I finally found direction after being confused for years.", author: "Ahmed", age: 20 },
  { quote: "The mentor feature is amazing. Got real advice!", author: "Lina", age: 22 },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Discover",
    description: "Take our smart AI quiz to find careers that match your interests.",
    icon: "bulb" as const,
    color: homeColors.primary,
  },
  {
    step: 2,
    title: "Improve",
    description: "Upload your CV and get instant AI feedback + job suggestions.",
    icon: "document-text" as const,
    color: homeColors.accentTeal,
  },
  {
    step: 3,
    title: "Plan",
    description: "Get a step-by-step roadmap to reach your target career.",
    icon: "map" as const,
    color: homeColors.accentGreen,
  },
  {
    step: 4,
    title: "Connect",
    description: "Talk to real professionals and learn from their experience.",
    icon: "people" as const,
    color: homeColors.accentOrange,
  },
];

function StarRating() {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name="star" size={16} color={homeColors.starYellow} />
      ))}
    </View>
  );
}

export default function HomeScreen(): React.ReactElement {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { data: latestUpload, isLoading: loadingUpload, refetch: refetchCv } = useLatestCvUpload();
  const { mutate: uploadCv, isPending: isUploading } = useUploadCv();
  const { mutate: triggerAnalysis } = useTriggerCvAnalysis();
  const { mutate: deleteCv, isPending: isDeleting } = useDeleteCv();
  const [localCvName, setLocalCvName] = useState<string | null>(null);

  const cvName = latestUpload?.filename || localCvName;
  const isProcessing = isUploading || isDeleting;

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
      uploadCv(
        { uri: file.uri, name: file.name, mimeType: file.mimeType },
        {
          onSuccess: (uploaded) => {
            Alert.alert("Success", "CV uploaded successfully!");
            triggerAnalysis(uploaded.id, {
              onSuccess: () => {
                Alert.alert("Analysis Complete", "Your CV has been analyzed!");
                (navigation as any).navigate("SkillsReview");
              },
              onError: () => {},
            });
          },
          onError: () => {
            Alert.alert("Upload Failed", "Could not upload CV. Try again.");
            setLocalCvName(null);
          },
        }
      );
    } catch {
      Alert.alert("Error", "Failed to pick file.");
    }
  };

  const handleChangeCV = async () => {
    pickCV();
  };

  const handleDeleteCV = () => {
    if (!latestUpload) return;
    
    Alert.alert(
      "Delete CV",
      "Are you sure you want to delete your CV? This will also remove your CV analysis.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCv(latestUpload, {
              onSuccess: () => {
                setLocalCvName(null);
                // Immediately update cache to null for instant UI update
                queryClient.setQueryData(cvQueryKeys.uploads(), null);
                Alert.alert("Success", "CV deleted successfully!");
              },
              onError: () => {
                Alert.alert("Error", "Failed to delete CV. Try again.");
              },
            });
          },
        },
      ]
    );
  };

  const goToQuiz = () => {
    (navigation as any).navigate("Quiz");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: Logo + Title + Subtitle */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <FontAwesome5 name="graduation-cap" size={26} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>
            Find Your Career Path{"\n"}
            <Text style={styles.heroTitleHighlight}>with AI Guidance</Text>
          </Text>
          <Text style={styles.heroSubtitle}>
            Take a quiz, scan your CV, explore roadmaps, and connect with real professionals.
          </Text>
        </View>

        {/* Two CTA Buttons */}
        <View style={styles.ctaRow}>
          <Pressable style={({ pressed }) => [styles.ctaQuizWrap, pressed && styles.pressed]} onPress={goToQuiz}>
            <LinearGradient
              colors={[homeColors.primary, homeColors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaQuizGradient}
            >
              <Ionicons name="bulb-outline" size={22} color="#fff" />
              <Text style={styles.ctaQuizText}>Take Career Quiz</Text>
            </LinearGradient>
          </Pressable>

          {/* CV Upload/Status Section */}
          {cvName ? (
            <View style={styles.cvUploadedContainer}>
              <View style={styles.cvUploadedContent}>
                <View style={styles.cvUploadedHeader}>
                  <Ionicons name="checkmark-circle" size={20} color={homeColors.accentGreen} />
                  <Text style={styles.cvUploadedTitle}>CV Uploaded</Text>
                </View>
                <Text style={styles.cvUploadedFilename} numberOfLines={1}>
                  {cvName}
                </Text>
                <View style={styles.cvActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cvActionBtn,
                      styles.cvChangeBtnStyle,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleChangeCV}
                    disabled={isProcessing}
                  >
                    <Ionicons name="swap-horizontal-outline" size={16} color={homeColors.primary} />
                    <Text style={styles.cvChangeBtnText}>Change</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.cvActionBtn,
                      styles.cvDeleteBtnStyle,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleDeleteCV}
                    disabled={isProcessing}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#f44336" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={16} color="#f44336" />
                        <Text style={styles.cvDeleteBtnText}>Delete</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.ctaUploadWrap, pressed && styles.pressed]}
              onPress={pickCV}
              disabled={isProcessing}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={homeColors.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={22} color={homeColors.textDark} />
                  <Text style={styles.ctaUploadText}>Upload Your CV</Text>
                </>
              )}
            </Pressable>
          )}
        </View>

        {/* How It Works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.howItWorksGrid}>
          {HOW_IT_WORKS.map((item) => (
            <View key={item.step} style={styles.howCard}>
              <View style={[styles.howIconBox, { backgroundColor: item.color + "20" }]}>
                <Ionicons name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.howCardTitle}>{item.step}. {item.title}</Text>
              <Text style={styles.howCardDesc}>{item.description}</Text>
            </View>
          ))}
        </View>

        {/* Trusted by Students */}
        <Text style={styles.sectionTitle}>Trusted by Students</Text>
        <View style={styles.trustedSubtitle}>
          <Ionicons name="sparkles" size={14} color={homeColors.primary} />
          <Text style={styles.trustedSubtitleText}>AI-powered career matching</Text>
        </View>
        <View style={styles.testimonials}>
          {TESTIMONIALS.map((t, i) => (
            <View key={i} style={styles.testimonialCard}>
              <StarRating />
              <Text style={styles.testimonialQuote}>"{t.quote}"</Text>
              <Text style={styles.testimonialAuthor}>– {t.author}, {t.age}</Text>
            </View>
          ))}
        </View>

        {/* CTA Block: Ready to Build Your Future? */}
        <Pressable style={({ pressed }) => [styles.ctaBlockWrap, pressed && styles.pressed]}>
          <LinearGradient
            colors={[homeColors.primaryLight, homeColors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.ctaBlockGradient}
          >
            <Text style={styles.ctaBlockTitle}>Ready to Build Your Future?</Text>
            <Text style={styles.ctaBlockSubtitle}>
              Start your journey today and discover the perfect career for you.
            </Text>
            <View style={styles.ctaBlockButtons}>
              <Pressable style={({ pressed }) => [styles.ctaBlockBtnWhite, pressed && styles.pressed]} onPress={goToQuiz}>
                <Text style={styles.ctaBlockBtnWhiteText}>Take the Quiz</Text>
                <Ionicons name="arrow-forward" size={18} color={homeColors.primary} />
              </Pressable>
              {cvName ? (
                <Pressable
                  style={({ pressed }) => [styles.ctaBlockBtnPurple, pressed && styles.pressed]}
                  onPress={() => (navigation as any).navigate("SkillsReview")}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.ctaBlockBtnPurpleText}>View CV Analysis</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.ctaBlockBtnPurple, pressed && styles.pressed]}
                  onPress={pickCV}
                  disabled={isProcessing}
                >
                  {isUploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.ctaBlockBtnPurpleText}>Upload CV</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </LinearGradient>
        </Pressable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 32 },
  pressed: { opacity: 0.9 },

  hero: {
    alignItems: "center",
    marginBottom: 36,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: homeColors.logoBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: homeColors.textDark,
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 8,
  },
  heroTitleHighlight: {
    color: homeColors.primary,
  },
  heroSubtitle: {
    fontSize: 14,
    color: homeColors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  ctaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 40,
  },
  ctaQuizWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  ctaQuizGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  ctaQuizText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  ctaUploadWrap: {
    flex: 1,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  ctaUploadText: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.textDark,
  },

  // CV Uploaded State Styles
  cvUploadedContainer: {
    flex: 1,
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: homeColors.accentGreen,
    padding: 12,
  },
  cvUploadedContent: {
    gap: 8,
  },
  cvUploadedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cvUploadedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: homeColors.accentGreen,
  },
  cvUploadedFilename: {
    fontSize: 13,
    color: homeColors.textDark,
    fontWeight: "600",
  },
  cvActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  cvActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  cvChangeBtnStyle: {
    backgroundColor: homeColors.primary + "15",
    borderWidth: 1,
    borderColor: homeColors.primary + "30",
  },
  cvChangeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: homeColors.primary,
  },
  cvDeleteBtnStyle: {
    backgroundColor: "#f4433615",
    borderWidth: 1,
    borderColor: "#f4433630",
  },
  cvDeleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f44336",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.textDark,
    marginTop: 8,
    marginBottom: 16,
    textAlign: "center",
  },
  trustedSubtitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 20,
  },
  trustedSubtitleText: {
    fontSize: 14,
    color: homeColors.primary,
  },

  howItWorksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 40,
    gap: 14,
  },
  howCard: {
    width: "47.5%",
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  howIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  howCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.textDark,
    marginBottom: 6,
  },
  howCardDesc: {
    fontSize: 12,
    color: homeColors.textMuted,
    lineHeight: 17,
  },

  testimonials: {
    gap: 16,
    marginBottom: 36,
  },
  testimonialCard: {
    backgroundColor: homeColors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
  },
  starRow: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 8,
  },
  testimonialQuote: {
    fontSize: 14,
    color: homeColors.textDark,
    lineHeight: 20,
    marginBottom: 8,
  },
  testimonialAuthor: {
    fontSize: 13,
    color: homeColors.textMuted,
  },

  ctaBlockWrap: {
    borderRadius: 20,
    overflow: "hidden",
  },
  ctaBlockGradient: {
    padding: 24,
  },
  ctaBlockTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  ctaBlockSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 20,
  },
  ctaBlockButtons: {
    flexDirection: "row",
    gap: 12,
  },
  ctaBlockBtnWhite: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  ctaBlockBtnWhiteText: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.primary,
  },
  ctaBlockBtnPurple: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    gap: 6,
  },
  ctaBlockBtnPurpleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  bottomSpacer: { height: 40 },
});

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useCvAnalysis } from "./hooks";
import { homeColors } from "../../screens/homeTheme";

type RawIssue = {
  title?: string;
  impact?: "low" | "medium" | "high";
  fix?: string;
  type?: string;
  severity?: "critical" | "warning" | "info";
  description?: string;
};

type RawImprovement = {
  section?: string;
  suggestion?: string;
  example?: string;
};

function normalizeListValue(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const maybeNamed = item as { name?: unknown; title?: unknown; value?: unknown };
          if (typeof maybeNamed.name === "string") return maybeNamed.name;
          if (typeof maybeNamed.title === "string") return maybeNamed.title;
          if (typeof maybeNamed.value === "string") return maybeNamed.value;
        }
        return "";
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getSeverityColor(severity: string) {
  if (severity === "critical" || severity === "high") return "#DC2626";
  if (severity === "warning" || severity === "medium") return "#D97706";
  return homeColors.primary;
}

function toSeverityLabel(issue: RawIssue): string {
  const severity = issue.severity ?? issue.impact ?? "info";
  return severity.toUpperCase();
}

function getIssueTitle(issue: RawIssue): string {
  if (issue.title?.trim()) return issue.title;
  if (issue.type?.trim()) {
    return issue.type.charAt(0).toUpperCase() + issue.type.slice(1);
  }
  return "Issue";
}

function getIssueDescription(issue: RawIssue): string {
  return issue.fix?.trim() || issue.description?.trim() || "No additional details provided.";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  return "Needs improvement";
}

export function CVAnalysisScreen() {
  const { data: analysis, isLoading, isFetching, error, refetch } = useCvAnalysis();

  if (isLoading || isFetching) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={homeColors.primary} />
          <Text style={styles.loadingTitle}>Analyzing your CV insights</Text>
          <Text style={styles.loadingSubtitle}>Preparing ATS score, improvements, and career matches...</Text>
        </View>
      </View>
    );
  }

  if (error || !analysis) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centeredState}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
            <Text style={styles.errorTitle}>No CV analysis available</Text>
            <Text style={styles.errorText}>
              {error?.message || "Go back, analyze your CV, then open this page again."}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const issues = (analysis.ats_issues ?? []) as RawIssue[];
  const improvements = (analysis.suggested_improvements ?? []) as RawImprovement[];
  const extractedSkills = normalizeListValue(
    analysis.extracted_skills ?? analysis.skills_extracted ?? analysis.skills
  );
  const extractedInterests = normalizeListValue(
    analysis.extracted_interests ?? analysis.interests_extracted ?? analysis.interests
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[homeColors.backgroundStart, homeColors.backgroundEnd]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="document-text-outline" size={20} color={homeColors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>CV Analysis</Text>
            <Text style={styles.headerSubtitle}>ATS compatibility and role-fit recommendations</Text>
          </View>
        </View>

        <View style={styles.scoreCard}>
          <LinearGradient
            colors={[homeColors.primary, homeColors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scoreGradient}
          >
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{analysis.ats_score}</Text>
              <Text style={styles.scoreOutOf}>/100</Text>
            </View>
            <View style={styles.scoreTextWrap}>
              <Text style={styles.scoreTitle}>ATS Friendliness</Text>
              <Text style={styles.scoreLabel}>{getScoreLabel(analysis.ats_score)}</Text>
              <Text style={styles.scoreHint}>Improving this score increases shortlist chances.</Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="alert-circle-outline"
            label="Issues"
            value={String(issues.length)}
            color={issues.length > 0 ? "#D97706" : "#059669"}
          />
          <StatCard
            icon="construct-outline"
            label="Improvements"
            value={String(improvements.length)}
            color={homeColors.primary}
          />
        </View>

        <Section title="ATS Issues" icon="warning-outline">
          {issues.length === 0 ? (
            <EmptyState text="No major ATS issues detected." />
          ) : (
            issues.map((issue, idx) => {
              const severityLabel = toSeverityLabel(issue);
              const severityColor = getSeverityColor((issue.severity || issue.impact || "info") as string);
              return (
                <View key={`issue-${idx}`} style={styles.itemCard}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemTitle}>{getIssueTitle(issue)}</Text>
                    <View style={[styles.badge, { backgroundColor: `${severityColor}22`, borderColor: `${severityColor}55` }]}>
                      <Text style={[styles.badgeText, { color: severityColor }]}>{severityLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemDescription}>{getIssueDescription(issue)}</Text>
                </View>
              );
            })
          )}
        </Section>

        <Section title="Suggested Improvements" icon="sparkles-outline">
          {improvements.length === 0 ? (
            <EmptyState text="No improvement suggestions returned yet." />
          ) : (
            improvements.map((improvement, idx) => (
              <View key={`improvement-${idx}`} style={styles.itemCard}>
                <View style={styles.itemHeaderRow}>
                  <Text style={styles.itemTitle}>{improvement.section || "General"}</Text>
                </View>
                <Text style={styles.itemDescription}>{improvement.suggestion || "No suggestion provided."}</Text>
                {!!improvement.example && (
                  <View style={styles.exampleBox}>
                    <Text style={styles.exampleLabel}>Example</Text>
                    <Text style={styles.exampleText}>{improvement.example}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </Section>

        <Section title="Extracted Skills & Interests" icon="albums-outline">
          {extractedSkills.length === 0 && extractedInterests.length === 0 ? (
            <EmptyState text="No extracted skills or interests found in this analysis." />
          ) : (
            <View style={styles.extractedGrid}>
              <View style={styles.extractedCard}>
                <View style={styles.extractedHeaderRow}>
                  <Ionicons name="flash-outline" size={16} color={homeColors.primary} />
                  <Text style={styles.extractedTitle}>Skills</Text>
                </View>
                {extractedSkills.length === 0 ? (
                  <Text style={styles.extractedEmptyText}>No skills extracted.</Text>
                ) : (
                  <View style={styles.tagWrap}>
                    {extractedSkills.map((skill, idx) => (
                      <View key={`extracted-skill-${idx}`} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.extractedCard}>
                <View style={styles.extractedHeaderRow}>
                  <Ionicons name="heart-outline" size={16} color={homeColors.accentTeal} />
                  <Text style={styles.extractedTitle}>Interests</Text>
                </View>
                {extractedInterests.length === 0 ? (
                  <Text style={styles.extractedEmptyText}>No interests extracted.</Text>
                ) : (
                  <View style={styles.tagWrap}>
                    {extractedInterests.map((interest, idx) => (
                      <View key={`extracted-interest-${idx}`} style={styles.tagChip}>
                        <Text style={styles.tagChipText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={homeColors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyStateCard}>
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 10,
  },
  loadingTitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: homeColors.textMuted,
    textAlign: "center",
    maxWidth: 320,
  },
  errorCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#991B1B",
  },
  errorText: {
    fontSize: 14,
    color: "#B91C1C",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 6,
    backgroundColor: homeColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#FFF",
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 14,
  },
  headerCard: {
    backgroundColor: homeColors.cardBg,
    borderColor: homeColors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${homeColors.primary}1A`,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: homeColors.textDark,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: homeColors.textMuted,
  },
  scoreCard: {
    borderRadius: 18,
    overflow: "hidden",
  },
  scoreGradient: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scoreCircle: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFF",
    lineHeight: 36,
  },
  scoreOutOf: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
  },
  scoreTextWrap: {
    flex: 1,
    gap: 2,
  },
  scoreTitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  scoreLabel: {
    fontSize: 22,
    color: "#FFF",
    fontWeight: "800",
  },
  scoreHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: homeColors.cardBg,
    borderColor: homeColors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: homeColors.textDark,
  },
  statLabel: {
    fontSize: 12,
    color: homeColors.textMuted,
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: homeColors.textDark,
  },
  sectionContent: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: homeColors.cardBg,
    borderColor: homeColors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  itemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  itemDescription: {
    fontSize: 14,
    color: homeColors.textMuted,
    lineHeight: 20,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  exampleBox: {
    backgroundColor: homeColors.backgroundMuted,
    borderRadius: 10,
    padding: 10,
    marginTop: 2,
  },
  exampleLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: homeColors.primary,
    marginBottom: 3,
  },
  exampleText: {
    fontSize: 13,
    color: homeColors.textDark,
    lineHeight: 18,
  },
  emptyStateCard: {
    backgroundColor: homeColors.cardBg,
    borderColor: homeColors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  emptyStateText: {
    color: homeColors.textMuted,
    fontSize: 14,
  },
  extractedGrid: {
    gap: 10,
  },
  extractedCard: {
    backgroundColor: homeColors.cardBg,
    borderColor: homeColors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  extractedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  extractedTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  extractedEmptyText: {
    fontSize: 13,
    color: homeColors.textMuted,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    backgroundColor: homeColors.backgroundMuted,
    borderWidth: 1,
    borderColor: homeColors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: homeColors.textDark,
  },
});

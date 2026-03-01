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

type RawCareer = {
  title?: string;
  why?: string;
  reasoning?: string;
  match_score?: number;
  missing_skills?: string[];
  learning_plan?: string[];
};

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

function getCareerReason(career: RawCareer): string {
  return career.why?.trim() || career.reasoning?.trim() || "This path aligns with your profile.";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  return "Needs improvement";
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 60) return "#D97706";
  return "#DC2626";
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
  const careers = (analysis.career_suggestions ?? []) as RawCareer[];

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
          <StatCard
            icon="briefcase-outline"
            label="Careers"
            value={String(careers.length)}
            color={homeColors.accentTeal}
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

        <Section title="Suggested Career Paths" icon="compass-outline">
          {careers.length === 0 ? (
            <EmptyState text="No career recommendations returned yet." />
          ) : (
            careers.map((career, idx) => (
              <CareerCard key={`${career.title || "career"}-${idx}`} career={career} />
            ))
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

function CareerCard({ career }: { career: RawCareer }) {
  const [expanded, setExpanded] = React.useState(false);
  const match = typeof career.match_score === "number" ? Math.max(0, Math.min(100, career.match_score)) : null;
  const reason = getCareerReason(career);

  return (
    <Pressable onPress={() => setExpanded((prev) => !prev)} style={styles.itemCard}>
      <View style={styles.itemHeaderRow}>
        <Text style={styles.itemTitle}>{career.title || "Career Recommendation"}</Text>
        <View style={styles.careerRightWrap}>
          {match !== null && (
            <View style={[styles.badge, { backgroundColor: `${getScoreColor(match)}22`, borderColor: `${getScoreColor(match)}55` }]}>
              <Text style={[styles.badgeText, { color: getScoreColor(match) }]}>{match}% Match</Text>
            </View>
          )}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={homeColors.textMuted}
          />
        </View>
      </View>

      <Text style={styles.itemDescription}>{reason}</Text>

      {expanded && (
        <View style={styles.expandedWrap}>
          {!!career.missing_skills?.length && (
            <View style={styles.expandedBlock}>
              <Text style={styles.expandedTitle}>Missing skills</Text>
              {career.missing_skills.map((skill, idx) => (
                <Text key={`missing-skill-${idx}`} style={styles.expandedItem}>• {skill}</Text>
              ))}
            </View>
          )}

          {!!career.learning_plan?.length && (
            <View style={styles.expandedBlock}>
              <Text style={styles.expandedTitle}>Learning plan</Text>
              {career.learning_plan.map((step, idx) => (
                <Text key={`learning-step-${idx}`} style={styles.expandedItem}>• {step}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </Pressable>
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
  careerRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  expandedWrap: {
    marginTop: 2,
    gap: 8,
  },
  expandedBlock: {
    backgroundColor: homeColors.backgroundMuted,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  expandedTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: homeColors.textDark,
  },
  expandedItem: {
    fontSize: 13,
    color: homeColors.textMuted,
    lineHeight: 18,
  },
});

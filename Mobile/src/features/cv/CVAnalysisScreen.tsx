import React, { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCvAnalysis } from './hooks';
import { homeColors } from '../../screens/homeTheme';

type RawIssue = {
  title?: string;
  impact?: 'low' | 'medium' | 'high';
  fix?: string;
  type?: string;
  severity?: 'critical' | 'warning' | 'info';
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
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const maybeNamed = item as { name?: unknown; title?: unknown; value?: unknown };
          if (typeof maybeNamed.name === 'string') return maybeNamed.name;
          if (typeof maybeNamed.title === 'string') return maybeNamed.title;
          if (typeof maybeNamed.value === 'string') return maybeNamed.value;
        }
        return '';
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getSeverityColor(severity: string) {
  if (severity === 'critical' || severity === 'high') return '#d14358';
  if (severity === 'warning' || severity === 'medium') return '#d97706';
  return homeColors.accentTeal;
}

function toSeverityLabel(issue: RawIssue): string {
  const severity = issue.severity ?? issue.impact ?? 'info';
  return severity.toUpperCase();
}

function getIssueTitle(issue: RawIssue): string {
  if (issue.title?.trim()) return issue.title;
  if (issue.type?.trim()) {
    return issue.type.charAt(0).toUpperCase() + issue.type.slice(1);
  }
  return 'Issue';
}

function getIssueDescription(issue: RawIssue): string {
  return issue.fix?.trim() || issue.description?.trim() || 'No additional details provided.';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Action Required: Moderate';
  return 'Critical Revision Needed';
}

function Badge({
  children,
  tone = 'primary',
}: {
  children: ReactNode;
  tone?: 'primary' | 'error' | 'tertiary' | 'ghost';
}) {
  const bg =
    tone === 'error'
      ? '#fbe7ec'
      : tone === 'tertiary'
      ? '#ffe9d6'
      : tone === 'ghost'
      ? '#efe7ff'
      : '#ece2ff';

  const color =
    tone === 'error'
      ? '#d14358'
      : tone === 'tertiary'
      ? '#c86d10'
      : tone === 'ghost'
      ? '#5b4a7b'
      : homeColors.primary;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}> 
      <Text style={[styles.badgeText, { color }]}>{children}</Text>
    </View>
  );
}

function ProgressDisk({ score }: { score: number }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressRingOuter}>
        <View style={styles.progressRingInner}>
          <Text style={styles.progressScore}>{score}</Text>
          <Text style={styles.progressOutOf}>/100</Text>
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Ionicons name={icon} size={20} color={homeColors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export function CVAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopLike = width >= 960;

  const { data: analysis, isLoading, isFetching, error, refetch } = useCvAnalysis();

  if (isLoading || isFetching) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#fcf4ff', '#f8edff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={homeColors.primary} />
          <Text style={styles.loadingTitle}>Analyzing your CV</Text>
          <Text style={styles.loadingSubtitle}>Building ATS insights and strategy roadmap...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !analysis) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#fcf4ff', '#f8edff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.centeredState}>
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={28} color="#d14358" />
            <Text style={styles.errorTitle}>No CV analysis available</Text>
            <Text style={styles.errorText}>
              {error?.message || 'Go back, analyze your CV, then open this page again.'}
            </Text>
            <Pressable style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
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

  const leftColWidth = isDesktopLike ? { width: '40%' as const } : undefined;
  const rightColWidth = isDesktopLike ? { width: '57%' as const } : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#fcf4ff', '#f8edff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top + 12, 16) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageTitleWrap}>
          <Text style={styles.pageTitle}>CV Analysis</Text>
          <Text style={styles.pageSubtitle}>
            Your AI scan is complete. Review ATS issues, strategic improvements, and extracted strengths.
          </Text>
        </View>

        <View style={[styles.mainGrid, isDesktopLike && styles.mainGridDesktop]}>
          <View style={[styles.leftColumn, leftColWidth]}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreKicker}>ATS COMPATIBILITY SCORE</Text>
              <ProgressDisk score={analysis.ats_score} />
              <Badge tone="tertiary">{getScoreLabel(analysis.ats_score)}</Badge>
              <Text style={styles.scoreContext}>
                Your CV currently performs better than many candidates, but targeted fixes can significantly improve shortlist chances.
              </Text>
            </View>
          </View>

          <View style={[styles.rightColumn, rightColWidth]}>
            <View style={styles.sectionCard}>
              <SectionTitle icon="alert-circle-outline" title="Identified Issues" />

              {issues.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No major ATS issues detected.</Text>
                </View>
              ) : (
                issues.map((issue, idx) => {
                  const severity = toSeverityLabel(issue);
                  const severityColor = getSeverityColor((issue.severity || issue.impact || 'info') as string);
                  return (
                    <View key={`issue-${idx}`} style={styles.issueItem}>
                      <View style={styles.issueRowTop}>
                        <Text style={styles.issueTitle}>{getIssueTitle(issue)}</Text>
                        <Badge tone={severity === 'CRITICAL' ? 'error' : 'tertiary'}>{severity}</Badge>
                      </View>
                      <Text style={styles.issueDescription}>{getIssueDescription(issue)}</Text>
                      <View style={[styles.issueUnderline, { backgroundColor: `${severityColor}33` }]} />
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.sectionCard}>
              <SectionTitle icon="construct-outline" title="Suggested Improvements" />

              {improvements.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No improvement suggestions returned yet.</Text>
                </View>
              ) : (
                improvements.map((item, idx) => (
                  <View key={`improvement-${idx}`} style={styles.improvementItem}>
                    <View style={styles.improvementHead}>
                      <Text style={styles.improvementSection}>{item.section || 'General'}</Text>
                    </View>
                    <Text style={styles.improvementText}>{item.suggestion || 'No suggestion provided.'}</Text>
                    {item.example ? (
                      <View style={styles.exampleBlock}>
                        <Text style={styles.exampleLabel}>Example</Text>
                        <Text style={styles.exampleText}>{item.example}</Text>
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </View>

            <View style={[styles.dualCards, isDesktopLike && styles.dualCardsDesktop]}>
              <View style={styles.skillsCard}>
                <Text style={styles.dualCardTitle}>Extracted Skills</Text>
                {extractedSkills.length === 0 ? (
                  <Text style={styles.dualCardEmpty}>No extracted skills found.</Text>
                ) : (
                  <View style={styles.chipsWrap}>
                    {extractedSkills.map((skill, idx) => (
                      <Badge key={`skill-${idx}`} tone="ghost">
                        {skill}
                      </Badge>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.interestCard}>
                <Text style={styles.dualCardTitleLight}>Extracted Interests</Text>
                {extractedInterests.length === 0 ? (
                  <Text style={styles.dualCardEmptyLight}>No extracted interests found.</Text>
                ) : (
                  <View style={styles.chipsWrap}>
                    {extractedInterests.map((interest, idx) => (
                      <View key={`interest-${idx}`} style={styles.lightChip}>
                        <Text style={styles.lightChipText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '900',
    color: '#37274d',
  },
  loadingSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6f6085',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },
  errorCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 8,
    alignItems: 'center',
  },
  errorTitle: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '900',
    color: '#37274d',
  },
  errorText: {
    marginTop: 6,
    fontSize: 14,
    color: '#6f6085',
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: homeColors.primary,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  pageTitleWrap: {
    marginBottom: 18,
  },
  pageTitle: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    color: '#37274d',
    letterSpacing: -0.8,
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#6f6085',
    maxWidth: 700,
  },
  mainGrid: {
    gap: 14,
  },
  mainGridDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftColumn: {
    gap: 14,
  },
  rightColumn: {
    gap: 14,
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
  },
  scoreKicker: {
    fontSize: 11,
    fontWeight: '900',
    color: homeColors.primary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  progressWrap: {
    marginTop: 14,
    marginBottom: 14,
  },
  progressRingOuter: {
    width: 186,
    height: 186,
    borderRadius: 93,
    backgroundColor: '#ece2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRingInner: {
    width: 146,
    height: 146,
    borderRadius: 73,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 5,
  },
  progressScore: {
    fontSize: 56,
    lineHeight: 58,
    fontWeight: '900',
    color: '#37274d',
  },
  progressOutOf: {
    fontSize: 16,
    color: '#8d7aa8',
    fontWeight: '600',
  },
  scoreContext: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#6f6085',
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: '#f2e2ff',
    borderRadius: 24,
    padding: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#37274d',
    letterSpacing: -0.2,
  },
  issueItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  issueRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  issueTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: '#37274d',
  },
  issueDescription: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: '#6b5d80',
  },
  issueUnderline: {
    marginTop: 10,
    height: 4,
    borderRadius: 2,
  },
  improvementItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  improvementHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  improvementSection: {
    fontSize: 14,
    fontWeight: '900',
    color: '#6437db',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  improvementText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6b5d80',
  },
  exampleBlock: {
    marginTop: 10,
    backgroundColor: '#f8edff',
    borderRadius: 10,
    padding: 10,
  },
  exampleLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6437db',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  exampleText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4f4164',
  },
  dualCards: {
    gap: 10,
  },
  dualCardsDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  skillsCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#37274d',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 5,
  },
  interestCard: {
    flex: 1,
    backgroundColor: homeColors.primary,
    borderRadius: 24,
    padding: 18,
  },
  dualCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#37274d',
    marginBottom: 10,
  },
  dualCardTitleLight: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 10,
  },
  dualCardEmpty: {
    fontSize: 13,
    color: '#7f6d96',
  },
  dualCardEmptyLight: {
    fontSize: 13,
    color: '#ece2ff',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  lightChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lightChipText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#7f6d96',
  },
});

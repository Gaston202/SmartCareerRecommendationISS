/**
 * CV Analysis Screen
 * Displays ATS score, issues, improvements, and career suggestions
 */
import React from "react";
import { ActivityIndicator } from "react-native";
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Heading,
  Icon,
  AlertCircleIcon,
  CheckIcon,
  Pressable,
} from "@gluestack-ui/themed";
import { useCvAnalysis } from "./hooks";
import type { AtsIssue } from "./types";

export function CVAnalysisScreen() {
  const { data: analysis, isLoading, error } = useCvAnalysis();

  if (isLoading) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" bg="$white">
        <VStack space="md" alignItems="center">
          <ActivityIndicator size="large" />
          <Text color="$gray600">Analyzing your CV...</Text>
        </VStack>
      </Box>
    );
  }

  if (error || !analysis) {
    return (
      <Box flex={1} bg="$white" p="$4">
        <Box bg="$red50" p="$4" rounded="$lg">
          <HStack space="md" alignItems="center">
            <Icon as={AlertCircleIcon} color="$error600" size="lg" />
            <VStack flex={1} space="xs">
              <Text fontWeight="$semibold" color="$error700">
                No analysis available
              </Text>
              <Text size="sm" color="$error600">
                Upload a CV first to see analysis results
              </Text>
            </VStack>
          </HStack>
        </Box>
      </Box>
    );
  }

  return (
    <Box flex={1} bg="$white">
      <ScrollView>
        <VStack p="$4" space="lg">
          {/* Header */}
          <VStack space="xs">
            <Heading size="xl">CV Analysis</Heading>
            <Text size="sm" color="$gray600">
              ATS compatibility & career recommendations
            </Text>
          </VStack>

          {/* ATS Score */}
          <ATSScoreCard score={analysis.ats_score} />

          {/* ATS Issues */}
          {analysis.ats_issues?.length > 0 && (
            <VStack space="md">
              <Heading size="md">ATS Issues</Heading>
              {analysis.ats_issues.map((issue: AtsIssue, idx: number) => (
                <IssueCard key={idx} issue={issue} />
              ))}
            </VStack>
          )}

          {/* ATS Suggestions */}
          {analysis.ats_suggestions?.length > 0 && (
            <VStack space="md">
              <Heading size="md">Suggested Improvements</Heading>
              {analysis.ats_suggestions.map((sugg: any, idx: number) => (
                <Box key={idx} bg="$blue50" p="$3" rounded="$lg">
                  <VStack space="sm">
                    <HStack space="sm" alignItems="center">
                      <Icon as={CheckIcon} color="$blue600" size="md" />
                      <Text fontWeight="$semibold" color="$blue700" flex={1}>
                        {sugg.section}
                      </Text>
                    </HStack>

                    <Text size="sm" color="$blue600" ml="$6">
                      {sugg.suggestion}
                    </Text>

                    {sugg.example && (
                      <Box
                        bg="$white"
                        p="$2"
                        rounded="$md"
                        ml="$6"
                        borderLeftWidth={2}
                        borderLeftColor="$blue300"
                      >
                        <Text size="xs" color="$gray700">
                          {sugg.example}
                        </Text>
                      </Box>
                    )}
                  </VStack>
                </Box>
              ))}
            </VStack>
          )}

          {/* Career Suggestions */}
          {analysis.career_suggestions?.length > 0 && (
            <VStack space="md">
              <Heading size="md">Suggested Career Paths</Heading>
              {analysis.career_suggestions.map((career: any, idx: number) => (
                <CareerCard key={idx} career={career} />
              ))}
            </VStack>
          )}

          {/* Empty State */}
          {!analysis.ats_issues?.length &&
            !analysis.ats_suggestions?.length &&
            !analysis.career_suggestions?.length && (
              <Box bg="$gray50" p="$6" rounded="$lg" alignItems="center">
                <Text color="$gray600">No detailed analysis available yet</Text>
              </Box>
            )}
        </VStack>
      </ScrollView>
    </Box>
  );
}

/**
 * ATS Score Card
 */
function ATSScoreCard({ score }: { score: number }) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return "$success600";
    if (s >= 60) return "$warning600";
    return "$error600";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 80) return "Excellent";
    if (s >= 60) return "Good";
    return "Needs improvement";
  };

  return (
    <Box bg="$gray50" p="$6" rounded="$lg">
      <VStack alignItems="center" space="md">
        <Text size="sm" color="$gray600">
          ATS Friendliness Score
        </Text>

        <HStack alignItems="center" space="md">
          <Box
            width={120}
            height={120}
            rounded="$full"
            bg={getScoreColor(score)}
            justifyContent="center"
            alignItems="center"
          >
            <VStack alignItems="center">
              <Text size="4xl" fontWeight="$bold" color="$white">
                {score}
              </Text>
              <Text size="xs" color="$white" mt="$1">
                / 100
              </Text>
            </VStack>
          </Box>

          <VStack flex={1} space="sm">
            <Text fontWeight="$bold" size="lg" color={getScoreColor(score)}>
              {getScoreLabel(score)}
            </Text>
            <Text size="sm" color="$gray600">
              Your CV is formatted for automated screening systems.
            </Text>
          </VStack>
        </HStack>
      </VStack>
    </Box>
  );
}

/**
 * Issue Card
 */
function IssueCard({ issue }: { issue: AtsIssue }) {
  const impactColors: Record<string, string> = {
    high: "$error600",
    medium: "$warning600",
    low: "$info600",
  };

  return (
    <Box
      bg="$gray50"
      p="$3"
      rounded="$lg"
      borderLeftWidth={4}
      borderLeftColor={impactColors[issue.impact]}
    >
      <VStack space="sm">
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="$semibold" color="$gray900" flex={1}>
            {issue.title}
          </Text>
          <Box bg={impactColors[issue.impact]} px="$2" py="$1" rounded="$full">
            <Text size="xs" fontWeight="$bold" color="$white">
              {issue.impact}
            </Text>
          </Box>
        </HStack>
        <Text size="sm" color="$gray700">
          {issue.fix}
        </Text>
      </VStack>
    </Box>
  );
}

/**
 * Career Card
 */
function CareerCard({ career }: any) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Pressable onPress={() => setExpanded(!expanded)}>
      <Box bg="$blue50" p="$4" rounded="$lg">
        <VStack space="md">
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontWeight="$bold" size="lg" color="$blue900">
              {career.title}
            </Text>
            {expanded ? (
              <Icon as={CheckIcon} color="$blue600" />
            ) : (
              <Text color="$blue600">›</Text>
            )}
          </HStack>

          <Text size="sm" color="$blue700">
            {career.why}
          </Text>

          {expanded && (
            <VStack space="sm">
              {career.missing_skills?.map((s: string, i: number) => (
                <Text key={i} size="sm" color="$blue700">
                  • {s}
                </Text>
              ))}
            </VStack>
          )}
        </VStack>
      </Box>
    </Pressable>
  );
}

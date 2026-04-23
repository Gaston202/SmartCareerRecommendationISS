#!/usr/bin/env ts-node

import 'dotenv/config';

type TestStatus = 'passed' | 'failed' | 'skipped';

interface TestResult {
  name: string;
  status: TestStatus;
  message: string;
  failures: string[];
}

interface AuthResponse {
  access_token?: string;
}

interface RetrievedResourceDto {
  resource_title: string;
  source_url: string;
  score: number;
  keyword_score?: number;
  semantic_score?: number;
}

interface SearchResponseData {
  resources: RetrievedResourceDto[];
}

interface ResourceEvidenceDto {
  title: string;
  matchedBy: string[];
  skillLinkScore: number;
}

interface RoadmapStepDto {
  skill_name: string;
  confidence_score: number;
  source_url: string | null;
  primary_resource?: ResourceEvidenceDto | null;
}

interface PlanResponseData {
  success: boolean;
  steps: RoadmapStepDto[];
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

const BACKEND_BASE_URL = 'http://localhost:3000/api/v1';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function getJwtToken(): Promise<string> {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const email = requireEnv('TEST_USER_EMAIL');
  const password = requireEnv('TEST_USER_PASSWORD');

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json()) as AuthResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(`Failed to get JWT token. Status=${response.status}`);
  }

  return payload.access_token;
}

async function postJson<T>(token: string, path: string, body: unknown): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Bypass-Cache': 'true',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(`Request failed for ${path}. Status=${response.status} Body=${JSON.stringify(payload)}`);
  }

  return payload;
}

function buildFixesNeeded(results: TestResult[]): string[] {
  const fixes = new Set<string>();

  for (const result of results) {
    if (result.status !== 'failed') continue;

    if (result.name === 'TEST 1') {
      fixes.add('[roadmap-retrieval.service.ts](/Users/mac/Documents/GitHub/SmartCareerRecommendationISS/Mobile/backend/src/modules/roadmap/roadmap-retrieval.service.ts): `keywordCandidates()` / `fuseAndRerank()`');
    }

    if (result.name === 'TEST 2') {
      const joined = result.failures.join(' ');
      if (joined.includes('"Data"') || joined.includes('"Business"')) {
        fixes.add('[008_seed_role_skill_map.sql](/Users/mac/Documents/GitHub/SmartCareerRecommendationISS/Mobile/backend/migrations/008_seed_role_skill_map.sql): canonical Data Analyst seed block');
        fixes.add('[roadmap-skill-gap.service.ts](/Users/mac/Documents/GitHub/SmartCareerRecommendationISS/Mobile/backend/src/modules/roadmap/roadmap-skill-gap.service.ts): `loadRoleSkills()` / `normalizeSkillName()`');
      } else {
        fixes.add('[roadmap-planner.service.ts](/Users/mac/Documents/GitHub/SmartCareerRecommendationISS/Mobile/backend/src/modules/roadmap/roadmap-planner.service.ts): `buildResponseFromBundles()` / `buildBundlesWithWebFallback()`');
        fixes.add('[roadmap-evidence.service.ts](/Users/mac/Documents/GitHub/SmartCareerRecommendationISS/Mobile/backend/src/modules/roadmap/roadmap-evidence.service.ts): `buildEvidenceBundlesWithLinks()`');
      }
    }

    if (result.name === 'TEST 3') {
      fixes.add('[roadmap-web-search.service.ts](/Users/mac/Documents/GitHub/SmartCareerRecommendationISS/Mobile/backend/src/modules/roadmap/roadmap-web-search.service.ts): `searchForSkill()`');
      fixes.add('[roadmap-planner.service.ts](/Users/mac/Documents/GitHub/SmartCareerRecommendationISS/Mobile/backend/src/modules/roadmap/roadmap-planner.service.ts): `buildBundlesWithWebFallback()`');
    }
  }

  return Array.from(fixes);
}

async function runTest1(token: string): Promise<TestResult> {
  const failures: string[] = [];

  const response = await postJson<SearchResponseData>(token, '/roadmap/resources/search', {
    query: 'SQL for Data Analyst',
    top_k: 5,
  });

  const resources = response.data?.resources ?? [];
  const topTitles = resources.slice(0, 3).map((resource) => resource.resource_title);
  const topResource = resources[0];

  if (resources.length < 3) {
    failures.push(`resources.length expected >= 3, got ${resources.length}`);
  }

  if (!topResource || (topResource.keyword_score ?? 0) <= 0.3) {
    failures.push(`resources[0].keyword_score expected > 0.3, got ${topResource?.keyword_score ?? null}`);
  }

  if (!topResource || topResource.semantic_score == null || Number.isNaN(topResource.semantic_score)) {
    failures.push(`resources[0].semantic_score expected >= 0, got ${topResource?.semantic_score ?? null}`);
  }

  if (!topTitles.includes('SQL Foundations for Data Analysts')) {
    failures.push(`top 3 titles expected to include "SQL Foundations for Data Analysts", got ${JSON.stringify(topTitles)}`);
  }

  if (failures.length > 0) {
    return {
      name: 'TEST 1',
      status: 'failed',
      message: 'retrieval verification failed',
      failures,
    };
  }

  return {
    name: 'TEST 1',
    status: 'passed',
    message: `retrieval working, keyword_score: ${topResource.keyword_score}, top resource: "${topResource.resource_title}"`,
    failures: [],
  };
}

async function runTest2(token: string): Promise<TestResult> {
  const failures: string[] = [];

  const response = await postJson<PlanResponseData>(token, '/roadmap/plan', {
    target_role: 'Data Analyst',
    max_steps: 5,
    user_profile: {
      declared_skills: [],
    },
  });

  const plan = response.data;
  const steps = plan?.steps ?? [];
  const allowedFirstSkills = new Set(['SQL', 'Excel', 'Statistics', 'Python', 'Data Visualization']);
  const firstStep = steps[0];
  const highConfidenceStep = steps.find((step) => step.confidence_score > 0.35);
  const badSkill = steps.find((step) => step.skill_name === 'Data' || step.skill_name === 'Business');

  if (plan?.success !== true) {
    failures.push(`success expected true, got ${plan?.success ?? null}`);
  }

  if (steps.length < 3) {
    failures.push(`steps.length expected >= 3, got ${steps.length}`);
  }

  if (!firstStep || !allowedFirstSkills.has(firstStep.skill_name)) {
    failures.push(`steps[0].skill_name expected one of ${JSON.stringify(Array.from(allowedFirstSkills))}, got ${firstStep?.skill_name ?? null}`);
  }

  if (!firstStep?.primary_resource) {
    failures.push(`steps[0].primary_resource expected non-null, got ${firstStep?.primary_resource ?? null}`);
  }

  if (!firstStep?.primary_resource?.matchedBy || firstStep.primary_resource.matchedBy.length === 0) {
    failures.push(`steps[0].primary_resource.matchedBy expected non-empty, got ${JSON.stringify(firstStep?.primary_resource?.matchedBy ?? null)}`);
  }

  if (!highConfidenceStep) {
    failures.push(`expected at least one step with confidence_score > 0.35, got ${JSON.stringify(steps.map((step) => ({ skill: step.skill_name, confidence: step.confidence_score })))}`);
  }

  if (badSkill) {
    failures.push(`unexpected bad skill name found: "${badSkill.skill_name}"`);
  }

  if (failures.length > 0) {
    return {
      name: 'TEST 2',
      status: 'failed',
      message: 'plan generation verification failed',
      failures,
    };
  }

  return {
    name: 'TEST 2',
    status: 'passed',
    message: `plan generated with ${steps.length} steps, first skill: "${firstStep.skill_name}"`,
    failures: [],
  };
}

async function runTest3(token: string): Promise<TestResult> {
  const tavilyApiKey = process.env.TAVILY_API_KEY?.trim();
  if (!tavilyApiKey) {
    return {
      name: 'TEST 3',
      status: 'skipped',
      message: 'no TAVILY_API_KEY',
      failures: [],
    };
  }

  const failures: string[] = [];
  const response = await postJson<PlanResponseData>(token, '/roadmap/plan', {
    target_role: 'Data Analyst',
    max_steps: 3,
    user_profile: {
      declared_skills: ['SQL', 'Excel', 'Python', 'Statistics', 'Tableau'],
    },
  });

  const steps = response.data?.steps ?? [];
  const webStep = steps.find((step) => typeof step.source_url === 'string' && !step.source_url.includes('seed.smartcareer.local'));

  if (steps.length < 1) {
    failures.push(`steps.length expected >= 1, got ${steps.length}`);
  }

  if (!webStep) {
    failures.push(`expected at least one step with external source_url, got ${JSON.stringify(steps.map((step) => ({ skill: step.skill_name, source_url: step.source_url })))}`);
  }

  if (failures.length > 0) {
    return {
      name: 'TEST 3',
      status: 'failed',
      message: 'web fallback verification failed',
      failures,
    };
  }

  return {
    name: 'TEST 3',
    status: 'passed',
    message: `web fallback working, external source: "${webStep?.source_url}"`,
    failures: [],
  };
}

function printResult(result: TestResult): void {
  if (result.status === 'passed') {
    console.log(`✅ ${result.name} PASSED - ${result.message}`);
    return;
  }

  if (result.status === 'skipped') {
    console.log(`⏭  ${result.name} SKIPPED - ${result.message}`);
    return;
  }

  console.log(`❌ ${result.name} FAILED - reason: ${result.message}`);
  for (const failure of result.failures) {
    console.log(`   - ${failure}`);
  }
}

async function main(): Promise<void> {
  try {
    requireEnv('SUPABASE_URL');
    requireEnv('SUPABASE_ANON_KEY');
    requireEnv('TEST_USER_EMAIL');
    requireEnv('TEST_USER_PASSWORD');

    console.log('Note: cache bypass header is sent, but if your backend does not honor `X-Bypass-Cache`, flush Redis manually before trusting cached-sensitive results.');

    const token = await getJwtToken();
    const results = [
      await runTest1(token),
      await runTest2(token),
      await runTest3(token),
    ];

    for (const result of results) {
      printResult(result);
    }

    const passedCount = results.filter((result) => result.status === 'passed').length;
    const failedCount = results.filter((result) => result.status === 'failed').length;
    const skippedCount = results.filter((result) => result.status === 'skipped').length;

    console.log('');
    console.log(`SUMMARY: ${passedCount}/${results.length} passed${skippedCount > 0 ? `, ${skippedCount} skipped` : ''}`);

    if (failedCount > 0) {
      const fixes = buildFixesNeeded(results);
      if (fixes.length > 0) {
        console.log('');
        console.log('FIXES NEEDED');
        for (const fix of fixes) {
          console.log(`- ${fix}`);
        }
      }
      process.exit(1);
    }

    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`❌ TEST RUN FAILED - ${message}`);
    process.exit(1);
  }
}

void main();

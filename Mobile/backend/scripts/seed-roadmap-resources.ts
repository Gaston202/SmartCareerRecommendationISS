#!/usr/bin/env ts-node

import 'dotenv/config';

import { createHash } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SourceType =
  | 'course_platform'
  | 'official_docs'
  | 'tutorial_blog'
  | 'youtube_metadata'
  | 'job_roadmap_article'
  | 'internal_curated';

type ResourceType = 'course' | 'article' | 'docs' | 'video' | 'bootcamp' | 'roadmap' | 'tutorial';
type SkillLevel = 'beginner' | 'intermediate' | 'advanced';
type FreeOrPaid = 'free' | 'paid' | 'mixed';

interface ResourceSeed {
  provider: string;
  providerResourceId: string;
  sourceType: SourceType;
  resourceType: ResourceType;
  title: string;
  description: string;
  sourceUrl: string;
  language: string;
  level: SkillLevel;
  freeOrPaid: FreeOrPaid;
  durationHours: number;
  certificate: boolean;
  providerRating?: number;
  skillTags: string[];
  targetRoles: string[];
  metadata?: Record<string, unknown>;
  chunks: string[];
}

interface ResourceRow {
  id: string;
  provider: string;
  provider_resource_id: string | null;
  normalized_content_sha256: string | null;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PROVIDER = 'career_seed_library';

function sha256(text: string | null | undefined): string | null {
  if (!text) return null;
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if ((parsed.protocol === 'https:' && parsed.port === '443') || (parsed.protocol === 'http:' && parsed.port === '80')) {
      parsed.port = '';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

function buildResourcePayload(seed: ResourceSeed) {
  const now = new Date().toISOString();
  const rawContent = seed.chunks.join('\n\n');
  const normalizedContent = normalizeText(rawContent);

  return {
    provider: seed.provider,
    provider_resource_id: seed.providerResourceId,
    source_type: seed.sourceType,
    resource_type: seed.resourceType,
    title: seed.title,
    description: seed.description,
    source_url: seed.sourceUrl,
    source_url_normalized: normalizeUrl(seed.sourceUrl),
    language: seed.language,
    level: seed.level,
    free_or_paid: seed.freeOrPaid,
    duration_hours: seed.durationHours,
    certificate: seed.certificate,
    skill_tags: seed.skillTags,
    target_roles: seed.targetRoles,
    provider_rating: seed.providerRating ?? null,
    metadata: {
      seeded_by: 'seed-roadmap-resources.ts',
      seeded_at: now,
      ...seed.metadata,
    },
    raw_content: rawContent,
    normalized_content: normalizedContent,
    raw_content_sha256: sha256(rawContent),
    normalized_content_sha256: sha256(normalizedContent),
    last_crawled_at: now,
    last_refreshed_at: now,
    is_active: true,
    embedding_status: 'pending',
    embedding_updated_at: null,
  };
}

async function findExistingResource(
  client: SupabaseClient,
  seed: ResourceSeed,
): Promise<ResourceRow | null> {
  const { data, error } = await client
    .from('resources')
    .select('id, provider, provider_resource_id, normalized_content_sha256')
    .eq('provider', seed.provider)
    .eq('provider_resource_id', seed.providerResourceId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check existing resource ${seed.providerResourceId}: ${error.message}`);
  }

  return (data as ResourceRow | null) ?? null;
}

async function upsertResource(client: SupabaseClient, seed: ResourceSeed): Promise<{
  id: string;
  action: 'inserted' | 'updated' | 'skipped';
}> {
  const payload = buildResourcePayload(seed);
  const existing = await findExistingResource(client, seed);

  if (existing && existing.normalized_content_sha256 === payload.normalized_content_sha256) {
    return { id: existing.id, action: 'skipped' };
  }

  if (existing) {
    const { error } = await client.from('resources').update(payload).eq('id', existing.id);
    if (error) {
      throw new Error(`Failed to update resource ${seed.providerResourceId}: ${error.message}`);
    }
    return { id: existing.id, action: 'updated' };
  }

  const { data, error } = await client
    .from('resources')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert resource ${seed.providerResourceId}: ${error?.message || 'unknown error'}`);
  }

  return { id: data.id as string, action: 'inserted' };
}

async function replaceChunks(client: SupabaseClient, resourceId: string, chunks: string[]): Promise<void> {
  const { error: deleteError } = await client.from('resource_chunks').delete().eq('resource_id', resourceId);
  if (deleteError) {
    throw new Error(`Failed to clear chunks for ${resourceId}: ${deleteError.message}`);
  }

  const chunkRows = chunks.map((chunkText, index) => {
    const normalized = normalizeText(chunkText);
    return {
      resource_id: resourceId,
      chunk_index: index,
      chunk_text: normalized,
      token_count: estimateTokenCount(normalized),
      chunk_sha256: sha256(normalized)!,
      embedding: null,
      embedding_model: null,
      embedding_created_at: null,
    };
  });

  const { error: insertError } = await client.from('resource_chunks').insert(chunkRows);
  if (insertError) {
    throw new Error(`Failed to insert chunks for ${resourceId}: ${insertError.message}`);
  }
}

function buildSeeds(): ResourceSeed[] {
  return [
    {
      provider: PROVIDER,
      providerResourceId: 'seed-data-analyst-sql-foundations',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'SQL Foundations for Data Analysts',
      description: 'A practical guide to filtering, joining, aggregating, and validating business data with SQL.',
      sourceUrl: 'https://seed.smartcareer.local/data-analyst/sql-foundations',
      language: 'en',
      level: 'beginner',
      freeOrPaid: 'free',
      durationHours: 10,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['sql', 'data analysis', 'joins', 'aggregations', 'data cleaning', 'reporting'],
      targetRoles: ['Data Analyst', 'Business Analyst', 'Operations Analyst'],
      metadata: { career_path: 'Data Analyst' },
      chunks: [
        'SQL is the daily language of analytics because it lets analysts ask precise questions about revenue, retention, quality, and operations without moving data into spreadsheets first. A strong analyst starts by learning how to select fields, filter records, sort results, and validate row counts so every dashboard or insight begins with trustworthy data.',
        'The next leap is mastering joins and aggregations. Analysts often combine orders, customers, marketing channels, and support events in one query, then group the results by week, region, or segment to explain trends. Understanding inner joins, left joins, duplicate handling, and null behavior prevents inflated metrics and broken reporting logic.',
        'Real analyst work also includes data cleaning and documentation. You need patterns for standardizing categories, trimming invalid values, identifying missing records, and writing readable queries with clear aliases and comments. Teams trust analysts who can explain how a metric was calculated and why the SQL definition matches the business definition.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-data-analyst-python-pandas',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'Python and Pandas Workflow for Analysts',
      description: 'Hands-on material for cleaning datasets, exploring trends, and automating repetitive analysis tasks in Python.',
      sourceUrl: 'https://seed.smartcareer.local/data-analyst/python-pandas',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 12,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['python', 'pandas', 'data cleaning', 'exploratory data analysis', 'automation', 'csv'],
      targetRoles: ['Data Analyst', 'Analytics Engineer', 'Business Intelligence Analyst'],
      metadata: { career_path: 'Data Analyst' },
      chunks: [
        'Python helps analysts move beyond one-off spreadsheet work into repeatable analysis. With pandas you can load CSV or Excel files, inspect column types, handle missing values, and reshape data into a format that supports deeper questions. That makes it easier to debug your process and rerun the same workflow every time new data arrives.',
        'Exploratory analysis in pandas is not just about plotting charts. It is about checking distributions, spotting outliers, understanding category balance, and creating quick summaries that explain what changed. Analysts who can combine filters, groupby operations, calculated columns, and merges become much faster at finding signal in messy data.',
        'Automation matters because analysts often rebuild the same weekly report or data quality check. A simple Python script can standardize dates, apply the same business rules, export clean tables, and alert you when source files break expectations. That saves time and reduces manual mistakes in recurring analytics work.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-data-analyst-excel-analysis-playbook',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Excel Analysis Playbook for Business Reporting',
      description: 'Covers lookup formulas, pivot tables, scenario analysis, and stakeholder-ready spreadsheet practices.',
      sourceUrl: 'https://seed.smartcareer.local/data-analyst/excel-playbook',
      language: 'en',
      level: 'beginner',
      freeOrPaid: 'free',
      durationHours: 8,
      certificate: false,
      providerRating: 4.6,
      skillTags: ['excel', 'pivot tables', 'lookup formulas', 'reporting', 'stakeholder communication'],
      targetRoles: ['Data Analyst', 'Business Analyst', 'Project Quality Coordinator'],
      metadata: { career_path: 'Data Analyst' },
      chunks: [
        'Excel remains relevant for analysts because many teams still review budgets, forecasts, audits, and operating metrics in spreadsheets. Strong Excel users know how to structure tabs, separate raw data from calculations, and build formulas that are easy for someone else to audit. That discipline matters just as much as speed.',
        'Pivot tables and lookup functions solve a huge part of business reporting. Analysts use them to summarize performance by team, identify top drivers of change, and connect reference data such as targets or territories. When paired with conditional formatting and validation rules, these tools quickly surface issues in source data or process quality.',
        'The most valuable Excel skill is translating analysis for stakeholders. A spreadsheet should explain assumptions, highlight key numbers, and make scenario changes easy to follow. Business leaders are more likely to trust your recommendation when the workbook is organized, documented, and resilient to small data changes.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-data-analyst-tableau-storytelling',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'Tableau Storytelling for Operational Dashboards',
      description: 'Shows how analysts design useful dashboards, choose visuals, and communicate performance drivers.',
      sourceUrl: 'https://seed.smartcareer.local/data-analyst/tableau-storytelling',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 9,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['tableau', 'dashboards', 'data visualization', 'kpis', 'storytelling', 'analytics'],
      targetRoles: ['Data Analyst', 'Business Intelligence Analyst', 'Product Manager'],
      metadata: { career_path: 'Data Analyst' },
      chunks: [
        'A dashboard is only useful when it helps someone take action. Tableau work starts by defining the decision the viewer needs to make, the KPI that matters, and the level of detail that is actually helpful. Analysts often fail when they pack every chart into one page instead of guiding the audience to the question that matters most.',
        'Effective Tableau design uses visual hierarchy, comparison, and context. Trend lines, benchmark references, cohort breakdowns, and drill-down paths help users move from a headline metric to the operational reason behind it. Choosing the right chart type is important, but choosing the right comparison is what turns reporting into analysis.',
        'Good dashboard owners also manage freshness, definitions, and trust. You should annotate filters, show the data window, explain how metrics are calculated, and validate numbers against source systems. Stakeholders rely on a dashboard only when they know what it measures and when it should be questioned.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-data-analyst-statistics-business-decisions',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Statistics for Business Decision Making',
      description: 'Introduces descriptive statistics, sampling, confidence, and experiment thinking for analysts.',
      sourceUrl: 'https://seed.smartcareer.local/data-analyst/statistics-business-decisions',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 11,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['statistics', 'experimentation', 'sampling', 'confidence intervals', 'a/b testing'],
      targetRoles: ['Data Analyst', 'Product Manager', 'Growth Analyst'],
      metadata: { career_path: 'Data Analyst' },
      chunks: [
        'Statistics helps analysts separate noise from evidence. Descriptive measures like mean, median, variance, and percentiles explain what happened, but the real value comes from understanding whether a pattern is stable, surprising, or likely to change with more data. That mindset keeps teams from overreacting to random fluctuations.',
        'Sampling and confidence matter whenever you analyze a subset of users, transactions, or sessions. Analysts need to recognize biased samples, small sample pitfalls, and when an estimate is too uncertain to support a decision. Confidence intervals and effect size give leaders a more honest view than a single percentage alone.',
        'Modern analytics work also overlaps with experiment design. Even if you are not a data scientist, you should know how to frame a hypothesis, define a success metric, guard against peeking too early, and interpret a test without ignoring business context. Statistical thinking improves prioritization as much as it improves analysis.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-software-engineer-algorithms-practice',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'Algorithms and Data Structures Practice Guide',
      description: 'Explains core problem-solving patterns used in engineering interviews and production code.',
      sourceUrl: 'https://seed.smartcareer.local/software-engineer/algorithms-practice',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 14,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['algorithms', 'data structures', 'problem solving', 'arrays', 'hash maps', 'graphs'],
      targetRoles: ['Software Engineer', 'Backend Engineer', 'Full Stack Engineer'],
      metadata: { career_path: 'Software Engineer' },
      chunks: [
        'Algorithms matter because software engineers constantly trade simplicity, speed, and memory. A practical study plan starts with arrays, strings, hash maps, stacks, queues, trees, and graphs, then focuses on the patterns that show up repeatedly: two pointers, sliding window, breadth-first search, depth-first search, and dynamic programming.',
        'Good engineering problem solving is not about memorizing answers. It is about choosing the right representation for the problem, testing edge cases early, and explaining complexity clearly. Engineers who can reason about time complexity, space usage, and failure modes tend to write code that scales better in production as well as interviews.',
        'Production engineering uses the same mindset in a more collaborative setting. When designing a feature, you still need to select the right data structure, understand the cost of repeated operations, and recognize when a naive solution will break under load. Algorithmic thinking becomes a daily tool, not just an interview exercise.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-software-engineer-system-design-basics',
      sourceType: 'internal_curated',
      resourceType: 'roadmap',
      title: 'System Design Basics for Growing Engineers',
      description: 'Covers APIs, data stores, scalability, reliability, and tradeoffs in service-oriented systems.',
      sourceUrl: 'https://seed.smartcareer.local/software-engineer/system-design-basics',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 13,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['system design', 'scalability', 'reliability', 'databases', 'caching', 'apis'],
      targetRoles: ['Software Engineer', 'Backend Engineer', 'Platform Engineer'],
      metadata: { career_path: 'Software Engineer' },
      chunks: [
        'System design starts with clarity about requirements. Engineers need to define expected traffic, latency expectations, failure tolerance, and data consistency before choosing technologies. Without that framing, design discussions become tool debates instead of architecture decisions.',
        'Most service designs involve the same building blocks: an API layer, a persistence layer, background jobs, caching, and observability. The important skill is understanding tradeoffs between synchronous and asynchronous work, strong versus eventual consistency, and when to split responsibilities across services instead of centralizing everything.',
        'A strong system design answer also includes operations. You should explain how the team will monitor errors, handle retries, protect dependencies, and recover from partial outages. Reliable systems are shaped as much by failure handling and monitoring as by the happy-path architecture diagram.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-software-engineer-git-collaboration',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Git Collaboration and Code Review Workflow',
      description: 'Teaches branching, pull requests, commit hygiene, and team-friendly source control habits.',
      sourceUrl: 'https://seed.smartcareer.local/software-engineer/git-collaboration',
      language: 'en',
      level: 'beginner',
      freeOrPaid: 'free',
      durationHours: 6,
      certificate: false,
      providerRating: 4.6,
      skillTags: ['git', 'pull requests', 'version control', 'code review', 'branching'],
      targetRoles: ['Software Engineer', 'Frontend Engineer', 'DevOps Engineer'],
      metadata: { career_path: 'Software Engineer' },
      chunks: [
        'Git is not just a command-line tool; it is the team memory for software delivery. Engineers need to understand commits, branches, rebases, merges, and revert strategies so they can collaborate safely without blocking one another. Clean version control makes debugging and incident response much easier later.',
        'A healthy review workflow begins with small pull requests and meaningful commit messages. Reviewers need enough context to understand intent, test behavior, and spot risk, while authors need a history that tells the story of the change. That is why squashing, organizing commits, and writing good descriptions matter.',
        'Engineers also need habits for conflict resolution and release safety. Before merging, you should sync with the latest branch state, rerun tests, and understand whether your change interacts with related work. Good Git practices reduce integration bugs and make teamwork much more predictable.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-software-engineer-api-design',
      sourceType: 'internal_curated',
      resourceType: 'docs',
      title: 'API Design and Integration Handbook',
      description: 'Guides engineers through REST basics, contracts, error handling, and safe client-server integration.',
      sourceUrl: 'https://seed.smartcareer.local/software-engineer/api-design',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 8,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['apis', 'rest', 'http', 'integration', 'contracts', 'backend'],
      targetRoles: ['Software Engineer', 'Backend Engineer', 'Product Manager'],
      metadata: { career_path: 'Software Engineer' },
      chunks: [
        'APIs are contracts between systems, so design quality directly affects product speed and reliability. Engineers need to think about resource naming, request validation, status codes, pagination, and idempotency before writing handlers. Clear contracts make both implementation and debugging much easier for every consumer.',
        'Error handling is where many integrations fail. A good API returns useful messages, stable response shapes, and clear guidance about retry behavior or authentication problems. Engineers should also document edge cases such as partial failure, timeouts, and backward compatibility when fields evolve.',
        'Integration work is not finished when the endpoint returns a response. Strong teams add tests for serialization, contract validation, and failure scenarios so clients can rely on the API with confidence. API design is as much about long-term maintenance as it is about shipping the first version.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-software-engineer-debugging-observability',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Debugging and Observability for Product Engineers',
      description: 'Shows how logs, traces, metrics, and reproducible debugging speed up software delivery.',
      sourceUrl: 'https://seed.smartcareer.local/software-engineer/debugging-observability',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 7,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['debugging', 'observability', 'logging', 'metrics', 'testing', 'incident response'],
      targetRoles: ['Software Engineer', 'DevOps Engineer', 'Platform Engineer'],
      metadata: { career_path: 'Software Engineer' },
      chunks: [
        'Debugging is one of the most important engineering skills because software rarely fails in a neat, local way. Engineers need to reproduce issues, narrow the scope, inspect logs, and compare expected versus actual behavior without changing too many variables at once. A disciplined debugging process saves hours during delivery and incidents.',
        'Observability gives teams the evidence needed to debug production behavior. Metrics show whether something degraded, logs explain what happened, and traces show where latency or errors were introduced across service boundaries. Engineers who instrument systems well can answer operational questions much faster.',
        'The long-term goal is to build software that is easier to diagnose. That means structured logs, actionable error messages, health checks, and tests that lock in fixes after an incident. Reliable teams treat debugging feedback as an input to better design, not just a one-time emergency response.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-product-manager-roadmapping-prioritization',
      sourceType: 'internal_curated',
      resourceType: 'roadmap',
      title: 'Roadmapping and Prioritization for Product Managers',
      description: 'Explains how PMs connect vision, constraints, and sequencing into a credible roadmap.',
      sourceUrl: 'https://seed.smartcareer.local/product-manager/roadmapping-prioritization',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 9,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['roadmapping', 'prioritization', 'strategy', 'stakeholder management', 'planning'],
      targetRoles: ['Product Manager', 'Program Manager', 'Project Quality Coordinator'],
      metadata: { career_path: 'Product Manager' },
      chunks: [
        'Roadmapping is the practice of turning strategy into a sequence of bets. Product managers need to explain why a problem matters now, what outcome the team expects, and how today’s work supports longer-term positioning. A roadmap becomes useful only when it clarifies intent rather than listing every request in one place.',
        'Prioritization frameworks are helpful when they force sharper thinking about impact, risk, effort, and timing. PMs should compare opportunities using evidence from customer pain, business goals, technical constraints, and dependencies across teams. Good prioritization is transparent enough that stakeholders can understand why something moved up or down.',
        'A credible roadmap also accounts for uncertainty. Product managers should mark assumptions, revisit sequencing as new evidence arrives, and communicate tradeoffs early with engineering and leadership. The strongest PMs maintain focus without pretending the plan will never change.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-product-manager-user-research',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'User Research Methods for Product Discovery',
      description: 'Introduces interviews, synthesis, problem framing, and insight sharing for product teams.',
      sourceUrl: 'https://seed.smartcareer.local/product-manager/user-research',
      language: 'en',
      level: 'beginner',
      freeOrPaid: 'free',
      durationHours: 8,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['user research', 'discovery', 'interviews', 'problem framing', 'customer empathy'],
      targetRoles: ['Product Manager', 'UX Designer', 'Product Designer'],
      metadata: { career_path: 'Product Manager' },
      chunks: [
        'User research helps product teams solve the right problem before they optimize the wrong one. Product managers often start with interviews to understand context, pain points, current workarounds, and how users measure success. The goal is not to collect quotes; it is to find patterns that change decision making.',
        'Good interviews are structured but flexible. PMs need a discussion guide, neutral questions, and a way to probe deeper without leading the participant. After research sessions, the real value comes from synthesis: grouping observations, identifying recurring themes, and separating assumptions from evidence.',
        'Research becomes strategic when it influences prioritization and scope. Product managers should translate findings into problem statements, opportunity size, and design constraints that engineers and designers can act on. Sharing clear evidence reduces opinion-driven debate and improves alignment.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-product-manager-metrics-experimentation',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Metrics and Experimentation for Product Decisions',
      description: 'Teaches PMs how to define success metrics, monitor behavior, and evaluate product bets.',
      sourceUrl: 'https://seed.smartcareer.local/product-manager/metrics-experimentation',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 10,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['product metrics', 'experimentation', 'north star metric', 'a/b testing', 'analytics'],
      targetRoles: ['Product Manager', 'Growth Product Manager', 'Data Analyst'],
      metadata: { career_path: 'Product Manager' },
      chunks: [
        'Metrics help product managers distinguish activity from value. A useful metric system usually combines a primary outcome metric, supporting input metrics, and guardrail metrics that protect the user experience or business model. PMs should always be able to explain why a metric matters and what behavior it is meant to influence.',
        'Experimentation adds learning discipline to product work. Whether you run a formal A/B test or a lighter pilot, you need a hypothesis, a target audience, and a clear definition of success before launch. That preparation prevents teams from rewriting the success story after the data arrives.',
        'Strong PMs also know when not to over-index on experimentation. Some decisions require qualitative learning, some changes are too broad for clean testing, and some metrics move slowly. The best product judgment comes from combining analytics, user research, business context, and technical feasibility.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-product-manager-prd-writing',
      sourceType: 'internal_curated',
      resourceType: 'docs',
      title: 'Writing Clear Product Requirements Documents',
      description: 'A practical PRD guide covering scope, user flows, constraints, and launch readiness.',
      sourceUrl: 'https://seed.smartcareer.local/product-manager/prd-writing',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 7,
      certificate: false,
      providerRating: 4.6,
      skillTags: ['prds', 'requirements', 'documentation', 'scope definition', 'cross-functional communication'],
      targetRoles: ['Product Manager', 'Business Analyst', 'Software Engineer'],
      metadata: { career_path: 'Product Manager' },
      chunks: [
        'A good PRD does not try to prove that the PM thought of everything. It exists to align the team on the problem, the user, the scope boundaries, and the success criteria before implementation starts. Strong documents reduce rework because they clarify intent without prescribing every design detail.',
        'The most effective requirements include context, user flows, edge cases, non-goals, and open questions. Product managers should document assumptions about permissions, performance, error states, and rollout sequencing so engineering and design can challenge them early. Clear writing reveals hidden ambiguity faster than meetings alone.',
        'PRDs are also collaboration tools. The best versions invite comments, reflect technical input, and evolve as discovery continues. Teams move faster when requirements are easy to scan, easy to update, and honest about uncertainty or dependencies.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-product-manager-stakeholder-alignment',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Stakeholder Alignment and Product Communication',
      description: 'Shows PMs how to align leadership, design, engineering, and go-to-market teams around priorities.',
      sourceUrl: 'https://seed.smartcareer.local/product-manager/stakeholder-alignment',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 6,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['stakeholder management', 'communication', 'alignment', 'influence', 'cross-functional leadership'],
      targetRoles: ['Product Manager', 'Program Manager', 'Project Manager'],
      metadata: { career_path: 'Product Manager' },
      chunks: [
        'Product managers create leverage through alignment. Different stakeholders care about different outcomes: executives want strategic progress, engineers want clarity and feasibility, and commercial teams want launch readiness. PMs need a communication style that respects each lens without fragmenting the plan.',
        'Alignment does not mean avoiding tension. It means surfacing tradeoffs early, explaining the rationale behind priorities, and making decisions visible enough that teams understand why a path was chosen. Good communication reduces political friction because it turns hidden assumptions into shared context.',
        'The strongest PM communication habits are regular and lightweight. Short updates, clear decision logs, and visible next steps help teams stay coordinated without needing a high-overhead meeting for every issue. Consistency builds trust over time.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-ux-designer-figma-flows',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'Figma Workflow for Product and UX Designers',
      description: 'Covers components, layout, collaboration, and handoff practices in Figma.',
      sourceUrl: 'https://seed.smartcareer.local/ux-designer/figma-workflow',
      language: 'en',
      level: 'beginner',
      freeOrPaid: 'free',
      durationHours: 8,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['figma', 'ui design', 'components', 'auto layout', 'handoff'],
      targetRoles: ['UX Designer', 'Product Designer', 'UI Designer'],
      metadata: { career_path: 'UX Designer' },
      chunks: [
        'Figma is more than a drawing tool; it is where modern design systems, product explorations, and collaboration often come together. Designers should know how to structure files, use auto layout, build reusable components, and keep naming conventions clean so handoff remains manageable as a product grows.',
        'Good Figma workflow supports iteration, not just presentation. UX designers need quick ways to compare alternatives, annotate reasoning, and keep exploratory ideas separate from approved flows. That makes design reviews more focused and helps engineering understand what is final versus still in discussion.',
        'Strong handoff practices reduce implementation gaps. Designers should define spacing, states, interactions, and reusable tokens clearly enough that engineering can ship confidently. Figma becomes much more valuable when it supports cross-functional understanding rather than isolated design work.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-ux-designer-user-testing',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'User Testing and Insight Capture for UX Teams',
      description: 'Explains usability testing, observation, synthesis, and translating findings into design improvements.',
      sourceUrl: 'https://seed.smartcareer.local/ux-designer/user-testing',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 7,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['user testing', 'usability', 'research synthesis', 'interaction design', 'qualitative research'],
      targetRoles: ['UX Designer', 'Product Designer', 'Product Manager'],
      metadata: { career_path: 'UX Designer' },
      chunks: [
        'User testing helps designers see whether an interface supports the user’s actual task, not just the intended flow. A strong session observes confusion, hesitation, and workarounds without rushing to explain the design. The goal is to learn how the product behaves in the user’s mental model.',
        'Testing works best when the scenario is realistic and the tasks are concrete. Designers should define what success looks like, what signals count as friction, and how notes will be captured across sessions. That structure makes it easier to compare findings instead of relying on isolated anecdotes.',
        'Insight capture matters after the session ends. UX teams need to synthesize recurring patterns, estimate severity, and connect each issue to a design decision that can change. The best research outputs are specific enough to improve the interface and clear enough to influence product priorities.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-ux-designer-design-systems',
      sourceType: 'internal_curated',
      resourceType: 'docs',
      title: 'Design Systems and UI Consistency Guide',
      description: 'Introduces tokens, components, accessibility patterns, and governance for design systems.',
      sourceUrl: 'https://seed.smartcareer.local/ux-designer/design-systems',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 9,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['design systems', 'components', 'accessibility', 'ui consistency', 'design ops'],
      targetRoles: ['UX Designer', 'Product Designer', 'Software Engineer'],
      metadata: { career_path: 'UX Designer' },
      chunks: [
        'Design systems help teams scale quality by turning repeated interface decisions into reusable standards. UX designers need to think about component behavior, naming, spacing, typography, and accessibility from the start so the system supports both consistency and flexibility. A system should speed design and development, not add bureaucracy.',
        'A good system balances rules with rationale. Designers and engineers should understand when to reuse a pattern, when to extend it, and how to avoid creating near-duplicate components that increase maintenance cost. Governance works best when the team shares principles rather than policing every pixel.',
        'Accessibility is part of design system quality, not a last-minute checklist. Color contrast, focus states, interaction size, semantic labeling, and content structure should be built into the component model. Teams move faster when inclusive defaults are already available in the system.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-ux-designer-prototyping-interactions',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'Prototyping and Interaction Design Essentials',
      description: 'Teaches designers how to prototype flows, test interactions, and communicate product behavior.',
      sourceUrl: 'https://seed.smartcareer.local/ux-designer/prototyping-interactions',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 8,
      certificate: false,
      providerRating: 4.6,
      skillTags: ['prototyping', 'interaction design', 'user flows', 'microinteractions', 'ux'],
      targetRoles: ['UX Designer', 'Product Designer', 'Interaction Designer'],
      metadata: { career_path: 'UX Designer' },
      chunks: [
        'Prototypes help teams evaluate behavior before code is written. A useful prototype captures the critical path, key states, and moments where the user might hesitate or misunderstand the interface. Designers should choose the fidelity that best answers the current question instead of overbuilding every screen.',
        'Interaction design is about feedback, predictability, and flow. Designers need to decide how navigation behaves, what changes after an action, and how the product responds to errors or delays. These details shape whether an experience feels intuitive or frustrating even when the visuals are polished.',
        'Prototyping also improves collaboration. Product managers can validate scope, engineers can anticipate edge cases, and researchers can run task-based evaluations earlier. A strong interaction prototype creates shared understanding of behavior that static mocks often miss.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-ux-designer-accessibility-content',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Accessibility and Content Clarity for UX Design',
      description: 'Shows how content, hierarchy, and inclusive patterns improve usability for more users.',
      sourceUrl: 'https://seed.smartcareer.local/ux-designer/accessibility-content',
      language: 'en',
      level: 'beginner',
      freeOrPaid: 'free',
      durationHours: 6,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['accessibility', 'content design', 'information architecture', 'inclusive design', 'ux writing'],
      targetRoles: ['UX Designer', 'Content Designer', 'Product Designer'],
      metadata: { career_path: 'UX Designer' },
      chunks: [
        'Accessible design starts with the idea that different users perceive, interpret, and navigate interfaces in different ways. UX designers should think about reading order, contrast, motion, focus management, and cognitive load from the first draft. Inclusive design choices often improve clarity for everyone, not just edge cases.',
        'Content clarity is a design skill. Labels, helper text, button copy, and error messages all shape whether a user understands the next step. Designers should prefer direct language, visible context, and task-focused phrasing instead of product jargon or vague calls to action.',
        'Information architecture supports accessibility by making structure obvious. Grouping related content, sequencing forms logically, and reducing unnecessary choices all help users complete tasks with less friction. Good UX often looks simple because the structure behind it is intentional.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-devops-docker-containers',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'Docker and Container Basics for DevOps',
      description: 'Introduces image creation, container lifecycle, environment configuration, and debugging.',
      sourceUrl: 'https://seed.smartcareer.local/devops/docker-containers',
      language: 'en',
      level: 'beginner',
      freeOrPaid: 'free',
      durationHours: 9,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['docker', 'containers', 'images', 'devops', 'deployment', 'runtime'],
      targetRoles: ['DevOps Engineer', 'Platform Engineer', 'Software Engineer'],
      metadata: { career_path: 'DevOps Engineer' },
      chunks: [
        'Docker gives teams a consistent way to package software and its runtime dependencies. DevOps engineers should understand how images are built, how containers differ from virtual machines, and how environment variables, volumes, and networking affect application behavior across local and deployed environments.',
        'A strong Docker workflow also focuses on build quality. Smaller images, predictable tags, reproducible builds, and secure base images all improve release speed and reduce operational risk. Engineers should know how to read a Dockerfile critically and spot unnecessary layers or unsafe defaults.',
        'Container debugging is a practical skill. When an app behaves differently in a container, DevOps engineers need to inspect logs, environment variables, entrypoints, and mounted files quickly. Confidence with container troubleshooting is what turns Docker from a theory topic into an operational tool.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-devops-cicd-pipelines',
      sourceType: 'internal_curated',
      resourceType: 'docs',
      title: 'CI/CD Pipeline Design and Release Safety',
      description: 'Covers build automation, test gates, deployment stages, and rollback planning.',
      sourceUrl: 'https://seed.smartcareer.local/devops/cicd-pipelines',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 11,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['ci/cd', 'automation', 'deployment', 'testing', 'release management', 'pipelines'],
      targetRoles: ['DevOps Engineer', 'Platform Engineer', 'Software Engineer'],
      metadata: { career_path: 'DevOps Engineer' },
      chunks: [
        'CI/CD turns software delivery into a repeatable system instead of a manual ritual. DevOps engineers need to design pipelines that build artifacts, run the right tests, package releases, and promote changes across environments with clear gates. The objective is faster delivery with less operational risk, not just more automation.',
        'Release safety depends on what the pipeline proves before deployment. Teams should choose checks that validate code quality, dependency health, infrastructure correctness, and deploy readiness without making the pipeline so slow that engineers stop trusting it. The best pipelines provide fast feedback at each stage.',
        'Rollback planning is part of CI/CD design, not an afterthought. Mature release systems include versioned artifacts, health checks, deployment visibility, and a documented path to revert or pause when something goes wrong. Reliable pipelines make failure easier to contain.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-devops-kubernetes-operations',
      sourceType: 'internal_curated',
      resourceType: 'tutorial',
      title: 'Kubernetes Operations for Application Teams',
      description: 'Explains pods, deployments, services, config, and operational debugging in Kubernetes.',
      sourceUrl: 'https://seed.smartcareer.local/devops/kubernetes-operations',
      language: 'en',
      level: 'advanced',
      freeOrPaid: 'free',
      durationHours: 14,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['kubernetes', 'containers', 'orchestration', 'deployments', 'services', 'cluster operations'],
      targetRoles: ['DevOps Engineer', 'Platform Engineer', 'Site Reliability Engineer'],
      metadata: { career_path: 'DevOps Engineer' },
      chunks: [
        'Kubernetes becomes easier when you start from its operational model instead of memorizing objects. Pods run workloads, deployments manage rollout state, services expose traffic, and config objects separate code from environment. DevOps engineers need to understand how those pieces interact before troubleshooting cluster behavior.',
        'Production use requires more than basic manifests. Engineers should know how probes, resource requests, autoscaling, secrets, and rolling updates affect reliability and cost. These settings shape whether a cluster handles normal traffic, spikes, and partial failures gracefully.',
        'Troubleshooting Kubernetes means gathering evidence quickly. Logs, events, describe output, scheduling signals, and readiness failures often point to the root cause when a deployment is stuck. The strongest operators combine cluster knowledge with application context instead of treating Kubernetes as a black box.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-devops-cloud-foundations',
      sourceType: 'internal_curated',
      resourceType: 'roadmap',
      title: 'Cloud Foundations for Modern DevOps',
      description: 'Builds core understanding of compute, networking, storage, IAM, and cloud architecture tradeoffs.',
      sourceUrl: 'https://seed.smartcareer.local/devops/cloud-foundations',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 12,
      certificate: false,
      providerRating: 4.7,
      skillTags: ['cloud', 'aws', 'azure', 'gcp', 'networking', 'iam', 'infrastructure'],
      targetRoles: ['DevOps Engineer', 'Cloud Engineer', 'Platform Engineer'],
      metadata: { career_path: 'DevOps Engineer' },
      chunks: [
        'Cloud fluency for DevOps starts with service categories rather than provider memorization. Engineers need to understand compute, object storage, relational databases, networking, identity, and monitoring so they can reason about architecture choices across AWS, Azure, or GCP. That foundation makes provider-specific learning much faster.',
        'Identity and networking are especially important because many incidents come from access mistakes or connectivity assumptions. DevOps engineers should know how roles, policies, security groups, subnets, and service boundaries work together. Safe cloud design depends on least privilege and clear traffic paths.',
        'Cost and operability are part of cloud architecture as well. The best solution is not always the most managed or the most flexible one; it is the option that fits the team’s scale, skill set, reliability needs, and maintenance capacity. Strong DevOps judgment includes those tradeoffs from day one.',
      ],
    },
    {
      provider: PROVIDER,
      providerResourceId: 'seed-devops-infrastructure-as-code',
      sourceType: 'internal_curated',
      resourceType: 'article',
      title: 'Infrastructure as Code and Environment Consistency',
      description: 'Shows how IaC improves reproducibility, reviewability, and operational safety across environments.',
      sourceUrl: 'https://seed.smartcareer.local/devops/infrastructure-as-code',
      language: 'en',
      level: 'intermediate',
      freeOrPaid: 'free',
      durationHours: 8,
      certificate: false,
      providerRating: 4.8,
      skillTags: ['infrastructure as code', 'terraform', 'automation', 'cloud', 'change management'],
      targetRoles: ['DevOps Engineer', 'Cloud Engineer', 'Platform Engineer'],
      metadata: { career_path: 'DevOps Engineer' },
      chunks: [
        'Infrastructure as code treats environments the same way engineers treat application code: versioned, reviewable, and reproducible. DevOps teams use it to define compute, networking, permissions, and platform services in a way that can be validated before changes reach production. That reduces drift and improves auditability.',
        'IaC also improves collaboration because infrastructure changes become visible in pull requests instead of hidden in consoles. Reviewers can discuss blast radius, naming, permissions, and dependency order before anything is applied. Over time that creates much stronger operational habits across the team.',
        'The value of IaC is highest when environments stay aligned. Shared modules, clear variable conventions, and environment promotion practices help teams avoid subtle differences between staging and production. DevOps engineers should think of IaC as both a tooling approach and an operating model.',
      ],
    },
  ];
}

async function main() {
  const seeds = buildSeeds();
  console.log(`Seeding ${seeds.length} roadmap resources...`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of seeds) {
    const result = await upsertResource(supabase, seed);

    if (result.action === 'skipped') {
      skipped += 1;
      console.log(`⏭️  skipped ${seed.providerResourceId}`);
      continue;
    }

    await replaceChunks(supabase, result.id, seed.chunks);

    if (result.action === 'inserted') inserted += 1;
    if (result.action === 'updated') updated += 1;

    console.log(`✅ ${result.action} ${seed.providerResourceId} with ${seed.chunks.length} chunks`);
  }

  console.log('\nDone.');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch((error) => {
  console.error('Seeder failed:', error);
  process.exit(1);
});

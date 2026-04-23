#!/usr/bin/env ts-node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

interface SkillSeedRule {
  skillName: string;
  titlePattern: string;
  relevanceScore: number;
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seedRulesByRole: Record<string, SkillSeedRule[]> = {
  'Data Analyst': [
    { skillName: 'SQL', titlePattern: '%sql%', relevanceScore: 0.95 },
    { skillName: 'Python', titlePattern: '%python%', relevanceScore: 0.9 },
    { skillName: 'Excel', titlePattern: '%excel%', relevanceScore: 0.85 },
    { skillName: 'Tableau', titlePattern: '%tableau%', relevanceScore: 0.9 },
    { skillName: 'Statistics', titlePattern: '%statistic%', relevanceScore: 0.8 },
  ],
  'Product Manager': [
    { skillName: 'Product Sense', titlePattern: '%product%', relevanceScore: 0.9 },
    { skillName: 'Communication', titlePattern: '%communicat%', relevanceScore: 0.75 },
    { skillName: 'Data Analysis', titlePattern: '%data%', relevanceScore: 0.8 },
    { skillName: 'UX Research', titlePattern: '%ux%', relevanceScore: 0.85 },
  ],
};

async function seedSkill(skillName: string, titlePattern: string, relevanceScore: number): Promise<void> {
  const { data: resources, error: resourceError } = await supabase
    .from('resources')
    .select('id,title')
    .ilike('title', titlePattern)
    .limit(10);

  if (resourceError) {
    throw new Error(`Failed to query resources for ${skillName}: ${resourceError.message}`);
  }

  const rows = (resources ?? []).filter(
    (resource): resource is { id: string; title: string } =>
      typeof resource.id === 'string' && typeof resource.title === 'string',
  );

  if (rows.length === 0) {
    console.log(`[seed-skill-resource-map] ${skillName}: no resources matched pattern "${titlePattern}"`);
    return;
  }

  const payload = rows.map((resource) => ({
    skill_name: skillName,
    resource_id: resource.id,
    relevance_score: relevanceScore,
    is_active: true,
  }));

  const { error: upsertError } = await supabase
    .from('skill_resource_map')
    .upsert(payload, {
      onConflict: 'skill_name,resource_id',
      ignoreDuplicates: false,
    });

  if (upsertError) {
    throw new Error(`Failed to upsert skill_resource_map for ${skillName}: ${upsertError.message}`);
  }

  console.log(
    `[seed-skill-resource-map] ${skillName}: inserted/updated ${payload.length} resource links at relevance ${relevanceScore}`,
  );
}

async function main(): Promise<void> {
  for (const [roleName, rules] of Object.entries(seedRulesByRole)) {
    console.log(`[seed-skill-resource-map] Seeding role: ${roleName}`);
    for (const rule of rules) {
      await seedSkill(rule.skillName, rule.titlePattern, rule.relevanceScore);
    }
  }

  console.log('[seed-skill-resource-map] Done.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown error';
  console.error(`[seed-skill-resource-map] Failed: ${message}`);
  process.exit(1);
});

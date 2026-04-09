#!/usr/bin/env ts-node

/**
 * Utility script to check existing Supabase schema
 * Run: npx ts-node scripts/check-schema.ts
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(url, key);

async function checkSchema() {
  console.log('🔍 Checking existing Supabase schema...\n');

  // Get all tables
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  if (tablesError) {
    console.error('Error fetching tables:', tablesError);
    return;
  }

  console.log(`📊 Found ${tables?.length || 0} tables:\n`);
  tables?.forEach((t) => console.log(`  - ${t.table_name}`));

  console.log('\n');

  // Check for expected tables
  const expectedTables = [
    'user_profiles',
    'quiz_sessions',
    'quiz_answers',
    'careers',
    'career_match_results',
    'cv_analyses',
    'career_roadmaps',
    'user_roadmaps',
    'async_jobs',
    'api_audit_logs',
  ];

  console.log('✅ Expected tables status:\n');
  const existingTableNames = tables?.map(t => t.table_name) || [];

  expectedTables.forEach((table) => {
    const exists = existingTableNames.includes(table);
    console.log(`  ${exists ? '✅' : '❌'} ${table}`);
  });

  console.log('\n');

  // Check storage buckets
  console.log('📦 Storage buckets:\n');
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    buckets?.forEach(bucket => {
      console.log(`  📁 ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });
    if (!buckets || buckets.length === 0) {
      console.log('  (no buckets found)');
    }
  } catch (error) {
    console.log('  (could not fetch buckets - may need service role key)');
  }

  console.log('\n');

  // Check for existing RLS policies
  console.log('🔒 RLS Policies check:\n');
  console.log('  (Skipping - requires service role key to check)');
  console.log('  Run this SQL in Supabase SQL Editor to check:');
  console.log('    SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = \'public\';\n');
}

checkSchema().catch(console.error);

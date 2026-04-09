#!/usr/bin/env node

/**
 * Utility script to check existing Supabase schema
 * Run: node scripts/check-schema.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load env from parent (Mobile/) directory
require('dotenv').config({ path: '../.env' });

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Missing environment variables!');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkSchema() {
  console.log('🔍 Checking Supabase schema for project...\n');
  console.log(`   URL: ${url}\n`);

  // Get all tables
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  if (tablesError) {
    console.error('Error fetching tables:', tablesError);
    console.log('\n💡 Tip: Make sure your anon key has access to read information_schema');
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
  console.log('✅ Schema check complete!\n');

  // Summary
  const missingCount = expectedTables.filter(t => !existingTableNames.includes(t)).length;
  if (missingCount > 0) {
    console.log(`⚠️  ${missingCount} table(s) missing. Run the migration to create them.`);
  } else {
    console.log('🎉 All expected tables exist!');
  }
}

checkSchema().catch(console.error);

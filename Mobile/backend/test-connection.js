#!/usr/bin/env node

/**
 * Quick test to verify Supabase connection
 * Run: node test-connection.js
 */

require('dotenv').config({ path: '../.env' });

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

console.log('🔧 Testing Supabase Connection\n');
console.log(`URL: ${url}\n`);

// Test service role client
console.log('1. Testing Service Role Key...');
const serviceClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

serviceClient.from('users').select('count')
  .then(res => {
    console.log('   ✅ Service role client connected');
    console.log(`   Sample query result:`, res.data);

    // Test second query
    return serviceClient.rpc('get_nova_profile_from_answers', { answers: [] });
  })
  .then(res => {
    console.log('   ✅ RPC call works');

    console.log('\n2. Testing Anon Key...');
    const anonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    return anonClient.from('careers').select('count');
  })
  .then(res => {
    console.log('   ✅ Anon client connected');

    console.log('\n✅ All connections successful!');
    console.log('\n📝 Next steps:');
    console.log('1. Check which tables exist in your database');
    console.log('2. Run migrations if tables are missing');
    console.log('3. Install dependencies: npm install');
    console.log('4. Start backend: npm run start:dev');
  })
  .catch(err => {
    console.error('   ❌ Connection failed:', err.message);
    console.error('\nPlease check:');
    console.error('- SUPABASE_URL is correct');
    console.error('- Keys are valid (not expired)');
    console.error('- Database is running');
  });

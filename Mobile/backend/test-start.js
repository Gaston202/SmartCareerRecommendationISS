const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('ioredis');
require('dotenv').config({ path: '.env' });

async function test() {
  console.log('Testing configuration...');

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const redisUrl = process.env.REDIS_URL;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? 'SET' : 'MISSING');
  console.log('REDIS_URL:', redisUrl ? 'SET' : 'MISSING');
  console.log('OPENROUTER_API_KEY:', openRouterKey ? 'SET' : 'MISSING');

  if (!supabaseUrl || !serviceKey) {
    console.error('ERROR: Supabase credentials missing');
    process.exit(1);
  }

  // Test Redis connection
  if (redisUrl) {
    try {
      const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
      await redis.ping();
      console.log('✅ Redis connected successfully');
      await redis.quit();
    } catch (err) {
      console.error('❌ Redis connection failed:', err.message);
      process.exit(1);
    }
  } else {
    console.warn('⚠️  REDIS_URL not set, caching disabled');
  }

  console.log('✅ All checks passed');
}

test().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

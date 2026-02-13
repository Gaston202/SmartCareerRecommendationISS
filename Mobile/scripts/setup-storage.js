/**
 * Setup Script: Create Supabase Storage Bucket for CVs
 * Run this ONCE to set up the "cvs" bucket
 * 
 * Usage: node scripts/setup-storage.js
 */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "❌ Missing environment variables: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
  );
  console.error("⚠️  Add SUPABASE_SERVICE_ROLE_KEY to your .env file");
  console.error("📌 You need the SERVICE ROLE KEY (not anon key) for this script");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupBucket() {
  try {
    console.log("🔄 Checking if 'cvs' bucket exists...");

    // Try to list buckets
    const { data: buckets, error: listError } = await supabase.storage
      .listBuckets();

    if (listError) {
      console.error("❌ Error listing buckets:", listError.message);
      return;
    }

    const cvsBucketExists = buckets?.some((b) => b.name === "cvs");

    if (cvsBucketExists) {
      console.log("✅ Bucket 'cvs' already exists!");
      return;
    }

    console.log("📦 Creating 'cvs' bucket...");

    // Create the bucket
    const { data, error: createError } = await supabase.storage.createBucket(
      "cvs",
      {
        public: false, // Private bucket
      }
    );

    if (createError) {
      console.error("❌ Error creating bucket:", createError.message);
      return;
    }

    console.log("✅ Bucket 'cvs' created successfully!");
    console.log("📋 Bucket info:", data);

    // Verify bucket was created
    const { data: allBuckets } = await supabase.storage.listBuckets();
    console.log("✅ All buckets:", allBuckets?.map((b) => b.name));
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

setupBucket();

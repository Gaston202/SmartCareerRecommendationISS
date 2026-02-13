# US009 Implementation Guide: CV Analysis + Skills Review

Complete step-by-step implementation for CV upload, AI analysis, ATS scoring, and skills management using Expo + React Native + Supabase.

## Quick Start Checklist

- [ ] Step 1: Create Supabase tables & RLS policies
- [ ] Step 2: Create Storage bucket for CVs
- [ ] Step 3: Install required packages
- [ ] Step 4: Add screens to navigation
- [ ] Step 5: Request notification permissions
- [ ] Step 6: Create Edge Function for AI analysis
- [ ] Step 7: Test end-to-end flow

---

## Step 1: Supabase Database Setup

Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql):

```sql
-- 1) CV uploads table
create table if not exists public.cv_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text,
  status text not null default 'uploaded', -- uploaded | processing | done | failed
  error text,
  created_at timestamptz not null default now()
);

create index if not exists cv_uploads_user_id_idx on public.cv_uploads(user_id);

-- 2) CV analysis table
create table if not exists public.cv_analysis (
  id uuid primary key default gen_random_uuid(),
  cv_upload_id uuid not null references public.cv_uploads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  ats_score int,
  ats_issues jsonb,
  ats_suggestions jsonb,
  career_suggestions jsonb,

  created_at timestamptz not null default now()
);

create index if not exists cv_analysis_user_id_idx on public.cv_analysis(user_id);

-- 3) User skills table
create table if not exists public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  category text,
  source text not null default 'cv_extraction', -- cv_extraction | user_added
  confidence real,
  status text not null default 'pending', -- pending | confirmed | edited | removed

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_skills_user_id_idx on public.user_skills(user_id);
create unique index if not exists user_skills_unique_per_user on public.user_skills(user_id, lower(name));

-- 4) Enable RLS
alter table public.cv_uploads enable row level security;
alter table public.cv_analysis enable row level security;
alter table public.user_skills enable row level security;

-- 5) RLS policies for cv_uploads
create policy "Users can view own CV uploads"
on public.cv_uploads for select
using (auth.uid() = user_id);

create policy "Users can insert own CV uploads"
on public.cv_uploads for insert
with check (auth.uid() = user_id);

create policy "Users can update own CV uploads"
on public.cv_uploads for update
using (auth.uid() = user_id);

-- 6) RLS policies for cv_analysis
create policy "Users can view own CV analysis"
on public.cv_analysis for select
using (auth.uid() = user_id);

create policy "Users can insert own CV analysis"
on public.cv_analysis for insert
with check (auth.uid() = user_id);

-- 7) RLS policies for user_skills
create policy "Users can view own skills"
on public.user_skills for select
using (auth.uid() = user_id);

create policy "Users can insert own skills"
on public.user_skills for insert
with check (auth.uid() = user_id);

create policy "Users can update own skills"
on public.user_skills for update
using (auth.uid() = user_id);
```

---

## Step 2: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "Create Bucket"
3. Name: `cvs`
4. Set to **Private** (only owner can access)
5. Click "Create"

---

## Step 3: Install Required Packages

```bash
cd Mobile

npm install \
  expo-document-picker \
  expo-notifications \
  react-hook-form \
  @hookform/resolvers \
  zod

# If not already installed:
npm install @gluestack-ui/themed @react-navigation/native
```

---

## Step 4: Add Screens to Navigation

Update `Mobile/src/navigation/RootNavigator.tsx`:

```tsx
import { SkillsReviewScreen, UploadCVScreen, CVAnalysisScreen } from '../features/cv';

export function RootNavigator() {
  return (
    <Stack.Navigator>
      {/* ... existing screens ... */}

      {/* CV Feature Stack */}
      <Stack.Screen
        name="UploadCV"
        component={UploadCVScreen}
        options={{ title: "Upload CV" }}
      />
      <Stack.Screen
        name="CVAnalysis"
        component={CVAnalysisScreen}
        options={{ title: "CV Analysis" }}
      />
      <Stack.Screen
        name="SkillsReview"
        component={SkillsReviewScreen}
        options={{ title: "Review Skills" }}
      />
    </Stack.Navigator>
  );
}
```

---

## Step 5: Request Notification Permissions

In your app's root component or startup screen, add:

```tsx
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export async function requestNotificationPermissions() {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return;
  }

  const { status } = await Notifications.requestPermissionsAsync();

  if (status === "granted") {
    console.log("Notification permissions granted");
  }
}

// Call this in your App.tsx or initial screen
React.useEffect(() => {
  requestNotificationPermissions();
}, []);
```

---

## Step 6: Create Supabase Edge Function for AI Analysis

This is the **server-side** component that extracts text from PDF and calls AI.

### 6a. Initialize Edge Function

```bash
cd /path/to/supabase/folder  # Your local Supabase config

supabase functions new analyze-cv
```

### 6b. Create the function code

`supabase/functions/analyze-cv/index.ts`:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cvUploadId, userId } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Fetch CV upload record
    const { data: cvUpload, error: uploadError } = await supabase
      .from("cv_uploads")
      .select("*")
      .eq("id", cvUploadId)
      .single();

    if (uploadError) throw uploadError;

    // 2) Download CV file from Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("cvs")
      .download(cvUpload.storage_path);

    if (downloadError) throw downloadError;

    // 3) Extract text from PDF (use a library like pdfparse)
    // For simplicity, we'll use a basic PDF extraction
    const text = await extractPdfText(fileData);

    // 4) Call AI API (OpenAI, Claude, etc.)
    const aiResult = await callAiAnalysis(text);

    // 5) Parse and validate AI response
    const analysisData = parseAiResult(aiResult);

    // 6) Insert analysis into DB
    const { error: insertError } = await supabase
      .from("cv_analysis")
      .insert({
        cv_upload_id: cvUploadId,
        user_id: userId,
        ats_score: analysisData.ats.score,
        ats_issues: analysisData.ats.issues,
        ats_suggestions: analysisData.ats.improvements,
        career_suggestions: analysisData.career_orientation.suggested_roles,
      });

    if (insertError) throw insertError;

    // 7) Insert extracted skills
    const skillsToInsert = analysisData.skills.map((skill: any) => ({
      user_id: userId,
      name: skill.name,
      category: skill.category || null,
      source: "cv_extraction",
      confidence: skill.confidence || null,
      status: "pending",
    }));

    if (skillsToInsert.length > 0) {
      const { error: skillsError } = await supabase
        .from("user_skills")
        .insert(skillsToInsert)
        .onConflict("(user_id, lower(name))")
        .ignore();

      if (skillsError && skillsError.code !== "PGRST001") throw skillsError;
    }

    // 8) Update CV upload status
    await supabase
      .from("cv_uploads")
      .update({ status: "done" })
      .eq("id", cvUploadId);

    return new Response(
      JSON.stringify({ success: true, analysisId: analysisData.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Helper: Extract text from PDF (basic implementation)
async function extractPdfText(pdfBlob: Blob): Promise<string> {
  // Use a library like pdf-parse in Node or a similar solution for Deno
  // For MVP, return placeholder
  const text = await pdfBlob.text();
  return text;
}

// Helper: Call AI to analyze CV
async function callAiAnalysis(cvText: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  const prompt = `
Analyze this CV and return ONLY valid JSON following this exact schema:
{
  "skills": [{ "name": "string", "category": "string?", "confidence": 0..1 }],
  "career_orientation": {
    "suggested_roles": [{ "title": "string", "why": "string", "missing_skills": ["string"], "learning_plan": ["string"] }]
  },
  "ats": {
    "score": 0..100,
    "issues": [{ "title": "string", "impact": "low|medium|high", "fix": "string" }],
    "improvements": [{ "section": "string", "suggestion": "string", "example": "string?" }],
    "keywords_to_add": ["string"],
    "formatting_tips": ["string"]
  }
}

CV Text:
${cvText}
`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

// Helper: Parse AI response
function parseAiResult(aiResponse: string): any {
  // Extract JSON from response (may have markdown formatting)
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  return JSON.parse(jsonMatch[0]);
}
```

### 6c. Deploy the function

```bash
supabase functions deploy analyze-cv --project-id YOUR_PROJECT_ID
```

### 6d. Set environment variables in Supabase

Dashboard → Project Settings → Edge Functions → Secrets

Add:
- `OPENAI_API_KEY`: Your OpenAI API key

---

## Step 7: Test End-to-End

### Manual Testing Flow:

1. **Upload CV**:
   - Navigate to UploadCVScreen
   - Pick a PDF CV
   - Click "Upload & Analyze CV"
   - Observe the upload progress

2. **Wait for Analysis**:
   - See "Analyzing..." message
   - Check Supabase dashboard → cv_analysis table for new row
   - Check user_skills table for extracted skills

3. **Review Skills**:
   - Navigate to SkillsReviewScreen
   - See extracted skills from CV
   - Test edit, remove, add functionality
   - Click "Save Changes"
   - Observe success notification

4. **View Analysis**:
   - Navigate to CVAnalysisScreen
   - See ATS score, issues, improvements
   - See career suggestions

### Debug Checklist:

- [ ] Check Supabase Auth user is logged in
- [ ] Verify Storage bucket "cvs" is created and private
- [ ] Check Edge Function logs: `supabase functions logs analyze-cv`
- [ ] Verify OpenAI API key is set in secrets
- [ ] Check Supabase RLS policies allow current user access
- [ ] Monitor React Query DevTools for query/mutation status

---

## File Structure

```
Mobile/src/features/cv/
├── index.ts                  # Exports
├── types.ts                  # TypeScript types
├── schemas.ts                # Zod validation schemas
├── hooks.ts                  # React Query hooks
├── uploadCv.ts               # Upload utilities
├── SkillsReviewScreen.tsx    # US009 main screen
├── SkillEditModal.tsx        # Edit skill modal
├── SkillAddModal.tsx         # Add skill modal
├── UploadCVScreen.tsx        # CV upload screen
└── CVAnalysisScreen.tsx      # Analysis results screen
```

---

## Key Implementation Details

### Bulk Save Strategy

When user clicks "Save Changes" on SkillsReviewScreen:

1. Collect all skills with `status !== "removed"`
2. Separate into `toInsert` (new skills, `isNew: true`) and `toUpdate` (existing)
3. Call `useUpdateSkills()` mutation
4. Hook invalidates React Query cache
5. UI refetches and displays updated list

### Notification Flow

After successful save:
- Call `Notifications.scheduleNotificationAsync()` with `trigger: null` (immediate)
- Shows "Skills updated ✅" toast + native notification
- Used `expo-notifications` (already in package.json)

### Draft State Pattern

SkillsReviewScreen maintains local `draftSkills` state:
- User changes are tracked locally
- Only on "Save Changes" does it persist to DB
- If user navigates away without saving, changes are lost (intentional)
- On re-enter, fresh data is fetched from server

---

## Next Steps / Enhancements

1. **PDF Parsing**: Use `pdf-parse` or similar library in Edge Function for robust text extraction
2. **Image Upload**: Add option to upload CV photos + OCR
3. **Real-time Sync**: Use Supabase Realtime subscriptions for live updates
4. **Search/Filter**: Add search by skill name or category
5. **ATS Rewrite**: Add button to auto-rewrite sections based on AI suggestions
6. **Skill Endorsements**: Add feature for connections to endorse skills
7. **Offline Support**: Cache skills locally with React Query + AsyncStorage

---

## Troubleshooting

### "CV upload fails with 403"
- Check Storage bucket permissions
- Verify RLS policy on `cv_uploads` table allows user

### "Analysis never completes"
- Check Edge Function logs for errors
- Verify OPENAI_API_KEY is set
- Check network connectivity

### "Skills not appearing after save"
- Check Supabase RLS policy on `user_skills` allows SELECT
- Verify React Query cache is invalidated
- Check browser console for errors

### "Notifications not showing"
- Ensure permissions were requested (iOS requires explicit permission)
- Check `requestNotificationPermissions()` was called
- Verify `expo-notifications` is in package.json

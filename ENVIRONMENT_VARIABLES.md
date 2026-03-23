# Environment Variables Setup Guide

This document lists all required environment variables for the Smart Career Recommendation System.

## 📱 Mobile App (React Native / Expo)

**Location**: `Mobile/.env`

```bash
# Supabase Configuration (REQUIRED)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenRouter AI (OPTIONAL - for Career Quiz feature)
EXPO_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-...
```

### How to Get Keys:
1. **Supabase Keys**: 
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project → Settings → API
   - Copy `Project URL` and `anon/public` key

2. **OpenRouter Key** (Optional):
   - Visit [OpenRouter Keys](https://openrouter.ai/keys)
   - Sign up and generate an API key
   - Required only for the AI-powered career quiz feature

### Setup:
```bash
cd Mobile
cp .env.example .env
# Edit .env with your values
npm start
```

---

## 🖥️ Admin Dashboard (Next.js)

**Location**: `admin-dashboard/.env.local`

```bash
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# NextAuth Configuration (REQUIRED)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-secure-random-string-here
```

### How to Get Keys:
1. **Supabase Keys**: Same as Mobile app (use same project)

2. **NEXTAUTH_SECRET**: Generate a secure random string:
   ```bash
   openssl rand -base64 32
   ```
   Or use: https://generate-secret.vercel.app/32

### Setup:
```bash
cd admin-dashboard
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
```

---

## ⚡ Supabase Edge Functions

**Location**: Set in Supabase Dashboard → Edge Functions → Secrets

### Required Environment Variables:

```bash
# Supabase Configuration (AUTO-SET by Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI API Key (OPTIONAL - for CV Analysis with GPT-4)
OPENAI_API_KEY=sk-proj-...
```

### How to Set Edge Function Secrets:

#### Option 1: Using Supabase CLI
```bash
# Set OpenAI key (optional, for AI-powered CV analysis)
supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here
```

#### Option 2: Using Supabase Dashboard
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project → Edge Functions
3. Click on "Manage secrets"
4. Add `OPENAI_API_KEY` with your value

### Notes:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are **automatically set** by Supabase
- `OPENAI_API_KEY` is **optional**: 
  - ✅ With key: Uses GPT-4o-mini for advanced CV analysis
  - ❌ Without key: Falls back to rule-based heuristic analysis

### How to Get OpenAI Key:
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up / Log in
3. Create a new API key
4. Copy the key starting with `sk-proj-...`

---

## 🔒 Security Checklist

- [ ] ✅ All `.env` files are in `.gitignore`
- [ ] ✅ Never commit actual keys to Git
- [ ] ✅ Use different Supabase projects for dev/staging/prod
- [ ] ✅ Rotate keys if accidentally exposed
- [ ] ✅ Keep `SUPABASE_SERVICE_ROLE_KEY` secret (never expose to frontend)
- [ ] ✅ Use `EXPO_PUBLIC_*` prefix only for client-safe keys

---

## 🚀 Quick Start (All Apps)

### 1. Mobile App
```bash
cd Mobile
cp .env.example .env
# Edit .env with Supabase keys
npm install
npm start
```

### 2. Admin Dashboard
```bash
cd admin-dashboard
cp .env.example .env.local
# Edit .env.local with Supabase + NextAuth keys
npm install
npm run dev
```

### 3. Supabase Edge Functions
```bash
# Set OpenAI key (optional)
supabase secrets set OPENAI_API_KEY=sk-proj-your-key

# Deploy function
supabase functions deploy analyze-cv
```

---

## ❓ Troubleshooting

### "Missing EXPO_PUBLIC_SUPABASE_URL"
- Ensure `.env` file exists in `Mobile/` directory
- Restart Expo dev server: `npm start`
- Check file is named exactly `.env` (not `.env.txt`)

### "Invalid JWT" / 401 Errors
- Verify Supabase URL and keys match across all apps
- Make sure you're using the same Supabase project
- Check keys haven't expired or been rotated

### Quiz Feature Not Working
- Ensure `EXPO_PUBLIC_OPENROUTER_API_KEY` is set in `Mobile/.env`
- Verify key is valid at [OpenRouter Dashboard](https://openrouter.ai/)

### CV Analysis Falls Back to Heuristics
- This is normal if `OPENAI_API_KEY` is not set in Supabase Edge Function
- To enable AI analysis, set the key in Supabase Dashboard → Edge Functions → Secrets

---

## 📋 Summary Table

| App | File Location | Required Keys | Optional Keys |
|-----|---------------|---------------|---------------|
| **Mobile** | `Mobile/.env` | `EXPO_PUBLIC_SUPABASE_URL`<br>`EXPO_PUBLIC_SUPABASE_ANON_KEY` | `EXPO_PUBLIC_OPENROUTER_API_KEY` |
| **Admin** | `admin-dashboard/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`<br>`NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>`NEXTAUTH_URL`<br>`NEXTAUTH_SECRET` | - |
| **Edge Functions** | Supabase Dashboard | `SUPABASE_URL` (auto)<br>`SUPABASE_ANON_KEY` (auto)<br>`SUPABASE_SERVICE_ROLE_KEY` (auto) | `OPENAI_API_KEY` |

---

**Need Help?** Check the [Supabase Documentation](https://supabase.com/docs) or [Next.js Environment Variables Guide](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables).

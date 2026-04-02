# AI Copilot Instructions for Smart Career Recommendation System

## Project Overview
This is a **full-stack monorepo** containing:
- **admin-dashboard/**: Next.js 15 admin panel with TypeScript (server + client components)
- **Mobile/**: React Native (Expo) mobile application

Both share **Supabase** as the backend and use **Zod** for schema validation across platforms.

## Architecture & Data Flows

### Authentication Flow
- **Mobile**: Supabase Auth → AuthProvider context (`Mobile/src/auth/AuthProvider.tsx`)
- **Admin**: Supabase Auth → NextAuth.js v5 → JWT credentials provider (`admin-dashboard/auth.ts`)
- **Key Files**: `admin-dashboard/services/auth-supabase.ts`, `Mobile/src/auth/authTypes.ts`
- **Pattern**: Both platforms validate credentials via Supabase, then create session tokens

### API Communication
- **Admin Dashboard**: Axios client + TanStack React Query
  - Base client: `admin-dashboard/services/api.ts` (interceptors for auth, error handling)
  - Hooks pattern: `admin-dashboard/hooks/use-*.ts` (useUsers, useCareers, useSkills, etc.)
  - Queries use `queryKey` arrays for cache invalidation (e.g., `["users", userId]`)
  - Mutations invalidate parent queries on success
  
- **Mobile**: React Query + Supabase client directly
  - Supabase client: `Mobile/src/api/supabase.ts` (with AsyncStorage persistence)
  - Auth state managed via AuthProvider, not through API client

### Data Schema Validation
- Shared **Zod** schemas between platforms (`zod: ^4.3.6`)
- Admin dashboard uses them in forms, Mobile uses them in AuthProvider

## Key Development Patterns

### UI Components
- **Admin**: shadcn/ui components + Tailwind v4
  - All UI components in `admin-dashboard/components/ui/` (table, dialog, badge, etc.)
  - Custom theme color: **#7D10B9** (purple) — use this in Tailwind/Recharts
  - Layout: Sidebar + Header with sticky positioning
  - Charts: Recharts for analytics (`CHART_COLORS = ["#8B5CF6", "#A78BFA", "#2DD4BF", "#38BDF8", "#FBBF24"]`)

- **Mobile**: Gluestack UI + React Native
  - UI config: `Mobile/src/ui/gluestack-ui.config.ts`
  - Cross-platform styling through Gluestack theme system

### Server Components & Layouts
- **Admin App Router structure**:
  - `(auth)` route group (no layout, login page)
  - `admin` protected routes (layout with Sidebar + Header)
  - Each section has own layout: `admin/analytics/`, `admin/users/`, etc.
  - Use `"use client"` for interactive components (charts, forms, dropdowns)

- **Data Fetching**: Hooks (useUsers, useSkills, etc.) are client-side, call `/api/*` routes
  - API routes handle Supabase queries: `admin-dashboard/app/api/*/route.ts`

### Form Handling
- **Admin**: React Hook Form + Zod validation
  - Pattern: `useForm({ resolver: zodResolver(schema) })`
  - Component example: see `admin-dashboard/components/layout/Header.tsx` for dropdown pattern

- **Mobile**: Same pattern (react-hook-form + Zod)

## Critical Integration Points

### Supabase Integration
- Admin & Mobile both use `@supabase/supabase-js` v2.95.1
- **Environment variables**:
  - Admin: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (in `.env.local`)
  - Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (loaded by Expo at build time)
- Transformers: `admin-dashboard/lib/supabase/transformers.ts` (shape Supabase responses)

### NextAuth Sessions
- Uses **Credentials provider** with Supabase backend
- Token stored as JWT, available via `useSession()` hook
- Callbacks in `auth.ts` configure user role/email in session

## Development Workflows

### Admin Dashboard
```bash
cd admin-dashboard
npm run dev        # Start dev server (port 3000)
npm run build      # Production build
npm run lint       # ESLint check
```

### Mobile
```bash
cd Mobile
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator
```

### Common Tasks
- **Add new page**: Create folder in `admin-dashboard/app/admin/{feature}`, add `page.tsx` with `"use client"`
- **Create hook**: Add to `hooks/use-{feature}.ts`, use pattern from `useUsers()` (useQuery + queryKey)
- **Add API route**: Create `app/api/{resource}/route.ts`, handle GET/POST/DELETE
- **Add UI component**: Use shadcn/ui as base, style with Tailwind + custom purple theme

## Type Safety & Project Setup
- **TypeScript strict mode**: enabled
- **Path aliases**: `@/*` maps to workspace root
- **React Compiler**: enabled in `next.config.ts`
- **Monorepo note**: Each app has its own tsconfig.json, package.json, and node_modules

## Cross-App Considerations
- Auth happens independently; no shared auth state between web/mobile
- Both apps can query same Supabase database (ensure RLS policies align)
- Use same Zod schemas for validation consistency
- Mobile API calls go directly to Supabase; admin uses API routes as middleware

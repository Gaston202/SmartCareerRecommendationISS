# Smart Career Recommendation — Admin Dashboard

The web-based admin panel for the Smart Career Recommendation System. Built with **Next.js 16** and **TypeScript**, it provides administrators with tools to manage users, careers, skills, mentors, curated resources, and platform analytics.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Authentication Flow](#authentication-flow)
- [Navigation & Pages](#navigation--pages)
- [Key Dependencies](#key-dependencies)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Admin Dashboard is the operational control center for the platform. Administrators can monitor user activity, manage the career and skill catalog, curate learning resources for the RAG knowledge base, oversee mentor applications and sessions, and review AI-generated recommendations.

The dashboard is a **Next.js 16** application using the App Router, server components by default, and client components only where interactivity is required. It authenticates via **NextAuth.js v5** with a credentials provider validated against the Supabase `auth.users` table.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5.x (strict mode) |
| React | React 19.2.3 with React Compiler |
| Styling | Tailwind CSS v4 + `tw-animate-css` |
| UI Components | Radix UI primitives + shadcn/ui pattern |
| Icons | `lucide-react` |
| Data Fetching | TanStack Query v5 + Axios |
| Forms | React Hook Form + Zod v4 |
| Auth | NextAuth.js v5 (beta) — JWT in HTTP-only cookies |
| Charts | Recharts |
| Notifications | Sonner (toast notifications) |

---

## Features

### Dashboard Overview
- KPI cards and summary statistics
- Interactive charts powered by Recharts
- Platform activity monitoring

### User Management
- View and search all registered users
- Monitor user roles and activity status
- Access user profiles and generated recommendations

### Career Management
- Create, edit, and delete career entries
- Map skills to careers with relevance scores
- Set salary ranges, demand levels, and growth projections

### Skill Management
- Maintain the platform's skill taxonomy
- Link skills to careers and learning resources
- Track skill popularity and coverage

### Course / Resource Management
- Add and manage curated learning resources for the RAG knowledge base
- Import resources via the ingestion pipeline
- Monitor embedding status and resource quality

### Mentor Management
- Review and approve mentor applications
- Manage mentor profiles, specialties, and availability
- Oversee session bookings and group chat rooms
- View mentor ratings and reviews

### Recommendations Oversight
- Review AI-generated career recommendations
- Inspect roadmap generation diagnostics
- Monitor confidence scores and source breakdowns

### Analytics
- User growth trends
- Quiz completion and career match statistics
- CV upload and analysis metrics
- Mentor session booking rates

---

## Project Structure

```
admin-dashboard/
├── app/                        # App Router pages
│   ├── (auth)/                 # Auth group (unauthenticated layout)
│   │   └── login/
│   │       └── page.tsx        # Admin login page
│   │
│   ├── admin/                  # Protected admin routes
│   │   ├── (dashboard)/
│   │   │   └── page.tsx        # Main dashboard overview
│   │   ├── users/
│   │   │   └── page.tsx        # User management
│   │   ├── careers/
│   │   │   └── page.tsx        # Career management
│   │   ├── skills/
│   │   │   └── page.tsx        # Skill management
│   │   ├── courses/
│   │   │   └── page.tsx        # Resource / course management
│   │   ├── recommendations/
│   │   │   └── page.tsx        # AI recommendations oversight
│   │   ├── analytics/
│   │   │   └── page.tsx        # Analytics and charts
│   │   ├── mentors/
│   │   │   ├── page.tsx        # Mentor directory
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx    # Mentor detail page
│   │   │   └── new/
│   │   │       └── page.tsx    # Add new mentor
│   │   └── group-chats/
│   │       ├── page.tsx        # Group chat management
│   │       ├── [id]/
│   │       │   └── page.tsx    # Group chat detail
│   │       └── new/
│   │           └── page.tsx    # Create group chat
│   │
│   ├── layout.tsx              # Root layout
│   └── globals.css             # Global styles + Tailwind
│
├── components/                 # Reusable UI components
│   ├── ui/                     # shadcn/ui base components
│   ├── layout/                 # Sidebar, Header, Page wrappers
│   ├── tables/                 # Data tables with sorting/filtering
│   └── forms/                  # Form components
│
├── hooks/                      # TanStack Query data hooks
│   ├── use-api.ts              # Base CRUD hooks (users, dashboard stats)
│   ├── useUsers.ts             # User data hooks
│   ├── useCareers.ts           # Career data hooks
│   ├── useSkills.ts            # Skill data hooks
│   ├── useCourses.ts           # Course/resource hooks
│   ├── useRecommendations.ts   # Recommendation hooks
│   └── useChatbot.ts           # Chatbot admin hooks
│
├── services/                   # API and Supabase clients
│   ├── api.ts                  # Axios client with interceptors
│   └── supabase/               # Supabase client configurations
│       ├── client.ts           # Browser client
│       └── server.ts           # Server-side client
│
├── lib/                        # Utilities
│   ├── utils.ts                # cn() helper (clsx + tailwind-merge)
│   └── transformers.ts         # Data transformers
│
├── types/                      # TypeScript definitions
│   └── index.ts
│
├── providers/                  # Context providers
│   ├── query-provider.tsx      # TanStack Query client setup
│   └── theme-provider.tsx      # NextThemes (dark/light mode)
│
├── auth.ts                     # NextAuth configuration (credentials provider)
├── middleware.ts               # Route protection (redirects unauthenticated)
├── next.config.ts              # Next.js configuration (React Compiler enabled)
├── tsconfig.json               # TypeScript config (path alias: `@/*`)
├── tailwind.config.ts          # Tailwind CSS v4 configuration
├── package.json
└── .env.local                  # Environment variables (not in git)
```

---

## Getting Started

### Prerequisites

- **Node.js** 20 or later
- **npm**, **yarn**, or **pnpm**
- A running **FastAPI Backend** (see [../backend/](../backend/))
- A **Supabase** project

### Installation

```bash
cd admin-dashboard

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your API URL and NextAuth secret

# Run development server
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## Environment Variables

Create a `.env.local` file in the `admin-dashboard/` directory:

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# NextAuth.js v5
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secure-secret-key
# Generate with: openssl rand -base64 32
```

> **Never commit `.env.local` to version control.** It is already listed in `.gitignore`.

### Variable Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | `http://localhost:3000` | Public-facing app URL |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:3000/api/v1` | FastAPI backend base URL |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Canonical URL for NextAuth |
| `NEXTAUTH_SECRET` | Yes | — | Strong random secret for JWT encryption |

---

## Authentication Flow

The admin dashboard uses a custom credentials-based authentication flow via NextAuth.js v5:

1. **Login**: The admin enters email and password on `/login`
2. **Validation**: NextAuth calls the backend `/auth/validate` endpoint with the Supabase JWT
3. **Session**: On success, NextAuth creates a JWT stored in an **HTTP-only cookie**
4. **Middleware**: `middleware.ts` intercepts all `/admin/**` requests and redirects unauthenticated users to `/login`
5. **Server Components**: Use `createClient()` from `lib/supabase/server.ts` for server-side data fetching
6. **Client Components**: Use the browser Supabase client for real-time features

### Session Structure

The JWT contains:
- `user.id` — Supabase user UUID
- `user.role` — Admin role identifier
- `exp` — Expiration timestamp

### Route Protection

```typescript
// middleware.ts
export { default } from "next-auth/middleware"
export const config = { matcher: ["/admin/:path*"] }
```

---

## Navigation & Pages

### Sidebar Navigation Structure

| Path | Page | Description |
|---|---|---|
| `/admin` | Dashboard | Overview with KPIs and charts |
| `/admin/users` | Users | User directory and management |
| `/admin/careers` | Careers | Career catalog CRUD |
| `/admin/skills` | Skills | Skill taxonomy management |
| `/admin/courses` | Courses | Curated resource management |
| `/admin/recommendations` | Recommendations | AI recommendation oversight |
| `/admin/analytics` | Analytics | Platform analytics |
| `/admin/mentors` | Mentors | Mentor directory and approvals |
| `/admin/mentors/[id]` | Mentor Detail | Individual mentor profile |
| `/admin/group-chats` | Group Chats | Group chat room management |

### Page Types

- **Server Components** (default): Fetch data at request time, render HTML on the server
- **Client Components** (explicit `"use client"`): Interactive UI, forms, charts, real-time updates

---

## Key Dependencies

```json
{
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4",
  "@tanstack/react-query": "^5.90.20",
  "@tanstack/react-query-devtools": "^5.91.3",
  "next-auth": "^5.0.0-beta.30",
  "react-hook-form": "^7.71.1",
  "zod": "^4.3.6",
  "@hookform/resolvers": "^5.2.2",
  "recharts": "^3.7.0",
  "sonner": "^2.0.7",
  "lucide-react": "^0.563.0",
  "axios": "^1.13.4"
}
```

See `package.json` for the complete dependency list.

---

## Scripts

```bash
npm run dev        # Start Next.js dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Production server
npm run lint       # Run ESLint
npx tsc --noEmit   # Type check without emitting
```

---

## Troubleshooting

### Build errors with React Compiler
The project uses the experimental React Compiler via `babel-plugin-react-compiler`. If you encounter issues:

```bash
# Disable React Compiler in next.config.ts
const nextConfig = {
  reactCompiler: false,
};
```

### NextAuth session not persisting
- Ensure `NEXTAUTH_SECRET` is set and is at least 32 characters
- Verify `NEXTAUTH_URL` matches your actual deployment URL
- Check that the backend `/auth/validate` endpoint is reachable

### CORS errors when calling the backend
Ensure the backend `CORS_ALLOWED_ORIGINS` includes your dashboard URL:
```env
# backend/.env
cors_allowed_origins=["http://localhost:3000", "http://localhost:8081"]
```

### Tailwind CSS v4 classes not working
Tailwind v4 uses CSS-first configuration. Check that `globals.css` imports the theme and that `@tailwindcss/postcss` is configured in `postcss.config.js`.

### Path alias `@/*` not resolving
The path alias is configured in `tsconfig.json`:
```json
"paths": { "@/*": ["./*"] }
```
Ensure imports use `@/components/...` relative to the `admin-dashboard/` root.

---

## Related Projects

- [Mobile App](../Mobile/) — React Native (Expo) client for end-users
- [Backend](../backend/) — FastAPI API server
- [Job Spy Server](../Mobile/server/) — Standalone Python job scraping service

---

<p align="center">Built with Next.js, Tailwind CSS, and shadcn/ui.</p>

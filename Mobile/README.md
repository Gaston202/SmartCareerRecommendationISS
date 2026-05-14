# Smart Career Recommendation — Mobile App

The cross-platform mobile application for the Smart Career Recommendation System. Built with **React Native** and **Expo**, it provides end-users with AI-powered career discovery, CV analysis, personalized learning roadmaps, mentor connections, and job listings.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Navigation Structure](#navigation-structure)
- [Key Dependencies](#key-dependencies)
- [Scripts](#scripts)
- [Troubleshooting](#troubleshooting)

---

## Overview

This mobile app is the primary interface for job seekers and career explorers. Users can:

- Take an AI-powered career quiz to discover matching roles
- Upload their CV for skill extraction and ATS analysis
- Browse careers with salary, demand, and growth data
- Generate personalized learning roadmaps with curated courses
- Connect with mentors, book sessions, and join group chats
- Browse live job listings scraped from major job boards

The app communicates with the **FastAPI Backend** for AI operations and the **Job Spy Server** for job listings. Authentication is handled directly through **Supabase Auth** with sessions persisted in AsyncStorage.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 + React Native 0.81 |
| Language | TypeScript 5.9 (strict mode) |
| UI | Gluestack UI (`@gluestack-ui/themed`) |
| Navigation | React Navigation v7 (Native Stack, Bottom Tabs, Material Top Tabs) |
| State / Data | TanStack Query v5, React Hook Form |
| Validation | Zod v4 |
| Auth | Supabase Auth + AsyncStorage |
| Icons | `@expo/vector-icons` (Ionicons) |

---

## Features

### Career Discovery
- **AI Career Quiz**: Answer personality and skill questions to get AI-generated career recommendations
- **Career Browser**: Explore careers with details on salary, demand level, growth rate, and required skills
- **Career Matching**: View match percentage based on quiz results and CV analysis

### CV & Skills
- **PDF Upload**: Upload your CV via Expo Document Picker
- **AI Analysis**: Extract skills, get an ATS compatibility score, and receive improvement suggestions
- **Skills Review**: Manually confirm, edit, or remove AI-extracted skills

### Learning Roadmaps
- **Hybrid RAG Roadmaps**: Generate step-by-step learning plans powered by semantic + keyword search over a curated knowledge base
- **Curated Resources**: Each step includes a primary course, backup alternatives, and relevant certifications
- **Web Enrichment**: When internal knowledge is sparse, the system searches the live web for additional courses

### Mentorship
- **Mentor Directory**: Browse mentors by specialty
- **Session Booking**: Book 1-on-1 video or chat sessions with mentors
- **Group Chats**: Join specialty-based group chat rooms (e.g., "Frontend Developers", "Data Science")
- **My Sessions**: View upcoming and past mentor sessions
- **Mentor Mode**: Users can apply to become mentors and manage availability

### Jobs
- **Job Listings**: Browse scraped jobs from Indeed, LinkedIn, ZipRecruiter, and more
- **Search & Filter**: Filter by location, remote options, and job title

### User Account
- **Profile**: View and edit profile information
- **Notifications**: Push notifications for session reminders and chat messages
- **Authentication**: Secure sign-up and sign-in with Supabase Auth

---

## Project Structure

```
Mobile/
├── src/
│   ├── api/                  # API service layer
│   │   ├── supabase.ts       # Supabase client initialization
│   │   ├── backend.ts        # FastAPI backend client
│   │   └── jobs.ts           # Job Spy API client
│   │
│   ├── auth/                 # Authentication
│   │   ├── AuthProvider.tsx  # Global auth context (session, user, signOut)
│   │   └── hooks.ts          # Auth-related hooks
│   │
│   ├── features/             # Domain-first feature modules
│   │   ├── careers/          # Career browsing, matching, hooks, types
│   │   ├── chatbot/          # AI chatbot interface
│   │   ├── cv/               # CV upload, analysis, skill review
│   │   ├── jobs/             # Job listings and search
│   │   ├── learning-roadmap/ # Learning roadmap generation and display
│   │   ├── mentors/          # Mentor directory, booking, sessions
│   │   ├── quiz/             # Career quiz flow
│   │   └── roadmaps/         # Saved roadmaps
│   │
│   ├── navigation/           # Navigation setup
│   │   └── RootNavigator.tsx # Auth flow, bottom tabs, nested stacks
│   │
│   ├── screens/              # Screen components
│   │   ├── auth/             # Login, Signup, Welcome
│   │   ├── mentors/          # MentorHome, JobListings, GroupChats, etc.
│   │   ├── HomeScreen.tsx
│   │   ├── CareersScreen.tsx
│   │   ├── QuizScreen.tsx
│   │   ├── CareerRoadmapScreen.tsx
│   │   ├── LearningRoadmapScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   └── ...
│   │
│   ├── theme/                # Gluestack UI theme configuration
│   │   └── config.ts
│   │
│   └── types/                # Global TypeScript definitions
│
├── server/                   # Standalone Job Spy API (FastAPI)
│   ├── main.py               # Entry point (Port 8000)
│   ├── scrapers/             # Custom scraper modules
│   ├── ingestion_worker/     # Background ingestion pipeline
│   ├── requirements.txt
│   └── .env
│
├── App.tsx                   # Root app component
├── app.json                  # Expo configuration
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Getting Started

### Prerequisites

- **Node.js** 20 or later
- **npm** or **yarn**
- **Expo CLI** (installed via `npm install`)
- A physical device or emulator/simulator (Android Studio / Xcode)

### Installation

```bash
cd Mobile

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your actual Supabase and backend URLs

# Start the Expo development server
npm start
```

### Running on a Device

| Target | Command |
|---|---|
| iOS Simulator | Press `i` in the Expo CLI, or run `npm run ios` |
| Android Emulator | Press `a` in the Expo CLI, or run `npm run android` |
| Physical Device | Scan the QR code in the Expo Go app |
| Web Browser | Press `w` in the Expo CLI, or run `npm run web` |

> **Android Emulator Note**: Use `http://10.0.2.2:3000` to reach your local backend from the emulator.
> **Physical Device Note**: Use your computer's LAN IP (e.g., `http://192.168.1.10:3000`) instead of `localhost`.

---

## Environment Variables

Create a `.env` file in the `Mobile/` directory (copy from `.env.example`):

```env
# Supabase Configuration
# Get these from your Supabase project dashboard:
# https://supabase.com/dashboard/project/_/settings/api
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Main FastAPI Backend
# Android emulator: http://10.0.2.2:3000/api/v1
# iOS simulator:    http://localhost:3000/api/v1
# Physical device:  http://YOUR_PC_IP:3000/api/v1
EXPO_PUBLIC_BACKEND_URL=http://localhost:3000/api/v1

# Job Spy API (Python scraper backend)
# Defaults to the main backend when integrated, or localhost:8000 for standalone
EXPO_PUBLIC_JOB_API_URL=http://localhost:3000

# OpenRouter AI (optional — for Career Quiz feature)
# Get API key from: https://openrouter.ai/keys
EXPO_PUBLIC_OPENROUTER_API_KEY=sk-or-v1-...
```

> **Important**: All environment variables for Expo must be prefixed with `EXPO_PUBLIC_` to be accessible in the client bundle. Never commit your `.env` file.

---

## Navigation Structure

```
RootNavigator
├── AuthStack (not authenticated)
│   ├── WelcomeScreen
│   ├── LoginScreen
│   └── SignupScreen
│
└── MainTabs (authenticated)
    ├── HomeStack
    │   ├── HomeScreen
    │   ├── QuizScreen
    │   ├── SkillsReviewScreen
    │   ├── CVAnalysisScreen
    │   ├── CareerRoadmapScreen
    │   └── LearningRoadmapScreen
    │
    ├── CareersTab
    │   └── CareersScreen
    │
    ├── RoadmapsTab
    │   └── RoadmapsTabScreen / RoadmapsScreen
    │
    ├── MentorsStack
    │   ├── MentorsScreen
    │   ├── MentorDetailScreen
    │   ├── SessionBookingScreen
    │   ├── GroupChatsScreen
    │   └── GroupChatScreen
    │
    └── ProfileStack
        └── ProfileScreen
```

Additional mentor-only screens (accessible via Profile for approved mentors):
- `MentorHomeScreen`, `MentorSessionsScreen`, `AvailabilitySettingsScreen`, `JobListingsScreen`, `MentorSpecialtyGroupChatsScreen`, `MySessionsScreen`

---

## Key Dependencies

```json
{
  "expo": "^54.0.33",
  "react-native": "0.81.5",
  "react": "19.1.0",
  "@gluestack-ui/themed": "^1.1.43",
  "@tanstack/react-query": "^5.90.20",
  "@supabase/supabase-js": "^2.95.1",
  "@react-navigation/native": "^7.1.28",
  "@react-navigation/native-stack": "^7.12.0",
  "@react-navigation/bottom-tabs": "^7.12.0",
  "react-hook-form": "^7.71.1",
  "zod": "^4.3.6",
  "@hookform/resolvers": "^5.2.2"
}
```

See `package.json` for the full dependency list.

---

## Scripts

```bash
npm start          # Start Expo development server
npm run android    # Start on Android emulator
npm run ios        # Start on iOS simulator
npm run web        # Start in web browser
npm run lint       # Run ESLint
```

---

## Troubleshooting

### Metro bundler cache issues
```bash
npx expo start --clear
```

### Cannot connect to backend from emulator
- **Android**: Ensure you are using `http://10.0.2.2:3000` instead of `localhost`
- **iOS**: `http://localhost:3000` should work in the simulator
- **Physical device**: Use your computer's local network IP address

### Supabase auth session not persisting
- Ensure `@react-native-async-storage/async-storage` is installed
- Check that `url-polyfill` is imported in your entry point

### Gluestack UI components not styling correctly
- Verify `@gluestack-style/react` and `@gluestack-ui/config` are installed
- Ensure the theme provider wraps your app root in `App.tsx`

---

## Related Projects

- [Backend](../backend/) — FastAPI backend API
- [Admin Dashboard](../admin-dashboard/) — Next.js admin web panel
- [Job Spy Server](./server/) — Standalone Python job scraping microservice

---

<p align="center">Made with Expo and React Native.</p>

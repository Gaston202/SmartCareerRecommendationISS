/**
 * Integration Guide: How to Add CV Feature to Your App
 * Quick reference for connecting screens to your navigation and app
 */

// ============================================================================
// STEP 1: Update App Navigation
// ============================================================================

// File: Mobile/src/navigation/RootNavigator.tsx

import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { UploadCVScreen, CVAnalysisScreen, SkillsReviewScreen } from "../features/cv";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerBackTitleVisible: false,
        }}
      >
        {/* Your existing screens */}

        {/* CV Feature Screens */}
        <Stack.Screen
          name="UploadCV"
          component={UploadCVScreen}
          options={{
            title: "Upload Your CV",
            headerLargeTitleDisplayMode: "always",
          }}
        />

        <Stack.Screen
          name="CVAnalysis"
          component={CVAnalysisScreen}
          options={{
            title: "CV Analysis Results",
            headerLargeTitleDisplayMode: "always",
          }}
        />

        <Stack.Screen
          name="SkillsReview"
          component={SkillsReviewScreen}
          options={{
            title: "Review My Skills",
            headerLargeTitleDisplayMode: "always",
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ============================================================================
// STEP 2: Request Notification Permissions on App Start
// ============================================================================

// File: Mobile/App.tsx

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { AuthProvider } from "./src/auth/AuthProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/api/queryClient";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Request permissions
async function requestNotificationPermissions() {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
      console.log("✓ Notification permissions granted");
    }
  } catch (err) {
    console.warn("Notification permission request failed:", err);
  }
}

export default function App() {
  // Request permissions on app start
  React.useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// ============================================================================
// STEP 3: Navigate to CV Features from Other Screens
// ============================================================================

// Example: Home Screen or Profile Screen button

import { useNavigation } from "@react-navigation/native";
import { Button } from "@gluestack-ui/themed";

export function HomeScreen() {
  const navigation = useNavigation();

  return (
    <>
      <Button
        onPress={() => navigation.navigate("UploadCV")}
        action="primary"
      >
        <ButtonText>Upload CV</ButtonText>
      </Button>

      <Button
        onPress={() => navigation.navigate("SkillsReview")}
        action="secondary"
      >
        <ButtonText>My Skills</ButtonText>
      </Button>

      <Button
        onPress={() => navigation.navigate("CVAnalysis")}
        action="secondary"
      >
        <ButtonText>CV Analysis</ButtonText>
      </Button>
    </>
  );
}

// ============================================================================
// STEP 4: Create Query Client (if not already done)
// ============================================================================

// File: Mobile/src/api/queryClient.ts

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10,   // 10 minutes (formerly cacheTime)
    },
  },
});

// ============================================================================
// STEP 5: Environment Variables
// ============================================================================

// File: Mobile/.env (or create from .env.example)

EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

// Note: EXPO_PUBLIC_* variables are loaded automatically by Expo at build time

// ============================================================================
// STEP 6: Test the Integration
// ============================================================================

/*
1. Start the Expo app:
   npm start

2. Navigate to UploadCV screen and test:
   - Pick a PDF file
   - Upload it
   - Observe the processing status
   - See skills appear in SkillsReview after analysis

3. Test SkillsReviewScreen:
   - Edit a skill
   - Add a new skill
   - Remove a skill
   - Click Save Changes
   - See success notification

4. Test CVAnalysisScreen:
   - View ATS score (0-100)
   - See issues and improvements
   - Expand career suggestions
*/

// ============================================================================
// STEP 7: Type Safety
// ============================================================================

// File: Mobile/src/navigation/types.ts

import { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  UploadCV: undefined;
  CVAnalysis: undefined;
  SkillsReview: undefined;
  // Add other routes here
};

// Then in navigator:
const Stack = createNativeStackNavigator<RootStackParamList>();

// ============================================================================
// TROUBLESHOOTING CHECKLIST
// ============================================================================

/*
❌ Screens not appearing:
   → Check export in Mobile/src/features/cv/index.ts
   → Verify Stack.Screen is added to RootNavigator
   → Check Screen component names match (case-sensitive)

❌ Supabase errors:
   → Verify EXPO_PUBLIC_SUPABASE_URL in .env
   → Check EXPO_PUBLIC_SUPABASE_ANON_KEY exists
   → Run: npx expo env

❌ Notifications not showing:
   → Ensure requestNotificationPermissions() called in App.tsx
   → Check Platform.OS and permissions status
   → On iOS: Check app has notification permission in Settings

❌ React Query not caching:
   → Verify QueryClientProvider wraps app
   → Check queryClient is exported from api/queryClient.ts
   → Monitor React Query DevTools (add browser extension)

❌ File upload fails:
   → Check "cvs" bucket exists in Supabase Storage
   → Verify bucket is set to Private
   → Check RLS policy allows user to upload
   → Test with smaller file size first
*/

export {};

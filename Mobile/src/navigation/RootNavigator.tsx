import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';

import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

import ProfileScreen from '../screens/ProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import QuizScreen from '../screens/QuizScreen';
import RoadmapsScreen from '../screens/RoadmapsScreen';
import MentorsScreen from '../screens/MentorsScreen';
import { SkillsReviewScreen, CVAnalysisScreen } from '../features/cv';
import { homeColors } from '../screens/homeTheme';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type HomeStackParamList = {
  HomeMain: undefined;
  SkillsReview: undefined;
  CVAnalysis: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator();

function HomeStackNavigator(): React.ReactElement {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="SkillsReview" component={SkillsReviewScreen} />
      <HomeStack.Screen name="CVAnalysis" component={CVAnalysisScreen} />
    </HomeStack.Navigator>
  );
}

function TabLabel({
  focused,
  label,
  color,
}: {
  focused: boolean;
  label: string;
  color: string;
}) {
  return (
    <View style={tabLabelStyles.wrap}>
      <Text style={[tabLabelStyles.text, { color }]}>{label}</Text>
      {focused && <View style={[tabLabelStyles.dot, { backgroundColor: color }]} />}
    </View>
  );
}

const tabLabelStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});

const TAB_BAR_BASE_HEIGHT = 60;

export function RootNavigator(): React.ReactElement {
  const { state } = useAuth();
  const insets = useSafeAreaInsets();

  if (state.isLoading) {
    return null;
  }

  const isSignedIn = !!state.user && !!state.session;
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const tabBarPaddingTop = 8;
  const tabBarPaddingBottom = Math.max(insets.bottom, 8);

  return (
    <NavigationContainer>
      {isSignedIn ? (
        <Tab.Navigator
          id="TabNavigator"
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: homeColors.tabActive,
            tabBarInactiveTintColor: homeColors.tabInactive,
            tabBarStyle: {
              height: tabBarHeight,
              paddingBottom: tabBarPaddingBottom,
              paddingTop: tabBarPaddingTop,
              backgroundColor: homeColors.tabBarBg,
            },
            tabBarLabel: ({ focused, color }) => (
              <TabLabel
                focused={focused}
                label={route.name}
                color={color}
              />
            ),
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap;
              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Quiz') {
                iconName = focused ? 'bulb' : 'bulb-outline';
              } else if (route.name === 'Roadmaps') {
                iconName = focused ? 'map' : 'map-outline';
              } else if (route.name === 'Mentors') {
                iconName = focused ? 'people' : 'people-outline';
              } else {
                iconName = focused ? 'person' : 'person-outline';
              }
              return <Ionicons name={iconName} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeStackNavigator} />
          <Tab.Screen name="Quiz" component={QuizScreen} />
          <Tab.Screen name="Roadmaps" component={RoadmapsScreen} />
          <Tab.Screen name="Mentors" component={MentorsScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      ) : (
        <AuthStack.Navigator
          id="AuthNavigator"
          screenOptions={{
            headerShown: false,
            animation: 'default',
          }}
        >
          <AuthStack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ animation: 'none' }}
          />
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

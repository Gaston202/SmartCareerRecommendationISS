import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';

import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

import ProfileScreen from '../screens/ProfileScreen';
import HomeScreen from "../screens/HomeScreen";
import { SkillsReviewScreen, CVAnalysisScreen } from '../features/cv';


type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator();

export function RootNavigator(): React.ReactElement {
  const { state } = useAuth();

  if (state.isLoading) {
    return null;
  }

  const isSignedIn = !!state.user && !!state.session;

  return (
    <NavigationContainer>
      {isSignedIn ? (
        <Tab.Navigator
          id="TabNavigator"
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: 'rgb(224, 56, 129)',
            tabBarInactiveTintColor: 'gray',
            tabBarStyle: {
              height: 75,
              paddingBottom: 5,
            },
            tabBarLabelStyle: {
              fontSize: 12,
            },
            tabBarIcon: ({ focused, color, size }) => {
              let iconName: keyof typeof Ionicons.glyphMap;

              if (route.name === 'Home') {
                iconName = focused ? 'home' : 'home-outline';
              } else if (route.name === 'Profile') {
                iconName = focused ? 'person' : 'person-outline';
              } else {
                iconName = 'ellipse';
              }

              return <Ionicons name={iconName} size={size} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
          <Tab.Screen 
            name="SkillsReview" 
            component={SkillsReviewScreen} 
            options={{ title: "Skills", headerShown: true }} 
          />
          <Tab.Screen 
            name="CVAnalysis" 
            component={CVAnalysisScreen} 
            options={{ title: "Analysis", headerShown: true }} 
          />
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

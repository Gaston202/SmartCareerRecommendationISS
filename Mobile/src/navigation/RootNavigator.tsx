import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../auth/AuthProvider';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { View, Text } from 'react-native';
import HomeScreen from "../screens/HomeScreen";


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
    return <></>;
  }

  const isSignedIn = !!state.user && !!state.session;

  return (
    <NavigationContainer>
      {isSignedIn ? (
        <Tab.Navigator
          id="TabNavigator"
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
          }}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
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
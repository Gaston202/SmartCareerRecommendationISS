import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthProvider';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Root navigator component
 * Handles authentication state and conditional rendering
 */
export function RootNavigator(): React.ReactElement {
  const { state } = useAuth();

  if (state.isLoading) {
    // TODO: Replace with splash/loading screen
    return <></>;
  }

  const isSignedIn = !!state.user && !!state.session;

  return (
    <NavigationContainer>
      {isSignedIn ? (
        // TODO: Add app screens/stack here
        <></>
      ) : (
        <AuthStack.Navigator
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

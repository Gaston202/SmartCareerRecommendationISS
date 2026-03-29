import React, { useEffect } from 'react';
import { StyledProvider } from '@gluestack-ui/themed';
import { config } from './src/ui/gluestack-ui.config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initializeBackendConnection } from './src/config/backend';

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    // Initialize and verify backend connection on app startup
    initializeBackendConnection().catch((error) => {
      console.warn('[App] Backend initialization warning:', error);
      // App continues even if backend check fails - user will see error when trying to use AI features
    });
  }, []);

  return (
    <StyledProvider config={config}>
      <SafeAreaProvider>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <RootNavigator />
          </QueryClientProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </StyledProvider>
  );
}
//export default function App() {return <ProfileScreen />; } bach tchouf profile screen direct without login
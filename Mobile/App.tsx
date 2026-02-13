import React from 'react';
import { GluestackUIProvider } from '@gluestack-ui/themed';
import { config } from '@gluestack-ui/config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './src/auth/AuthProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient();

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </AuthProvider>
  );
}
//export default function App() {return <ProfileScreen />; } bach tchouf profile screen direct without login
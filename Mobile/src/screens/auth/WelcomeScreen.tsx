import React from 'react';
import { VStack, Button, Text, Center } from '@gluestack-ui/themed';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  return (
    <Center flex={1} bg="$white">
      <VStack space="md" w="$full" px="$6">
        <Text fontSize="$2xl" fontWeight="$bold" textAlign="center">
          Smart Career Recommendation
        </Text>
        <Text fontSize="$md" textAlign="center" color="$textLight700">
          Get personalized career recommendations based on your skills and interests
        </Text>

        <VStack space="sm" mt="$6">
          <Button
            onPress={() => navigation.navigate('Login')}
            bg="$primary600"
            rounded="$md"
            py="$3"
          >
            <Text color="$white" fontWeight="$semibold">
              Login
            </Text>
          </Button>

          <Button
            onPress={() => navigation.navigate('Signup')}
            variant="outline"
            borderColor="$primary600"
            rounded="$md"
            py="$3"
          >
            <Text color="$primary600" fontWeight="$semibold">
              Sign Up
            </Text>
          </Button>
        </VStack>
      </VStack>
    </Center>
  );
};

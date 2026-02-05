import React, { useState, useEffect } from 'react';
import { VStack, Button, Text, Input, InputField, FormControl, FormControlLabel, FormControlLabelText, FormControlError, FormControlErrorText, Center } from '@gluestack-ui/themed';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type SignupFormData = z.infer<typeof signupSchema>;

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
};

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {
  const { signUp, state } = useAuth();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Auto-login if session exists after signup
  useEffect(() => {
    if (!state.isLoading && state.session && state.user) {
      // User is logged in, navigate away or to home screen
      navigation.navigate('Login');
    }
  }, [state.session, state.isLoading, navigation]);

  const onSubmit = async (data: SignupFormData) => {
    try {
      setGeneralError(null);
      setSuccessMessage(null);
      setIsSubmitting(true);
      await signUp(data.email, data.password);
      setSuccessMessage('Account created! Check your email for confirmation.');
      // Route back to login after a short delay
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
    } catch (error) {
      setGeneralError(
        error instanceof Error ? error.message : 'An error occurred during sign up'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Center flex={1} bg="$white">
      <VStack space="md" w="$full" px="$6" pb="$6">
        <Text fontSize="$2xl" fontWeight="$bold" mb="$4">
          Create Account
        </Text>

        {generalError && (
          <FormControl isInvalid>
            <FormControlError>
              <FormControlErrorText color="$error600">
                {generalError}
              </FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}

        {successMessage && (
          <FormControl>
            <FormControlError>
              <FormControlErrorText color="$success600">
                {successMessage}
              </FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}

        <FormControl isInvalid={!!errors.email}>
          <FormControlLabel mb="$2">
            <FormControlLabelText fontWeight="$semibold">Email</FormControlLabelText>
          </FormControlLabel>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <Input>
                <InputField
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Input>
            )}
          />
          {errors.email && (
            <FormControlError>
              <FormControlErrorText>{errors.email.message}</FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>

        <FormControl isInvalid={!!errors.password}>
          <FormControlLabel mb="$2">
            <FormControlLabelText fontWeight="$semibold">Password</FormControlLabelText>
          </FormControlLabel>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <Input>
                <InputField
                  placeholder="••••••"
                  value={value}
                  onChangeText={onChange}
                  secureTextEntry
                />
              </Input>
            )}
          />
          {errors.password && (
            <FormControlError>
              <FormControlErrorText>{errors.password.message}</FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>

        <Button
          onPress={handleSubmit(onSubmit)}
          bg="$primary600"
          rounded="$md"
          py="$3"
          mt="$6"
          isDisabled={state.isLoading || isSubmitting}
        >
          <Text color="$white" fontWeight="$semibold">
            {state.isLoading || isSubmitting ? 'Creating account...' : 'Sign Up'}
          </Text>
        </Button>

        <VStack space="xs" mt="$4" flexDirection="row" justifyContent="center">
          <Text color="$textLight700">Already have an account?</Text>
          <Button
            variant="link"
            onPress={() => navigation.navigate('Login')}
            p="$0"
          >
            <Text color="$primary600" fontWeight="$semibold">
              Login
            </Text>
          </Button>
        </VStack>
      </VStack>
    </Center>
  );
};

import React, { useState } from 'react';
import {
  VStack,
  Button,
  Text,
  Input,
  InputField,
  FormControl,
  FormControlLabel,
  FormControlLabelText,
  FormControlError,
  FormControlErrorText,
  Center,
} from '@gluestack-ui/themed';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

type LoginScreenProps = {
  navigation: LoginScreenNavigationProp;
};

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Helper to parse auth errors safely with type narrowing
 */
const parseAuthError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message ?? 'An unexpected error occurred';
  }
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    if ('message' in errObj && typeof errObj.message === 'string') {
      return errObj.message;
    }
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An error occurred during login. Please try again.';
};

export function LoginScreen({ navigation }: LoginScreenProps): React.ReactElement {
  const authContext = useAuth();
  const { signIn, state } = authContext;
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData): Promise<void> => {
    try {
      setGeneralError(null);

      // Guard: validate form data exists and has required fields
      if (!data?.email || !data?.password) {
        setGeneralError('Email and password are required');
        return;
      }

      // Sign in with trimmed email (password should NOT be trimmed for security)
      await signIn(data.email.trim(), data.password);
    } catch (error: unknown) {
      const friendlyError = parseAuthError(error);
      setGeneralError(friendlyError);
    }
  };

  const isLoading = state?.isLoading ?? false;
  const busy = isLoading || isSubmitting;

  return (
    <Center flex={1} bg="$white">
      <VStack space="md" w="$full" px="$6">
      
        <Text fontSize="$2xl" fontWeight="$bold">Login</Text>

        {generalError && (
          <FormControl isInvalid>
            <FormControlError>
              <FormControlErrorText color="$error600">
                {generalError}
              </FormControlErrorText>
            </FormControlError>
          </FormControl>
        )}

        <FormControl isInvalid={!!errors.email?.message}>
          <FormControlLabel>
            <FormControlLabelText fontWeight="$semibold">
              Email
            </FormControlLabelText>
          </FormControlLabel>

          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange } }) => (
              <Input>
                <InputField
                  placeholder="you@example.com"
                  value={value ?? ''}
                  onChangeText={(text: string): void => onChange(text ?? '')}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!busy}
                  testID="email-input"
                />
              </Input>
            )}
          />

          {errors.email?.message && (
            <FormControlError>
              <FormControlErrorText color="$error600" testID="email-error">
                {errors.email.message}
              </FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>

        <FormControl isInvalid={!!errors.password?.message}>
          <FormControlLabel>
            <FormControlLabelText fontWeight="$semibold">
              Password
            </FormControlLabelText>
          </FormControlLabel>

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange } }) => (
              <Input>
                <InputField
                  placeholder="••••••"
                  value={value ?? ''}
                  onChangeText={(text: string): void => onChange(text ?? '')}
                  secureTextEntry
                  editable={!busy}
                  testID="password-input"
                />
              </Input>
            )}
          />

          {errors.password?.message && (
            <FormControlError>
              <FormControlErrorText color="$error600" testID="password-error">
                {errors.password.message}
              </FormControlErrorText>
            </FormControlError>
          )}
        </FormControl>

        <Button
          onPress={handleSubmit(onSubmit)}
          isDisabled={busy}
          bg="$primary600"
          py="$3"
          mt="$4"
          testID="login-button"
        >
          <Text color="$white" fontWeight="$semibold">
            {busy ? 'Logging in…' : 'Login'}
          </Text>
        </Button>

        <Button
          variant="link"
          onPress={(): void => {
            navigation?.navigate?.('Signup');
          }}
          isDisabled={busy}
          testID="signup-link"
        >
          <Text color="$primary600">Don't have an account? Sign up</Text>
        </Button>
      </VStack>
    </Center>
  );
}

import { signIn as nextAuthSignIn } from "next-auth/react";

export const authService = {
  async signIn(email: string, password: string) {
    const result = await nextAuthSignIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    return result;
  },
};

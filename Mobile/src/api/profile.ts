import { supabase } from "../api/supabase";

export type UserRow = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  avatar: string | null;
  bio: string | null;
  education_level?: string | null;
  field_of_study?: string | null;
  skills?: string | null;
  career_goal?: string | null;
  updated_at?: string | null;
  
  // ✅ Client-side alias for avatar
  photo_url?: string | null;
};

export type UpdateUserProfileInput = Partial<
  Pick<
    UserRow,
    | "name"
    | "avatar"
    | "bio"
    | "education_level"
    | "field_of_study"
    | "skills"
    | "career_goal"
  >
>;

export async function getMyUserRow(): Promise<{ userId: string; authEmail: string | null; row: UserRow | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  const user = authData.user;
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  // ✅ Map avatar to photo_url for form compatibility
  const mappedRow = data ? { ...data, photo_url: data.avatar } : null;

  return { userId: user.id, authEmail: user.email ?? null, row: (mappedRow as UserRow) ?? null };
}

export async function updateMyUserRow(input: UpdateUserProfileInput): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  const user = authData.user;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("users")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
}

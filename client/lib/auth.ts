import type { User } from "@/context/AuthContext";

export async function loadUserProfile(
  supabase: any,
  email: string,
  setUser: (user: User | null) => void,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("email", email)
    .single();

  if (error || !data) {
    console.error("Employee profile not found for:", email, error);
    return false;
  }

  setUser({
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    department: data.department,
    personal_email: data.personal_email ?? undefined,
  });
  return true;
}

export async function login(
  supabase: any,
  email: string,
  password: string,
  loadUserProfileFn: (email: string) => Promise<boolean>,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const found = await loadUserProfileFn(email);
  if (!found) {
    await supabase.auth.signOut();
    throw new Error("Your account is not registered as an MPDO employee. Contact the administrator.");
  }
}

export async function logout(supabase: any, setUser: (user: null) => void): Promise<void> {
  await supabase.auth.signOut();
  setUser(null);
  window.location.replace("/login");
}

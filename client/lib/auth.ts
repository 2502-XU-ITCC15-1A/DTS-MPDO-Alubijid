// Auth helpers for use in both context and tests

export async function login(supabase: any, email: string, password: string, loadUserProfileFn: (email: string) => Promise<boolean>) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const found = await loadUserProfileFn(email);
  if (!found) {
    await supabase.auth.signOut();
    throw new Error("Your account is not registered as an MPDO employee. Contact the administrator.");
  }
}

export async function logout(supabase: any, setUser: (user: any) => void) {
  await supabase.auth.signOut();
  setUser(null);
  if (typeof window !== "undefined" && window.location) {
    window.location.replace("/login");
  }
}

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
    "Add them to your .env.local file (see .env.example) to enable authentication and cloud sync."
  );
}

// Single shared Supabase client for the whole app.
// detectSessionInUrl lets supabase-js automatically pick up the access token
// that Google/Spotify OAuth redirects back with, so no manual redirect
// handling is required in the UI.
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------------------
// OAuth sign-in helpers
// ---------------------------------------------------------------------------

export const signInWithGoogle = async () => {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
};

export const signInWithSpotify = async () => {
  return supabase.auth.signInWithOAuth({
    provider: "spotify",
    options: {
      redirectTo: window.location.origin,
      scopes: "user-read-email user-read-private",
    },
  });
};

// ---------------------------------------------------------------------------
// Passwordless email OTP helpers
// ---------------------------------------------------------------------------

// Sends a 6-digit code to the user's email. Supabase creates the auth user
// automatically on first verification when shouldCreateUser is true.
export const sendEmailOtp = async (email: string) => {
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
};

// Verifies the 6-digit code the user received by email.
export const verifyEmailOtp = async (email: string, token: string) => {
  return supabase.auth.verifyOtp({ email, token, type: "email" });
};

export const signOut = async () => {
  return supabase.auth.signOut();
};

// ---------------------------------------------------------------------------
// Profile + project persistence (Postgres tables via Supabase, RLS-protected)
// ---------------------------------------------------------------------------

// Create or update a user's profile row in Supabase (table: public.profiles)
export const createUserProfileInCloud = async (
  userId: string,
  profileData: { name: string; email?: string; avatarUrl?: string; provider: string }
) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          name: profileData.name,
          email: profileData.email || null,
          avatar_url: profileData.avatarUrl || null,
          provider: profileData.provider,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) throw error;
    console.log("User profile saved/updated in Supabase!");
    return data;
  } catch (error) {
    console.error("Error creating/updating user profile in cloud:", error);
    return null;
  }
};

// Retrieve a user's profile from Supabase
export const getUserProfileFromCloud = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

// Save (upsert) the user's in-progress project (table: public.projects)
export const saveProjectToCloud = async (userId: string, data: any) => {
  try {
    const { error } = await supabase.from("projects").upsert(
      {
        user_id: userId,
        config: data.config ?? null,
        lyrics: data.lyrics ?? null,
        audio_url: data.audioUrl ?? null,
        waveform_peaks: data.waveformPeaks ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    console.log("Project synced to Supabase!");
  } catch (error) {
    console.error("Error saving project:", error);
  }
};

// Load the user's saved project from Supabase
export const loadProjectFromCloud = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      config: data.config,
      lyrics: data.lyrics,
      audioUrl: data.audio_url,
      waveformPeaks: data.waveform_peaks,
    };
  } catch (error) {
    console.error("Error loading project:", error);
    return null;
  }
};

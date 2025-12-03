import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRoles extends Profile {
  appRoles: AppRole[];
}

export function useAuth() {
  // All useState hooks first - always in same order
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserWithRoles | null>(null);
  const [loading, setLoading] = useState(true);

  // useCallback hook
  const fetchProfile = useCallback(async (userId: string, userEmail?: string, userName?: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!profileData && !profileError) {
        console.warn("Profile not found, attempting to create...");
        
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: userId,
            email: userEmail || "unknown@email.com",
            full_name: userName || "Usuário",
            role: "employee_amaggi" as const,
            company: "Amaggi"
          })
          .select()
          .single();

        if (createError) {
          console.error("Failed to create profile:", createError);
          setProfile(null);
          setLoading(false);
          return;
        }

        await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: "employee_amaggi" as const
          });

        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        setProfile({
          ...newProfile,
          appRoles: rolesData?.map(r => r.role) || ["employee_amaggi"],
        });
        setLoading(false);
        return;
      }

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setProfile(null);
        setLoading(false);
        return;
      }

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      }

      const appRoles = rolesData?.map(r => r.role) || [];

      setProfile({
        ...profileData,
        appRoles,
      });
    } catch (error) {
      console.error("Error in fetchProfile:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // useEffect hook - always runs
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          const email = currentSession.user.email;
          const name = currentSession.user.user_metadata?.full_name;
          await fetchProfile(currentSession.user.id, email, name);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        if (newSession?.user) {
          const email = newSession.user.email;
          const name = newSession.user.user_metadata?.full_name;
          // Use setTimeout to avoid potential Supabase deadlock
          setTimeout(() => {
            if (mounted) {
              fetchProfile(newSession.user.id, email, name);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Sign in function
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  // Sign up function
  const signUp = useCallback(async (
    email: string, 
    password: string, 
    fullName: string, 
    role: "admin_hc" | "employee_amaggi" = "employee_amaggi"
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (!error && data.user) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!existingProfile) {
        await supabase.from("profiles").insert({
          id: data.user.id,
          email: email,
          full_name: fullName,
          role: role,
          company: "Amaggi"
        });

        const appRole: AppRole = role === "admin_hc" ? "admin_hc" : "employee_amaggi";
        await supabase.from("user_roles").insert({
          user_id: data.user.id,
          role: appRole
        });
      }
    }

    return { error };
  }, []);

  // Sign out function
  const signOut = useCallback(async () => {
    setProfile(null);
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  // Refresh profile function
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user.email, user.user_metadata?.full_name);
    }
  }, [user, fetchProfile]);

  // Computed values
  const isAdmin = profile?.role === "admin_hc" || 
                  profile?.appRoles?.includes("admin_hc") || 
                  profile?.appRoles?.includes("super_admin");
  
  const isSuperAdmin = profile?.appRoles?.includes("super_admin") || false;

  return {
    user,
    session,
    profile,
    loading,
    isAdmin,
    isSuperAdmin,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };
}

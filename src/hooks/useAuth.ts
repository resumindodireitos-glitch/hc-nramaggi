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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserWithRoles | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, userEmail?: string, userName?: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      // If profile doesn't exist, create it (fallback for trigger failure)
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

        // Also create user_roles entry
        await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: "employee_amaggi" as const
          })
          .single();

        // Fetch roles
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

      // Fetch roles from user_roles table
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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const email = session.user.email;
        const name = session.user.user_metadata?.full_name;
        setTimeout(() => {
          if (mounted) fetchProfile(session.user.id, email, name);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const email = session.user.email;
          const name = session.user.user_metadata?.full_name;
          setTimeout(() => {
            if (mounted) fetchProfile(session.user.id, email, name);
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

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (
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

    // If signup was successful and we got a user, ensure profile exists
    if (!error && data.user) {
      // Wait a moment for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if profile was created by trigger
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      // If trigger failed, create profile manually
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
  };

  const signOut = async () => {
    setProfile(null);
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  // Check if user is admin (either admin_hc in profile or has admin role in user_roles)
  const isAdmin = profile?.role === "admin_hc" || 
                  profile?.appRoles?.includes("admin_hc") || 
                  profile?.appRoles?.includes("super_admin");
  
  // Check if user is super admin (only from user_roles table)
  const isSuperAdmin = profile?.appRoles?.includes("super_admin");

  // Function to refresh profile
  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, user.email, user.user_metadata?.full_name);
    }
  };

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

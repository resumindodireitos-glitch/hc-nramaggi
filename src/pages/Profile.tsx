import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  Loader2, User, Mail, Building2, Briefcase, Shield, 
  Save, Eye, EyeOff, Lock, Calendar, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AIUsageStats {
  totalTokens: number;
  monthlyLimit: number;
  requestCount: number;
}

export default function Profile() {
  const { profile, user, isAdmin, isSuperAdmin, refreshProfile } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiUsage, setAIUsage] = useState<AIUsageStats>({
    totalTokens: 0,
    monthlyLimit: 1000000,
    requestCount: 0,
  });

  // Form state
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  // Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setDepartment(profile.department || "");
      setJobTitle(profile.job_title || "");
    }
    fetchAIUsage();
  }, [profile]);

  const fetchAIUsage = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data, count } = await supabase
        .from("ai_usage")
        .select("total_tokens", { count: "exact" })
        .gte("created_at", startOfMonth.toISOString());

      const { data: limits } = await supabase
        .from("ai_usage_limits")
        .select("monthly_token_limit")
        .eq("is_active", true)
        .limit(1)
        .single();

      const totalTokens = data?.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0;

      setAIUsage({
        totalTokens,
        monthlyLimit: limits?.monthly_token_limit || 1000000,
        requestCount: count || 0,
      });
    } catch (error) {
      console.error("Error fetching AI usage:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          department: department || null,
          job_title: jobTitle || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast.error("Erro ao alterar senha", { description: error.message });
    } finally {
      setChangingPassword(false);
    }
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const usagePercentage = (aiUsage.totalTokens / aiUsage.monthlyLimit) * 100;

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            Meu Perfil
          </h1>
          <p className="text-muted-foreground">
            Gerencie suas informações pessoais e configurações de conta
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <Card className="md:col-span-2 border-border/50">
            <CardHeader>
              <CardTitle>Informações Pessoais</CardTitle>
              <CardDescription>Atualize seus dados de perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar and Basic Info */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-4 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{profile.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <Badge 
                    className={cn(
                      "mt-2",
                      isSuperAdmin ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                      isAdmin ? "bg-primary/10 text-primary border-primary/30" :
                      "bg-muted text-muted-foreground"
                    )}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Colaborador"}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Edit Form */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Setor</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ex: Recursos Humanos"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Cargo</Label>
                  <Input
                    id="jobTitle"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Ex: Analista"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Side Cards */}
          <div className="space-y-6">
            {/* Account Info */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informações da Conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="truncate">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Empresa:</span>
                  <span>{profile.company || "Amaggi"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Desde:</span>
                  <span>
                    {profile.created_at 
                      ? format(new Date(profile.created_at), "dd MMM yyyy", { locale: ptBR })
                      : "-"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* AI Usage */}
            {isAdmin && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Uso de IA (Mês)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tokens usados</span>
                      <span className="font-medium">
                        {aiUsage.totalTokens.toLocaleString()} / {aiUsage.monthlyLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          usagePercentage > 90 ? "bg-red-500" : 
                          usagePercentage > 70 ? "bg-amber-500" : "bg-primary"
                        )}
                        style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      {Math.round(usagePercentage)}% utilizado
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Requisições</span>
                    <span className="font-medium">{aiUsage.requestCount}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Change Password */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Segurança
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!showPasswordForm ? (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setShowPasswordForm(true)}
                  >
                    Alterar Senha
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Nova Senha</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar Senha</Label>
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a nova senha"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        className="flex-1"
                        onClick={handleChangePassword}
                        disabled={changingPassword}
                      >
                        {changingPassword && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

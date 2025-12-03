import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, Plus, Pencil, Users, Search, Shield, User, UserPlus, 
  Mail, Lock, MoreHorizontal, KeyRound, Crown, Eye, EyeOff,
  UserCheck, UserX, RefreshCw, Trash2, Ban, CheckCircle, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type UserRole = Database["public"]["Enums"]["user_role"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRoles extends Profile {
  appRoles: AppRole[];
}

// Zod Schemas
const createUserSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(72, "Senha muito longa"),
  fullName: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  role: z.enum(["admin_hc", "employee_amaggi"]),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome muito longo"),
  role: z.enum(["admin_hc", "employee_amaggi"]),
  department: z.string().max(100).optional(),
  jobTitle: z.string().max(100).optional(),
  company: z.string().max(100).optional(),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(72, "Senha muito longa"),
});

export default function UserManagement() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, profile: currentUser } = useAuthContext();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showRolesDialog, setShowRolesDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Create form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("employee_amaggi");
  const [newDepartment, setNewDepartment] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newCompany, setNewCompany] = useState("Amaggi");

  // Edit form state
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("employee_amaggi");
  const [editDepartment, setEditDepartment] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");

  // Password reset state
  const [resetPassword, setResetPassword] = useState("");

  // Role management state
  const [selectedAppRoles, setSelectedAppRoles] = useState<AppRole[]>([]);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      }

      // Map roles to users
      const usersWithRoles: UserWithRoles[] = (profiles || []).map((profile) => {
        const userRoles = rolesData?.filter(r => r.user_id === profile.id).map(r => r.role) || [];
        return { ...profile, appRoles: userRoles };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = <T extends z.ZodSchema>(schema: T, data: unknown): boolean => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const path = err.path.join(".");
        newErrors[path] = err.message;
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

// Auto-set company based on role
  const getCompanyForRole = (role: UserRole) => {
    return role === "admin_hc" ? "HC Consultoria" : "Amaggi";
  };

  const handleRoleChange = (role: UserRole, isEdit = false) => {
    const company = getCompanyForRole(role);
    if (isEdit) {
      setEditRole(role);
      setEditCompany(company);
    } else {
      setNewRole(role);
      setNewCompany(company);
    }
  };

  const openCreateDialog = () => {
    setNewEmail("");
    setNewPassword("");
    setNewFullName("");
    setNewRole("employee_amaggi");
    setNewDepartment("");
    setNewJobTitle("");
    setNewCompany("Amaggi");
    setErrors({});
    setShowCreateDialog(true);
  };

  const openEditDialog = (user: UserWithRoles) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditRole(user.role);
    setEditDepartment(user.department || "");
    setEditJobTitle(user.job_title || "");
    // Set company based on role (auto-correct if necessary)
    setEditCompany(getCompanyForRole(user.role));
    setErrors({});
    setShowEditDialog(true);
  };

  const openPasswordDialog = (user: UserWithRoles) => {
    setEditingUser(user);
    setResetPassword("");
    setShowPassword(false);
    setErrors({});
    setShowPasswordDialog(true);
  };

  const openRolesDialog = (user: UserWithRoles) => {
    setEditingUser(user);
    setSelectedAppRoles([...user.appRoles]);
    setShowRolesDialog(true);
  };

  const handleCreateUser = async () => {
    const formData = {
      email: newEmail,
      password: newPassword,
      fullName: newFullName,
      role: newRole,
      department: newDepartment || undefined,
      jobTitle: newJobTitle || undefined,
      company: newCompany || undefined,
    };

    if (!validateForm(createUserSchema, formData)) return;

    setSaving(true);
    try {
      // Create user in auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: {
          data: {
            full_name: newFullName,
            role: newRole,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile with additional info
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            department: newDepartment || null,
            job_title: newJobTitle || null,
            company: newCompany || null,
            role: newRole,
          })
          .eq("id", authData.user.id);

        if (profileError) {
          console.error("Profile update error:", profileError);
        }
      }

      toast.success("Usuário criado com sucesso!", {
        description: `${newFullName} pode fazer login com o email ${newEmail}`,
      });
      setShowCreateDialog(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.message?.includes("already registered")) {
        toast.error("Este email já está cadastrado");
      } else {
        toast.error("Erro ao criar usuário", { description: error.message });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    const formData = {
      fullName: editFullName,
      role: editRole,
      department: editDepartment || undefined,
      jobTitle: editJobTitle || undefined,
      company: editCompany || undefined,
    };

    if (!validateForm(updateUserSchema, formData)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editFullName,
          role: editRole,
          department: editDepartment || null,
          job_title: editJobTitle || null,
          company: editCompany || null,
        })
        .eq("id", editingUser.id);

      if (error) throw error;

      toast.success("Usuário atualizado com sucesso!");
      setShowEditDialog(false);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Erro ao atualizar usuário");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser) return;

    if (!validateForm(passwordSchema, { password: resetPassword })) return;

    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-password", {
        body: { 
          userId: editingUser.id,
          newPassword: resetPassword 
        },
      });

      if (error) throw error;

      toast.success("Senha alterada com sucesso!", {
        description: `A nova senha foi definida para ${editingUser.full_name}`,
      });
      setShowPasswordDialog(false);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error("Erro ao redefinir senha", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRoles = async () => {
    if (!editingUser || !isSuperAdmin) return;

    setSaving(true);
    try {
      // Delete existing roles for user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", editingUser.id);

      if (deleteError) throw deleteError;

      // Insert new roles
      if (selectedAppRoles.length > 0) {
        const rolesToInsert = selectedAppRoles.map(role => ({
          user_id: editingUser.id,
          role,
        }));

        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(rolesToInsert);

        if (insertError) throw insertError;
      }

      toast.success("Permissões atualizadas com sucesso!");
      setShowRolesDialog(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating roles:", error);
      toast.error("Erro ao atualizar permissões", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleAppRole = (role: AppRole) => {
    setSelectedAppRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role) 
        : [...prev, role]
    );
  };

  const openDeleteDialog = (user: UserWithRoles) => {
    // Don't allow deleting super admins or self
    if (user.appRoles.includes("super_admin")) {
      toast.error("Não é possível excluir um Super Admin");
      return;
    }
    if (user.id === currentUser?.id) {
      toast.error("Não é possível excluir sua própria conta");
      return;
    }
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !isSuperAdmin) return;

    setSaving(true);
    try {
      // Delete user roles first
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userToDelete.id);

      // Delete profile (auth user deletion requires admin API)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userToDelete.id);

      if (error) throw error;

      toast.success("Usuário excluído com sucesso!", {
        description: `${userToDelete.full_name} foi removido do sistema`,
      });
      setShowDeleteDialog(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Erro ao excluir usuário", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserStatus = async (user: UserWithRoles, activate: boolean) => {
    if (!isSuperAdmin) return;
    
    setSaving(true);
    try {
      // Toggle the admin_hc role to effectively enable/disable the user
      if (activate) {
        // Add role back
        const roleToAdd = user.role === "admin_hc" ? "admin_hc" : "employee_amaggi";
        await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: roleToAdd });
      } else {
        // Remove all roles (keeping super_admin if exists)
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.id)
          .neq("role", "super_admin");
      }

      toast.success(activate ? "Usuário ativado!" : "Usuário desativado!", {
        description: `${user.full_name} foi ${activate ? "ativado" : "desativado"} com sucesso`,
      });
      fetchUsers();
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      toast.error("Erro ao alterar status", { description: error.message });
    } finally {
      setSaving(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.department?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

    if (activeTab === "all") return matchesSearch;
    if (activeTab === "admins") return matchesSearch && (user.role === "admin_hc" || user.appRoles.includes("admin_hc") || user.appRoles.includes("super_admin"));
    if (activeTab === "employees") return matchesSearch && user.role === "employee_amaggi" && !user.appRoles.includes("admin_hc") && !user.appRoles.includes("super_admin");
    return matchesSearch;
  });

  // Stats
  const totalUsers = users.length;
  const adminCount = users.filter(u => u.role === "admin_hc" || u.appRoles.includes("admin_hc") || u.appRoles.includes("super_admin")).length;
  const employeeCount = users.filter(u => u.role === "employee_amaggi" && !u.appRoles.includes("admin_hc") && !u.appRoles.includes("super_admin")).length;
  const superAdminCount = users.filter(u => u.appRoles.includes("super_admin")).length;

  const getRoleBadges = (user: UserWithRoles) => {
    const badges = [];
    
    if (user.appRoles.includes("super_admin")) {
      badges.push(
        <Badge key="super" className="bg-amber-500/10 text-amber-600 border-0 mr-1">
          <Crown className="h-3 w-3 mr-1" />
          Super Admin
        </Badge>
      );
    }
    
    if (user.appRoles.includes("admin_hc") || user.role === "admin_hc") {
      badges.push(
        <Badge key="admin" className="bg-primary/10 text-primary border-0 mr-1">
          <Shield className="h-3 w-3 mr-1" />
          Admin
        </Badge>
      );
    }
    
    if (badges.length === 0 || user.role === "employee_amaggi") {
      if (!user.appRoles.includes("admin_hc") && !user.appRoles.includes("super_admin")) {
        badges.push(
          <Badge key="employee" variant="secondary" className="border-0">
            <User className="h-3 w-3 mr-1" />
            Colaborador
          </Badge>
        );
      }
    }
    
    return badges;
  };

  if (loading) {
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Gerenciamento de Usuários
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Crie, edite e gerencie os acessos ao sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchUsers} size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openCreateDialog} className="gradient-primary shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Crown className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{superAdminCount}</p>
                  <p className="text-xs text-muted-foreground">Super Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{adminCount}</p>
                  <p className="text-xs text-muted-foreground">Administradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <UserCheck className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{employeeCount}</p>
                  <p className="text-xs text-muted-foreground">Colaboradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou departamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="admins">Admins</TabsTrigger>
                  <TabsTrigger value="employees">Colaboradores</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Lista de Usuários</CardTitle>
            <CardDescription>
              {filteredUsers.length} usuário(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Permissões</TableHead>
                    <TableHead className="font-semibold">Departamento</TableHead>
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Cadastrado em</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Nenhum usuário encontrado</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} className="group">
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {getRoleBadges(user)}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{user.department || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{user.company || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.created_at
                            ? format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar Dados
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openPasswordDialog(user)}>
                                <KeyRound className="h-4 w-4 mr-2" />
                                Redefinir Senha
                              </DropdownMenuItem>
                              {isSuperAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openRolesDialog(user)}>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Gerenciar Permissões
                                  </DropdownMenuItem>
                                  {user.appRoles.length > 0 && !user.appRoles.includes("super_admin") ? (
                                    <DropdownMenuItem 
                                      onClick={() => handleToggleUserStatus(user, false)}
                                      className="text-amber-600"
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Desativar Conta
                                    </DropdownMenuItem>
                                  ) : user.appRoles.length === 0 ? (
                                    <DropdownMenuItem 
                                      onClick={() => handleToggleUserStatus(user, true)}
                                      className="text-green-600"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Ativar Conta
                                    </DropdownMenuItem>
                                  ) : null}
                                  {!user.appRoles.includes("super_admin") && user.id !== currentUser?.id && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => openDeleteDialog(user)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Excluir Usuário
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Criar Novo Usuário
              </DialogTitle>
              <DialogDescription>
                Preencha os dados para criar uma nova conta de acesso ao sistema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Nome Completo *</Label>
                  <Input 
                    value={newFullName} 
                    onChange={(e) => setNewFullName(e.target.value)} 
                    placeholder="Nome do usuário"
                    className={`h-10 ${errors.fullName ? "border-destructive" : ""}`}
                  />
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="email"
                      value={newEmail} 
                      onChange={(e) => setNewEmail(e.target.value)} 
                      placeholder="email@empresa.com"
                      className={`pl-10 h-10 ${errors.email ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Senha *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type={showPassword ? "text" : "password"}
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="Mínimo 6 caracteres"
                      className={`pl-10 pr-10 h-10 ${errors.password ? "border-destructive" : ""}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Tipo de Acesso *</Label>
                  <Select value={newRole} onValueChange={(v) => handleRoleChange(v as UserRole)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee_amaggi">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-green-500" />
                          <div>
                            <span className="font-medium">Colaborador RH Amaggi</span>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin_hc">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <div>
                            <span className="font-medium">Administrador HC</span>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {newRole === "admin_hc" 
                      ? "Acesso completo para equipe HC Consultoria" 
                      : "Acesso ao RH da empresa Amaggi"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Empresa</Label>
                  <Input 
                    value={newCompany} 
                    disabled
                    className="h-10 bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Definido automaticamente pelo tipo de acesso</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Departamento</Label>
                  <Input 
                    value={newDepartment} 
                    onChange={(e) => setNewDepartment(e.target.value)} 
                    placeholder="Ex: Administrativo"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cargo</Label>
                  <Input 
                    value={newJobTitle} 
                    onChange={(e) => setNewJobTitle(e.target.value)} 
                    placeholder="Ex: Analista"
                    className="h-10"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateUser} disabled={saving} className="gradient-primary">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Editar Usuário
              </DialogTitle>
              <DialogDescription>Atualize as informações de {editingUser?.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Nome Completo</Label>
                  <Input 
                    value={editFullName} 
                    onChange={(e) => setEditFullName(e.target.value)} 
                    className={`h-10 ${errors.fullName ? "border-destructive" : ""}`}
                  />
                  {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Email</Label>
                  <Input value={editingUser?.email || ""} disabled className="bg-muted h-10" />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Tipo de Acesso</Label>
                  <Select value={editRole} onValueChange={(v) => handleRoleChange(v as UserRole, true)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee_amaggi">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-green-500" />
                          <span className="font-medium">Colaborador RH Amaggi</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin_hc">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Administrador HC</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editRole === "admin_hc" 
                      ? "Acesso completo para equipe HC Consultoria" 
                      : "Acesso ao RH da empresa Amaggi"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Empresa</Label>
                  <Input 
                    value={editCompany} 
                    disabled
                    className="h-10 bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Definido automaticamente pelo tipo de acesso</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Departamento</Label>
                  <Input 
                    value={editDepartment} 
                    onChange={(e) => setEditDepartment(e.target.value)} 
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cargo</Label>
                  <Input 
                    value={editJobTitle} 
                    onChange={(e) => setEditJobTitle(e.target.value)} 
                    className="h-10"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveUser} disabled={saving} className="gradient-primary">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Password Reset Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Redefinir Senha
              </DialogTitle>
              <DialogDescription>
                Defina uma nova senha para {editingUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nova Senha *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={resetPassword} 
                    onChange={(e) => setResetPassword(e.target.value)} 
                    placeholder="Mínimo 6 caracteres"
                    className={`pl-10 pr-10 h-10 ${errors.password ? "border-destructive" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleResetPassword} disabled={saving} className="gradient-primary">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Redefinir Senha
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Roles Management Dialog (Super Admin Only) */}
        <Dialog open={showRolesDialog} onOpenChange={setShowRolesDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Gerenciar Permissões
              </DialogTitle>
              <DialogDescription>
                Configure as permissões avançadas para {editingUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium">Super Admin</p>
                      <p className="text-xs text-muted-foreground">Acesso total ao sistema</p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedAppRoles.includes("super_admin")}
                    onCheckedChange={() => toggleAppRole("super_admin")}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Administrador HC</p>
                      <p className="text-xs text-muted-foreground">Gerencia formulários e relatórios</p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedAppRoles.includes("admin_hc")}
                    onCheckedChange={() => toggleAppRole("admin_hc")}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Colaborador Amaggi</p>
                      <p className="text-xs text-muted-foreground">Acesso básico de visualização</p>
                    </div>
                  </div>
                  <Switch
                    checked={selectedAppRoles.includes("employee_amaggi")}
                    onCheckedChange={() => toggleAppRole("employee_amaggi")}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRolesDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateRoles} disabled={saving} className="gradient-primary">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Permissões
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o usuário <strong>{userToDelete?.full_name}</strong>?
                <br />
                <span className="text-destructive font-medium">Esta ação não pode ser desfeita.</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToDelete(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

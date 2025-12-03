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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Users, Search, Shield, User, UserPlus, Mail, Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type UserRole = Database["public"]["Enums"]["user_role"];

export default function UserManagement() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("employee_amaggi");
  const [editDepartment, setEditDepartment] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");

  // Create form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("employee_amaggi");
  const [newDepartment, setNewDepartment] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newCompany, setNewCompany] = useState("Amaggi");

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchProfiles();
  }, [isAdmin]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (profile: Profile) => {
    setEditingUser(profile);
    setEditFullName(profile.full_name);
    setEditEmail(profile.email);
    setEditRole(profile.role);
    setEditDepartment(profile.department || "");
    setEditJobTitle(profile.job_title || "");
    setEditCompany(profile.company || "");
    setShowEditDialog(true);
  };

  const openCreateDialog = () => {
    setNewEmail("");
    setNewPassword("");
    setNewFullName("");
    setNewRole("employee_amaggi");
    setNewDepartment("");
    setNewJobTitle("");
    setNewCompany("Amaggi");
    setShowCreateDialog(true);
  };

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newFullName) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

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
        description: "O usuário pode fazer login com as credenciais informadas.",
      });
      setShowCreateDialog(false);
      fetchProfiles();
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

      toast.success("Usuário atualizado!");
      setShowEditDialog(false);
      fetchProfiles();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Erro ao atualizar usuário");
    } finally {
      setSaving(false);
    }
  };

  const filteredProfiles = profiles.filter(
    (profile) =>
      profile.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.department?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const getRoleBadge = (role: UserRole) => {
    return role === "admin_hc" ? (
      <Badge className="bg-primary/10 text-primary border-0">
        <Shield className="h-3 w-3 mr-1" />
        Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="border-0">
        <User className="h-3 w-3 mr-1" />
        Colaborador
      </Badge>
    );
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Gerenciamento de Usuários
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {profiles.length} usuário(s) cadastrado(s) no sistema
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gradient-primary shadow-lg shadow-primary/20">
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* Search */}
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Lista de Usuários</CardTitle>
            <CardDescription>Gerencie os acessos ao sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Nome</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Função</TableHead>
                    <TableHead className="font-semibold">Departamento</TableHead>
                    <TableHead className="font-semibold">Empresa</TableHead>
                    <TableHead className="font-semibold">Cadastrado em</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>Nenhum usuário encontrado</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((profile) => (
                      <TableRow key={profile.id} className="group">
                        <TableCell className="font-medium">{profile.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                        <TableCell>{getRoleBadge(profile.role)}</TableCell>
                        <TableCell className="text-muted-foreground">{profile.department || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{profile.company || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {profile.created_at
                            ? format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEditDialog(profile)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
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
                    className="h-10"
                  />
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
                      className="pl-10 h-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Senha *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="password"
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10 h-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Acesso</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee_amaggi">Colaborador</SelectItem>
                      <SelectItem value="admin_hc">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Empresa</Label>
                  <Input 
                    value={newCompany} 
                    onChange={(e) => setNewCompany(e.target.value)} 
                    placeholder="Nome da empresa"
                    className="h-10"
                  />
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

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Editar Usuário
              </DialogTitle>
              <DialogDescription>Atualize as informações do usuário</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Nome Completo</Label>
                  <Input 
                    value={editFullName} 
                    onChange={(e) => setEditFullName(e.target.value)} 
                    className="h-10"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-sm font-medium">Email</Label>
                  <Input value={editEmail} disabled className="bg-muted h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tipo de Acesso</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin_hc">Administrador</SelectItem>
                      <SelectItem value="employee_amaggi">Colaborador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Empresa</Label>
                  <Input 
                    value={editCompany} 
                    onChange={(e) => setEditCompany(e.target.value)} 
                    className="h-10"
                  />
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
      </div>
    </AppLayout>
  );
}

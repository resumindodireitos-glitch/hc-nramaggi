import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Briefcase,
  Users,
  Search,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Types
interface Department {
  id: string;
  name: string;
  code: string | null;
  manager_name: string | null;
  description: string | null;
  created_at: string | null;
}

interface JobRole {
  id: string;
  department_id: string | null;
  name: string;
  description: string | null;
  cbo: string | null;
  risk_category: string | null;
  created_at: string | null;
  departments?: Department | null;
}

interface Employee {
  id: string;
  job_role_id: string | null;
  name: string;
  email: string | null;
  registration_code: string | null;
  admission_date: string | null;
  is_active: boolean | null;
  created_at: string | null;
  job_roles?: (JobRole & { departments?: Department | null }) | null;
}

export default function OrganizationManagement() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();
  const [activeTab, setActiveTab] = useState("departments");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Data states
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Dialog states
  const [showDeptDialog, setShowDeptDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showEmployeeDialog, setShowEmployeeDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ type: string; id: string; name: string } | null>(null);

  // Edit states
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editingRole, setEditingRole] = useState<JobRole | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form states - Department
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptManager, setDeptManager] = useState("");
  const [deptDescription, setDeptDescription] = useState("");

  // Form states - Job Role
  const [roleName, setRoleName] = useState("");
  const [roleDeptId, setRoleDeptId] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleCbo, setRoleCbo] = useState("");
  const [roleRiskCategory, setRoleRiskCategory] = useState("");

  // Form states - Employee
  const [empName, setEmpName] = useState("");
  const [empEmail, setEmpEmail] = useState("");
  const [empRoleId, setEmpRoleId] = useState("");
  const [empRegistration, setEmpRegistration] = useState("");
  const [empAdmissionDate, setEmpAdmissionDate] = useState("");
  const [empIsActive, setEmpIsActive] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Acesso negado");
      navigate("/dashboard");
      return;
    }
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchDepartments(), fetchJobRoles(), fetchEmployees()]);
    setLoading(false);
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name");
    if (!error) setDepartments(data || []);
  };

  const fetchJobRoles = async () => {
    const { data, error } = await supabase
      .from("job_roles")
      .select("*, departments(*)")
      .order("name");
    if (!error) setJobRoles(data || []);
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("*, job_roles(*, departments(*))")
      .order("name");
    if (!error) setEmployees(data || []);
  };

  // Department CRUD
  const openDeptDialog = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptName(dept.name);
      setDeptCode(dept.code || "");
      setDeptManager(dept.manager_name || "");
      setDeptDescription(dept.description || "");
    } else {
      setEditingDept(null);
      setDeptName("");
      setDeptCode("");
      setDeptManager("");
      setDeptDescription("");
    }
    setShowDeptDialog(true);
  };

  const saveDepartment = async () => {
    if (!deptName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: deptName.trim(),
        code: deptCode.trim() || null,
        manager_name: deptManager.trim() || null,
        description: deptDescription.trim() || null,
      };

      if (editingDept) {
        const { error } = await supabase.from("departments").update(data).eq("id", editingDept.id);
        if (error) throw error;
        toast.success("Departamento atualizado!");
      } else {
        const { error } = await supabase.from("departments").insert(data);
        if (error) throw error;
        toast.success("Departamento criado!");
      }
      setShowDeptDialog(false);
      fetchDepartments();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar departamento");
    } finally {
      setSaving(false);
    }
  };

  // Job Role CRUD
  const openRoleDialog = (role?: JobRole) => {
    if (role) {
      setEditingRole(role);
      setRoleName(role.name);
      setRoleDeptId(role.department_id || "");
      setRoleDescription(role.description || "");
      setRoleCbo(role.cbo || "");
      setRoleRiskCategory(role.risk_category || "");
    } else {
      setEditingRole(null);
      setRoleName("");
      setRoleDeptId("");
      setRoleDescription("");
      setRoleCbo("");
      setRoleRiskCategory("");
    }
    setShowRoleDialog(true);
  };

  const saveJobRole = async () => {
    if (!roleName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!roleDeptId) {
      toast.error("Departamento é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: roleName.trim(),
        department_id: roleDeptId,
        description: roleDescription.trim() || null,
        cbo: roleCbo.trim() || null,
        risk_category: roleRiskCategory || null,
      };

      if (editingRole) {
        const { error } = await supabase.from("job_roles").update(data).eq("id", editingRole.id);
        if (error) throw error;
        toast.success("Cargo atualizado!");
      } else {
        const { error } = await supabase.from("job_roles").insert(data);
        if (error) throw error;
        toast.success("Cargo criado!");
      }
      setShowRoleDialog(false);
      fetchJobRoles();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar cargo");
    } finally {
      setSaving(false);
    }
  };

  // Employee CRUD
  const openEmployeeDialog = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setEmpName(emp.name);
      setEmpEmail(emp.email || "");
      setEmpRoleId(emp.job_role_id || "");
      setEmpRegistration(emp.registration_code || "");
      setEmpAdmissionDate(emp.admission_date || "");
      setEmpIsActive(emp.is_active ?? true);
    } else {
      setEditingEmployee(null);
      setEmpName("");
      setEmpEmail("");
      setEmpRoleId("");
      setEmpRegistration("");
      setEmpAdmissionDate("");
      setEmpIsActive(true);
    }
    setShowEmployeeDialog(true);
  };

  const saveEmployee = async () => {
    if (!empName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: empName.trim(),
        email: empEmail.trim() || null,
        job_role_id: empRoleId || null,
        registration_code: empRegistration.trim() || null,
        admission_date: empAdmissionDate || null,
        is_active: empIsActive,
      };

      if (editingEmployee) {
        const { error } = await supabase.from("employees").update(data).eq("id", editingEmployee.id);
        if (error) throw error;
        toast.success("Colaborador atualizado!");
      } else {
        const { error } = await supabase.from("employees").insert(data);
        if (error) throw error;
        toast.success("Colaborador criado!");
      }
      setShowEmployeeDialog(false);
      fetchEmployees();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar colaborador");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteDialog) return;
    setSaving(true);
    try {
      const table = deleteDialog.type === "department" ? "departments" : 
                    deleteDialog.type === "role" ? "job_roles" : "employees";
      const { error } = await supabase.from(table).delete().eq("id", deleteDialog.id);
      if (error) throw error;
      toast.success("Excluído com sucesso!");
      setDeleteDialog(null);
      fetchAll();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir");
    } finally {
      setSaving(false);
    }
  };

  // Filter logic
  const filteredDepartments = departments.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRoles = jobRoles.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.departments?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmployees = employees.filter(e =>
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.registration_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
              <Building2 className="h-6 w-6 text-primary" />
              Estrutura Organizacional
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerencie departamentos, cargos e colaboradores
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{departments.length}</p>
                  <p className="text-sm text-muted-foreground">Departamentos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-accent/10">
                  <Briefcase className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{jobRoles.length}</p>
                  <p className="text-sm text-muted-foreground">Cargos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-success/10">
                  <Users className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{employees.length}</p>
                  <p className="text-sm text-muted-foreground">Colaboradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="departments" className="gap-2">
              <Building2 className="h-4 w-4" />
              Departamentos
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Briefcase className="h-4 w-4" />
              Cargos
            </TabsTrigger>
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              Colaboradores
            </TabsTrigger>
          </TabsList>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Departamentos</CardTitle>
                  <Button onClick={() => openDeptDialog()} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Gestor</TableHead>
                      <TableHead>Cargos</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDepartments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum departamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDepartments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell>{dept.code || "-"}</TableCell>
                          <TableCell>{dept.manager_name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {jobRoles.filter(r => r.department_id === dept.id).length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openDeptDialog(dept)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setDeleteDialog({ type: "department", id: dept.id, name: dept.name })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Job Roles Tab */}
          <TabsContent value="roles">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Cargos</CardTitle>
                  <Button onClick={() => openRoleDialog()} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>CBO</TableHead>
                      <TableHead>Risco</TableHead>
                      <TableHead>Colaboradores</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRoles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum cargo encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRoles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {role.departments?.name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>{role.cbo || "-"}</TableCell>
                          <TableCell>
                            {role.risk_category && (
                              <Badge variant="outline">{role.risk_category}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {employees.filter(e => e.job_role_id === role.id).length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openRoleDialog(role)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setDeleteDialog({ type: "role", id: role.id, name: role.name })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Colaboradores</CardTitle>
                  <Button onClick={() => openEmployeeDialog()} size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum colaborador encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{emp.name}</p>
                              {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell>{emp.registration_code || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Briefcase className="h-3 w-3 text-muted-foreground" />
                              {emp.job_roles?.name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {emp.job_roles?.departments?.name || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={emp.is_active ? "default" : "secondary"}>
                              {emp.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEmployeeDialog(emp)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setDeleteDialog({ type: "employee", id: emp.id, name: emp.name })}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Department Dialog */}
      <Dialog open={showDeptDialog} onOpenChange={setShowDeptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Ex: Administrativo" />
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={deptCode} onChange={(e) => setDeptCode(e.target.value)} placeholder="Ex: ADM-01" />
            </div>
            <div className="space-y-2">
              <Label>Gestor</Label>
              <Input value={deptManager} onChange={(e) => setDeptManager(e.target.value)} placeholder="Nome do gestor" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={deptDescription} onChange={(e) => setDeptDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeptDialog(false)}>Cancelar</Button>
            <Button onClick={saveDepartment} disabled={saving} className="gradient-primary">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar Cargo" : "Novo Cargo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Ex: Operador de Empilhadeira" />
            </div>
            <div className="space-y-2">
              <Label>Departamento *</Label>
              <Select value={roleDeptId} onValueChange={setRoleDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CBO (Código Brasileiro de Ocupações)</Label>
              <Input value={roleCbo} onChange={(e) => setRoleCbo(e.target.value)} placeholder="Ex: 7823-05" />
            </div>
            <div className="space-y-2">
              <Label>Categoria de Risco</Label>
              <Select value={roleRiskCategory} onValueChange={setRoleRiskCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="moderado">Moderado</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancelar</Button>
            <Button onClick={saveJobRole} disabled={saving} className="gradient-primary">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Dialog */}
      <Dialog open={showEmployeeDialog} onOpenChange={setShowEmployeeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Editar Colaborador" : "Novo Colaborador"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo *</Label>
              <Input value={empName} onChange={(e) => setEmpName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={empEmail} onChange={(e) => setEmpEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input value={empRegistration} onChange={(e) => setEmpRegistration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={empRoleId} onValueChange={setEmpRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {jobRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} ({role.departments?.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Admissão</Label>
              <Input type="date" value={empAdmissionDate} onChange={(e) => setEmpAdmissionDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeDialog(false)}>Cancelar</Button>
            <Button onClick={saveEmployee} disabled={saving} className="gradient-primary">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteDialog?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

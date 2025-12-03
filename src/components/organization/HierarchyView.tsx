import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Briefcase,
  Users,
  Edit,
  Loader2,
  Search,
} from "lucide-react";

interface Department {
  id: string;
  name: string;
  code: string | null;
}

interface JobRole {
  id: string;
  name: string;
  department_id: string | null;
  cbo: string | null;
  risk_category: string | null;
  departments?: Department | null;
}

interface HierarchyViewProps {
  departments: Department[];
  jobRoles: JobRole[];
  onUpdate: () => void;
}

export function HierarchyView({ departments, jobRoles, onUpdate }: HierarchyViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [editingRole, setEditingRole] = useState<JobRole | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Group job roles by department
  const rolesByDept = departments.reduce((acc, dept) => {
    acc[dept.id] = jobRoles.filter(r => r.department_id === dept.id);
    return acc;
  }, {} as Record<string, JobRole[]>);

  // Unassigned roles
  const unassignedRoles = jobRoles.filter(r => !r.department_id);

  const filteredDepts = departments.filter(dept => {
    const deptMatch = dept.name.toLowerCase().includes(searchTerm.toLowerCase());
    const hasMatchingRoles = rolesByDept[dept.id]?.some(
      r => r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return deptMatch || hasMatchingRoles;
  });

  const toggleDept = (deptId: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepts(newExpanded);
  };

  const expandAll = () => {
    setExpandedDepts(new Set(departments.map(d => d.id)));
  };

  const collapseAll = () => {
    setExpandedDepts(new Set());
  };

  const openEditDialog = (role: JobRole) => {
    setEditingRole(role);
    setSelectedDeptId(role.department_id || "");
  };

  const saveRoleDepartment = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("job_roles")
        .update({ department_id: selectedDeptId || null })
        .eq("id", editingRole.id);

      if (error) throw error;
      toast.success("Cargo atualizado!");
      setEditingRole(null);
      onUpdate();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar cargo");
    } finally {
      setSaving(false);
    }
  };

  const getRiskBadge = (category: string | null) => {
    switch (category?.toLowerCase()) {
      case "alto":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs">Alto</Badge>;
      case "medio":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 text-xs">Médio</Badge>;
      case "baixo":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 text-xs">Baixo</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar setor ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expandir Todos
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Recolher Todos
          </Button>
        </div>
      </div>

      {/* Hierarchy Tree */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Hierarquia Tanguro - Setores e Cargos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredDepts.map((dept) => (
            <Collapsible
              key={dept.id}
              open={expandedDepts.has(dept.id)}
              onOpenChange={() => toggleDept(dept.id)}
            >
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-muted/50 rounded-lg transition-colors text-left">
                {expandedDepts.has(dept.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-medium">{dept.name}</span>
                {dept.code && (
                  <Badge variant="secondary" className="text-xs ml-2">
                    {dept.code}
                  </Badge>
                )}
                <Badge variant="outline" className="ml-auto text-xs">
                  {rolesByDept[dept.id]?.length || 0} cargos
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-8 pl-4 border-l-2 border-muted space-y-1 py-2">
                  {rolesByDept[dept.id]?.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Nenhum cargo vinculado a este setor
                    </p>
                  ) : (
                    rolesByDept[dept.id]?.map((role) => (
                      <div
                        key={role.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded group"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm flex-1">{role.name}</span>
                        {role.cbo && (
                          <span className="text-xs text-muted-foreground">
                            CBO: {role.cbo}
                          </span>
                        )}
                        {getRiskBadge(role.risk_category)}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEditDialog(role)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {/* Unassigned Roles */}
          {unassignedRoles.length > 0 && (
            <Collapsible
              open={expandedDepts.has("unassigned")}
              onOpenChange={() => toggleDept("unassigned")}
            >
              <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-muted/50 rounded-lg transition-colors text-left border border-dashed border-orange-500/50 bg-orange-50/50">
                {expandedDepts.has("unassigned") ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Users className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-orange-700">Cargos sem Setor</span>
                <Badge variant="outline" className="ml-auto text-xs bg-orange-100 text-orange-700">
                  {unassignedRoles.length} pendentes
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-8 pl-4 border-l-2 border-orange-200 space-y-1 py-2">
                  {unassignedRoles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded group"
                    >
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm flex-1">{role.name}</span>
                      {role.cbo && (
                        <span className="text-xs text-muted-foreground">
                          CBO: {role.cbo}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => openEditDialog(role)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Vincular
                      </Button>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingRole} onOpenChange={() => setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vínculo do Cargo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={editingRole?.name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Setor (Departamento)</Label>
              <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum (sem vínculo)</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>
              Cancelar
            </Button>
            <Button onClick={saveRoleDepartment} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

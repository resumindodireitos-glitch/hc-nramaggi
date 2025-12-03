import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Building2, Briefcase, Calendar, Clock, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, validateCPF } from "@/lib/cpfUtils";

export interface RespondentData {
  cpf: string;
  empresa: string;
  setor: string;
  cargo: string;
  genero: string;
  tempo_empresa: string;
  data_avaliacao: string;
}

interface RespondentDataFormProps {
  data: RespondentData;
  onChange: (data: RespondentData) => void;
}

interface Department {
  id: string;
  name: string;
}

interface JobRole {
  id: string;
  name: string;
  department_id: string | null;
}

const GENEROS = [
  "Masculino",
  "Feminino",
  "Prefiro não dizer",
  "Outro"
];

const TEMPO_EMPRESA = [
  "Menos de 6 meses",
  "De 6 meses a 1 ano",
  "De 1 a 2 anos",
  "De 2 a 5 anos",
  "De 5 a 7 anos",
  "De 7 a 10 anos",
  "De 10 a 15 anos",
  "Acima de 15 anos"
];

export function RespondentDataForm({ data, onChange }: RespondentDataFormProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [cpfError, setCpfError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [deptRes, rolesRes] = await Promise.all([
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("job_roles").select("id, name, department_id").order("name")
      ]);

      if (deptRes.data) setDepartments(deptRes.data);
      if (rolesRes.data) setJobRoles(rolesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const updateField = (field: keyof RespondentData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value);
    updateField("cpf", formatted);
    
    const cleaned = formatted.replace(/\D/g, '');
    if (cleaned.length === 11) {
      if (!validateCPF(cleaned)) {
        setCpfError("CPF inválido");
      } else {
        setCpfError(null);
      }
    } else {
      setCpfError(null);
    }
  };

  // Filter job roles by selected department
  const filteredJobRoles = data.setor 
    ? jobRoles.filter(jr => {
        const dept = departments.find(d => d.name === data.setor);
        return dept ? jr.department_id === dept.id : true;
      })
    : jobRoles;

  if (loadingData) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-primary" />
          Dados do Respondente
        </CardTitle>
        <CardDescription>
          Preencha seus dados para caracterização no relatório. Todas as informações são tratadas de forma sigilosa conforme a LGPD.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* CPF */}
          <div className="space-y-2">
            <Label htmlFor="cpf" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              CPF *
            </Label>
            <Input
              id="cpf"
              value={data.cpf}
              onChange={(e) => handleCPFChange(e.target.value)}
              placeholder="000.000.000-00"
              maxLength={14}
              required
              className={cpfError ? "border-red-500" : ""}
            />
            {cpfError && <p className="text-xs text-red-500">{cpfError}</p>}
          </div>

          {/* Empresa - Fixo Amaggi */}
          <div className="space-y-2">
            <Label htmlFor="empresa" className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Empresa
            </Label>
            <Input 
              id="empresa" 
              value="Amaggi" 
              disabled 
              className="bg-muted font-medium" 
            />
          </div>

          {/* Setor - Select */}
          <div className="space-y-2">
            <Label htmlFor="setor" className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Setor/Departamento *
            </Label>
            <Select value={data.setor} onValueChange={(v) => {
              updateField("setor", v);
              // Reset cargo when setor changes
              if (data.cargo) updateField("cargo", "");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor..." />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>{dept.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cargo - Select */}
          <div className="space-y-2">
            <Label htmlFor="cargo" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Cargo/Função *
            </Label>
            <Select value={data.cargo} onValueChange={(v) => updateField("cargo", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cargo..." />
              </SelectTrigger>
              <SelectContent>
                {filteredJobRoles.map((role) => (
                  <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gênero */}
          <div className="space-y-2">
            <Label htmlFor="genero" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Gênero
            </Label>
            <Select value={data.genero} onValueChange={(v) => updateField("genero", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {GENEROS.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tempo na Empresa */}
          <div className="space-y-2">
            <Label htmlFor="tempo_empresa" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Tempo na Empresa *
            </Label>
            <Select value={data.tempo_empresa} onValueChange={(v) => updateField("tempo_empresa", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {TEMPO_EMPRESA.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Data da Avaliação */}
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="data_avaliacao" className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Data da Avaliação
          </Label>
          <Input
            id="data_avaliacao"
            type="date"
            value={data.data_avaliacao}
            onChange={(e) => updateField("data_avaliacao", e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

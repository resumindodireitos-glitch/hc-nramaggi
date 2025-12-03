import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Building2, Briefcase, Calendar, Clock } from "lucide-react";

export interface RespondentData {
  nome: string;
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
  empresaFixa?: string;
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

export function RespondentDataForm({ data, onChange, empresaFixa }: RespondentDataFormProps) {
  const updateField = (field: keyof RespondentData, value: string) => {
    onChange({ ...data, [field]: value });
  };

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
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Nome Completo *
            </Label>
            <Input
              id="nome"
              value={data.nome}
              onChange={(e) => updateField("nome", e.target.value)}
              placeholder="Seu nome completo"
              required
            />
          </div>

          {/* Empresa */}
          <div className="space-y-2">
            <Label htmlFor="empresa" className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Empresa *
            </Label>
            {empresaFixa ? (
              <Input id="empresa" value={empresaFixa} disabled className="bg-muted" />
            ) : (
              <Input
                id="empresa"
                value={data.empresa}
                onChange={(e) => updateField("empresa", e.target.value)}
                placeholder="Nome da empresa"
                required
              />
            )}
          </div>

          {/* Setor */}
          <div className="space-y-2">
            <Label htmlFor="setor" className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Setor/Departamento *
            </Label>
            <Input
              id="setor"
              value={data.setor}
              onChange={(e) => updateField("setor", e.target.value)}
              placeholder="Ex: Administrativo, Operacional"
              required
            />
          </div>

          {/* Cargo/Função */}
          <div className="space-y-2">
            <Label htmlFor="cargo" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Cargo/Função *
            </Label>
            <Input
              id="cargo"
              value={data.cargo}
              onChange={(e) => updateField("cargo", e.target.value)}
              placeholder="Ex: Analista, Operador"
              required
            />
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

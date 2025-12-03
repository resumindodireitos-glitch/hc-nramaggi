import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, X, Loader2, Download, AlertTriangle } from "lucide-react";

type MatrixType = "ergos" | "hseit" | "biomecanicos";

interface CSVRow {
  [key: string]: string;
}

const MATRIX_CONFIGS: Record<MatrixType, { table: string; columns: string[]; label: string }> = {
  ergos: {
    table: "risk_matrix_ergos",
    columns: ["dimension", "perigo", "fonte_geradora", "dano_potencial", "medida_controle_sugerida", "gravidade_padrao", "probabilidade_base", "nr_referencia", "observacoes"],
    label: "ERGOS (Cognitivo/Organizacional)"
  },
  hseit: {
    table: "risk_matrix_hseit",
    columns: ["dimension", "perigo", "fonte_geradora", "dano_potencial", "medida_controle_sugerida", "gravidade_padrao", "probabilidade_base", "benchmark_hse", "nr_referencia", "observacoes"],
    label: "HSE-IT (Psicossocial)"
  },
  biomecanicos: {
    table: "risk_matrix_biomecanicos",
    columns: ["segmento_corporal", "perigo", "fonte_geradora", "dano_potencial", "medida_controle_sugerida", "gravidade_padrao", "probabilidade_base", "cid_relacionado", "nr_referencia", "observacoes"],
    label: "Biomecânicos (Físico)"
  }
};

export function CSVImporter() {
  const [matrixType, setMatrixType] = useState<MatrixType>("ergos");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const parseCSV = (text: string): { headers: string[]; rows: CSVRow[] } => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    // Handle both comma and semicolon separators
    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ""));
    
    const rows = lines.slice(1).map(line => {
      const values = line.split(separator).map(v => v.trim().replace(/"/g, ""));
      const row: CSVRow = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });

    return { headers, rows };
  };

  const validateCSV = (headers: string[], rows: CSVRow[]): string[] => {
    const errors: string[] = [];
    const config = MATRIX_CONFIGS[matrixType];
    const required = config.columns.slice(0, 2); // First 2 columns are required

    required.forEach(col => {
      if (!headers.includes(col)) {
        errors.push(`Coluna obrigatória ausente: ${col}`);
      }
    });

    rows.forEach((row, i) => {
      required.forEach(col => {
        if (!row[col]?.trim()) {
          errors.push(`Linha ${i + 2}: ${col} vazio`);
        }
      });
    });

    return errors.slice(0, 10); // Limit to 10 errors
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationErrors([]);

    const text = await selectedFile.text();
    const { headers, rows } = parseCSV(text);
    
    setHeaders(headers);
    setPreview(rows.slice(0, 5)); // Preview first 5 rows
    
    const errors = validateCSV(headers, rows);
    setValidationErrors(errors);
  };

  const handleImport = async () => {
    if (!file || validationErrors.length > 0) return;

    setImporting(true);
    try {
      const text = await file.text();
      const { rows } = parseCSV(text);
      const config = MATRIX_CONFIGS[matrixType];

      // Map CSV rows to database format
      const dbRows = rows.map(row => {
        const dbRow: Record<string, any> = { is_active: true };
        
        config.columns.forEach(col => {
          if (row[col] !== undefined) {
            // Handle special column types
            if (col === "gravidade_padrao" || col === "probabilidade_base") {
              dbRow[col] = parseInt(row[col]) || 3;
            } else if (col === "benchmark_hse") {
              dbRow[col] = parseFloat(row[col]) || null;
            } else if (col === "nr_referencia") {
              dbRow[col] = row[col] ? row[col].split(",").map(s => s.trim()) : null;
            } else {
              dbRow[col] = row[col] || null;
            }
          }
        });

        return dbRow;
      });

      // Insert in batches
      const batchSize = 50;
      let inserted = 0;

      for (let i = 0; i < dbRows.length; i += batchSize) {
        const batch = dbRows.slice(i, i + batchSize);
        const { error } = await supabase
          .from(config.table as any)
          .insert(batch as any);

        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
        inserted += batch.length;
      }

      toast.success(`${inserted} registros importados com sucesso!`);
      setFile(null);
      setPreview([]);
      setHeaders([]);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao importar CSV");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const config = MATRIX_CONFIGS[matrixType];
    const csvContent = config.columns.join(";") + "\n" + 
      config.columns.map(() => "exemplo").join(";");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${matrixType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importar Matriz de Riscos (CSV)
        </CardTitle>
        <CardDescription>
          Carregue portfólios personalizados de riscos e medidas de controle
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Matrix Type Selection */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de Matriz</Label>
            <Select value={matrixType} onValueChange={(v) => setMatrixType(v as MatrixType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MATRIX_CONFIGS).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={downloadTemplate} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Baixar Template
            </Button>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label>Arquivo CSV</Label>
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="flex-1"
            />
            <Button 
              onClick={handleImport} 
              disabled={!file || validationErrors.length > 0 || importing}
              className="gap-2"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar
            </Button>
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <AlertTriangle className="h-4 w-4" />
              Erros de Validação
            </div>
            <ul className="text-sm space-y-1">
              {validationErrors.map((err, i) => (
                <li key={i} className="flex items-center gap-2">
                  <X className="h-3 w-3" />
                  {err}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Prévia (primeiras 5 linhas)</Label>
              <Badge variant="secondary">{file?.name}</Badge>
            </div>
            <div className="border rounded-lg overflow-auto max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.slice(0, 5).map(h => (
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      {headers.slice(0, 5).map(h => (
                        <TableCell key={h} className="text-sm truncate max-w-[200px]">
                          {row[h] || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {validationErrors.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <Check className="h-4 w-4" />
                CSV válido, pronto para importar
              </div>
            )}
          </div>
        )}

        {/* Expected Columns */}
        <div className="text-sm text-muted-foreground">
          <p className="font-medium mb-1">Colunas esperadas para {MATRIX_CONFIGS[matrixType].label}:</p>
          <div className="flex flex-wrap gap-1">
            {MATRIX_CONFIGS[matrixType].columns.map((col, i) => (
              <Badge key={col} variant={i < 2 ? "default" : "secondary"} className="text-xs">
                {col}{i < 2 && " *"}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

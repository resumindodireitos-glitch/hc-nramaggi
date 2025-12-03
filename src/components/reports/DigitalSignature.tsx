import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileSignature, CheckCircle2, Shield, Copy, Loader2 } from "lucide-react";

interface DigitalSignatureProps {
  reportId: string;
  isApproved: boolean;
  existingSignature?: {
    id: string;
    signer_name: string;
    signer_role: string;
    signer_credential: string | null;
    verification_code: string;
    signed_at: string;
    signature_hash: string;
  } | null;
  onSignatureComplete?: () => void;
}

export function DigitalSignature({ 
  reportId, 
  isApproved, 
  existingSignature,
  onSignatureComplete 
}: DigitalSignatureProps) {
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [signerName, setSignerName] = useState("Andre Luiz Lopes de Oliveira");
  const [signerRole, setSignerRole] = useState("Fisioterapeuta - Consultor em Ergonomia");
  const [signerCredential, setSignerCredential] = useState("CREFITO-9 26.465-F");

  const signMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("sign_report", {
        report_uuid: reportId,
        p_signer_name: signerName,
        p_signer_role: signerRole,
        p_signer_credential: signerCredential,
        p_ip_address: null,
        p_user_agent: navigator.userAgent
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Relatório assinado digitalmente!");
      setIsSignDialogOpen(false);
      onSignatureComplete?.();
    },
    onError: (error) => {
      toast.error("Erro ao assinar: " + error.message);
    }
  });

  const copyVerificationCode = () => {
    if (existingSignature?.verification_code) {
      navigator.clipboard.writeText(existingSignature.verification_code);
      toast.success("Código de verificação copiado!");
    }
  };

  const copySignatureHash = () => {
    if (existingSignature?.signature_hash) {
      navigator.clipboard.writeText(existingSignature.signature_hash);
      toast.success("Hash SHA256 copiado!");
    }
  };

  if (existingSignature) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <CardTitle className="text-base">Assinatura Digital Verificada</CardTitle>
          </div>
          <CardDescription>
            Este relatório possui assinatura digital válida
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Assinante</p>
              <p className="font-medium">{existingSignature.signer_name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Função</p>
              <p className="font-medium">{existingSignature.signer_role}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Credencial</p>
              <p className="font-medium">{existingSignature.signer_credential || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Data da Assinatura</p>
              <p className="font-medium">
                {new Date(existingSignature.signed_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>

          <div className="p-3 bg-background rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Código de Verificação</p>
                <p className="font-mono font-bold text-lg">{existingSignature.verification_code}</p>
              </div>
              <Button size="sm" variant="outline" onClick={copyVerificationCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="p-3 bg-background rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Hash SHA256</p>
                <p className="font-mono text-xs truncate">{existingSignature.signature_hash}</p>
              </div>
              <Button size="sm" variant="outline" onClick={copySignatureHash}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Integridade do documento garantida por hash criptográfico</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Assinatura Digital</CardTitle>
        </div>
        <CardDescription>
          Assine digitalmente este relatório para garantir sua autenticidade
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isApproved ? (
          <div className="text-center py-4">
            <Badge variant="secondary">Aguardando Aprovação</Badge>
            <p className="text-sm text-muted-foreground mt-2">
              O relatório precisa ser aprovado antes de ser assinado
            </p>
          </div>
        ) : (
          <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <FileSignature className="w-4 h-4 mr-2" />
                Assinar Relatório
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assinar Relatório Digitalmente</DialogTitle>
                <DialogDescription>
                  A assinatura gerará um código de verificação e hash SHA256 único
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Assinante</Label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Função/Cargo</Label>
                  <Input
                    value={signerRole}
                    onChange={(e) => setSignerRole(e.target.value)}
                    placeholder="Ex: Fisioterapeuta"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Registro Profissional</Label>
                  <Input
                    value={signerCredential}
                    onChange={(e) => setSignerCredential(e.target.value)}
                    placeholder="Ex: CREFITO-9 12345-F"
                  />
                </div>

                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1">Ao assinar, você declara que:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Revisou o conteúdo deste relatório</li>
                    <li>As informações estão corretas e completas</li>
                    <li>Assume responsabilidade técnica pelo documento</li>
                  </ul>
                </div>

                <Button 
                  className="w-full" 
                  onClick={() => signMutation.mutate()}
                  disabled={signMutation.isPending || !signerName || !signerRole}
                >
                  {signMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Assinando...
                    </>
                  ) : (
                    <>
                      <FileSignature className="w-4 h-4 mr-2" />
                      Confirmar Assinatura
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}

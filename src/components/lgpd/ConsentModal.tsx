import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Loader2 } from "lucide-react";

interface ConsentModalProps {
  open: boolean;
  onAccept: (consentData: ConsentData) => void;
  formTitle: string;
}

export interface ConsentData {
  accepted_at: string;
  consent_text: string;
  term_version: string;
  user_agent: string;
}

const CONSENT_VERSION = "v2.0";
const CONSENT_TEXT = `TERMO DE CONSENTIMENTO (LGPD - Lei 13.709/2018)

1. FINALIDADE: Dados coletados exclusivamente para avaliação de riscos psicossociais e ergonômicos.

2. ANONIMIZAÇÃO: Respostas anonimizadas em relatórios agregados. Dados tratados com confidencialidade.

3. DIREITOS: Acesso, correção, anonimização, eliminação, portabilidade e revogação.

4. RETENÇÃO: 5 anos para histórico ocupacional, com anonimização automática após período.

5. CONTATO DPO: lgpd@hcconsultoria.com.br`;

export function ConsentModal({ open, onAccept, formTitle }: ConsentModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = () => {
    if (!accepted) return;
    setLoading(true);
    const consentData: ConsentData = {
      accepted_at: new Date().toISOString(),
      consent_text: CONSENT_TEXT,
      term_version: CONSENT_VERSION,
      user_agent: navigator.userAgent,
    };
    setTimeout(() => { onAccept(consentData); setLoading(false); }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm mx-auto max-h-[80vh] flex flex-col p-4" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <DialogTitle className="text-sm">Termo de Consentimento</DialogTitle>
          </div>
          <DialogDescription className="text-xs">{formTitle}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[140px] border rounded p-2 text-xs">
          <pre className="whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">{CONSENT_TEXT}</pre>
        </ScrollArea>
        <div className="flex items-start gap-2 py-2">
          <Checkbox id="consent" checked={accepted} onCheckedChange={(c) => setAccepted(c === true)} className="mt-0.5" />
          <label htmlFor="consent" className="text-xs cursor-pointer">Li e aceito os termos de consentimento.</label>
        </div>
        <Button onClick={handleAccept} disabled={!accepted || loading} size="sm" className="w-full">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</> : "Aceitar e Continuar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Lock, FileText, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface ConsentModalProps {
  open: boolean;
  onAccept: (consentData: ConsentData) => void;
  formTitle: string;
}

export interface ConsentData {
  accepted: boolean;
  term_version: string;
  consent_text: string;
  accepted_at: string;
  user_agent: string;
}

const CONSENT_VERSION = "v1.0";

const CONSENT_TEXT = `TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS

De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD), declaro que:

1. FINALIDADE DO TRATAMENTO
Os dados coletados neste formulário serão utilizados exclusivamente para:
- Análise ergonômica e de riscos psicossociais no ambiente de trabalho
- Elaboração de relatórios técnicos de ergonomia (AET)
- Identificação de fatores de risco ocupacional
- Proposição de melhorias nas condições de trabalho

2. DADOS COLETADOS
Serão coletados os seguintes dados:
- Nome completo (para controle de participação)
- Setor/Departamento de trabalho
- Cargo/Função exercida
- Tempo na empresa
- Respostas ao questionário de avaliação

3. TRATAMENTO E PROTEÇÃO
- Seus dados pessoais identificáveis (nome) NÃO serão expostos nos relatórios finais
- Os relatórios apresentam dados AGREGADOS por cargo/setor
- Suas respostas individuais são CONFIDENCIAIS
- Os dados são protegidos por criptografia e controles de acesso

4. RETENÇÃO E EXCLUSÃO
- Os dados serão mantidos pelo período de 5 anos (prazo legal para saúde ocupacional)
- Após este período, os dados pessoais serão automaticamente anonimizados
- Você pode solicitar a exclusão de seus dados a qualquer momento

5. SEUS DIREITOS (LGPD Art. 18)
Você tem direito a:
- Confirmar a existência de tratamento de dados
- Acessar seus dados
- Solicitar correção de dados incompletos ou inexatos
- Solicitar anonimização ou eliminação de dados
- Solicitar portabilidade dos dados
- Revogar este consentimento a qualquer momento

6. CONTROLADOR DOS DADOS
HC Consultoria - Ergonomia & Fisioterapia
Contato: contato@hcconsultoria.com.br

Ao marcar a opção abaixo e prosseguir, você declara que leu, compreendeu e concorda com este termo.`;

export function ConsentModal({ open, onAccept, formTitle }: ConsentModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = () => {
    if (!accepted) return;
    
    setLoading(true);
    
    const consentData: ConsentData = {
      accepted: true,
      term_version: CONSENT_VERSION,
      consent_text: CONSENT_TEXT,
      accepted_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
    };

    // Small delay for UX
    setTimeout(() => {
      onAccept(consentData);
      setLoading(false);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] bg-gradient-to-br from-slate-900 to-slate-950 border-slate-700">
        <DialogHeader className="space-y-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
          >
            <Shield className="h-10 w-10 text-emerald-400" />
          </motion.div>
          <DialogTitle className="text-2xl text-center text-white">
            Termo de Consentimento LGPD
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {formTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <Lock className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-xs text-emerald-300">Dados Protegidos</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
              <FileText className="h-5 w-5 text-blue-400 mx-auto mb-1" />
              <p className="text-xs text-blue-300">Relatórios Anônimos</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <AlertTriangle className="h-5 w-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xs text-amber-300">Lei 13.709/2018</p>
            </div>
          </div>

          {/* Consent Text */}
          <ScrollArea className="h-[300px] rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
              {CONSENT_TEXT}
            </pre>
          </ScrollArea>

          {/* Checkbox */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
            <Checkbox 
              id="consent" 
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
              className="mt-1 border-emerald-500 data-[state=checked]:bg-emerald-500"
            />
            <Label htmlFor="consent" className="text-sm text-slate-300 cursor-pointer leading-relaxed">
              Li, compreendi e concordo com o Termo de Consentimento acima. 
              Estou ciente de que meus dados serão processados para fins de análise 
              ergonômica e que posso revogar este consentimento a qualquer momento.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!accepted || loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
            size="lg"
          >
            {loading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Shield className="h-5 w-5" />
              </motion.div>
            ) : (
              <>
                <Shield className="h-5 w-5 mr-2" />
                Aceitar e Continuar
              </>
            )}
          </Button>
        </DialogFooter>

        <p className="text-xs text-center text-slate-500">
          Versão do Termo: {CONSENT_VERSION} • Seus dados estão protegidos conforme LGPD
        </p>
      </DialogContent>
    </Dialog>
  );
}

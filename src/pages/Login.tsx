import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield, Lock, Mail } from "lucide-react";
import logoHC from "@/assets/logo-hc-new.png";
import logoAmaggi from "@/assets/logo-amaggi.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, loading } = useAuthContext();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error("Erro ao entrar", { description: error.message });
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/dashboard");
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <img src={logoHC} alt="HC Logo" className="h-10 w-auto rounded-lg" />
            <span className="text-lg font-medium text-white/60">×</span>
            <img src={logoAmaggi} alt="Amaggi Logo" className="h-10 w-auto brightness-0 invert opacity-90" />
          </div>
          
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              HC Consultoria
              <br />
              <span className="text-gradient">Ergonomia & Fisioterapia</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md leading-relaxed">
              Sistema integrado para avaliação de riscos ergonômicos e psicossociais, 
              em conformidade com NR-01 e NR-17.
            </p>
            <div className="flex gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <div className="w-2 h-2 rounded-full bg-success" />
                HSE-IT
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <div className="w-2 h-2 rounded-full bg-accent" />
                ERGOS
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <div className="w-2 h-2 rounded-full bg-info" />
                IA Integrada
              </div>
            </div>
          </div>
          
          <p className="text-sm text-white/40">
            © {new Date().getFullYear()} HC Consultoria em Ergonomia e Fisioterapia
          </p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-4 mb-8">
            <img src={logoHC} alt="HC Logo" className="h-10 w-auto rounded-lg" />
            <span className="text-xl text-muted-foreground">×</span>
            <img src={logoAmaggi} alt="Amaggi Logo" className="h-10 w-auto" />
          </div>

          <div className="text-center lg:text-left">
            <div className="inline-flex lg:hidden w-14 h-14 rounded-2xl gradient-primary items-center justify-center mb-4 shadow-lg shadow-primary/25">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Bem-vindo de volta
            </h2>
            <p className="mt-2 text-muted-foreground">
              Faça login para acessar o sistema
            </p>
          </div>

          <Card className="border border-border/50 shadow-xl shadow-black/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Acesso ao Sistema</CardTitle>
              <CardDescription>
                Utilize suas credenciais corporativas
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full gradient-primary hover:opacity-90 h-11 text-base font-medium shadow-lg shadow-primary/25 transition-all duration-200"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </CardContent>
            </form>
          </Card>

          <div className="text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Acesso restrito a usuários autorizados.
              <br />
              Contate o administrador para solicitar acesso.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

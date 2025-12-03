import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  LogOut,
  Menu,
  X,
  BarChart3,
  Settings,
  Users,
  FileArchive,
  Building2,
  Shield,
  ChevronRight,
  Brain,
  ScrollText,
  Inbox,
} from "lucide-react";
import logoHC from "@/assets/logo-hc.jpg";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Formulários", href: "/forms", icon: <ClipboardList className="h-5 w-5" /> },
  { label: "Minhas Submissões", href: "/submissions", icon: <FileText className="h-5 w-5" /> },
  { label: "Relatórios", href: "/reports", icon: <BarChart3 className="h-5 w-5" />, adminOnly: true },
  { label: "Submissões (Admin)", href: "/admin/submissions", icon: <Inbox className="h-5 w-5" />, adminOnly: true },
  { label: "Organização", href: "/admin/organization", icon: <Building2 className="h-5 w-5" />, adminOnly: true },
  { label: "Gerenciar Forms", href: "/admin/forms", icon: <Settings className="h-5 w-5" />, adminOnly: true },
  { label: "Prompts IA", href: "/admin/prompts", icon: <Brain className="h-5 w-5" />, adminOnly: true },
  { label: "Geração em Massa", href: "/admin/bulk", icon: <FileArchive className="h-5 w-5" />, adminOnly: true },
  { label: "Usuários", href: "/admin/users", icon: <Users className="h-5 w-5" />, adminOnly: true },
  { label: "Logs do Sistema", href: "/admin/logs", icon: <ScrollText className="h-5 w-5" />, adminOnly: true },
  { label: "Config. Sistema", href: "/admin/settings", icon: <Shield className="h-5 w-5" />, adminOnly: true },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, signOut, isAdmin } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-lg border-b border-border/50 z-50 flex items-center justify-between px-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="hover:bg-primary/10">
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <img src={logoHC} alt="Logo" className="h-8 w-auto rounded-lg" />
          <span className="font-semibold text-sm">ERGOS AI</span>
        </div>
        <div className="w-10" />
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/30 backdrop-blur-sm z-50 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-72 gradient-dark z-50 transition-transform duration-300 shadow-2xl",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full text-white">
          {/* Logo Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src={logoHC} alt="Logo" className="h-9 w-auto rounded-lg" />
              <div>
                <span className="font-bold text-white text-base">ERGOS AI</span>
                <p className="text-[10px] text-white/50 -mt-0.5">Plataforma Ergonômica</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden hover:bg-white/10 text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="px-3 mb-3 text-[11px] uppercase tracking-wider text-white/40 font-medium">
              Menu Principal
            </p>
            {filteredNavItems.slice(0, 3).map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                  location.pathname === item.href
                    ? "bg-primary text-white shadow-lg shadow-primary/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <span className={cn(
                  "transition-transform duration-200",
                  location.pathname === item.href && "scale-110"
                )}>
                  {item.icon}
                </span>
                {item.label}
                {location.pathname === item.href && (
                  <ChevronRight className="h-4 w-4 ml-auto" />
                )}
              </Link>
            ))}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-3 text-[11px] uppercase tracking-wider text-white/40 font-medium">
                    Administração
                  </p>
                </div>
                {filteredNavItems.slice(3).map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
                      location.pathname === item.href
                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span className={cn(
                      "transition-transform duration-200",
                      location.pathname === item.href && "scale-110"
                    )}>
                      {item.icon}
                    </span>
                    {item.label}
                    {location.pathname === item.href && (
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    )}
                  </Link>
                ))}
              </>
            )}
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-white/10">
            <div className="mb-3 px-3 py-3 rounded-xl bg-white/5">
              <p className="text-sm font-medium text-white truncate">
                {profile?.full_name}
              </p>
              <p className="text-xs text-white/50 truncate">
                {profile?.email}
              </p>
              <span className={cn(
                "inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
                isAdmin 
                  ? "bg-primary/20 text-primary" 
                  : "bg-accent/20 text-accent"
              )}>
                <Shield className="h-3 w-3" />
                {isAdmin ? "Administrador" : "Colaborador"}
              </span>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sair do Sistema
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-72 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

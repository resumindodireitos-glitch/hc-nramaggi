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
  { label: "Organização", href: "/admin/organization", icon: <Building2 className="h-5 w-5" />, adminOnly: true },
  { label: "Gerenciar Forms", href: "/admin/forms", icon: <Settings className="h-5 w-5" />, adminOnly: true },
  { label: "Geração em Massa", href: "/admin/bulk", icon: <FileArchive className="h-5 w-5" />, adminOnly: true },
  { label: "Usuários", href: "/admin/users", icon: <Users className="h-5 w-5" />, adminOnly: true },
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
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center justify-between px-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-6 w-6" />
        </Button>
        <img src={logoHC} alt="Logo" className="h-8 w-auto rounded" />
        <div className="w-10" />
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/20 z-50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-card border-r z-50 transition-transform duration-300",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center justify-between px-4 border-b">
            <div className="flex items-center gap-3">
              <img src={logoHC} alt="Logo" className="h-8 w-auto rounded" />
              <span className="font-semibold text-foreground">HSE Portal</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.email}
              </p>
              <span className={cn(
                "inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium",
                isAdmin 
                  ? "bg-primary/10 text-primary" 
                  : "bg-accent/10 text-accent-foreground"
              )}>
                {isAdmin ? "Administrador" : "Colaborador"}
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

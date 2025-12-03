import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  SidebarLabel,
  useSidebar,
} from "@/components/ui/animated-sidebar";
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  LogOut,
  BarChart3,
  Settings,
  Users,
  FileArchive,
  Building2,
  Shield,
  Brain,
  ScrollText,
  Inbox,
  Activity,
} from "lucide-react";
import logoHC from "@/assets/logo-hc-new.png";
import { AppHeader } from "./AppHeader";

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
  { label: "Agentes de IA", href: "/admin/agents", icon: <Brain className="h-5 w-5" />, adminOnly: true },
  { label: "Uso de IA", href: "/admin/ai-usage", icon: <Activity className="h-5 w-5" />, adminOnly: true },
  { label: "Geração em Massa", href: "/admin/bulk", icon: <FileArchive className="h-5 w-5" />, adminOnly: true },
  { label: "Usuários", href: "/admin/users", icon: <Users className="h-5 w-5" />, adminOnly: true },
  { label: "Logs do Sistema", href: "/admin/logs", icon: <ScrollText className="h-5 w-5" />, adminOnly: true },
  { label: "Config. Sistema", href: "/admin/settings", icon: <Shield className="h-5 w-5" />, adminOnly: true },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut, isAdmin } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const { open, animate } = useSidebar();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <div className="flex flex-col h-full">
      {/* Logos */}
      <div className={cn(
        "flex flex-col gap-3 py-2 mb-4 flex-shrink-0",
        open ? "px-3" : "px-0 items-center"
      )}>
        {/* HC Logo */}
        <div className="flex items-center gap-3">
          <img src={logoHC} alt="HC Consultoria" className="h-9 w-9 rounded-lg flex-shrink-0" />
          <motion.div
            animate={{
              display: animate ? (open ? "block" : "none") : "block",
              opacity: animate ? (open ? 1 : 0) : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            <span className="font-bold text-sidebar-foreground text-base whitespace-nowrap">HC Consultoria</span>
            <p className="text-[10px] text-sidebar-foreground/50 -mt-0.5 whitespace-nowrap">Ergonomia & Fisioterapia</p>
          </motion.div>
        </div>
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll pr-1">
        <SidebarLabel>Menu Principal</SidebarLabel>
        {filteredNavItems.slice(0, 3).map((item) => (
          <SidebarLink
            key={item.href}
            link={item}
            active={location.pathname === item.href}
            onClick={onNavigate}
          />
        ))}

        {isAdmin && (
          <>
            {open && (
              <div className="pt-4 pb-2">
                <SidebarLabel>Administração</SidebarLabel>
              </div>
            )}
            {!open && <div className="pt-2" />}
            {filteredNavItems.slice(3).map((item) => (
              <SidebarLink
                key={item.href}
                link={item}
                active={location.pathname === item.href}
                onClick={onNavigate}
              />
            ))}
          </>
        )}
      </nav>

      {/* User Profile & Logout - Fixed at bottom */}
      <div className="flex-shrink-0 mt-4 border-t border-sidebar-border pt-4">
        <motion.div
          animate={{
            display: animate ? (open ? "block" : "none") : "block",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          transition={{ duration: 0.2 }}
          className="mb-3 px-3 py-3 rounded-xl bg-sidebar-accent/50"
        >
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {profile?.full_name}
          </p>
          <p className="text-xs text-sidebar-foreground/50 truncate">
            {profile?.email}
          </p>
          <span className={cn(
            "inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
            isAdmin 
              ? "bg-primary/20 text-primary" 
              : "bg-accent/20 text-accent-foreground"
          )}>
            <Shield className="h-3 w-3" />
            {isAdmin ? "Administrador" : "Colaborador"}
          </span>
        </motion.div>
        <Button
          variant="ghost"
          className={cn(
            "w-full gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            open ? "justify-start px-3" : "justify-center px-2"
          )}
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <motion.span
            animate={{
              display: animate ? (open ? "inline-block" : "none") : "inline-block",
              opacity: animate ? (open ? 1 : 0) : 1,
            }}
            transition={{ duration: 0.2 }}
          >
            Sair do Sistema
          </motion.span>
        </Button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-screen flex w-full bg-background overflow-hidden">
      {/* Sidebar - Fixed height, own scroll */}
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="gradient-dark border-r border-sidebar-border h-screen sticky top-0">
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SidebarBody>
      </Sidebar>

      {/* Main content - Full height with own scroll */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-8 max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

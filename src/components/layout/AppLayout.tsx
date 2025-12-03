import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
  useSidebar,
} from "@/components/ui/animated-sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  AlertTriangle,
  PieChart,
  Clock,
  ChevronRight,
  Database,
  Cog,
  Bot,
  FolderOpen,
} from "lucide-react";
import logoHC from "@/assets/logo-hc-new.png";
import { AppHeader } from "./AppHeader";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
  adminOnly?: boolean;
}

const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "Visão Geral",
    icon: <LayoutDashboard className="h-4 w-4" />,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    ],
  },
  {
    id: "data",
    label: "Coleta de Dados",
    icon: <ClipboardList className="h-4 w-4" />,
    items: [
      { label: "Formulários", href: "/forms", icon: <ClipboardList className="h-5 w-5" /> },
      { label: "Minhas Submissões", href: "/submissions", icon: <FileText className="h-5 w-5" /> },
    ],
  },
  {
    id: "analysis",
    label: "Análise",
    icon: <BarChart3 className="h-4 w-4" />,
    adminOnly: true,
    items: [
      { label: "Relatórios", href: "/reports", icon: <BarChart3 className="h-5 w-5" /> },
      { label: "Agregados", href: "/admin/aggregated-reports", icon: <PieChart className="h-5 w-5" /> },
      { label: "Matriz de Riscos", href: "/admin/risk-matrix", icon: <AlertTriangle className="h-5 w-5" /> },
    ],
  },
  {
    id: "management",
    label: "Gestão",
    icon: <FolderOpen className="h-4 w-4" />,
    adminOnly: true,
    items: [
      { label: "Submissões", href: "/admin/submissions", icon: <Inbox className="h-5 w-5" /> },
      { label: "Organização", href: "/admin/organization", icon: <Building2 className="h-5 w-5" /> },
      { label: "Usuários", href: "/admin/users", icon: <Users className="h-5 w-5" /> },
      { label: "Geração em Massa", href: "/admin/bulk", icon: <FileArchive className="h-5 w-5" /> },
    ],
  },
  {
    id: "ai",
    label: "IA & Automação",
    icon: <Bot className="h-4 w-4" />,
    adminOnly: true,
    items: [
      { label: "Agentes de IA", href: "/admin/agents", icon: <Brain className="h-5 w-5" /> },
      { label: "Uso de IA", href: "/admin/ai-usage", icon: <Activity className="h-5 w-5" /> },
    ],
  },
  {
    id: "config",
    label: "Configuração",
    icon: <Cog className="h-4 w-4" />,
    adminOnly: true,
    items: [
      { label: "Gerenciar Forms", href: "/admin/forms", icon: <Settings className="h-5 w-5" /> },
      { label: "Webhooks", href: "/admin/webhooks", icon: <Activity className="h-5 w-5" /> },
      { label: "Config. Sistema", href: "/admin/settings", icon: <Settings className="h-5 w-5" /> },
    ],
  },
  {
    id: "system",
    label: "Sistema",
    icon: <Database className="h-4 w-4" />,
    adminOnly: true,
    items: [
      { label: "Logs", href: "/admin/logs", icon: <ScrollText className="h-5 w-5" /> },
      { label: "Tarefas Agendadas", href: "/admin/cron-jobs", icon: <Clock className="h-5 w-5" /> },
      { label: "LGPD & Privacidade", href: "/admin/lgpd", icon: <Shield className="h-5 w-5" /> },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, signOut, isAdmin } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const { open, animate } = useSidebar();

  // Track which groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("sidebar-expanded-groups");
    return saved ? JSON.parse(saved) : { overview: true, data: true };
  });

  // Auto-expand group containing current route
  useEffect(() => {
    const currentGroup = navGroups.find(group => 
      group.items.some(item => location.pathname === item.href)
    );
    if (currentGroup && !expandedGroups[currentGroup.id]) {
      setExpandedGroups(prev => ({ ...prev, [currentGroup.id]: true }));
    }
  }, [location.pathname]);

  // Save expanded state
  useEffect(() => {
    localStorage.setItem("sidebar-expanded-groups", JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const filteredGroups = navGroups.filter(
    (group) => !group.adminOnly || isAdmin
  );

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        "flex flex-col gap-3 py-2 mb-4 flex-shrink-0",
        open ? "px-3" : "px-0 items-center"
      )}>
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

      {/* Navigation - Scrollable with Collapsible Groups */}
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scroll pr-1">
        {filteredGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={expandedGroups[group.id]}
            onOpenChange={() => toggleGroup(group.id)}
          >
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                  open ? "justify-between" : "justify-center"
                )}
              >
                <div className="flex items-center gap-2">
                  {group.icon}
                  <motion.span
                    animate={{
                      display: animate ? (open ? "inline" : "none") : "inline",
                      opacity: animate ? (open ? 1 : 0) : 1,
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {group.label}
                  </motion.span>
                </div>
                <motion.div
                  animate={{
                    display: animate ? (open ? "block" : "none") : "block",
                    opacity: animate ? (open ? 1 : 0) : 1,
                    rotate: expandedGroups[group.id] ? 90 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronRight className="h-4 w-4" />
                </motion.div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {group.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  link={item}
                  active={location.pathname === item.href}
                  onClick={onNavigate}
                />
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
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

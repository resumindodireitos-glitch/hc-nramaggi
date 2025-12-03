import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, User, Settings, LogOut, Shield, Check, 
  Info, AlertTriangle, CheckCircle, XCircle,
  FileText, Brain, ChevronRight, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface AIUsageStats {
  totalTokens: number;
  monthlyLimit: number;
  dailyTokens: number;
  dailyLimit: number | null;
}

export function AppHeader() {
  const { profile, signOut, isAdmin, isSuperAdmin } = useAuthContext();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [aiUsage, setAIUsage] = useState<AIUsageStats>({
    totalTokens: 0,
    monthlyLimit: 1000000,
    dailyTokens: 0,
    dailyLimit: null,
  });

  useEffect(() => {
    fetchNotifications();
    if (isAdmin) {
      fetchAIUsage();
    }
  }, [isAdmin]);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications((data as Notification[]) || []);
      setUnreadCount(data?.filter((n: any) => !n.is_read).length || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const fetchAIUsage = async () => {
    try {
      // Get current month usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: monthlyData } = await supabase
        .from("ai_usage")
        .select("total_tokens")
        .gte("created_at", startOfMonth.toISOString());

      const { data: dailyData } = await supabase
        .from("ai_usage")
        .select("total_tokens")
        .gte("created_at", startOfDay.toISOString());

      const { data: limits } = await supabase
        .from("ai_usage_limits")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      const totalTokens = monthlyData?.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0;
      const dailyTokens = dailyData?.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0;

      setAIUsage({
        totalTokens,
        monthlyLimit: limits?.monthly_token_limit || 1000000,
        dailyTokens,
        dailyLimit: limits?.daily_token_limit || null,
      });
    } catch (error) {
      console.error("Error fetching AI usage:", error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("is_read", false);
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "report": return <FileText className="h-3 w-3" />;
      case "ai": return <Brain className="h-3 w-3" />;
      default: return <Info className="h-3 w-3" />;
    }
  };

  const usagePercentage = (aiUsage.totalTokens / aiUsage.monthlyLimit) * 100;
  const dailyPercentage = aiUsage.dailyLimit 
    ? (aiUsage.dailyTokens / aiUsage.dailyLimit) * 100 
    : 0;

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-end gap-3 px-4 lg:px-6">
        {/* AI Usage Indicator (Admin only) */}
        {isAdmin && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground leading-none">Uso IA</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      usagePercentage > 90 ? "bg-red-500" : 
                      usagePercentage > 70 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium">
                  {Math.round(usagePercentage)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <AnimatePresence>
                {unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-popover border border-border shadow-lg">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notificações</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 text-xs"
                  onClick={markAllAsRead}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Marcar todas lidas
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="h-[300px]">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "px-3 py-2.5 border-b border-border/50 cursor-pointer hover:bg-muted/50 transition-colors",
                      !notification.is_read && "bg-primary/5"
                    )}
                    onClick={() => {
                      markAsRead(notification.id);
                      if (notification.link) navigate(notification.link);
                    }}
                  >
                    <div className="flex items-start gap-2.5">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="h-4 text-[10px] px-1.5">
                            {getCategoryIcon(notification.category)}
                            <span className="ml-1">{notification.category}</span>
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </div>
                      {notification.link && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="justify-center text-primary"
              onClick={() => navigate("/updates")}
            >
              Ver atualizações do sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9 border-2 border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-lg">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {profile?.email}
                </p>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "w-fit mt-2 text-[10px]",
                    isSuperAdmin ? "border-amber-500/50 text-amber-600 bg-amber-500/10" :
                    isAdmin ? "border-primary/50 text-primary bg-primary/10" :
                    "border-muted"
                  )}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Colaborador"}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair do Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

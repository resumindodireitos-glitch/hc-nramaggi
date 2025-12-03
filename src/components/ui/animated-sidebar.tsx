"use client";

import { cn } from "@/lib/utils";
import { Link, LinkProps } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

interface SidebarBodyProps {
  className?: string;
  children: React.ReactNode;
}

export const SidebarBody = ({
  className,
  children,
}: SidebarBodyProps) => {
  return (
    <>
      <DesktopSidebar className={className}>
        {children}
      </DesktopSidebar>
      <MobileSidebar className={className}>
        {children}
      </MobileSidebar>
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  const { open, setOpen, animate } = useSidebar();
  
  return (
    <motion.div
      className={cn(
        "h-screen py-4 hidden md:flex md:flex-col flex-shrink-0 sticky top-0 relative",
        open ? "px-4" : "px-2",
        className
      )}
      animate={{
        width: animate ? (open ? "280px" : "60px") : "280px",
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
      
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "absolute -right-3 top-1/2 -translate-y-1/2 z-50",
          "w-6 h-6 rounded-full bg-primary text-primary-foreground",
          "flex items-center justify-center shadow-lg",
          "hover:bg-primary/90 transition-colors",
          "border-2 border-background"
        )}
        aria-label={open ? "Recolher sidebar" : "Expandir sidebar"}
      >
        {open ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-16 px-4 py-4 flex flex-row md:hidden items-center justify-between w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-foreground cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 p-6 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-6 top-6 z-50 cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X className="h-6 w-6" />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  active,
  onClick,
  ...props
}: {
  link: Links;
  className?: string;
  active?: boolean;
  onClick?: () => void;
} & Omit<LinkProps, 'to'>) => {
  const { open, animate } = useSidebar();
  
  const linkContent = (
    <Link
      to={link.href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 group/sidebar py-2.5 rounded-xl relative overflow-hidden",
        "transition-all duration-300 ease-out",
        open ? "justify-start px-3" : "justify-center px-2",
        active 
          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30" 
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
        className
      )}
      {...props}
    >
      {/* Hover background effect */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-xl bg-sidebar-accent opacity-0 group-hover/sidebar:opacity-100",
          "transition-opacity duration-300 ease-out",
          active && "hidden"
        )}
        initial={false}
      />
      
      {/* Glow effect on hover */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-xl opacity-0 group-hover/sidebar:opacity-100",
          "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent",
          "transition-opacity duration-500 ease-out",
          active && "hidden"
        )}
        initial={false}
      />
      
      {/* Icon with animation */}
      <motion.span 
        className={cn(
          "flex-shrink-0 relative z-10",
          "transition-all duration-300 ease-out",
          active && "scale-110"
        )}
        whileHover={{ scale: active ? 1.1 : 1.15, rotate: active ? 0 : 3 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {link.icon}
      </motion.span>
      
      {/* Label with slide animation */}
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.2 }}
        className={cn(
          "text-sm font-medium relative z-10 whitespace-pre inline-block !p-0 !m-0",
          "transition-transform duration-300 ease-out",
          "group-hover/sidebar:translate-x-1"
        )}
      >
        {link.label}
      </motion.span>
    </Link>
  );

  // Show tooltip only when sidebar is collapsed
  if (!open && animate) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent 
            side="right" 
            sideOffset={12}
            className="z-[9999] bg-popover backdrop-blur-sm border-border shadow-lg shadow-black/20 animate-scale-in"
          >
            <p className="font-medium">{link.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return linkContent;
};

export const SidebarLabel = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const { open, animate } = useSidebar();
  
  // Don't render anything when sidebar is collapsed
  if (animate && !open) return null;
  
  return (
    <motion.p
      animate={{
        opacity: animate ? (open ? 1 : 0) : 1,
      }}
      transition={{ duration: 0.2 }}
      className={cn(
        "px-3 mb-3 text-[11px] uppercase tracking-wider text-sidebar-foreground/40 font-medium",
        className
      )}
    >
      {children}
    </motion.p>
  );
};

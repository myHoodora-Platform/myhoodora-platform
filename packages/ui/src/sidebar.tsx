"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  forwardRef,
} from "react";
import { cn } from "./utils";
import { Menu, PanelLeft } from "lucide-react";

const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 1 week
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "4rem";

interface SidebarContextType {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export const SidebarProvider = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const [isMobile, setIsMobile] = useState(false);
    const [openMobile, setOpenMobile] = useState(false);

    // Internal open state, synced with openProp if provided
    const [_open, _setOpen] = useState(defaultOpen);
    const open = openProp !== undefined ? openProp : _open;

    const setOpen = useCallback(
      (value: boolean) => {
        if (openProp === undefined) {
          _setOpen(value);
        }
        onOpenChange?.(value);

        // Store in cookie for session persistence
        if (typeof document !== "undefined") {
          document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
        }
      },
      [openProp, onOpenChange],
    );

    const toggleSidebar = useCallback(() => {
      if (isMobile) {
        setOpenMobile((prev) => !prev);
      } else {
        setOpen(!open);
      }
    }, [isMobile, open, setOpen]);

    // Handle viewport resize breakpoint
    useEffect(() => {
      const handleResize = () => {
        const mobile = window.innerWidth < 1024; // lg breakpoint
        setIsMobile(mobile);
        if (!mobile) {
          setOpenMobile(false);
        }
      };

      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    const state = open ? "expanded" : "collapsed";

    return (
      <SidebarContext.Provider
        value={{
          state,
          open,
          setOpen,
          openMobile,
          setOpenMobile,
          isMobile,
          toggleSidebar,
        }}
      >
        <div
          ref={ref}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "flex min-h-screen w-full text-slate-800 bg-slate-50 font-sans",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    );
  },
);
SidebarProvider.displayName = "SidebarProvider";

export const Sidebar = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
  }
>(({ side = "left", className, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  // Mobile View Overlay and Drawer
  if (isMobile) {
    return (
      <>
        {/* Backdrop Blur Overlay */}
        <div
          className={cn(
            "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300",
            openMobile
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none",
          )}
          onClick={() => setOpenMobile(false)}
        />
        {/* Drawer Body */}
        <aside
          ref={ref}
          style={{ width: SIDEBAR_WIDTH_MOBILE }}
          className={cn(
            "fixed bottom-0 top-0 z-50 flex h-full flex-col bg-white border-r border-slate-100 shadow-xl transition-transform duration-300 ease-in-out",
            side === "left" ? "left-0" : "right-0",
            openMobile
              ? "translate-x-0"
              : side === "left"
                ? "-translate-x-full"
                : "translate-x-full",
            className,
          )}
          {...props}
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </aside>
      </>
    );
  }

  // Desktop View
  return (
    <div
      className="group peer hidden lg:block"
      style={{
        width: state === "expanded" ? SIDEBAR_WIDTH : SIDEBAR_WIDTH_ICON,
        transition: "width 0.3s ease-in-out",
      }}
    >
      <aside
        ref={ref}
        className={cn(
          "fixed bottom-0 top-0 z-20 flex h-full flex-col bg-white border-r border-slate-100 transition-[width] duration-300 ease-in-out",
          side === "left" ? "left-0" : "right-0",
          state === "expanded"
            ? "w-[var(--sidebar-width)]"
            : "w-[var(--sidebar-width-icon)]",
          className,
        )}
        {...props}
      >
        <div className="flex h-full w-full flex-col">{children}</div>
      </aside>
    </div>
  );
});
Sidebar.displayName = "Sidebar";

export const SidebarTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <button
      ref={ref}
      data-sidebar="trigger"
      className={cn(
        "inline-flex items-center justify-center rounded-lg p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      {isMobile ? (
        <Menu className="size-5" />
      ) : (
        <PanelLeft className="size-5" />
      )}
      <span className="sr-only">Toggle Sidebar</span>
    </button>
  );
});
SidebarTrigger.displayName = "SidebarTrigger";

export const SidebarHeader = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="header"
    className={cn("flex flex-col p-4 border-b border-slate-100", className)}
    {...props}
  />
));
SidebarHeader.displayName = "SidebarHeader";

export const SidebarContent = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="content"
    className={cn(
      "flex flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden p-3",
      className,
    )}
    {...props}
  />
));
SidebarContent.displayName = "SidebarContent";

export const SidebarFooter = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="footer"
    className={cn(
      "flex flex-col p-4 border-t border-slate-100 mt-auto",
      className,
    )}
    {...props}
  />
));
SidebarFooter.displayName = "SidebarFooter";

export const SidebarGroup = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group"
    className={cn("flex flex-col gap-2 w-full", className)}
    {...props}
  />
));
SidebarGroup.displayName = "SidebarGroup";

export const SidebarGroupLabel = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  const { state } = useSidebar();
  if (state === "collapsed") return null;

  return (
    <div
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 select-none",
        className,
      )}
      {...props}
    />
  );
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

export const SidebarGroupContent = forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("flex flex-col gap-1 w-full", className)}
    {...props}
  />
));
SidebarGroupContent.displayName = "SidebarGroupContent";

export const SidebarMenu = forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex flex-col gap-1 w-full list-none p-0 m-0", className)}
    {...props}
  />
));
SidebarMenu.displayName = "SidebarMenu";

export const SidebarMenuItem = forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("w-full list-none p-0 m-0 relative", className)}
    {...props}
  />
));
SidebarMenuItem.displayName = "SidebarMenuItem";

export const SidebarMenuButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    isActive?: boolean;
    tooltip?: string;
  }
>(({ className, isActive, tooltip, children, ...props }, ref) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <button
      ref={ref}
      data-sidebar="menu-button"
      data-active={isActive}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary transition-all duration-200 outline-none select-none text-left relative",
        isActive && "bg-primary/5 text-primary hover:bg-primary/5",
        isCollapsed ? "justify-center px-0 py-3" : "justify-start",
        className,
      )}
      title={isCollapsed ? tooltip : undefined}
      {...props}
    >
      {children}
    </button>
  );
});
SidebarMenuButton.displayName = "SidebarMenuButton";

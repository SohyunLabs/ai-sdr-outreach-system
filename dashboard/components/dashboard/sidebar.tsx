"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { BookOpen, BarChart2, User, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SidebarPage = "guide" | "campaign-analysis" | "profile-analysis" | "knowledge-base";

interface SidebarProps {
  activePage: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
}

const navItems: { id: SidebarPage; label: string; icon: React.ElementType }[] = [
  { id: "guide", label: "Guide", icon: BookOpen },
  { id: "campaign-analysis", label: "Campaign Analysis", icon: BarChart2 },
  { id: "profile-analysis", label: "Profile Analysis", icon: User },
  { id: "knowledge-base", label: "Knowledge Base", icon: Database },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        {!collapsed ? (
          <>
            <Image
              src="/logo-black.svg"
              alt="AI SDR"
              width={100}
              height={26}
              className="block dark:hidden"
              priority
            />
            <Image
              src="/logo-white.svg"
              alt="AI SDR"
              width={100}
              height={26}
              className="hidden dark:block"
              priority
            />
          </>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M5.84 6.75C5.84 6.75 6.04 5.80 6.36 4.28C6.68 2.77 7.32 2.50 8.87 2.50H16.57L17.09 0H6.87C4.95 0 3.68 1.53 3.43 2.71C3.25 3.56 0 19.16 0 19.16H3.26L5.32 9.28H10.87L11.40 6.75H5.84Z"
                fill="currentColor"
                className="text-primary-foreground"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer",
              activePage === id
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom: collapse/expand toggle */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}

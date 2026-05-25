"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface HeaderProps {
  title: string;
  subtitle?: string;
  back?: React.ReactNode;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, back, actions }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        {back}
        <div className="flex flex-col gap-0.5">
          <p className="text-lg font-semibold leading-none">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground leading-none">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src={session?.user?.image ?? ""} alt={session?.user?.name ?? "User"} />
              <AvatarFallback>{session?.user?.name?.charAt(0).toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

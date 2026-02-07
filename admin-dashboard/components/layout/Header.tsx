"use client";

import { Bell, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
  onSignOut: () => void;
}

export function Header({ user, onSignOut }: HeaderProps) {
  const userInitials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "AD";

  return (
    <header className="sticky top-0 z-50 bg-[#F8F8FA]/80 backdrop-blur-md shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex flex-1 items-center gap-4 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="search"
              placeholder="Search..."
              className="w-full rounded-xl border-0 bg-white/80 py-2 pl-10 pr-4 text-sm text-[#1F2937] placeholder:text-[#9CA3AF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-[#6B7280] hover:bg-white/80 hover:text-[#1F2937]">
            <Bell className="h-5 w-5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/80">
                <div className="text-right text-sm hidden sm:block">
                  <p className="font-medium text-[#1F2937]">{user?.name || "Admin"}</p>
                  <p className="text-xs text-[#6B7280]">{user?.email}</p>
                </div>
                <Avatar className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white">
                  <AvatarFallback className="bg-transparent text-sm font-medium">{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl border-0 bg-[#F8F8FA] shadow-lg">
              <DropdownMenuLabel className="text-[#6B7280]">Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#E5E7EB]" />
              <DropdownMenuItem onClick={onSignOut} className="text-[#DC2626] focus:bg-white/80">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

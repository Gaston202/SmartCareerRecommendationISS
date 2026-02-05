"use client";

import { Bell, Search, Settings } from "lucide-react";

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
  };
  onSignOut: () => void;
}

export function Header({ user, onSignOut }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search..."
              className="w-full rounded-lg border border-border/50 bg-white/50 py-2 pl-10 pr-4 text-sm transition-all focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="rounded-lg p-2 transition-colors hover:bg-purple-50 hover:text-purple-600">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="rounded-lg p-2 transition-colors hover:bg-purple-50 hover:text-purple-600">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="font-semibold text-foreground">{user?.name || "Admin User"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <button
              onClick={onSignOut}
              className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition-all hover:shadow-xl hover:scale-105"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search..."
              className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="rounded-md p-2 hover:bg-muted">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </button>
          <button className="rounded-md p-2 hover:bg-muted">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <p className="font-medium">{user?.name || "Admin User"}</p>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
            <button
              onClick={onSignOut}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

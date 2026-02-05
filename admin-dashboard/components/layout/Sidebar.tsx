"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  BookOpen,
  Award,
  TrendingUp,
  BarChart3,
} from "lucide-react";

const menuItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/skills", label: "Skills", icon: Award },
  { href: "/admin/careers", label: "Careers", icon: Briefcase },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/recommendations", label: "Recommendations", icon: TrendingUp },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border/50 bg-gradient-to-b from-white to-purple-50/30 backdrop-blur-sm">
      <div className="flex h-16 items-center border-b border-border/50 px-6 bg-gradient-to-r from-purple-600 to-pink-500">
        <h1 className="text-xl font-bold text-white">Smart Career</h1>
      </div>
      <nav className="space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/30 scale-105"
                  : "text-muted-foreground hover:bg-purple-50 hover:text-purple-700 hover:scale-105"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

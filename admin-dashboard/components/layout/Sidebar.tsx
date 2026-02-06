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
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <aside className="w-64 border-r bg-card">
      {/* Logo Header */}
      <div className="flex h-16 items-center gap-2 border-b px-6 bg-primary">
        <GraduationCap className="h-6 w-6 text-primary-foreground" />
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-primary-foreground leading-tight">Smart Career</h1>
          <p className="text-[10px] text-primary-foreground/80 leading-tight">Admin Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5"
              )}
            >
              <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

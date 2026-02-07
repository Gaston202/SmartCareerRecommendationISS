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
    <aside className="w-80 shrink-0 bg-[#F8F8FA]/95 shadow-[2px_0_20px_-4px_rgba(0,0,0,0.08)]">
      <div className="flex h-16 items-center gap-3 px-6 bg-gradient-to-br from-[#DDD6FE] via-[#C4B5FD] to-[#A5B4FC]">
        <GraduationCap className="h-6 w-6 text-[#5B21B6]" />
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-[#5B21B6] leading-tight">Smart Career</h1>
          <p className="text-[10px] text-[#6D28D9]/80 leading-tight">Admin</p>
        </div>
      </div>
      <nav className="space-y-0.5 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#C4B5FD]/70 text-[#5B21B6] shadow-sm border-l-4 border-[#38BDF8]"
                  : "text-[#6B7280] hover:bg-white/70 hover:text-[#1F2937]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  className?: string;
  accentColor?: "violet" | "teal" | "blue" | "orange";
}

const accentBg: Record<string, string> = {
  violet: "from-[#8B5CF6]/15 to-[#9C66FF]/5",
  teal: "from-[#2DD4BF]/15 to-[#5EEAD4]/5",
  blue: "from-[#38BDF8]/15 to-[#0EA5E9]/5",
  orange: "from-[#FBBF24]/15 to-[#F59E0B]/5",
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  accentColor = "violet",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[#F8F8FA]/95 p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] backdrop-blur-sm",
        "bg-gradient-to-br",
        accentBg[accentColor],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#6B7280]">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#1F2937]">{value}</p>
          {(description || trend != null) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {description && <span className="text-[#6B7280]">{description}</span>}
              {trend != null && (
                <span className={cn("font-medium", trend.isPositive ? "text-emerald-600" : "text-red-500")}>
                  {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
                </span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl bg-[#F8F8FA]/95 p-12 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      {Icon && (
        <div className="rounded-2xl bg-white/80 p-5 mb-4">
          <Icon className="h-10 w-10 text-[#8B5CF6]" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-[#1F2937] mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-[#6B7280] mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          size="sm"
          className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-sm hover:opacity-90"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

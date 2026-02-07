import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = "Loading...", className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl bg-[#F8F8FA]/95 p-16 text-center shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      <Loader2 className="h-10 w-10 animate-spin text-[#8B5CF6] mb-4" />
      <p className="text-sm text-[#6B7280] font-medium animate-pulse">{message}</p>
    </div>
  );
}

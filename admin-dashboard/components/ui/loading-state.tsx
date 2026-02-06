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
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-16 text-center",
        className
      )}
    >
      <div className="relative mb-4">
        <div className="h-12 w-12 rounded-full border-4 border-primary/20"></div>
        <Loader2 className="absolute top-0 h-12 w-12 animate-spin text-primary" />
      </div>
      <p className="text-sm text-muted-foreground font-medium animate-pulse">{message}</p>
    </div>
  );
}

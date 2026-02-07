declare module "sonner" {
  interface Toast {
    (message: string, options?: Record<string, unknown>): void;
    success: (message: string, options?: Record<string, unknown>) => void;
    error: (message: string, options?: Record<string, unknown>) => void;
  }
  export const toast: Toast;
  export const Toaster: React.ComponentType<Record<string, unknown>>;
}

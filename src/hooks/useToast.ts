import { useState, useRef, useCallback, useEffect } from "react";

interface ToastState {
  message: string;
  tone: "warn" | "info";
}

interface UseToastReturn {
  toast: ToastState | null;
  showToast: (message: string, tone?: "warn" | "info") => void;
}

export function useToast(): UseToastReturn {
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, tone: "warn" | "info" = "warn") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, tone });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return { toast, showToast };
}

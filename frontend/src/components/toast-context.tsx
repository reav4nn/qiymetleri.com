"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export type ToastMessage = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastContextType = {
  toast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-5 ${
              t.type === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
                : t.type === "error"
                ? "border-red-200 bg-red-50/95 text-red-950"
                : "border-zinc-200 bg-zinc-900/95 text-white"
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-semibold">
              {t.type === "success" && (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              )}
              {t.type === "error" && (
                <AlertCircle className="size-5 shrink-0 text-red-600" />
              )}
              {t.type === "info" && (
                <Info className="size-5 shrink-0 text-blue-400" />
              )}
              <span>{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-black/10 hover:text-zinc-700 cursor-pointer transition-colors"
              aria-label="Bağla"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toast: (msg: string) => console.log(msg),
    };
  }
  return context;
}

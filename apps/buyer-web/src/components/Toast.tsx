"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  action?: ToastAction;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: { duration?: number; action?: ToastAction }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", options?: { duration?: number; action?: ToastAction }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const duration = options?.duration ?? 4000;
      setToasts((prev) => [...prev, { id, type, message, duration, action: options?.action }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return "✓";
      case "error":
        return "✕";
      case "warning":
        return "⚠";
      case "info":
        return "ℹ";
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/20 text-green-400";
      case "error":
        return "bg-red-500/10 border-red-500/20 text-red-400";
      case "warning":
        return "toast-warning";
      case "info":
        return "bg-primary/10 border-primary/20 text-primary";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3" style={{ maxWidth: "400px" }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-lg border animate-fade-in ${getStyles(
              toast.type
            )}`}
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              background:
                toast.type === "warning"
                  ? "rgba(255, 200, 0, 0.08)"
                  : undefined,
              borderColor:
                toast.type === "warning"
                  ? "rgba(255, 200, 0, 0.2)"
                  : undefined,
              color:
                toast.type === "warning" ? "#ffc800" : undefined,
            }}
          >
            <span className="text-lg flex-shrink-0">{getIcon(toast.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">{toast.message}</p>
              {toast.action && (
                <div className="mt-2">
                  {toast.action.href ? (
                    <a
                      href={toast.action.href}
                      className="text-xs font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity underline"
                    >
                      {toast.action.label}
                    </a>
                  ) : (
                    <button
                      onClick={() => {
                        toast.action?.onClick?.();
                        removeToast(toast.id);
                      }}
                      className="text-xs font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity underline"
                    >
                      {toast.action.label}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

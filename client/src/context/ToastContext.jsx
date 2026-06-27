import { createContext, useContext } from 'react';
import { toast as sonner } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const ToastContext = createContext(null);

const toastApi = {
  success: (msg) => sonner.success(msg),
  error: (msg) => sonner.error(msg),
  info: (msg) => sonner.message(msg),
};

export function ToastProvider({ children }) {
  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <Toaster richColors position="bottom-right" />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

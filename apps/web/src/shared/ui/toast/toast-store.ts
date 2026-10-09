import { create } from 'zustand';

export type ToastTone = 'info' | 'error';
export type Toast = { id: number; tone: ToastTone; title: string; details: readonly string[] };

type ToastState = {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
};

/** At most three toasts stay on screen; a fourth pushes the oldest out. */
const MAX_TOASTS = 3;
let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (toast) =>
    set((state) => ({ toasts: [...state.toasts.slice(1 - MAX_TOASTS), { ...toast, id: nextId++ }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Shows a short message; works from anywhere, components or not. */
export const toast = {
  info: (title: string, details: readonly string[] = []): void =>
    useToastStore.getState().push({ tone: 'info', title, details }),
  error: (title: string, details: readonly string[] = []): void =>
    useToastStore.getState().push({ tone: 'error', title, details }),
};

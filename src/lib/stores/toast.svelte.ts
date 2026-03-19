export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
	id: number;
	message: string;
	type: ToastType;
	duration: number;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
	success: 3000,
	error: 5000,
	info: 4000,
	warning: 4000,
};

const MAX_TOASTS = 5;
let nextId = 0;
let toasts = $state<Toast[]>([]);

export function getToasts(): Toast[] {
	return toasts;
}

export function addToast(message: string, type: ToastType = "info", duration?: number): void {
	const id = nextId++;
	const toast: Toast = { id, message, type, duration: duration ?? DEFAULT_DURATIONS[type] };

	toasts = [...toasts, toast].slice(-MAX_TOASTS);

	if (toast.duration > 0) {
		setTimeout(() => dismissToast(id), toast.duration);
	}
}

export function dismissToast(id: number): void {
	toasts = toasts.filter((t) => t.id !== id);
}

export function dismissLatest(): void {
	if (toasts.length > 0) {
		toasts = toasts.slice(0, -1);
	}
}

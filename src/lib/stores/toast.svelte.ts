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
const timerMap = new Map<number, ReturnType<typeof setTimeout>>();

export function getToasts(): Toast[] {
	return toasts;
}

export function addToast(message: string, type: ToastType = "info", duration?: number): void {
	const id = nextId++;
	const toast: Toast = { id, message, type, duration: duration ?? DEFAULT_DURATIONS[type] };

	const newToasts = [...toasts, toast];
	// Cancel timers for evicted toasts
	if (newToasts.length > MAX_TOASTS) {
		for (const evicted of newToasts.slice(0, newToasts.length - MAX_TOASTS)) {
			const t = timerMap.get(evicted.id);
			if (t) {
				clearTimeout(t);
				timerMap.delete(evicted.id);
			}
		}
	}
	toasts = newToasts.slice(-MAX_TOASTS);

	if (toast.duration > 0) {
		timerMap.set(
			id,
			setTimeout(() => dismissToast(id), toast.duration),
		);
	}
}

export function dismissToast(id: number): void {
	const t = timerMap.get(id);
	if (t) {
		clearTimeout(t);
		timerMap.delete(id);
	}
	toasts = toasts.filter((t) => t.id !== id);
}

export function dismissLatest(): void {
	if (toasts.length > 0) {
		toasts = toasts.slice(0, -1);
	}
}

// src/components/Layout/ToastNotifications.tsx
import React, {
	useState,
	useCallback,
	createContext,
	useContext,
	ReactNode,
} from "react";
// CSS wird global importiert, z.B. in App.css über @import "../style/Layout/ToastNotifications.css";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
	id: number;
	message: string;
	type: ToastType;
	duration?: number;
}

interface ToastContextType {
	addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
};

interface ToastProviderProps {
	children: ReactNode;
}

let toastIdCounter = 0;

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
	const [toasts, setToasts] = useState<ToastMessage[]>([]);

	const addToast = useCallback(
		(message: string, type: ToastType = "info", duration: number = 5000) => {
			const id = toastIdCounter++;
			setToasts((prevToasts) => [
				{ id, message, type, duration },
				...prevToasts,
			]); // Neue Toasts oben anzeigen

			if (duration > 0) {
				// Nur Timeout setzen, wenn duration > 0
				setTimeout(() => {
					removeToast(id);
				}, duration);
			}
		},
		[]
	);

	const removeToast = (id: number) => {
		setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
	};

	return (
		<ToastContext.Provider value={{ addToast }}>
			{children}
			<div className="toast-container" aria-live="polite" aria-atomic="true">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={`toast toast-${toast.type}`}
						onClick={() => removeToast(toast.id)}
						role="status" // Besser für Screenreader als "alert" für nicht-kritische Infos
					>
						{/* Hier könnte ein Icon basierend auf toast.type stehen */}
						{/* <span className="toast-icon">ICON</span> */}
						<span className="toast-message">{toast.message}</span>
						<button
							className="toast-close-button"
							onClick={(e) => {
								e.stopPropagation();
								removeToast(toast.id);
							}}
							aria-label="Benachrichtigung schließen"
						>
							&times;
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
};

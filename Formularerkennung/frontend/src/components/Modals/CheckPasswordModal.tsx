// src/components/Settings/Modals/CheckPasswordModal.tsx
import React, { useState, useEffect, useRef } from "react";

interface CheckPasswordModalProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (password: string) => void; // Callback mit dem eingegebenen Passwort
	title: string;
	message: string;
	actionButtonText?: string;
	isLoading?: boolean;
	addToast: (
		message: string,
		type?: "success" | "error" | "info" | "warning",
		duration?: number
	) => void;
}

export const CheckPasswordModal: React.FC<CheckPasswordModalProps> = ({
	isOpen,
	onClose,
	onConfirm,
	title,
	message,
	actionButtonText = "Weiter",
	isLoading = false,
	addToast,
}) => {
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const passwordInputRef = useRef<HTMLInputElement>(null);

	// Fokus auf Passwortfeld setzen, wenn Modal geöffnet wird
	useEffect(() => {
		if (isOpen) {
			setTimeout(() => passwordInputRef.current?.focus(), 0);
			setPassword(""); // Passwortfeld leeren beim Öffnen
			setError(null); // Fehler zurücksetzen
		}
	}, [isOpen]);

	const handleSubmit = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!password.trim()) {
			setError("Passwort darf nicht leer sein.");
			addToast("Passwort darf nicht leer sein.", "warning");
			passwordInputRef.current?.focus();
			return;
		}
		setError(null);
		onConfirm(password);
	};

	// Tastatur-Handler für Enter und Escape
	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			} else if (event.key === "Enter") {
				// Verhindere doppeltes Auslösen, wenn Fokus auf Button ist
				if (document.activeElement?.tagName !== "BUTTON") {
					handleSubmit();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen, onClose, handleSubmit]); // handleSubmit als Abhängigkeit

	if (!isOpen) {
		return null;
	}

	return (
		<div
			className={`modal-overlay password-modal-overlay ${
				isOpen ? "active" : ""
			}`}
			onClick={onClose}
		>
			<div
				className="modal-content password-modal-content"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="modal-header">
					<h3 id="check-password-modal-title">{title}</h3>
					<button
						onClick={onClose}
						className="modal-close-button"
						aria-label="Schließen"
					>
						&times;
					</button>
				</div>
				<div className="modal-body">
					<p id="check-password-modal-message">{message}</p>
					<form onSubmit={handleSubmit} className="modal-form">
						<div className="form-group">
							<label htmlFor="checkPasswordInput">
								Ihr aktuelles Passwort:
							</label>
							<input
								type="password"
								id="checkPasswordInput"
								ref={passwordInputRef}
								value={password}
								onChange={(e) => {
									setPassword(e.target.value);
									if (error) setError(null); // Fehler bei Eingabe entfernen
								}}
								required
								disabled={isLoading}
								className={error ? "input-error" : ""}
								autoComplete="current-password"
							/>
							{error && (
								<p className="error-message modal-error-message">{error}</p>
							)}
						</div>
						<div className="modal-actions">
							<button
								type="button"
								onClick={onClose}
								className="button button-secondary"
								disabled={isLoading}
							>
								Abbrechen
							</button>
							<button
								type="submit"
								className="button button-primary"
								disabled={isLoading || !password.trim()}
							>
								{isLoading ? "Prüfe..." : actionButtonText}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

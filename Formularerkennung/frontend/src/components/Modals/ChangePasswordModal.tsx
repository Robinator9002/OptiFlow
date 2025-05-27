// src/components/Settings/Modals/ChangePasswordModal.tsx
import React, { useState, useEffect, useRef } from "react";
import * as api from "../../api/api"; // Pfad angepasst
import type { ChangePasswordPayload } from "../../api/api"; // Pfad angepasst

interface ChangePasswordModalProps {
	isOpen: boolean;
	onClose: () => void;
	addToast: (
		message: string,
		type?: "success" | "error" | "info" | "warning",
		duration?: number
	) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
	isOpen,
	onClose,
	addToast,
}) => {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const currentPasswordInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setCurrentPassword("");
			setNewPassword("");
			setConfirmNewPassword("");
			setError(null);
			setTimeout(() => currentPasswordInputRef.current?.focus(), 0);
		}
	}, [isOpen]);

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		setError(null);

		if (!currentPassword.trim()) {
			setError("Aktuelles Passwort darf nicht leer sein.");
			addToast("Aktuelles Passwort darf nicht leer sein.", "warning");
			currentPasswordInputRef.current?.focus();
			return;
		}
		if (newPassword.length < 8) {
			setError("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
			addToast(
				"Das neue Passwort muss mindestens 8 Zeichen lang sein.",
				"warning"
			);
			return;
		}
		if (newPassword !== confirmNewPassword) {
			setError("Die neuen Passwörter stimmen nicht überein.");
			addToast("Die neuen Passwörter stimmen nicht überein.", "error");
			return;
		}

		setIsLoading(true);
		try {
			const payload: ChangePasswordPayload = {
				current_password: currentPassword,
				new_password: newPassword,
			};
			const response = await api.changeMyPassword(payload);
			addToast(response.message || "Passwort erfolgreich geändert!", "success");
			onClose();
		} catch (err: any) {
			const errorMsg = err.message || "Fehler beim Ändern des Passworts.";
			setError(errorMsg);
			addToast(errorMsg, "error");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (!isOpen) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			} else if (event.key === "Enter") {
				if (
					document.activeElement?.tagName !== "BUTTON" &&
					currentPassword &&
					newPassword &&
					confirmNewPassword
				) {
					handleSubmit();
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		isOpen,
		onClose,
		handleSubmit,
		currentPassword,
		newPassword,
		confirmNewPassword,
	]);

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
					<h3 id="change-password-modal-title">Passwort ändern</h3>
					<button
						onClick={onClose}
						className="modal-close-button"
						aria-label="Schließen"
					>
						&times;
					</button>
				</div>
				<div className="modal-body">
					<form onSubmit={handleSubmit} className="modal-form">
						{error && (
							<p className="error-message modal-error-message">{error}</p>
						)}
						<div className="form-group">
							<label htmlFor="changePwdCurrentPassword">
								Aktuelles Passwort:
							</label>
							<input
								type="password"
								id="changePwdCurrentPassword"
								ref={currentPasswordInputRef}
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								required
								disabled={isLoading}
								autoComplete="current-password"
							/>
						</div>
						<div className="form-group">
							<label htmlFor="changePwdNewPassword">
								Neues Passwort (min. 8 Zeichen):
							</label>
							<input
								type="password"
								id="changePwdNewPassword"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								required
								minLength={8}
								disabled={isLoading}
								autoComplete="new-password"
							/>
						</div>
						<div className="form-group">
							<label htmlFor="changePwdConfirmNewPassword">
								Neues Passwort bestätigen:
							</label>
							<input
								type="password"
								id="changePwdConfirmNewPassword"
								value={confirmNewPassword}
								onChange={(e) => setConfirmNewPassword(e.target.value)}
								required
								minLength={8}
								disabled={isLoading}
								autoComplete="new-password"
							/>
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
								disabled={
									isLoading ||
									!currentPassword ||
									!newPassword ||
									!confirmNewPassword
								}
							>
								{isLoading ? "Speichere..." : "Passwort speichern"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

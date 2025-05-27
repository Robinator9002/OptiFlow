// src/components/Settings/Modals/ChangeUsernameModal.tsx
import React, { useState, useEffect, useRef } from "react";
import * as api from "../../api/api"; // Pfad angepasst
import type { UserPublic, ChangeUsernamePayload } from "../../api/api"; // Pfad angepasst

interface ChangeUsernameModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentUser: UserPublic;
	confirmedPassword: string;
	addToast: (
		message: string,
		type?: "success" | "error" | "info" | "warning",
		duration?: number
	) => void;
	onLogout: () => void;
}

export const ChangeUsernameModal: React.FC<ChangeUsernameModalProps> = ({
	isOpen,
	onClose,
	currentUser,
	confirmedPassword,
	addToast,
	onLogout,
}) => {
	const [newUsername, setNewUsername] = useState(currentUser.username);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const usernameInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (isOpen) {
			setNewUsername(currentUser.username);
			setError(null);
			setTimeout(() => usernameInputRef.current?.focus(), 0);
		}
	}, [isOpen, currentUser.username]);

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		setError(null);
		const trimmedNewUsername = newUsername.trim();

		if (!trimmedNewUsername) {
			setError("Der neue Benutzername darf nicht leer sein.");
			addToast("Der neue Benutzername darf nicht leer sein.", "warning");
			return;
		}
		if (trimmedNewUsername === currentUser.username) {
			setError("Der neue Benutzername ist identisch mit dem aktuellen.");
			addToast(
				"Der neue Benutzername ist identisch mit dem aktuellen.",
				"info"
			);
			return;
		}
		if (trimmedNewUsername.length < 3) {
			setError("Der neue Benutzername muss mindestens 3 Zeichen lang sein.");
			addToast(
				"Der neue Benutzername muss mindestens 3 Zeichen lang sein.",
				"warning"
			);
			return;
		}

		setIsLoading(true);
		try {
			const payload: ChangeUsernamePayload = {
				password: confirmedPassword,
				new_username: trimmedNewUsername,
			};
			const updatedUser = await api.changeMyUsername(payload);
			addToast(
				`Benutzername erfolgreich zu "${updatedUser.username}" geändert. Sie werden nun abgemeldet und müssen sich neu einloggen.`,
				"success",
				7000
			);
			onClose();
			onLogout();
		} catch (err: any) {
			const errorMsg = err.message || "Fehler beim Ändern des Benutzernamens.";
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
					newUsername.trim()
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
	}, [isOpen, onClose, handleSubmit, newUsername]);

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
					<h3 id="change-username-modal-title">Benutzername ändern</h3>
					<button
						onClick={onClose}
						className="modal-close-button"
						aria-label="Schließen"
					>
						&times;
					</button>
				</div>
				<div className="modal-body">
					<p>
						Ihr aktueller Benutzername: <strong>{currentUser.username}</strong>
					</p>
					<form onSubmit={handleSubmit} className="modal-form">
						{error && (
							<p className="error-message modal-error-message">{error}</p>
						)}
						<div className="form-group">
							<label htmlFor="changeUsernameNew">Neuer Benutzername:</label>
							<input
								type="text"
								id="changeUsernameNew"
								ref={usernameInputRef}
								value={newUsername}
								onChange={(e) => setNewUsername(e.target.value)}
								required
								minLength={3}
								disabled={isLoading}
								autoComplete="username"
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
									!newUsername.trim() ||
									newUsername.trim() === currentUser.username
								}
							>
								{isLoading ? "Speichere..." : "Benutzernamen speichern"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

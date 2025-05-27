// src/components/Settings/Modals/AdminChangeUserRoleModal.tsx
import React, { useState, useEffect, useRef } from "react";
import * as api from "../../api/api"; // Pfad angepasst für Konsistenz, ggf. prüfen
import type {
	UserPublic,
	AdminUpdateUserRolePayload,
	UserRole,
} from "../../api/api"; // Pfad angepasst

interface AdminChangeUserRoleModalProps {
	isOpen: boolean;
	onClose: () => void;
	targetUser: UserPublic | null;
	requestingAdminPassword: string;
	addToast: (
		message: string,
		type?: "success" | "error" | "info" | "warning",
		duration?: number
	) => void;
	onUserListUpdate: () => void;
}

export const AdminChangeUserRoleModal: React.FC<
	AdminChangeUserRoleModalProps
> = ({
	isOpen,
	onClose,
	targetUser,
	requestingAdminPassword,
	addToast,
	onUserListUpdate,
}) => {
	const [newRole, setNewRole] = useState<UserRole | undefined>(
		targetUser?.role
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectRoleRef = useRef<HTMLSelectElement>(null);

	useEffect(() => {
		if (isOpen && targetUser) {
			setNewRole(targetUser.role);
			setError(null);
			setTimeout(() => selectRoleRef.current?.focus(), 0);
		}
	}, [isOpen, targetUser]);

	const handleSubmit = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (!targetUser || typeof newRole === "undefined") {
			setError("Benutzer oder neue Rolle nicht ausgewählt.");
			addToast("Benutzer oder neue Rolle nicht ausgewählt.", "error");
			return;
		}
		if (newRole === targetUser.role) {
			addToast(
				"Die Rolle ist bereits die aktuelle Rolle des Benutzers.",
				"info"
			);
			onClose();
			return;
		}
		setError(null);
		setIsLoading(true);

		try {
			const payload: AdminUpdateUserRolePayload = {
				requesting_admin_password: requestingAdminPassword,
				new_role: newRole,
			};
			await api.adminUpdateUserRole(targetUser.username, payload);
			addToast(
				`Rolle für "${targetUser.username}" erfolgreich zu "${newRole}" geändert.`,
				"success"
			);
			onUserListUpdate();
			onClose();
		} catch (err: any) {
			const errorMsg = err.message || "Fehler beim Ändern der Benutzerrolle.";
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
					typeof newRole !== "undefined"
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
	}, [isOpen, onClose, handleSubmit, newRole]);

	if (!isOpen || !targetUser) {
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
					<h3 id="admin-change-role-modal-title">
						Benutzerrolle ändern für: {targetUser.username}
					</h3>
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
						Aktuelle Rolle: <strong>{targetUser.role}</strong>
					</p>
					<form onSubmit={handleSubmit} className="modal-form">
						{error && (
							<p className="error-message modal-error-message">{error}</p>
						)}
						<div className="form-group">
							<label htmlFor="adminChangeNewRole">Neue Rolle:</label>
							<select
								id="adminChangeNewRole"
								ref={selectRoleRef}
								value={newRole}
								onChange={(e) => setNewRole(e.target.value as UserRole)}
								disabled={isLoading}
								required
							>
								<option value={api.UserRole.KUNDE}>Kunde</option>
								<option value={api.UserRole.MITARBEITER}>Mitarbeiter</option>
								<option value={api.UserRole.ADMIN}>Administrator</option>
							</select>
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
									typeof newRole === "undefined" ||
									newRole === targetUser.role
								}
							>
								{isLoading ? "Speichere..." : "Rolle speichern"}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
};

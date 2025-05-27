// src/components/Settings/SettingComponents/UserAccountSettings.tsx
import React, { useState, useCallback, useEffect } from "react";
import * as api from "../../../api/api";
import type {
	UserPublic,
	DeleteOwnAccountPayload,
	// AdminUpdateUserRolePayload, // Wird in AdminChangeUserRoleModal verwendet
	// AdminResetPasswordPayload, // Wird direkt in der Funktion verwendet
	// AdminDeleteUserPayload, // Wird direkt in der Funktion verwendet
} from "../../../api/api";
import { CheckPasswordModal } from "../../Modals/CheckPasswordModal";
import { ChangePasswordModal } from "../../Modals/ChangePasswordModal";
import { ChangeUsernameModal } from "../../Modals/ChangeUsernameModal";
import { AdminChangeUserRoleModal } from "../../Modals/AdminChangeUserRoleModal";
// import { AdminShowTemporaryPasswordModal } from '../Modals/AdminShowTemporaryPasswordModal'; // Optional

interface UserAccountSettingsTabProps {
	currentUser: UserPublic;
	addToast: (
		message: string,
		type?: "success" | "error" | "info" | "warning",
		duration?: number
	) => void;
	showConfirmModal: (config: {
		title?: string;
		message: string;
		onConfirm: () => void;
		onCancel?: () => void;
		confirmText?: string;
		cancelText?: string;
		isDanger?: boolean;
	}) => void;
	setCurrentUserGlobal: (user: UserPublic | null) => void;
	onLogout: () => void;
}

const UserAccountSettingsTab: React.FC<UserAccountSettingsTabProps> = ({
	currentUser,
	addToast,
	showConfirmModal,
	setCurrentUserGlobal,
	onLogout,
}) => {
	const [isCheckPasswordModalOpen, setIsCheckPasswordModalOpen] =
		useState(false);
	const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
		useState(false);
	const [isChangeUsernameModalOpen, setIsChangeUsernameModalOpen] =
		useState(false);

	const [isUserListLoading, setIsUserListLoading] = useState(false);
	const [userList, setUserList] = useState<UserPublic[]>([]);
	const [userListError, setUserListError] = useState<string | null>(null);
	const [targetUserForAdminAction, setTargetUserForAdminAction] =
		useState<UserPublic | null>(null);
	const [isAdminChangeRoleModalOpen, setIsAdminChangeRoleModalOpen] =
		useState(false);
	// const [adminActionPassword, setAdminActionPassword] = useState<string>(""); // Nicht mehr global benötigt, da direkt übergeben

	type PendingAction =
		| "deleteAccount"
		| "changeUsername"
		| "adminChangeRole"
		| "adminResetPassword"
		| "adminDeleteUser"
		| null;
	const [pendingAction, setPendingAction] = useState<PendingAction>(null);
	const [passwordForPendingAction, setPasswordForPendingAction] =
		useState<string>("");

	const handleDeleteAccountRequest = () => {
		setPendingAction("deleteAccount");
		setIsCheckPasswordModalOpen(true);
	};

	const executeDeleteAccount = async (password: string) => {
		showConfirmModal({
			title: "Account endgültig löschen?",
			message: `Sind Sie absolut sicher, dass Sie Ihren Account "${currentUser.username}" endgültig löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.`,
			confirmText: "Ja, Account löschen",
			cancelText: "Abbrechen",
			isDanger: true,
			onConfirm: async () => {
				try {
					const payload: DeleteOwnAccountPayload = { password };
					await api.deleteMyAccount(payload);
					addToast(
						"Ihr Account wurde erfolgreich gelöscht. Sie werden nun abgemeldet.",
						"success"
					);
					onLogout();
				} catch (err: any) {
					addToast(err.message || "Fehler beim Löschen des Accounts.", "error");
				} finally {
					setPendingAction(null); // Aktion hier zurücksetzen
				}
			},
			onCancel: () => {
				addToast("Löschvorgang abgebrochen.", "info");
				setPendingAction(null); // Aktion auch bei Abbruch im ConfirmModal zurücksetzen
			},
		});
	};

	const handleChangeUsernameRequest = () => {
		setPendingAction("changeUsername");
		setIsCheckPasswordModalOpen(true);
	};

	const openChangeUsernameModalWithPassword = (password: string) => {
		setPasswordForPendingAction(password);
		setIsChangeUsernameModalOpen(true);
		// setPendingAction wird erst beim Schließen des ChangeUsernameModal zurückgesetzt
	};

	const fetchUserList = useCallback(async () => {
		if (currentUser.role !== api.UserRole.ADMIN) return;
		setIsUserListLoading(true);
		setUserListError(null);
		try {
			const users = await api.getUsers();
			setUserList(users.filter((u) => u.id !== currentUser.id));
		} catch (err: any) {
			setUserListError(err.message || "Fehler beim Laden der Benutzerliste.");
			addToast(err.message || "Fehler beim Laden der Benutzerliste.", "error");
		} finally {
			setIsUserListLoading(false);
		}
	}, [currentUser, addToast]);

	useEffect(() => {
		if (currentUser.role === api.UserRole.ADMIN) {
			fetchUserList();
		}
	}, [currentUser.role, fetchUserList]);

	const handleAdminChangeRoleRequest = (user: UserPublic) => {
		setTargetUserForAdminAction(user);
		setPendingAction("adminChangeRole");
		setIsCheckPasswordModalOpen(true);
	};
	const handleAdminResetPasswordRequest = (user: UserPublic) => {
		setTargetUserForAdminAction(user);
		setPendingAction("adminResetPassword");
		setIsCheckPasswordModalOpen(true);
	};
	const handleAdminDeleteUserRequest = (user: UserPublic) => {
		setTargetUserForAdminAction(user);
		setPendingAction("adminDeleteUser");
		setIsCheckPasswordModalOpen(true);
	};

	const handlePasswordChecked = (password: string) => {
		setIsCheckPasswordModalOpen(false); // Schließe das Passwort-Modal
		// WICHTIG: pendingAction hier NICHT sofort zurücksetzen!
		// Es wird benötigt, um das richtige Folgemodal zu rendern oder die Aktion auszuführen.

		switch (pendingAction) {
			case "deleteAccount":
				executeDeleteAccount(password);
				// pendingAction wird in executeDeleteAccount zurückgesetzt
				break;
			case "changeUsername":
				openChangeUsernameModalWithPassword(password);
				// pendingAction wird beim Schließen des ChangeUsernameModal zurückgesetzt
				break;
			case "adminChangeRole":
				setPasswordForPendingAction(password);
				setIsAdminChangeRoleModalOpen(true);
				// pendingAction wird beim Schließen des AdminChangeUserRoleModal zurückgesetzt
				break;
			case "adminResetPassword":
				executeAdminResetPassword(password);
				// pendingAction wird in executeAdminResetPassword zurückgesetzt
				break;
			case "adminDeleteUser":
				executeAdminDeleteUser(password);
				// pendingAction wird in executeAdminDeleteUser zurückgesetzt
				break;
			default:
				addToast("Unbekannte Aktion nach Passwortüberprüfung.", "error");
				setPendingAction(null); // Fallback, falls doch was schiefgeht
		}
		// setPendingAction(null); // FRÜHER: Hier war der Fehler, jetzt entfernt!
	};

	const executeAdminResetPassword = async (adminPassword: string) => {
		if (!targetUserForAdminAction) return;
		showConfirmModal({
			title: "Passwort zurücksetzen bestätigen",
			message: `Möchten Sie das Passwort für "${targetUserForAdminAction.username}" wirklich zurücksetzen? Ein neues temporäres Passwort wird generiert.`,
			confirmText: "Ja, zurücksetzen",
			onConfirm: async () => {
				try {
					const payload: api.AdminResetPasswordPayload = {
						// Typ direkt aus api importieren
						requesting_admin_password: adminPassword,
					};
					const response = await api.adminResetUserPassword(
						targetUserForAdminAction.username,
						payload
					);
					addToast(
						`${response.message} Neues temporäres Passwort: ${response.new_temporary_password}`,
						"success",
						15000
					);
				} catch (err: any) {
					addToast(
						err.message || "Fehler beim Zurücksetzen des Passworts.",
						"error"
					);
				} finally {
					setTargetUserForAdminAction(null);
					setPendingAction(null); // Aktion hier zurücksetzen
				}
			},
			onCancel: () => {
				addToast("Passwort-Reset abgebrochen.", "info");
				setTargetUserForAdminAction(null);
				setPendingAction(null); // Aktion auch hier zurücksetzen
			},
		});
	};

	const executeAdminDeleteUser = async (adminPassword: string) => {
		if (!targetUserForAdminAction) return;
		showConfirmModal({
			title: "Benutzer löschen bestätigen",
			message: `Möchten Sie den Benutzer "${targetUserForAdminAction.username}" wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`,
			confirmText: "Ja, Benutzer löschen",
			isDanger: true,
			onConfirm: async () => {
				try {
					const payload: api.AdminDeleteUserPayload = {
						// Typ direkt aus api importieren
						requesting_admin_password: adminPassword,
					};
					await api.adminDeleteUser(targetUserForAdminAction.username, payload);
					addToast(
						`Benutzer "${targetUserForAdminAction.username}" erfolgreich gelöscht.`,
						"success"
					);
					fetchUserList();
				} catch (err: any) {
					addToast(
						err.message ||
							`Fehler beim Löschen von ${targetUserForAdminAction.username}.`,
						"error"
					);
				} finally {
					setTargetUserForAdminAction(null);
					setPendingAction(null); // Aktion hier zurücksetzen
				}
			},
			onCancel: () => {
				addToast("Löschvorgang für Benutzer abgebrochen.", "info");
				setTargetUserForAdminAction(null);
				setPendingAction(null); // Aktion auch hier zurücksetzen
			},
		});
	};

	return (
		<div className="settings-tab-content user-account-settings-tab">
			<h2>Nutzereinstellungen</h2>

			<div className="setting-group">
				<h3>Kontoaktionen</h3>
				<div className="account-actions-grid">
					<button
						onClick={() => setIsChangePasswordModalOpen(true)}
						className="button"
					>
						Passwort ändern
					</button>
					<button onClick={handleChangeUsernameRequest} className="button">
						Benutzername ändern
					</button>
					<button
						onClick={handleDeleteAccountRequest}
						className="button button-danger"
					>
						Meinen Account löschen
					</button>
				</div>
			</div>

			{currentUser.role === api.UserRole.ADMIN && (
				<div className="setting-group admin-user-management">
					<h3>Benutzerverwaltung (Admin)</h3>
					{isUserListLoading && (
						<p className="loading-message">Lade Benutzerliste...</p>
					)}
					{userListError && <p className="error-message">{userListError}</p>}
					{!isUserListLoading && !userListError && userList.length === 0 && (
						<p>Keine anderen Benutzer im System vorhanden.</p>
					)}
					{!isUserListLoading && !userListError && userList.length > 0 && (
						<table className="user-admin-table">
							<thead>
								<tr>
									<th>Benutzername</th>
									<th>E-Mail</th>
									<th>Rolle</th>
									<th>Aktiv</th>
									<th>Letzter Login</th>
									<th>Aktionen</th>
								</tr>
							</thead>
							<tbody>
								{userList.map((user) => (
									<tr key={user.id}>
										<td>{user.username}</td>
										<td>{user.email || "-"}</td>
										<td>{user.role}</td>
										<td>{user.is_active ? "Ja" : "Nein"}</td>
										<td>
											{user.last_login
												? new Date(user.last_login).toLocaleString("de-DE")
												: "Nie"}
										</td>
										<td className="actions-cell">
											<button
												onClick={() => handleAdminChangeRoleRequest(user)}
												className="button button-small"
												title="Rolle ändern"
											>
												Rolle
											</button>
											<button
												onClick={() => handleAdminResetPasswordRequest(user)}
												className="button button-small button-warning"
												title="Passwort zurücksetzen"
											>
												PW Reset
											</button>
											<button
												onClick={() => handleAdminDeleteUserRequest(user)}
												className="button button-small button-danger"
												title="Benutzer löschen"
											>
												Löschen
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			)}

			{/* Modals */}
			<CheckPasswordModal
				isOpen={isCheckPasswordModalOpen}
				onClose={() => {
					setIsCheckPasswordModalOpen(false);
					setPendingAction(null); // Aktion hier sicher zurücksetzen, wenn CheckPasswordModal abgebrochen wird
				}}
				onConfirm={handlePasswordChecked}
				title="Passwortbestätigung erforderlich"
				message="Bitte geben Sie Ihr aktuelles Passwort ein, um diese Aktion zu bestätigen."
				actionButtonText={
					pendingAction === "deleteAccount"
						? "Löschung vorbereiten"
						: pendingAction === "changeUsername"
						? "Benutzernamenänderung vorbereiten"
						: "Weiter"
				}
				addToast={addToast}
			/>
			<ChangePasswordModal
				isOpen={isChangePasswordModalOpen}
				onClose={() => setIsChangePasswordModalOpen(false)}
				addToast={addToast}
			/>

			{/* Das ChangeUsernameModal wird nur gerendert, wenn isChangeUsernameModalOpen true ist.
                Die Logik für passwordForPendingAction und pendingAction als Bedingung ist nicht mehr nötig,
                da das Öffnen von setIsChangeUsernameModalOpen(true) jetzt ausreicht und
                pendingAction erst beim Schließen dieses Modals zurückgesetzt wird. */}
			<ChangeUsernameModal
				isOpen={isChangeUsernameModalOpen}
				onClose={() => {
					setIsChangeUsernameModalOpen(false);
					setPasswordForPendingAction("");
					setPendingAction(null); // WICHTIG: pendingAction hier zurücksetzen
				}}
				currentUser={currentUser}
				confirmedPassword={passwordForPendingAction} // Dieses Passwort wird übergeben
				addToast={addToast}
				onLogout={onLogout}
			/>

			{/* Das AdminChangeUserRoleModal wird nur gerendert, wenn isAdminChangeRoleModalOpen true ist. */}
			<AdminChangeUserRoleModal
				isOpen={isAdminChangeRoleModalOpen}
				onClose={() => {
					setIsAdminChangeRoleModalOpen(false);
					setTargetUserForAdminAction(null);
					setPasswordForPendingAction("");
					setPendingAction(null); // WICHTIG: pendingAction hier zurücksetzen
				}}
				targetUser={targetUserForAdminAction} // Wird korrekt übergeben
				requestingAdminPassword={passwordForPendingAction} // Wird korrekt übergeben
				addToast={addToast}
				onUserListUpdate={fetchUserList}
			/>
		</div>
	);
};

export default UserAccountSettingsTab;

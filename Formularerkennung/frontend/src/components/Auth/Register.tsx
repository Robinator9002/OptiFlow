// src/components/Auth/Register.tsx
import React, { useState } from "react";
import * as api from "../../api/api";
import { UserRole } from "../../api/api";
import type { UserRegistrationRequest, UserPublic } from "../../api/api";
import type { ToastType } from "../Layout/ToastNotifications";

interface RegisterProps {
	onRegistrationSuccess: (newUser: UserPublic) => void;
	addToast: (message: string, type?: ToastType, duration?: number) => void;
	//  Callback zum Umschalten zur Login-Ansicht
	onSwitchToLogin: () => void;
}

const RegisterComponent: React.FC<RegisterProps> = ({
	onRegistrationSuccess,
	addToast,
	onSwitchToLogin, // Neuer Prop
}) => {
	const [adminUsername, setAdminUsername] = useState("");
	const [adminPassword, setAdminPassword] = useState("");
	const [newUsername, setNewUsername] = useState("");
	const [newEmail, setNewEmail] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.KUNDE);

	const [isLoading, setIsLoading] = useState(false);
	const [registrationError, setRegistrationError] = useState<string | null>(
		null
	);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setRegistrationError(null);

		if (newPassword !== confirmNewPassword) {
			const msg =
				"Die Passwörter für den neuen Benutzer stimmen nicht überein.";
			setRegistrationError(msg);
			addToast(msg, "error");
			return;
		}
		if (newPassword.length < 8) {
			const msg =
				"Das Passwort des neuen Benutzers muss mindestens 8 Zeichen lang sein.";
			setRegistrationError(msg);
			addToast(msg, "error");
			return;
		}

		setIsLoading(true);

		const registrationPayload: UserRegistrationRequest = {
			admin_credentials: {
				admin_username: adminUsername,
				admin_password: adminPassword,
			},
			new_user_details: {
				username: newUsername,
				email: newEmail || undefined, // Stelle sicher, dass undefined gesendet wird, wenn leer
				password: newPassword,
				role: newUserRole,
			},
		};

		try {
			const registeredUser = await api.registerUserByAdmin(registrationPayload);
			// onRegistrationSuccess wird in App.tsx aufgerufen, um Toast anzuzeigen und ggf. View zu wechseln
			onRegistrationSuccess(registeredUser);
			// Felder nach erfolgreicher Registrierung leeren (optional, da View wechselt)
			setAdminUsername("");
			setAdminPassword("");
			setNewUsername("");
			setNewEmail("");
			setNewPassword("");
			setConfirmNewPassword("");
			setNewUserRole(UserRole.KUNDE);
		} catch (error: any) {
			console.error("Registrierung fehlgeschlagen:", error);
			const errMsg = error.message || "Registrierung fehlgeschlagen.";
			setRegistrationError(errMsg);
			addToast(errMsg, "error");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="register-container auth-container">
			{" "}
			{/* generische Klasse für Styling */}
			<form onSubmit={handleSubmit} className="auth-form register-form">
				<h2>Neuen Benutzer registrieren</h2>
				<p className="form-description">
					Diese Aktion erfordert Administrator-Anmeldeinformationen.
				</p>

				{registrationError && (
					<p className="error-message global-error-message">
						{registrationError}
					</p>
				)}

				<fieldset>
					<legend>Administrator-Bestätigung</legend>
					<div className="form-group">
						<label htmlFor="adminUsernameReg">Admin-Benutzername:</label>
						<input
							type="text"
							id="adminUsernameReg"
							value={adminUsername}
							onChange={(e) => setAdminUsername(e.target.value)}
							required
							autoComplete="username"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="adminPasswordReg">Admin-Passwort:</label>
						<input
							type="password"
							id="adminPasswordReg"
							value={adminPassword}
							onChange={(e) => setAdminPassword(e.target.value)}
							required
							autoComplete="current-password"
						/>
						<small className="form-text text-muted">
							Master-Passwort für Demo: dup1992
						</small>
					</div>
				</fieldset>

				<fieldset>
					<legend>Daten des neuen Benutzers</legend>
					<div className="form-group">
						<label htmlFor="newUsernameReg">Neuer Benutzername:</label>
						<input
							type="text"
							id="newUsernameReg"
							value={newUsername}
							onChange={(e) => setNewUsername(e.target.value)}
							required
							autoComplete="new-username"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="newEmailReg">E-Mail (optional):</label>
						<input
							type="email"
							id="newEmailReg"
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
							autoComplete="new-email"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="newPasswordReg">
							Neues Passwort (min. 8 Zeichen):
						</label>
						<input
							type="password"
							id="newPasswordReg"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							required
							minLength={8}
							autoComplete="new-password"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="confirmNewPasswordReg">Passwort bestätigen:</label>
						<input
							type="password"
							id="confirmNewPasswordReg"
							value={confirmNewPassword}
							onChange={(e) => setConfirmNewPassword(e.target.value)}
							required
							minLength={8}
							autoComplete="new-password"
						/>
					</div>
					<div className="form-group">
						<label htmlFor="newUserRoleReg">Rolle des neuen Benutzers:</label>
						<select
							id="newUserRoleReg"
							value={newUserRole}
							onChange={(e) => setNewUserRole(e.target.value as UserRole)}
							required
						>
							<option value={UserRole.KUNDE}>Kunde</option>
							<option value={UserRole.MITARBEITER}>Mitarbeiter</option>
							<option value={UserRole.ADMIN}>Administrator</option>
						</select>
					</div>
				</fieldset>

				<button
					type="submit"
					className="button button-primary auth-button"
					disabled={isLoading}
				>
					{isLoading ? "Registriere..." : "Neuen Benutzer registrieren"}
				</button>
				<div className="auth-switch">
					<p>Bereits einen Account?</p>
					<button
						type="button"
						onClick={onSwitchToLogin} // Ruft die Funktion in App.tsx auf
						className="button button-link" // Styling als Link
					>
						Zurück zum Login
					</button>
				</div>
			</form>
		</div>
	);
};

export default RegisterComponent;

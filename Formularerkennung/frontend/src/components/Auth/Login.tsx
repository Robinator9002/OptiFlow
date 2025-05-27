// src/components/Auth/Login.tsx
import React, { useState } from "react";
import * as api from "../../api/api";

interface LoginComponentProps {
	onLoginSuccess: (user: api.UserPublic) => void;
	setAuthError: (error: string | null) => void;
	authError: string | null;
	// NEU: Callback zum Umschalten zur Registrierungsansicht
	onSwitchToRegister: () => void;
}

const LoginComponent: React.FC<LoginComponentProps> = ({
	onLoginSuccess,
	setAuthError,
	authError,
	onSwitchToRegister, // Neuer Prop
}) => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setIsLoading(true);
		setAuthError(null);
		try {
			const formData = new FormData();
			formData.append("username", username);
			formData.append("password", password);

			const tokenData = await api.loginUser(formData);
			// Nach erfolgreichem Login, Benutzerdaten abrufen (wird in App.tsx gemacht oder hier)
			const user = await api.getCurrentUser(); // Annahme: getCurrentUser holt den User basierend auf dem gesetzten Token
			if (user) {
				onLoginSuccess(user);
			} else {
				// Dieser Fall sollte idealerweise nicht eintreten, wenn loginUser erfolgreich war
				// und getCurrentUser korrekt funktioniert.
				setAuthError("Benutzerdaten konnten nach Login nicht geladen werden.");
			}
		} catch (error: any) {
			console.error("Login fehlgeschlagen:", error);
			setAuthError(
				error.message || "Login fehlgeschlagen. Überprüfen Sie Ihre Eingaben."
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="login-container auth-container">
			{" "}
			{/* generische Klasse für Styling */}
			<form onSubmit={handleSubmit} className="auth-form login-form">
				<h2>Anmelden</h2>
				{authError && (
					<p className="error-message global-error-message">{authError}</p>
				)}
				<div className="form-group">
					<label htmlFor="username">Benutzername:</label>
					<input
						type="text"
						id="username"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
						autoComplete="username"
					/>
				</div>
				<div className="form-group">
					<label htmlFor="password">Passwort:</label>
					<input
						type="password"
						id="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
						autoComplete="current-password"
					/>
				</div>
				<button
					type="submit"
					className="button button-primary auth-button"
					disabled={isLoading}
				>
					{isLoading ? "Anmelden..." : "Anmelden"}
				</button>
				<div className="auth-switch">
					<p>Noch keinen Account?</p>
					<button
						type="button"
						onClick={onSwitchToRegister} // Ruft die Funktion in App.tsx auf
						className="button button-link" // Styling als Link
					>
						Jetzt registrieren (Admin erforderlich)
					</button>
				</div>
				<p
					style={{
						marginTop: "var(--spacing-md)",
						fontSize: "var(--font-size-sm)",
						textAlign: "center",
						color: "var(--text-color-light)",
					}}
				>
					Test-Login: `testuser` / `testpassword`
				</p>
			</form>
		</div>
	);
};

export default LoginComponent;

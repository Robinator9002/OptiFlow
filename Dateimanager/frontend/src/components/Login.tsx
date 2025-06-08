import React, { useState } from "react";
import { loginUser, registerUser } from "../api/api.tsx";
import { toast } from "react-toastify";

// --- Type Definitions ---

interface LoginProps {
    onLoginSuccess: (username: string) => void;
}

// --- Component ---

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [adminUsername, setAdminUsername] = useState<string>("");
    const [adminPassword, setAdminPassword] = useState<string>("");
    const [isRegistering, setIsRegistering] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ): Promise<void> => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        // Validation
        if (!trimmedUsername || !trimmedPassword) {
            const msg = "Benutzername und Passwort dürfen nicht leer sein.";
            setError(msg);
            toast.error(msg);
            setLoading(false);
            return;
        }

        if (isRegistering) {
            if (trimmedPassword.length < 4) {
                const msg = "Das Passwort muss mindestens 4 Zeichen lang sein.";
                setError(msg);
                toast.error(msg);
                setLoading(false);
                return;
            }
            if (!adminUsername.trim() || !adminPassword.trim()) {
                const msg =
                    "Administrator-Zugangsdaten sind für die Registrierung erforderlich.";
                setError(msg);
                toast.error(msg);
                setLoading(false);
                return;
            }
        }

        try {
            let response;
            if (isRegistering) {
                response = await registerUser(
                    trimmedUsername,
                    trimmedPassword,
                    adminUsername.trim(),
                    adminPassword.trim(),
                    isAdmin
                );
            } else {
                response = await loginUser(trimmedUsername, trimmedPassword);
            }
            if (response.message) {
                toast.success(response.message);
            }
            onLoginSuccess(trimmedUsername);
        } catch (err: unknown) {
            let errorMessage = "Anmeldung/Registrierung fehlgeschlagen.";
            if (
                err instanceof Error &&
                "response" in err &&
                err.response &&
                typeof err.response === "object" &&
                err.response !== null &&
                "data" in err.response
            ) {
                const responseData = err.response.data as { detail?: string };
                if (responseData.detail) {
                    errorMessage = responseData.detail;
                }
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }

            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-form">
                <h2>{isRegistering ? "Registrieren" : "Anmelden"}</h2>
                {error && <p className="error-message">{error}</p>}
                <input
                    type="text"
                    placeholder="Benutzername"
                    autoFocus
                    value={username}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUsername(e.target.value)
                    }
                    className={error ? "error-input" : ""}
                />
                <input
                    type="password"
                    placeholder="Passwort"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value)
                    }
                    className={error ? "error-input" : ""}
                />
                {isRegistering && (
                    <>
                        <input
                            type="text"
                            placeholder="Administrator-Benutzername"
                            value={adminUsername}
                            onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                            ) => setAdminUsername(e.target.value)}
                            className={error ? "error-input" : ""}
                        />
                        <input
                            type="password"
                            placeholder="Administrator-Passwort"
                            value={adminPassword}
                            onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                            ) => setAdminPassword(e.target.value)}
                            className={error ? "error-input" : ""}
                        />
                        <label>
                            Administrator:
                            <input
                                type="checkbox"
                                checked={isAdmin}
                                onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                ) => setIsAdmin(e.target.checked)}
                            />
                        </label>
                    </>
                )}
                <button type="submit" disabled={loading}>
                    {loading
                        ? "Lädt..."
                        : isRegistering
                        ? "Registrieren"
                        : "Anmelden"}
                </button>
                <button
                    type="button"
                    onClick={() => setIsRegistering(!isRegistering)}
                    disabled={loading}
                >
                    {isRegistering
                        ? "Zurück zum Login"
                        : "Neuen Benutzer anlegen"}
                </button>
            </form>
        </div>
    );
};

export default Login;

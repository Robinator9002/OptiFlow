import React, { useState, useEffect } from "react";
import { loginUser, registerUser, checkNoUsersExist } from "../../api/api.tsx";
import { toast } from "react-toastify";

// --- Type Definitions ---

interface LoginProps {
    onLoginSuccess: (username: string) => void;
}

// --- Component ---

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    // Component state
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [adminUsername, setAdminUsername] = useState<string>("");
    const [adminPassword, setAdminPassword] = useState<string>("");
    const [isRegistering, setIsRegistering] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [noUsersExist, setNoUsersExist] = useState<boolean>(false);
    
    // NEU: State für die Sichtbarkeit des "Passwort vergessen"-Modals
    const [showResetModal, setShowResetModal] = useState<boolean>(false);

    // Check on initial render if any users exist to toggle setup mode
    useEffect(() => {
        const checkUserStatus = async () => {
            try {
                const response = await checkNoUsersExist();
                if (response.no_users) {
                    setNoUsersExist(true);
                    setIsRegistering(true); // Switch to registration for first user
                }
            } catch (err) {
                console.error("Fehler bei der Prüfung des Benutzerstatus:", err);
                toast.error("Fehler bei der Kommunikation mit dem Server.");
            }
        };
        checkUserStatus();
    }, []); // Empty dependency array ensures this runs only once

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ): Promise<void> => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const trimmedUsername = username.trim();
        const trimmedPassword = password.trim();

        if (!trimmedUsername || !trimmedPassword) {
            const msg = "Benutzername und Passwort dürfen nicht leer sein.";
            setError(msg);
            toast.error(msg);
            setLoading(false);
            return;
        }
        
        if (isRegistering && trimmedPassword.length < 4) {
            const msg = "Das Passwort muss mindestens 4 Zeichen lang sein.";
            setError(msg);
            toast.error(msg);
            setLoading(false);
            return;
        }

        if (isRegistering && !noUsersExist) {
            if (!adminUsername.trim() || !adminPassword.trim()) {
                const msg = "Administrator-Zugangsdaten sind für die Registrierung erforderlich.";
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
                    noUsersExist ? null : adminUsername.trim(),
                    noUsersExist ? null : adminPassword.trim(),
                    noUsersExist ? true : isAdmin
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

    const getTitle = () => {
        if (isRegistering && noUsersExist) return "Ersten Admin erstellen";
        if (isRegistering) return "Registrieren";
        return "Anmelden";
    };

    return (
        <>
            {showResetModal && (
                <div className="overlay" onClick={() => setShowResetModal(false)}>
                    <div className="modal-content modal-danger" onClick={(e) => e.stopPropagation()}>
                        {/* START: Diesen Block ersetzen */}
                        <div className="reset-warning">
                            <h3>Passwort-Reset</h3>
                            <p>
                                Um den Zugriff wiederherzustellen, müssen Sie die Datei <code>users.json</code> manuell löschen.
                                Der Speicherort hängt von Ihrer Umgebung ab:
                            </p>
                            <hr />
                            <p>
                                <strong>In der installierten Anwendung (Produktion):</strong><br />
                                Die Datei befindet sich im <code>backend/data</code> Ordner innerhalb des Installationsverzeichnisses Ihrer App (oft C:\Users\IhrBenutzername\AppData\Local\Programs\optiflow-filemanager\backend\data).
                            </p>
                            <p>
                                <strong>In der Entwicklungsumgebung:</strong><br />
                                Die Datei befindet sich im <code>data</code> Ordner direkt im Hauptverzeichnis Ihres Projekts.
                            </p>
                            <hr />
                            <h4>WARNUNG: DIESER VORGANG IST ENDGÜLTIG</h4>
                            <p>
                                Durch das Löschen dieser Datei werden <strong>alle Benutzerkonten</strong>, Passwörter und benutzerspezifische Einstellungen unwiderruflich entfernt. Ihre anderen Daten (Datei-Index etc.) bleiben erhalten.
                            </p>
                            <p>
                               Nachdem Sie die Datei gelöscht und die App neu gestartet haben, können Sie hier einen neuen Administrator-Account anlegen.
                            </p>
                            <p>In einigen Fällen kann es passieren das der Server zuerst einige Aufträge ausführt, wie Events die fällig werden oder das laden des Indexes. Normalerweiße reicht es hier einfach etwas zu warten, wenn das nicht Funktioniert dann hilft es den Data Ordner zu komplett löschen. Davor sollte allerdings ein backup von allen darin vorhandenen Dateien gemacht werden!</p>
                        </div>
                        {/* ENDE: Ersetzter Block */}
                        <div className="modal-buttons">
                            <button onClick={() => setShowResetModal(false)} className="confirm">
                                Verstanden
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="login-container">
                <form onSubmit={handleSubmit} className="login-form">
                    <h2>{getTitle()}</h2>
                    
                    {noUsersExist && isRegistering && (
                         <p className="info-message">Willkommen! Da noch keine Benutzer existieren, wird jetzt der erste Administrator-Account angelegt.</p>
                    )}

                    {error && <p className="error-message">{error}</p>}
                    
                    <input
                        type="text"
                        placeholder="Benutzername"
                        autoFocus
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={error ? "error-input" : ""}
                    />
                    <input
                        type="password"
                        placeholder="Passwort"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={error ? "error-input" : ""}
                    />
                    
                    {isRegistering && !noUsersExist && (
                        <>
                            <input
                                type="text"
                                placeholder="Administrator-Benutzername"
                                value={adminUsername}
                                onChange={(e) => setAdminUsername(e.target.value)}
                                className={error ? "error-input" : ""}
                            />
                            <input
                                type="password"
                                placeholder="Administrator-Passwort"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                className={error ? "error-input" : ""}
                            />
                            <label>
                                Administrator:
                                <input
                                    type="checkbox"
                                    checked={isAdmin}
                                    onChange={(e) => setIsAdmin(e.target.checked)}
                                />
                            </label>
                        </>
                    )}
                    
                    <button type="submit" disabled={loading}>
                        {loading ? "Lädt..." : getTitle()}
                    </button>
                    
                    {!noUsersExist && (
                        <button
                            type="button"
                            onClick={() => setIsRegistering(!isRegistering)}
                            disabled={loading}
                            className="toggle-button"
                        >
                            {isRegistering
                                ? "Zurück zum Login"
                                : "Neuen Benutzer anlegen"}
                        </button>
                    )}
                     
                    {/* NEU: Der Hilfetext ist jetzt ein Link, der das Modal öffnet */}
                    {!isRegistering && (
                        <p className="help-text">
                           <a href="#" onClick={(e) => { e.preventDefault(); setShowResetModal(true); }}>
                             Passwort vergessen?
                           </a>
                        </p>
                    )}
                </form>
            </div>
        </>
    );
};

export default Login;

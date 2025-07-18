import { useState, useEffect, type FC, type FormEvent } from "react";
import { toast } from "react-toastify";
import { changePassword } from "../../api/api";

// 1. Props-Interface definieren
interface ChangePasswordProps {
    currentUser: string;
    password: string; // Das alte, bestätigte Passwort
    adminUser: string | null,
    adminPassword: string | null,
    passwordReset: boolean,
    onLogout: () => void;
    onCancel: () => void;
}

export const ChangePassword: FC<ChangePasswordProps> = ({
    currentUser,
    password,
    adminUser = null,
    adminPassword = null,
    passwordReset = false,
    onLogout,
    onCancel,
}) => {
    // --- State für Passwortänderung ---
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
    const [passwordChangeError, setPasswordChangeError] = useState("");

    useEffect(() => {
        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            // 2. Event-Typ hinzufügen
            if (e.key === "Enter") {
                const active = document.activeElement;
                if (active) {
                    const isInput =
                        active.tagName === "INPUT" ||
                        active.tagName === "TEXTAREA";
                    if (isInput) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Wir können hier kein Event übergeben, da wir es nicht haben.
                        // Stattdessen rufen wir die Logik direkt auf, was sauberer ist.
                        handlePasswordChangeSubmit();
                    }
                }
            }
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [newPassword, confirmPassword]); // Abhängigkeiten sind korrekt

    // Eigene Submit-Logik, die von überall aufgerufen werden kann
    const handlePasswordChangeSubmit = async () => {
        setPasswordChangeError("");

        if (!newPassword || !confirmPassword) {
            setPasswordChangeError("Bitte beide Passwortfelder ausfüllen.");
            toast.error("Bitte beide Passwortfelder ausfüllen.");
            return;
        }

        if (newPassword.trim().length < 4) {
            setPasswordChangeError(
                "Das neue Passwort muss mindestens 4 Zeichen lang sein."
            );
            toast.error(
                "Das neue Passwort muss mindestens 4 Zeichen lang sein."
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordChangeError(
                "Die neuen Passwörter stimmen nicht überein."
            );
            toast.error("Die neuen Passwörter stimmen nicht überein.");
            return;
        }

        if (newPassword === password) {
            setPasswordChangeError(
                "Das neue Passwort ist das selbe als das alte Passwort."
            );
            toast.error(
                "Das neue Passwort ist das selbe als das alte Passwort."
            );
            return;
        }

        setPasswordChangeLoading(true);
        try {
            // Die Prüfung `newPassword === confirmPassword` ist redundant, da sie oben schon stattfindet.
            const response = await changePassword(
                currentUser,
                password,
                adminUser,
                adminPassword,
                passwordReset,
                newPassword
            );
            toast.success(response.message);
            // Felder leeren
            setNewPassword("");
            setConfirmPassword("");
            setPasswordChangeError("");
            // Ausloggen
            onLogout();
        } catch (err: any) {
            const message =
                err.response?.data?.detail ||
                err.message ||
                "Passwort konnte nicht geändert werden.";
            setPasswordChangeError(message);
            toast.error(message);
        } finally {
            setPasswordChangeLoading(false);
        }
    };

    // Wrapper für das Form-Event
    const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handlePasswordChangeSubmit();
    };

    return (
        <form className="password-change-field" onSubmit={handleFormSubmit}>
            <h4>Passwort ändern</h4>
            {passwordChangeError && (
                <p
                    className="error-message"
                    style={{ textAlign: "left", marginBottom: "10px" }}
                >
                    {passwordChangeError}
                </p>
            )}
            <div className="form-group">
                <label htmlFor="newPassword">Neues Passwort:</label>
                <input
                    type="password"
                    id="newPassword"
                    autoFocus
                    value={newPassword}
                    onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordChangeError("");
                    }}
                    className={passwordChangeError ? "error-input" : ""}
                />
            </div>
            <div className="form-group">
                <label htmlFor="confirmPassword">
                    Neues Passwort bestätigen:
                </label>
                <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordChangeError("");
                    }}
                    className={
                        passwordChangeError.includes("stimmen nicht überein")
                            ? "error-input"
                            : ""
                    }
                />
            </div>
            <div className="button-container" style={{ marginTop: "10px" }}>
                <button
                    type="button"
                    onClick={() => {
                        // type="button" hinzugefügt, um Form-Submit zu verhindern
                        setNewPassword("");
                        setConfirmPassword("");
                        setPasswordChangeError("");
                        onCancel();
                    }}
                    disabled={passwordChangeLoading}
                >
                    Abbrechen
                </button>
                <button
                    type="submit"
                    className={
                        newPassword == confirmPassword &&
                        newPassword != password &&
                        newPassword.trim().length >= 4
                            ? "confirm"
                            : "button-danger"
                    }
                    disabled={passwordChangeLoading}
                >
                    {passwordChangeLoading ? "Speichern..." : "Passwort ändern"}
                </button>
            </div>
        </form>
    );
};

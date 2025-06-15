import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { ConfirmModal } from "../modals/ConfirmModal";
import { ChangePassword } from "../modals/ChangePassword";
import {
    getAllUsers,
    setUserAdminStatus,
    deleteUser,
    changeUsername,
    verifyPassword,
} from "../../api/api";

// --- Typdefinitionen ---
interface UserSettingsProps {
    currentUser: string;
    setCurrentUser: React.Dispatch<React.SetStateAction<string>>;
    isAdmin: boolean;
    swapBack: () => void;
    onLogout: () => void;
    setIsBusy: React.Dispatch<React.SetStateAction<boolean>>;
}

interface User {
    username: string;
    isAdmin: boolean;
    lastLogin: string | null;
}

// --- Komponente ---
export default function UserSettings({
    currentUser,
    setCurrentUser,
    isAdmin,
    swapBack,
    onLogout,
    setIsBusy,
}: UserSettingsProps) {
    const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
    const [password, setPassword] = useState<string>("");
    const [confirmationError, setConfirmationError] = useState<string>("");

    const [newUsername, setNewUsername] = useState<string>(currentUser || "");
    const [isChangingPassword, setIsChangingPassword] =
        useState<boolean>(false);

    const [userList, setUserList] = useState<User[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
    const [userError, setUserError] = useState<string | null>(null);

    const [modal, setModal] = useState<
        | { type: "delete"; username: string }
        | { type: "reset"; username: string }
        | { type: "username"; username: string }
        | null
    >(null);

    const fetchUsers = useCallback(async () => {
        if (!isAdmin) return;
        setIsLoadingUsers(true);
        setUserError(null);
        try {
            const users = await getAllUsers();
            setUserList(users);
        } catch (err: any) {
            setUserError("Benutzerliste konnte nicht geladen werden.");
            toast.error("Fehler beim Laden der Benutzerliste.");
        } finally {
            setIsLoadingUsers(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (isConfirmed) {
            fetchUsers();
        }
    }, [isConfirmed, fetchUsers]);

    const handleConfirmUser = useCallback(async () => {
        if (!password) {
            setConfirmationError("Bitte Passwort eingeben.");
            return;
        }
        setIsBusy(true);
        setConfirmationError("");
        try {
            const result = await verifyPassword(currentUser, password);
            if (result.verified) {
                setIsConfirmed(true);
            } else {
                setConfirmationError("Falsches Passwort.");
                toast.error("Das eingegebene Passwort ist nicht korrekt.");
            }
        } catch (err: any) {
            toast.error("Serverfehler bei der Passwortprüfung.");
        } finally {
            setIsBusy(false);
        }
    }, [currentUser, password, setIsBusy]);

    const handleUsernameChange = useCallback(async () => {
        const trimmedNewUsername = newUsername.trim();
        if (!trimmedNewUsername) {
            toast.error("Der Benutzername darf nicht leer sein.");
            return;
        }
        setModal(null);
        setIsBusy(true);
        try {
            await changeUsername(currentUser, password, trimmedNewUsername);
            toast.success(`Benutzername geändert! Du wirst jetzt abgemeldet.`);
            setCurrentUser(trimmedNewUsername);
            onLogout();
        } catch (err: any) {
            toast.error(
                err.response?.data?.detail ||
                    "Benutzername konnte nicht geändert werden."
            );
        } finally {
            setIsBusy(false);
        }
    }, [
        newUsername,
        currentUser,
        password,
        setCurrentUser,
        onLogout,
        setIsBusy,
    ]);

    const handleToggleAdmin = async (
        targetUsername: string,
        newStatus: boolean
    ) => {
        setIsBusy(true);
        try {
            await setUserAdminStatus(targetUsername, password, newStatus);
            toast.success(`Admin-Status für ${targetUsername} geändert.`);
            await fetchUsers();
        } catch (err: any) {
            toast.error(`Fehler: ${err.response?.data?.detail || err.message}`);
        } finally {
            setIsBusy(false);
        }
    };

    const handleDeleteUser = async (targetUsername: string) => {
        setModal(null);
        setIsBusy(true);
        try {
            await deleteUser(targetUsername, password);
            toast.success(`Benutzer ${targetUsername} wurde gelöscht.`);
            if (targetUsername === currentUser) {
                onLogout();
            } else {
                await fetchUsers();
            }
        } catch (err: any) {
            toast.error(`Fehler: ${err.response?.data?.detail || err.message}`);
        } finally {
            setIsBusy(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isConfirmed) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmUser();
                } else if (e.key === "Escape") {
                    swapBack();
                }
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isConfirmed, handleConfirmUser, swapBack]);

    useEffect(() => {
        setIsBusy(!isConfirmed);
    }, [isConfirmed, setIsBusy]);

    if (!isConfirmed) {
        return (
            <div className="user-confirmation-overlay">
                <div className="user-confirmation-box">
                    <h3>Identität bestätigen</h3>
                    <p>
                        Bitte gib dein aktuelles Passwort ein, um deine
                        Kontoeinstellungen zu verwalten.
                    </p>
                    {confirmationError && (
                        <p className="error-message">{confirmationError}</p>
                    )}
                    <input
                        type="password"
                        placeholder="Dein Passwort"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={confirmationError ? "error-input" : ""}
                    />
                    <div className="button-group">
                        <button onClick={swapBack} className="button secondary">
                            Abbrechen
                        </button>
                        <button
                            onClick={handleConfirmUser}
                            className="button confirm"
                        >
                            Bestätigen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="settings-section">
                <div className="settings-section-header">
                    <h3>Mein Konto</h3>
                </div>
                <div className="setting-group">
                    <div className="setting-item">
                        <label htmlFor="username">Benutzername</label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <input
                                id="username"
                                type="text"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                            />
                            <button
                                className="button primary"
                                onClick={() =>
                                    setModal({
                                        type: "username",
                                        username: newUsername,
                                    })
                                }
                                disabled={newUsername === currentUser}
                            >
                                Ändern
                            </button>
                        </div>
                    </div>
                    <div className="setting-item">
                        <label>Passwort</label>
                        <button
                            onClick={() => {
                                setIsChangingPassword(true);
                                setIsBusy(true);
                            }}
                        >
                            Passwort ändern
                        </button>
                    </div>
                    <div className="setting-item">
                        <label>Konto löschen</label>
                        <button
                            onClick={() =>
                                setModal({
                                    type: "delete",
                                    username: currentUser,
                                })
                            }
                            className="button-danger"
                        >
                            Meinen Account endgültig löschen
                        </button>
                    </div>
                </div>

                {isAdmin && (
                    <>
                        <div className="settings-section-header">
                            <h3>Benutzerverwaltung</h3>
                        </div>
                        {isLoadingUsers ? (
                            <p>Lade Benutzer...</p>
                        ) : userError ? (
                            <p className="error-message">{userError}</p>
                        ) : (
                            <div className="table-container">
                                <table className="user-management-table">
                                    <thead>
                                        <tr>
                                            <th>Benutzername</th>
                                            <th>Admin</th>
                                            <th>Letzter Login</th>
                                            <th className="actions-cell">
                                                Aktionen
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {userList.map((user) => (
                                            <tr key={user.username}>
                                                <td>{user.username}</td>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={user.isAdmin}
                                                        onChange={() =>
                                                            handleToggleAdmin(
                                                                user.username,
                                                                !user.isAdmin
                                                            )
                                                        }
                                                        disabled={
                                                            user.username ===
                                                            currentUser
                                                        }
                                                        title={
                                                            user.username ===
                                                            currentUser
                                                                ? "Eigenen Admin-Status nicht änderbar"
                                                                : "Admin-Status umschalten"
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    {user.lastLogin
                                                        ? new Date(
                                                              user.lastLogin
                                                          ).toLocaleString(
                                                              "de-DE"
                                                          )
                                                        : "Nie"}
                                                </td>
                                                <td className="actions-cell">
                                                    <button
                                                        onClick={() => {
                                                            setIsBusy(true);
                                                            setModal({
                                                                type: "reset",
                                                                username:
                                                                    user.username,
                                                            })
                                                        }}
                                                        disabled={
                                                            user.username ===
                                                            currentUser
                                                        }
                                                    >
                                                        PW Reset
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setIsBusy(true);
                                                            setModal({
                                                                type: "delete",
                                                                username:
                                                                    user.username,
                                                            });
                                                        }}
                                                        className="button-danger"
                                                        disabled={
                                                            user.username ===
                                                            currentUser
                                                        }
                                                    >
                                                        Löschen
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {isChangingPassword && (
                <div className="overlay">
                    <ChangePassword
                        currentUser={currentUser}
                        password={password}
                        adminUser={null}
                        adminPassword={null}
                        passwordReset={false}
                        onLogout={() => {
                            onLogout();
                        }}
                        onCancel={() => {
                            setIsChangingPassword(false);
                            setIsBusy(false);
                        }}
                    />
                </div>
            )}

            {modal?.type === "delete" && (
                <ConfirmModal
                    title="Benutzer löschen"
                    message={`Bist du absolut sicher, dass du den Benutzer "${modal.username}" endgültig löschen willst? Diese Aktion kann nicht rückgängig gemacht werden.`}
                    isDanger={true}
                    onConfirm={() => handleDeleteUser(modal.username)}
                    onCancel={() => setModal(null)}
                />
            )}
            {modal?.type === "reset" && (
                <div className="overlay"><ChangePassword
                    currentUser={modal.username}
                    password={''}
                    adminUser={currentUser}
                    adminPassword={password}
                    passwordReset={true}
                    onLogout={() => {
                        toast.success(`Das Passwort des Benutzers ${modal.username} wurde erfolgreich geändert!`);
                        setIsBusy(false);
                        setModal(null);
                    }}
                    onCancel={() => {
                        setModal(null);
                        setIsBusy(false);
                    }}
                /></div>
            )}
            {modal?.type === "username" && (
                <ConfirmModal
                    title="Benutzername ändern"
                    message={`Willst du deinen Benutzernamen wirklich zu "${modal.username}" ändern? Du wirst danach automatisch abgemeldet.`}
                    isDanger={true}
                    onConfirm={handleUsernameChange}
                    onCancel={() => setModal(null)}
                />
            )}
        </>
    );
}

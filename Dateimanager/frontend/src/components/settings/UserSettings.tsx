import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify'; // Annahme: Toast ist global verfügbar
import { ConfirmModal } from '../ConfirmModal.tsx';
import { ChangePassword } from './ChangePassword.tsx';
import { getAllUsers, setUserAdminStatus, deleteUser, resetUserPassword, changeUsername, verifyPassword } from '../../api/api.tsx';

// --- UserSettings Komponente ---
// Erwartet Props: currentUser (Objekt mit {username}), isAdmin (boolean)
export default function UserSettings({ currentUser, setCurrentUser, isAdmin, swapBack, onLogout, setIsBusy }) {
    // --- Allgemein ---
    const [confirmedUser, setConfirmedUser] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmationError, setConfirmationError] = useState('')

    // --- State für Benutzereinstellungen ---
    const [username, setUsername] = useState(currentUser || '');
    const [changingPassword, setChangingPassword] = useState(false);

    // --- State für Benutzerverwaltung (Admin) ---
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userError, setUserError] = useState(null);
    const [showConfirmUsernameModal, setShowConfirmUsernameModal] = useState(null); // Enthält neuen username
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(null); // Enthält username zum Löschen
    const [showConfirmResetModal, setShowConfirmResetModal] = useState(null); // Enthält username zum Resetten

    // --- Effekt zum Laden der Userliste (nur für Admins) ---
    useEffect(() => {
        const fetchUsers = async () => {
            setLoadingUsers(true);
            setUserError(null);
            try {
                const users = await getAllUsers();
                setUserList(users);
            } catch (err) {
                console.error("Fehler beim Laden der Benutzerliste:", err);
                setUserError("Benutzerliste konnte nicht geladen werden.");
                toast.error("Fehler beim Laden der Benutzerliste.");
            } finally {
                setLoadingUsers(false);
            }
        };

        if (isAdmin) {
            fetchUsers();
        } else {
            setUserList([]); // Liste leeren, wenn kein Admin
        }
    }, [isAdmin]); // Neu laden, wenn sich Admin-Status ändert

    // --- Handler ---
    const handleConfirmUser = async () => {
        try {
            const result = await verifyPassword(currentUser, password);
            console.log(result);
            if (result.verified === true) {
                setConfirmedUser(true);
            } else {
                setConfirmationError('Falsches Passwort.');
                toast.error('Bitte geben Sie Ihr aktuelles Passwort ein.');
            }
        } catch (err) {
            console.error("Fehler bei der Passwortprüfung:", err);
            toast.error('Serverfehler bei Passwortprüfung.');
        } finally {
            setIsBusy(false);
        }
    };

    const handleUsernameChange = async () => {
        const trimmedNewUsername = username.trim();
        if (!trimmedNewUsername) {
            toast.error('Der neue Benutzername darf nicht leer sein.');
            return;
        }

        if (!password) {
            toast.error('Bitte gib dein Passwort zur Bestätigung ein.');
            return;
        }

        try {
            await changeUsername(currentUser, password, trimmedNewUsername);
            toast.success(`Benutzername wurde von ${currentUser} zu ${trimmedNewUsername} geändert!`);

            // Speichern und weiterreichen
            window.localStorage.setItem('username', trimmedNewUsername);
            setCurrentUser(trimmedNewUsername);

            // Rauswerfen zur Reauthentifizierung
            onLogout();
        } catch (err) {
            const message = err.message || "Benutzername konnte nicht geändert werden.";
            toast.error(message);
        }
    };

    const handleToggleAdmin = async (targetUsername, currentIsAdmin) => {
        try {
            const response = await setUserAdminStatus(targetUsername, currentUser, password);
            toast.success(response.message);

            // Userliste neu laden oder lokal aktualisieren
            setUserList(prevList => prevList.map(user =>
                user.username === targetUsername ? { ...user, isAdmin: !currentIsAdmin } : user
            ));
        } catch (err) {
            toast.error(`Fehler beim Ändern des Admin-Status für ${targetUsername}.`);
            console.error("Admin Status Error:", err);
        }
    };

    const handleDeleteUser = async (targetUsername) => {
        setShowConfirmDeleteModal(null); // Modal schließen
        try {
            // Sicherheit: Sich selbst löschen verhindern?
            const response = await deleteUser(targetUsername, password)
            if (targetUsername === currentUser) {
                toast.warn("Dein Account wurde gelöscht!");
            }
            toast.success(response.message);

            // User aus Liste entfernen
            setUserList(prevList => prevList.filter(user => user.username !== targetUsername));
        } catch (err) {
            toast.error(`Fehler beim Löschen von ${targetUsername}.`);
            console.error("Delete User Error:", err);
        }
    };

    const handleResetPassword = async (targetUsername) => {
        setShowConfirmResetModal(null); // Modal schließen
        try {
            const response = await resetUserPassword(targetUsername, currentUser, password);
            toast.success(response.message);
        } catch (err) {
            toast.error(`Fehler beim Zurücksetzen des Passworts für ${targetUsername}.`);
            console.error("Reset Password Error:", err);
        }
    };

    useEffect(() => {
        if (!confirmedUser) {
            setIsBusy(true);
        }
    }, [confirmedUser]);

    // --- Key Handler ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!confirmedUser) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmUser();
                }
                if (e.key === 'Escape') {
                    swapBack();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleConfirmUser, swapBack, confirmedUser]);

    return (
        <div className="user-settings-container">
            {/* === Abschnitt: Nutzer Bestätigen === */}
            {!confirmedUser && (
                <div className="overlay">
                    <div className="user-confirmation">
                        <h3>Nutzer bestätigen</h3>
                        <p>Für die Accountverwaltung bestätigen sie bitte ihre Identität.</p>
                        {confirmationError && (
                            <p className="error-message">{confirmationError}</p>
                        )}
                        <input
                            type="password"
                            placeholder='Password'
                            autoFocus
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={confirmationError ? 'error-input' : ''}
                        />
                        <div className="confirm-buttons">
                            <button onClick={handleConfirmUser}>Bestätigen</button>
                            <button onClick={swapBack}>Abbrechen</button>
                        </div>
                    </div>
                </div>
            )}

            {/* === Abschnitt: Konto Verwaltung === */}
            <div className="settings-section">
                <h3>Konto Verwaltung</h3>
                <div className="form-group">
                    <label>Benutzername:</label>
                    <div className="change-username-div">
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
                        <button className='confirm' onClick={() => {setShowConfirmUsernameModal(username); setIsBusy(true);}}>Speichern</button>
                    </div>

                    <label>Passwort Ändern:</label>
                    <button onClick={() => {setChangingPassword(true); setIsBusy(true);}}>Passwort Ändern</button>

                    <label>Account Löschen:</label>
                    <button onClick={() => {
                        setShowConfirmDeleteModal(currentUser);
                        setIsBusy(true);
                    }} className="disfirm">Account Löschen</button>
                </div>
            </div>

            {/* === Abschnitt: Benutzerverwaltung (Nur für Admins) === */}
            {isAdmin && (
                <div className="settings-section">
                    <h3>Benutzerverwaltung</h3>

                    {loadingUsers && <p className="settings-message">Lade Benutzerliste...</p>}

                    {userError && <p className="settings-message error">{userError}</p>}

                    {!loadingUsers && !userError && (
                        <div className="table-container">
                            <table className="user-management-table">
                                <thead>
                                    <tr>
                                        <th>Benutzername</th>
                                        <th>Admin</th>
                                        <th>Letzter Login</th>
                                        <th style={{ textAlign: 'right' }}>Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userList.map(user => (
                                        <tr key={user.username}>
                                            <td>{user.username}</td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={user.isAdmin}
                                                    onChange={() => handleToggleAdmin(user.username, user.isAdmin)}
                                                    disabled={user.username === currentUser} // Sich selbst nicht ändern
                                                    title={user.username === currentUser ? "Eigenen Admin-Status nicht änderbar" : "Admin-Status umschalten"}
                                                    style={{ cursor: user.username === currentUser ? 'not-allowed' : 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                {user.lastLogin ? new Date(user.lastLogin).toLocaleString('de-DE') : 'Nie'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    onClick={() => {setShowConfirmResetModal(user.username); setIsBusy(true);}}
                                                    disabled={user.username === currentUser} // Eigenes PW hier nicht zurücksetzen
                                                    title={user.username === currentUser ? "Eigenes Passwort hier nicht zurücksetzen" : "Passwort zurücksetzen"}
                                                    className={user.username === currentUser ? 'disabled table-button' : 'table-button'}
                                                >
                                                    PW Reset
                                                </button>

                                                <button
                                                    onClick={() => {setShowConfirmDeleteModal(user.username); setIsBusy(true);}}
                                                    disabled={user.username === currentUser} // Sich selbst nicht löschen
                                                    title={user.username === currentUser ? "Eigenen Account nicht löschen" : "Benutzer löschen"}
                                                    className={user.username === currentUser ? 'disabled table-button delete-button' : 'table-button delete-button'}
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
                </div>
            )}

            {/* Confirmation Modals für Admin-Aktionen */}
            {showConfirmDeleteModal && (
                <ConfirmModal
                    title="Account löschen"
                    message={`⚠️ WARNUNG: Willst du den Account ${showConfirmDeleteModal} wirklich Löschen?`}
                    isDanger={true}
                    onConfirm={() => {
                        handleDeleteUser(showConfirmDeleteModal);
                        setIsBusy(false);
                        if (showConfirmDeleteModal === currentUser) {
                            onLogout();
                        }
                    }}
                    onCancel={() => {
                        setShowConfirmDeleteModal(null);
                        setIsBusy(false);
                    }}
                />
            )}

            {changingPassword && (
                <div className='overlay'>
                    <ChangePassword
                        currentUser={currentUser}
                        password={password}
                        onLogout={() => {
                            onLogout();
                            setIsBusy(false);
                        }}
                        onCancel={() => {
                            setChangingPassword(false);
                            setIsBusy(false);
                        }}
                    />
                </div>
            )}

            {showConfirmResetModal && (
                <ConfirmModal
                    title="Passwort zurücksetzen"
                    isDanger={true}
                    message={`Soll das Passwort für "${showConfirmResetModal}" wirklich zurückgesetzt werden? Der Benutzer muss ggf. ein neues setzen.`}
                    onConfirm={() => {
                        handleResetPassword(showConfirmResetModal);
                        setIsBusy(false);
                    }}
                    onCancel={() => {
                        setShowConfirmResetModal(null);
                        setIsBusy(false);
                    }}
                />
            )}

            {showConfirmUsernameModal && (
                <ConfirmModal
                    title="Benutzername ändern"
                    message={`Willst du deinen Benutzernamen wirklich zu ${showConfirmUsernameModal} ändern?`}
                    isDanger={true}
                    onConfirm={() => {
                        handleUsernameChange();
                        setShowConfirmUsernameModal(null);
                        setIsBusy(false);
                    }}
                    onCancel={() => {
                        setShowConfirmUsernameModal(null);
                        setIsBusy(false);
                    }}
                />
            )}

        </div>
    );
}

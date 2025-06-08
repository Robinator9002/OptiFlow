import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { ConfirmModal } from "../ConfirmModal.tsx";
import { ChangePassword } from "./ChangePassword.tsx";
import {
  getAllUsers,
  setUserAdminStatus,
  deleteUser,
  resetUserPassword,
  changeUsername,
  verifyPassword,
} from "../../api/api.tsx";

// --- Type Definitions ---
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

// --- Component ---
export default function UserSettings({
  currentUser,
  setCurrentUser,
  isAdmin,
  swapBack,
  onLogout,
  setIsBusy,
}: UserSettingsProps) {
  const [confirmedUser, setConfirmedUser] = useState<boolean>(false);
  const [password, setPassword] = useState<string>("");
  const [confirmationError, setConfirmationError] = useState<string>("");
  const [username, setUsername] = useState<string>(currentUser || "");
  const [changingPassword, setChangingPassword] = useState<boolean>(false);
  const [userList, setUserList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [showConfirmUsernameModal, setShowConfirmUsernameModal] = useState<
    string | null
  >(null);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState<
    string | null
  >(null);
  const [showConfirmResetModal, setShowConfirmResetModal] = useState<
    string | null
  >(null);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setUserList([]);
      return;
    }
    setLoadingUsers(true);
    setUserError(null);
    try {
      const users = await getAllUsers();
      setUserList(users);
    } catch (err: any) {
      setUserError("Benutzerliste konnte nicht geladen werden.");
      toast.error("Fehler beim Laden der Benutzerliste.");
    } finally {
      setLoadingUsers(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleConfirmUser = useCallback(async () => {
    setIsBusy(true);
    try {
      const result = await verifyPassword(currentUser, password);
      if (result.verified) {
        setConfirmedUser(true);
      } else {
        setConfirmationError("Falsches Passwort.");
        toast.error("Bitte geben Sie Ihr aktuelles Passwort ein.");
      }
    } catch (err: any) {
      toast.error("Serverfehler bei Passwortprüfung.");
    } finally {
      setIsBusy(false);
    }
  }, [currentUser, password, setIsBusy]);

  const handleUsernameChange = useCallback(async () => {
    const trimmedNewUsername = username.trim();
    if (!trimmedNewUsername || !password) {
      toast.error("Benutzername und Passwort dürfen nicht leer sein.");
      return;
    }
    try {
      await changeUsername(currentUser, password, trimmedNewUsername);
      toast.success(
        `Benutzername wurde zu ${trimmedNewUsername} geändert! Sie werden abgemeldet.`
      );
      setCurrentUser(trimmedNewUsername);
      onLogout();
    } catch (err: any) {
      toast.error(err.message || "Benutzername konnte nicht geändert werden.");
    }
  }, [username, currentUser, password, setCurrentUser, onLogout]);

  const handleToggleAdmin = async (
    targetUsername: string,
    currentIsAdmin: boolean
  ) => {
    try {
      const response = await setUserAdminStatus(
        targetUsername,
        currentUser,
        password
      );
      toast.success(response.message);
      await fetchUsers(); // Refetch to get the latest state
    } catch (err: any) {
      toast.error(`Fehler beim Ändern des Admin-Status für ${targetUsername}.`);
    }
  };

  const handleDeleteUser = async (targetUsername: string) => {
    setShowConfirmDeleteModal(null);
    try {
      const response = await deleteUser(targetUsername, password);
      toast.success(response.message);
      await fetchUsers(); // Refetch
      if (targetUsername === currentUser) {
        toast.warn("Dein Account wurde gelöscht!");
        onLogout();
      }
    } catch (err: any) {
      toast.error(`Fehler beim Löschen von ${targetUsername}.`);
    }
  };

  const handleResetPassword = async (targetUsername: string) => {
    setShowConfirmResetModal(null);
    try {
      const response = await resetUserPassword(
        targetUsername,
        currentUser,
        password
      );
      toast.success(response.message);
    } catch (err: any) {
      toast.error(
        `Fehler beim Zurücksetzen des Passworts für ${targetUsername}.`
      );
    }
  };

  useEffect(() => {
    setIsBusy(!confirmedUser);
  }, [confirmedUser, setIsBusy]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!confirmedUser) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirmUser();
        }
        if (e.key === "Escape") {
          swapBack();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleConfirmUser, swapBack, confirmedUser]);

  return (
    <div className="user-settings-container">
      {!confirmedUser && (
        <div className="overlay">
          <div className="user-confirmation">
            <h3>Nutzer bestätigen</h3>
            <p>
              Für die Accountverwaltung bestätigen sie bitte ihre Identität.
            </p>
            {confirmationError && (
              <p className="error-message">{confirmationError}</p>
            )}
            <input
              type="password"
              placeholder="Password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={confirmationError ? "error-input" : ""}
            />
            <div className="confirm-buttons">
              <button onClick={handleConfirmUser}>Bestätigen</button>
              <button onClick={swapBack}>Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {confirmedUser && (
        <>
          <div className="settings-section">
            <h3>Konto Verwaltung</h3>
            <div className="form-group">
              <label>Benutzername:</label>
              <div className="change-username-div">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <button
                  className="confirm"
                  onClick={() => setShowConfirmUsernameModal(username)}
                >
                  Speichern
                </button>
              </div>

              <label>Passwort Ändern:</label>
              <button onClick={() => setChangingPassword(true)}>
                Passwort Ändern
              </button>

              <label>Account Löschen:</label>
              <button
                onClick={() => setShowConfirmDeleteModal(currentUser)}
                className="disfirm"
              >
                Account Löschen
              </button>
            </div>
          </div>

          {isAdmin && (
            <div className="settings-section">
              <h3>Benutzerverwaltung</h3>
              {loadingUsers && (
                <p className="settings-message">Lade Benutzerliste...</p>
              )}
              {userError && (
                <p className="settings-message error">{userError}</p>
              )}
              {!loadingUsers && !userError && (
                <div className="table-container">
                  <table className="user-management-table">
                    <thead>
                      <tr>
                        <th>Benutzername</th>
                        <th>Admin</th>
                        <th>Letzter Login</th>
                        <th style={{ textAlign: "right" }}>Aktionen</th>
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
                                handleToggleAdmin(user.username, user.isAdmin)
                              }
                              disabled={user.username === currentUser}
                              title={
                                user.username === currentUser
                                  ? "Eigenen Admin-Status nicht änderbar"
                                  : "Admin-Status umschalten"
                              }
                              style={{
                                cursor:
                                  user.username === currentUser
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            />
                          </td>
                          <td
                            style={{
                              fontSize: "0.85rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleString("de-DE")
                              : "Nie"}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              onClick={() =>
                                setShowConfirmResetModal(user.username)
                              }
                              disabled={user.username === currentUser}
                              className={
                                user.username === currentUser ? "disabled" : ""
                              }
                            >
                              PW Reset
                            </button>
                            <button
                              onClick={() =>
                                setShowConfirmDeleteModal(user.username)
                              }
                              disabled={user.username === currentUser}
                              className={
                                user.username === currentUser
                                  ? "disabled delete-button"
                                  : "delete-button"
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
            </div>
          )}
        </>
      )}

      {showConfirmDeleteModal && (
        <ConfirmModal
          title="Account löschen"
          message={`⚠️ WARNUNG: Willst du den Account ${showConfirmDeleteModal} wirklich Löschen?`}
          isDanger={true}
          onConfirm={() => handleDeleteUser(showConfirmDeleteModal)}
          onCancel={() => setShowConfirmDeleteModal(null)}
        />
      )}

      {changingPassword && (
        <div className="overlay">
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
          message={`Soll das Passwort für "${showConfirmResetModal}" wirklich zurückgesetzt werden?`}
          onConfirm={() => handleResetPassword(showConfirmResetModal)}
          onCancel={() => setShowConfirmResetModal(null)}
        />
      )}

      {showConfirmUsernameModal && (
        <ConfirmModal
          title="Benutzername ändern"
          message={`Willst du deinen Benutzernamen wirklich zu ${showConfirmUsernameModal} ändern?`}
          isDanger={true}
          onConfirm={handleUsernameChange}
          onCancel={() => setShowConfirmUsernameModal(null)}
        />
      )}
    </div>
  );
}

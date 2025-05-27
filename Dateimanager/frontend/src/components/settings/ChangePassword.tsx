import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { changePassword } from '../../api/api.tsx'

export function ChangePassword({ currentUser, password, onLogout, onCancel }) {
    // --- State für Passwortänderung ---
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
    const [passwordChangeError, setPasswordChangeError] = useState('');

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                const active = document.activeElement;
                if (active) { // Dein brillanter Fix!
                    // Innerhalb dieses Blocks ist 'active' garantiert kein 'null' mehr.
                    const isInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA';
                    if (isInput) {
                        e.preventDefault();
                        handlePasswordChange(e); // Du übergibst hier das KeyboardEvent
                    }
                } else {
                    // Hier kommt dein Gedanke mit der Fehlermeldung ins Spiel.
                    // Für den Benutzer ist eine Fehlermeldung hier wahrscheinlich nicht nötig,
                    // denn wenn kein Input-Feld aktiv ist, erwartet er vermutlich auch keine Aktion bei "Enter".
                    // Man könnte hier höchstens für Entwicklungszwecke loggen:
                    // console.debug('Enter pressed without an active element qualifying for submission.');
                    // Aber im Produktivcode ist es oft am besten, hier einfach nichts zu tun.
                }
            }
        };
    
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [newPassword, confirmPassword]); // Abhängigkeiten, falls State drin vorkommt

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPasswordChangeError('');

        if (!newPassword || !confirmPassword) {
            setPasswordChangeError('Bitte beide Passwortfelder ausfüllen.');
            toast.error('Bitte beide Passwortfelder ausfüllen.');
            return;
        }
    
        if (newPassword.trim().length < 4) {
            setPasswordChangeError('Das neue Passwort muss mindestens 4 Zeichen lang sein.');
            toast.error('Das neue Passwort muss mindestens 4 Zeichen lang sein.');
            return;
        }
    
        if (newPassword !== confirmPassword) {
            setPasswordChangeError('Die neuen Passwörter stimmen nicht überein.');
            toast.error('Die neuen Passwörter stimmen nicht überein.');
            return;
        }

        setPasswordChangeLoading(true);
        try {
            if (newPassword === confirmPassword) {
                const response = await changePassword(currentUser, password, newPassword);
                toast.success(response.message);
                // Felder leeren
                setNewPassword('');
                setConfirmPassword('');
                setPasswordChangeError('');
                // Ausloggen
                onLogout();
            }
            else {
                setPasswordChangeError('Neues Passwort ist nicht identisch.');
                toast.error('Neues Passwort ist nicht identisch.');
            }
        } catch (err) {
            const message = err.message || "Passwort konnte nicht geändert werden.";
            setPasswordChangeError(message);
            toast.error(message);
        } finally {
            setPasswordChangeLoading(false);
        }
    };

    return (
        <form className="password-change-field" onSubmit={handlePasswordChange}>
            <h4>Passwort ändern</h4>
            {passwordChangeError && <p className="error-message" style={{ textAlign: 'left', marginBottom: '10px' }}>{passwordChangeError}</p>}
            <div className="form-group">
                <label htmlFor="newPassword">Neues Passwort:</label>
                <input
                    type="password"
                    id="newPassword"
                    autoFocus
                    value={newPassword}
                    onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordChangeError('');
                    }}
                    className={passwordChangeError.includes('stimmen nicht überein') || passwordChangeError.includes('mindestens 6 Zeichen') ? 'error-input' : ''}
                />
            </div>
            <div className="form-group">
                <label htmlFor="confirmPassword">Neues Passwort bestätigen:</label>
                <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordChangeError('');
                    }}
                    className={passwordChangeError.includes('stimmen nicht überein') ? 'error-input' : ''}
                />
            </div>
            <div className="button-container" style={{ marginTop: '10px' }}>
                <button type="submit" disabled={passwordChangeLoading}>
                    {passwordChangeLoading ? 'Speichern...' : 'Passwort ändern'}
                </button>
                <button onClick={() => {
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordChangeError('');
                    onCancel();
                }} disabled={passwordChangeLoading}>
                    Abbrechen
                </button>
            </div>
        </form>
    );
}




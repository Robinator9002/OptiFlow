import React, { useState } from 'react';
import { loginUser, registerUser } from '../api/api.tsx';
import { toast } from 'react-toastify';

const Login = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [adminUsername, setAdminUsername] = useState('');
    const [adminPassword, setAdminPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const trimmedUsername = username.trim();

        // Gemeinsame Validierung
        if (!trimmedUsername || (isRegistering && !password.trim())) {
            setError('Benutzername und Passwort dürfen nicht leer sein.');
            toast.error('Benutzername und Passwort dürfen nicht leer sein.');
            setLoading(false);
            return;
        }

        if (isRegistering) {
            if (password.trim().length < 4) {
                setError('Das Passwort muss mindestens 4 Zeichen lang sein.');
                toast.error('Das Passwort muss mindestens 4 Zeichen lang sein.');
                setLoading(false);
                return;
            }

            if (!adminPassword) {
                setError('Administrator-Zugangsdaten werden benötigt, um einen neuen Benutzer zu registrieren.');
                toast.error('Administrator-Zugangsdaten erforderlich.');
                setLoading(false);
                return;
            }
        }

        try {
            let response;
            if (isRegistering) {
                response = await registerUser(trimmedUsername, password, adminUsername, adminPassword, isAdmin);
            } else {
                response = await loginUser(trimmedUsername, password);
            }
            toast.success(response.message);
            onLoginSuccess(trimmedUsername);
        } catch (err) {
            const errorMessage = err.response?.data?.detail || 'Anmeldung/Registrierung fehlgeschlagen.';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-form">
                <h2>{isRegistering ? 'Registrieren' : 'Anmelden'}</h2>
                {error && <p className="error-message">{error}</p>}
                <input
                    type="text"
                    placeholder="Benutzername"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={error ? 'error-input' : ''}
                />
                <input
                    type="password"
                    placeholder="Passwort"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={error ? 'error-input' : ''}
                />
                {isRegistering && (
                    <>
                        <input
                            type="text"
                            placeholder="Administrator-Benutzername"
                            value={adminUsername}
                            onChange={(e) => setAdminUsername(e.target.value)}
                            className={error ? 'error-input' : ''}
                        />
                        <input
                            type="password"
                            placeholder="Administrator-Passwort"
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className={error ? 'error-input' : ''}
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
                    {loading ? 'Lädt...' : isRegistering ? 'Registrieren' : 'Anmelden'}
                </button>
                <button type="button" onClick={() => setIsRegistering(!isRegistering)}>
                    {isRegistering ? 'Zurück zum Login' : 'Registrieren'}
                </button>
            </form>
        </div>
    );
};

export default Login;
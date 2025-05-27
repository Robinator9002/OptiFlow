import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    verifyPassword,
    shutdown,
    getAllEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    executeEvent,
} from '../../api/api.tsx';
import { ConfirmModal } from '../ConfirmModal.tsx';

const ALLOWED_EVENTS = [
    { value: 'scanner', label: 'Scanner aktualisieren' },
    { value: 'file-structure', label: 'Struktur neu einlesen' },
];
const FREQUENCIES = [
    { value: 'hourly', label: 'Stündlich' },
    { value: 'daily', label: 'Täglich' },
    { value: 'weekly', label: 'Wöchentlich' },
];

export default function SystemSettings({ currentUser, checkInterval, setCheckInterval, setExecutingEvent, setIsBusy, onLogout }) {
    const [password, setPassword] = useState('');
    const [showShutdownConfirm, setShowShutdownConfirm] = useState(false);
    const [showFinalShutdownConfirm, setShowFinalShutdownConfirm] = useState(false);
    const [loadingShutdown, setLoadingShutdown] = useState(false);
    const [events, setEvents] = useState([]);
    const [editingIndex, setEditingIndex] = useState(null);
    const [shutdownError, setShutdownError] = useState(null);
    const [formData, setFormData] = useState({
        event: '',
        frequency: 'daily',
        times: [''],
    });

    // === NEU: loadEvents in useCallback ===
    const loadEvents = useCallback(async () => {
        setIsBusy(true);
        try {
            const list = await getAllEvents();
            setEvents(list);
        } catch {
            toast.error('Fehler beim Laden der Events.');
        } finally {
            setIsBusy(false);
        }
    }, [setIsBusy]); // Dependencies: setIsBusy

    // Laden beim Mounten (verwendet die useCallback-Version von loadEvents)
    useEffect(() => {
        loadEvents();
    }, [loadEvents]); // Dependencies: loadEvents

    // === NEU: closeForm in useCallback ===
    const closeForm = useCallback(() => {
        setIsBusy(false);
        setEditingIndex(null);
        setFormData({ event: '', frequency: 'daily', times: [''] });
    }, [setIsBusy, setEditingIndex, setFormData]); // Dependencies: State setters

    const openForm = (index) => {
        setIsBusy(true);
        if (index === 'new') {
            setFormData({ event: '', frequency: 'daily', times: [''] });
        } else {
            const ev = events[index];
            setFormData({ event: ev.event, frequency: ev.frequency, times: [...ev.times] });
        }
        setEditingIndex(index);
    };

    const handleTimeChange = (i, v) => {
        const ts = [...formData.times]; ts[i] = v;
        setFormData({ ...formData, times: ts });
    };
    const addTimeField = () => setFormData({ ...formData, times: [...formData.times, ''] });
    const removeTimeField = (i) => {
        const ts = formData.times.filter((_, idx) => idx !== i);
        setFormData({ ...formData, times: ts });
    };

    // === NEU: handleFormSubmit in useCallback ===
    const handleFormSubmit = useCallback(async () => {
        const { event, frequency, times } = formData;
        if (!event || times.some(t => !t)) {
            toast.error('Bitte alle Felder ausfüllen.');
            return;
        }
        setIsBusy(true);
        try {
            if (editingIndex === 'new') {
                await addEvent(frequency, times, event);
                toast.success('Event hinzugefügt');
            } else {
                await updateEvent(editingIndex, frequency, times, event);
                toast.success('Event aktualisiert');
            }
            closeForm(); // closeForm ist jetzt stabil (useCallback)
            await loadEvents(); // loadEvents ist jetzt stabil (useCallback)
        } catch {
            toast.error('Fehler beim Speichern des Events');
        } finally {
            setIsBusy(false);
        }
    }, [formData, editingIndex, setIsBusy, closeForm, loadEvents]); // Dependencies: formData, editingIndex, setIsBusy, closeForm, loadEvents

    // === NEU: handleDelete in useCallback ===
    const handleDelete = useCallback(async (i) => {
        setIsBusy(true);
        try {
            await deleteEvent(i);
            toast.success('Event gelöscht');
            await loadEvents(); // loadEvents ist jetzt stabil (useCallback)
        } catch {
            toast.error('Fehler beim Löschen des Events');
        } finally {
            setIsBusy(false);
        }
    }, [setIsBusy, loadEvents]); // Dependencies: setIsBusy, loadEvents

    // === NEU: handleExecute in useCallback ===
    const handleExecute = useCallback(async (i) => {
        setIsBusy(true);
        setExecutingEvent(true);
        try {
            await executeEvent(i);
            toast.success('Event ausgeführt');
        } catch {
            toast.error('Fehler beim Ausführen des Events');
        } finally {
            setExecutingEvent(false);
            setIsBusy(false);
        }
    }, [setExecutingEvent, setIsBusy]); // Dependencies: setExecutingEvent, setIsBusy

    const requestShutdown = () => {
        setShutdownError(null);
        setPassword('');
        setShowShutdownConfirm(true);
        setIsBusy(true);
    };

    const confirmShutdown = useCallback(async () => {
        // Kein setIsBusy(true) hier, da es schon in requestShutdown gesetzt wurde
        try {
            setShutdownError(null);
            const response = await verifyPassword(currentUser, password);
            if (response.verified) {
                setShowShutdownConfirm(false);
                setShowFinalShutdownConfirm(true);
                setShutdownError(null);
                // setIsBusy(false) wird erst nach dem finalen Shutdown-Aufruf zurückgesetzt
                // oder wenn das finale Modal abgebrochen wird.
            }
            else {
                setShutdownError('Passwort nicht korrekt!');
                toast.error('Passwort ist nicht korrekt!');
                // setIsBusy(false) wird hier nicht zurückgesetzt, da das Modal offen bleibt
            }
        } catch (err) {
            console.error("Fehler beim Verifizieren des Passworts:", err);
            setShutdownError('Fehler beim Verifizieren des Passworts');
            toast.error('Fehler beim Verifizieren des Passworts');
            // setIsBusy(false) wird hier nicht zurückgesetzt, da das Modal offen bleibt
        }
    }, [currentUser, password, setShowShutdownConfirm, setShowFinalShutdownConfirm, setShutdownError, setPassword, setIsBusy]); // Dependencies: currentUser, password, State setters/Props

    const handleShutdown = useCallback(async () => {
        setLoadingShutdown(true);
        setIsBusy(true);
        try {
            await shutdown(password); // Passwort hier übergeben
            toast.success('Server wird heruntergefahren');
            onLogout();
        } catch {
            toast.error('Fehler beim Herunterfahren');
        } finally {
            setLoadingShutdown(false);
            setShowFinalShutdownConfirm(false);
            setIsBusy(false);
        }
    }, [password, setIsBusy, setLoadingShutdown, setShowFinalShutdownConfirm]); // Dependencies: password, setIsBusy, State setters

    // === GEÄNDERT: Effekt für globale Keybindings (Enter/Escape) ===
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Reagiere nicht, wenn ein Modal (Passwort oder Final Confirm) offen ist,
            // da die Modal-Komponenten ihre eigenen Keydown-Handler haben sollten,
            // um Konflikte zu vermeiden.
            // Wir behandeln Enter/Escape für das benutzerdefinierte Passwort-Modal
            // jetzt direkt hier, da es kein ConfirmModal ist.
            if (editingIndex !== null) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFormSubmit(); // handleFormSubmit ist jetzt stabil (useCallback)
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeForm(); // closeForm ist jetzt stabil (useCallback)
                }
            }
            // === NEU: Handle Enter/Escape für das benutzerdefinierte Passwort-Modal ===
            if (showShutdownConfirm) {
                // Wenn das Passwort-Modal offen ist
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmShutdown(); // confirmShutdown ist jetzt stabil (useCallback)
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    // Schließe das Passwort-Modal und setze busy zurück
                    setShowShutdownConfirm(false);
                    setShutdownError(null);
                    setPassword('');
                    setIsBusy(false);
                }
            }
            // Escape für das finale ConfirmModal wird durch dessen internen useEffect gehandhabt
            // (der jetzt auch die isBusy Logik im Cancel-Handler aufruft)
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        editingIndex,
        handleFormSubmit, // handleFormSubmit ist jetzt stabil (useCallback)
        closeForm, // closeForm ist jetzt stabil (useCallback)
        showShutdownConfirm,
        confirmShutdown, // confirmShutdown ist jetzt stabil (useCallback)
        setShowShutdownConfirm, // State setter
        setShutdownError, // State setter
        setPassword, // State setter
        setIsBusy // Prop setter
        // formData ist hier nicht direkt im Effektcode verwendet,
        // sondern nur indirekt über handleFormSubmit. Da handleFormSubmit
        // in den Dependencies ist und korrekt auf formData reagiert,
        // muss formData nicht hier in den Dependencies sein.
    ]);


    return (
        <div className="settings-section">
            <div className="events-section">
                <h3>Events</h3>
                <div className="events-grid form-group">
                    {ALLOWED_EVENTS.map(opt => {
                        const idx = events.findIndex(e => e.event === opt.value);
                        const ev = idx >= 0 ? events[idx] : null;
                        return (
                            <div
                                key={opt.value}
                                className={`event-card ${ev ? '' : 'add-event'}`}
                                onClick={() => !ev && openForm('new')}
                            >
                                {ev ? (
                                    <>
                                        <div className="card-header">{opt.label}</div>
                                        <div className="event-freq">Freq: {ev.frequency}</div>
                                        <div className="event-times">Times: {ev.times.join(', ')}</div>
                                        <div className="card-buttons">
                                            <button className="btn edit" onClick={(e) => { e.stopPropagation(); openForm(idx); }}>Bearbeiten</button>
                                            <button className="btn delete" onClick={(e) => { e.stopPropagation(); handleDelete(idx); }}>Löschen</button>
                                            <button className="btn run" onClick={(e) => { e.stopPropagation(); handleExecute(idx); }}>Ausführen</button>
                                        </div>
                                    </>
                                ) : (
                                    <span>+</span>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div>
                    <label htmlFor="checkInterval" className="search-relevance-input">Event Überprüfungsintervall (Sekunden):
                        <input
                            id="checkInterval"
                            type="number"
                            value={checkInterval}
                            onChange={(e) => setCheckInterval(e.target.value)}
                            min="1"
                        />
                    </label>
                    <p className="setting-description">Wie oft überprüft wird ob eines der Events fällig ist (in Sekunden).</p>
                </div>
            </div>

            {editingIndex !== null && (
                <div className="event-form-overlay">
                    <div className="event-form-container">
                        <form className="event-form" onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }}>
                            <h3 className="form-title">
                                {editingIndex === 'new' ? 'Neues Event' : 'Event bearbeiten'}
                            </h3>
                            <div className="form-group">
                                <label>Event-Typ</label>
                                <select
                                    value={formData.event}
                                    onChange={e => setFormData({ ...formData, event: e.target.value })}
                                    disabled={editingIndex !== 'new'}
                                >
                                    <option value="">-- wählen --</option>
                                    {ALLOWED_EVENTS.filter(
                                        o => editingIndex === 'new' ? !events.some(ev => ev.event === o.value) : o.value === formData.event
                                    ).map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Häufigkeit</label>
                                <select
                                    value={formData.frequency}
                                    onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                                >
                                    {FREQUENCIES.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Zeit(en) (HH:MM)</label>
                                {formData.times.map((t, i) => (
                                    <div key={i} className="time-field">
                                        <input
                                            type="time"
                                            className="time-input"
                                            value={t}
                                            onChange={e => handleTimeChange(i, e.target.value)}
                                        />
                                        {formData.times.length > 1 && (
                                            <button type="button" className="remove-time-button" onClick={() => removeTimeField(i)}>×</button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" className="add-time-button" onClick={addTimeField}>+ Zeit</button>
                            </div>
                            <div className="form-group buttons">
                                <button type="submit" className="confirm-btn">Speichern</button>
                                <button type="button" className="cancel-btn" onClick={closeForm}>Abbrechen</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <h3>Server herunterfahren</h3>
            <div className="form-group">
                <button
                    onClick={requestShutdown}
                    disabled={loadingShutdown}
                    className="confirm"
                >
                    {loadingShutdown ? 'Bitte warten...' : 'Herunterfahren'}
                </button>
            </div>

            {/* Benutzerdefiniertes Modal für Passwort-Bestätigung */}
            {showShutdownConfirm && (
                <div className="modal-overlay overlay">
                    <div className="modal-content modal-danger">
                        <h3>Identität Bestätigen</h3>
                        <p>Für das Herunterfahren bestätigen sie bitte ihre Identität.</p>
                        {shutdownError && (
                            <p className="error-message" style={{ color: 'var(--text-danger)', marginBottom: '0.5rem' }}>{shutdownError}</p>
                        )}
                        <input
                            type="password"
                            placeholder='Passwort'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={shutdownError ? 'error-input' : ''}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-tertiary)' }}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    confirmShutdown();
                                }
                            }}
                        />
                        <div className="confirm-buttons" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={confirmShutdown} className="confirm-btn">Bestätigen</button>
                            <button onClick={() => {
                                setShowShutdownConfirm(false);
                                setShutdownError(null);
                                setPassword('');
                                setIsBusy(false);
                            }} className="cancel-btn">Abbrechen</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bestätigungsmodal für endgültiges Herunterfahren (verwendet ConfirmModal) */}
            {showFinalShutdownConfirm && (
                <ConfirmModal
                    title="Herunterfahren Bestätigen"
                    message="Sind Sie sicher das sie den Server herunterfahren wollen?"
                    onConfirm={() => {
                        handleShutdown();
                    }}
                    onCancel={() => {
                        setShowShutdownConfirm(false);
                        setShutdownError(null);
                        setShowFinalShutdownConfirm(false);
                        setPassword('');
                        setIsBusy(false);
                    }}
                    isDanger={true}
                />
            )}
        </div>
    );
}

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
    verifyPassword,
    shutdown,
    getAllEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    executeEvent,
} from "../../api/api.tsx";
import { ConfirmModal } from "../ConfirmModal.tsx";

// --- Type Definitions ---
interface SystemSettingsProps {
    currentUser: string;
    checkInterval: number;
    setCheckInterval: React.Dispatch<React.SetStateAction<number>>;
    setExecutingEvent: React.Dispatch<React.SetStateAction<boolean>>;
    setIsBusy: React.Dispatch<React.SetStateAction<boolean>>;
    onLogout: () => void;
}

interface EventData {
    event: string;
    frequency: string;
    times: string[];
}

interface AllowedEventOption {
    value: string;
    label: string;
}

interface FrequencyOption {
    value: "hourly" | "daily" | "weekly";
    label: string;
}

// --- Constants ---
const ALLOWED_EVENTS: AllowedEventOption[] = [
    { value: "scanner", label: "Scanner aktualisieren" },
    { value: "file-structure", label: "Struktur neu einlesen" },
];
const FREQUENCIES: FrequencyOption[] = [
    { value: "hourly", label: "Stündlich" },
    { value: "daily", label: "Täglich" },
    { value: "weekly", label: "Wöchentlich" },
];

const initialFormData: EventData = {
    event: "",
    frequency: "daily",
    times: [""],
};

// --- Component ---
export default function SystemSettings({
    currentUser,
    checkInterval,
    setCheckInterval,
    setExecutingEvent,
    setIsBusy,
    onLogout,
}: SystemSettingsProps) {
    const [password, setPassword] = useState<string>("");
    const [showShutdownConfirm, setShowShutdownConfirm] =
        useState<boolean>(false);
    const [showFinalShutdownConfirm, setShowFinalShutdownConfirm] =
        useState<boolean>(false);
    const [loadingShutdown, setLoadingShutdown] = useState<boolean>(false);
    const [events, setEvents] = useState<EventData[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | "new" | null>(
        null
    );
    const [shutdownError, setShutdownError] = useState<string | null>(null);
    const [formData, setFormData] = useState<EventData>(initialFormData);

    const loadEvents = useCallback(async () => {
        setIsBusy(true);
        try {
            const list = await getAllEvents();
            setEvents(list);
        } catch {
            toast.error("Fehler beim Laden der Events.");
        } finally {
            setIsBusy(false);
        }
    }, [setIsBusy]);

    useEffect(() => {
        loadEvents();
    }, [loadEvents]);

    const closeForm = useCallback(() => {
        setIsBusy(false);
        setEditingIndex(null);
        setFormData(initialFormData);
    }, [setIsBusy]);

    const openForm = (index: number | "new") => {
        setIsBusy(true);
        if (index === "new") {
            setFormData(initialFormData);
        } else {
            const ev = events[index];
            setFormData({
                event: ev.event,
                frequency: ev.frequency,
                times: [...ev.times],
            });
        }
        setEditingIndex(index);
    };

    const handleTimeChange = (i: number, v: string) => {
        const ts = [...formData.times];
        ts[i] = v;
        setFormData({ ...formData, times: ts });
    };

    const addTimeField = () =>
        setFormData({ ...formData, times: [...formData.times, ""] });

    const removeTimeField = (i: number) => {
        const ts = formData.times.filter((_, idx) => idx !== i);
        setFormData({ ...formData, times: ts });
    };

    const handleFormSubmit = useCallback(async () => {
        const { event, frequency, times } = formData;
        if (!event || times.some((t) => !t)) {
            toast.error("Bitte alle Felder ausfüllen.");
            return;
        }
        setIsBusy(true);
        try {
            if (editingIndex === "new") {
                await addEvent(frequency, times, event);
                toast.success("Event hinzugefügt");
            } else if (typeof editingIndex === "number") {
                await updateEvent(editingIndex, frequency, times, event);
                toast.success("Event aktualisiert");
            }
            closeForm();
            await loadEvents();
        } catch {
            toast.error("Fehler beim Speichern des Events");
        } finally {
            setIsBusy(false);
        }
    }, [formData, editingIndex, setIsBusy, closeForm, loadEvents]);

    const handleDelete = useCallback(
        async (i: number) => {
            setIsBusy(true);
            try {
                await deleteEvent(i);
                toast.success("Event gelöscht");
                await loadEvents();
            } catch {
                toast.error("Fehler beim Löschen des Events");
            } finally {
                setIsBusy(false);
            }
        },
        [setIsBusy, loadEvents]
    );

    const handleExecute = useCallback(
        async (i: number) => {
            setIsBusy(true);
            setExecutingEvent(true);
            try {
                await executeEvent(i);
                toast.success("Event ausgeführt");
            } catch {
                toast.error("Fehler beim Ausführen des Events");
            } finally {
                setExecutingEvent(false);
                setIsBusy(false);
            }
        },
        [setExecutingEvent, setIsBusy]
    );

    const requestShutdown = () => {
        setShutdownError(null);
        setPassword("");
        setShowShutdownConfirm(true);
        setIsBusy(true);
    };

    const confirmShutdown = useCallback(async () => {
        try {
            setShutdownError(null);
            const response = await verifyPassword(currentUser, password);
            if (response.verified) {
                setShowShutdownConfirm(false);
                setShowFinalShutdownConfirm(true);
            } else {
                setShutdownError("Passwort nicht korrekt!");
                toast.error("Passwort ist nicht korrekt!");
            }
        } catch (err) {
            setShutdownError("Fehler beim Verifizieren des Passworts");
            toast.error("Fehler beim Verifizieren des Passworts");
        }
    }, [currentUser, password]);

    const handleShutdown = useCallback(async () => {
        setLoadingShutdown(true);
        setIsBusy(true);
        try {
            await shutdown(password);
            toast.success("Server wird heruntergefahren");
            onLogout();
        } catch {
            toast.error("Fehler beim Herunterfahren");
        } finally {
            setLoadingShutdown(false);
            setShowFinalShutdownConfirm(false);
            setIsBusy(false);
        }
    }, [password, setIsBusy, onLogout]);

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>System & Events</h2>
            </div>

            <div className="setting-group">
                <h3>Geplante Aufgaben (Events)</h3>
                <div className="events-grid">
                    {ALLOWED_EVENTS.map((opt) => {
                        const idx = events.findIndex(
                            (e) => e.event === opt.value
                        );
                        const ev = idx >= 0 ? events[idx] : null;
                        if (ev) {
                            return (
                                <div key={opt.value} className="event-card">
                                    <div className="event-card-header">
                                        {opt.label}
                                    </div>
                                    <div className="event-details">
                                        <div>Frequenz: {ev.frequency}</div>
                                        <div>Zeiten: {ev.times.join(", ")}</div>
                                    </div>
                                    <div className="event-card-actions">
                                        <button
                                            className="button-icon"
                                            onClick={() => openForm(idx)}
                                            title="Bearbeiten"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="button-icon"
                                            onClick={() => handleExecute(idx)}
                                            title="Jetzt ausführen"
                                        >
                                            ▶️
                                        </button>
                                        <button
                                            className="button-icon button-danger"
                                            onClick={() => handleDelete(idx)}
                                            title="Löschen"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div
                                key={opt.value}
                                className="event-card add-new"
                                onClick={() => openForm("new")}
                            >
                                <div className="event-card-header">
                                    {opt.label}
                                </div>
                                <span>+</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="setting-group">
                <h3>Konfiguration</h3>
                <div className="setting-item">
                    <label htmlFor="checkInterval">
                        Event Überprüfungsintervall (Sekunden)
                        <input
                            id="checkInterval"
                            type="number"
                            value={checkInterval}
                            onChange={(e) =>
                                setCheckInterval(
                                    parseInt(e.target.value, 10) || 60
                                )
                            }
                            min="1"
                        />
                    </label>
                    <p className="setting-description">
                        Wie oft überprüft wird ob eine der Aufgaben fällig ist
                        (in Sekunden).
                    </p>
                </div>
            </div>

            <div className="setting-group">
                <h3>Systemsteuerung</h3>
                <div className="setting-item">
                    <label>
                        Server herunterfahren
                        <button
                            onClick={requestShutdown}
                            disabled={loadingShutdown}
                            className="button button-danger"
                        >
                            {loadingShutdown
                                ? "Bitte warten..."
                                : "Herunterfahren"}
                        </button>
                    </label>
                    <p className="setting-description">
                        Fährt den gesamten Anwendungs-Server herunter. Erfordert
                        eine Passwortbestätigung.
                    </p>
                </div>
            </div>

            {editingIndex !== null && (
                <div className="event-form-overlay">
                    <div className="event-form-container">
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleFormSubmit();
                            }}
                        >
                            <h3>
                                {editingIndex === "new"
                                    ? "Neue Aufgabe"
                                    : "Aufgabe bearbeiten"}
                            </h3>
                            <div className="setting-item">
                                <label>Aufgabentyp</label>
                                <select
                                    value={formData.event}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            event: e.target.value,
                                        })
                                    }
                                    disabled={editingIndex !== "new"}
                                >
                                    <option value="">-- wählen --</option>
                                    {ALLOWED_EVENTS.filter((o) =>
                                        editingIndex === "new"
                                            ? !events.some(
                                                  (ev) => ev.event === o.value
                                              )
                                            : o.value === formData.event
                                    ).map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="setting-item">
                                <label>Häufigkeit</label>
                                <select
                                    value={formData.frequency}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            frequency: e.target
                                                .value as FrequencyOption["value"],
                                        })
                                    }
                                >
                                    {FREQUENCIES.map((f) => (
                                        <option key={f.value} value={f.value}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="setting-item">
                                <label>Zeit(en) (HH:MM)</label>
                                {formData.times.map((t, i) => (
                                    <div key={i} className="time-input-group">
                                        <input
                                            type="time"
                                            value={t}
                                            onChange={(e) =>
                                                handleTimeChange(
                                                    i,
                                                    e.target.value
                                                )
                                            }
                                        />
                                        {formData.times.length > 1 && (
                                            <button
                                                type="button"
                                                className="remove-time-btn"
                                                onClick={() =>
                                                    removeTimeField(i)
                                                }
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="add-time-btn"
                                    onClick={addTimeField}
                                >
                                    + Zeit hinzufügen
                                </button>
                            </div>
                            <div className="button-group">
                                <button
                                    type="submit"
                                    className="button button-primary"
                                >
                                    Speichern
                                </button>
                                <button
                                    type="button"
                                    className="button"
                                    onClick={closeForm}
                                >
                                    Abbrechen
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showShutdownConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content shutdown-confirm-modal">
                        <h3>Identität Bestätigen</h3>
                        <p>
                            Für das Herunterfahren bestätigen sie bitte ihre
                            Identität mit ihrem Passwort.
                        </p>
                        {shutdownError && (
                            <p className="error-message">{shutdownError}</p>
                        )}
                        <input
                            type="password"
                            placeholder="Passwort"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={shutdownError ? "input-error" : ""}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    confirmShutdown();
                                }
                            }}
                        />
                        <div className="button-group">
                            <button
                                onClick={confirmShutdown}
                                className="button button-danger"
                            >
                                Bestätigen
                            </button>
                            <button
                                onClick={() => {
                                    setShowShutdownConfirm(false);
                                    setShutdownError(null);
                                    setPassword("");
                                    setIsBusy(false);
                                }}
                                className="button"
                            >
                                Abbrechen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showFinalShutdownConfirm && (
                <ConfirmModal
                    title="Herunterfahren Bestätigen"
                    message="Sind Sie sicher, dass Sie den Server herunterfahren wollen? Alle nicht gespeicherten Änderungen gehen verloren."
                    onConfirm={handleShutdown}
                    onCancel={() => {
                        setShowFinalShutdownConfirm(false);
                        setIsBusy(false);
                    }}
                    isDanger={true}
                />
            )}
        </div>
    );
}

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { ConfirmModal } from "../modals/ConfirmModal";
import { verifyPassword, shutdown, getAllEvents, addEvent, updateEvent, deleteEvent, executeEvent } from "../../api/api";

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

// --- Constants (translated to German) ---
const ALLOWED_EVENTS: AllowedEventOption[] = [
    { value: "scanner", label: "Scanner aktualisieren" },
    { value: "file-structure", label: "Struktur neu einlesen" },
    { value: "convert-index-ocr", label: "Ganzen Index in OCR umwandeln" },
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
            toast.error("Fehler beim Laden der Ereignisse.");
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
                toast.success("Ereignis hinzugefügt");
            } else if (typeof editingIndex === "number") {
                await updateEvent(editingIndex, frequency, times, event);
                toast.success("Ereignis aktualisiert");
            }
            closeForm();
            await loadEvents();
        } catch {
            toast.error("Fehler beim Speichern des Ereignisses");
        } finally {
            setIsBusy(false);
        }
    }, [formData, editingIndex, setIsBusy, closeForm, loadEvents]);

    const handleDelete = useCallback(
        async (i: number) => {
            setIsBusy(true);
            try {
                await deleteEvent(i);
                toast.success("Ereignis gelöscht");
                await loadEvents();
            } catch {
                toast.error("Fehler beim Löschen des Ereignisses");
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
                toast.success("Ereignis ausgeführt");
            } catch {
                toast.error("Fehler beim Ausführen des Ereignisses");
            } finally {
                setExecutingEvent(false);
                setIsBusy(false);
            }
        },
        [setExecutingEvent, setIsBusy]
    );

    const confirmShutdown = useCallback(async () => {
        setIsBusy(true);
        try {
            setShutdownError(null);
            const response = await verifyPassword(currentUser, password);
            if (response.verified) {
                setShowShutdownConfirm(false);
                setShowFinalShutdownConfirm(true);
            } else {
                setShutdownError("Falsches Passwort!");
            }
        } catch (err) {
            setShutdownError("Fehler bei der Passwort-Verifizierung");
            toast.error("Fehler bei der Passwort-Verifizierung");
        } finally {
            if (shutdownError) {
                setIsBusy(false);
            }
        }
    }, [currentUser, password, shutdownError, setIsBusy]);

    const handleShutdown = useCallback(async () => {
        setLoadingShutdown(true);
        setIsBusy(true);
        try {
            await shutdown(password);
            onLogout();
        } catch {
            toast.error("Fehler während des Herunterfahrens");
        } finally {
            setLoadingShutdown(false);
            setShowFinalShutdownConfirm(false);
            setIsBusy(false);
        }
    }, [password, setIsBusy, onLogout]);

    useEffect(() => {
        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            if (showShutdownConfirm) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    confirmShutdown();
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    try {
                        setShowShutdownConfirm(false);
                        setShutdownError(null);
                        setPassword("");
                    } finally {
                        e.stopPropagation();
                        setIsBusy(false);
                    }
                }
            }
            if (editingIndex !== null) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    handleFormSubmit();
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    closeForm();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        showShutdownConfirm,
        editingIndex,
        confirmShutdown,
        handleFormSubmit,
        closeForm,
    ]);

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>System & Ereignisse</h2>
            </div>

            <div className="setting-group">
                <h3>Geplante Aufgaben (Ereignisse)</h3>
                <div className="events-grid">
                    {events.map((ev, idx) => {
                        const eventOption = ALLOWED_EVENTS.find(
                            (o) => o.value === ev.event
                        );
                        const label = eventOption
                            ? eventOption.label
                            : "Unbekanntes Ereignis";
                        return (
                            <div key={idx} className="event-card">
                                <div className="event-card-header">{label}</div>
                                <div className="event-details">
                                    <div>Häufigkeit: {FREQUENCIES.find(f => f.value === ev.frequency)?.label}</div>
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
                    })}

                    {events.length < ALLOWED_EVENTS.length && (
                        <div
                            className="event-card add-new"
                            onClick={() => openForm("new")}
                            title="Neues Ereignis hinzufügen"
                        >
                            <span>+</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="setting-group">
                <h3>Konfiguration</h3>
                <div className="setting-item">
                    <label htmlFor="checkInterval">
                        Ereignis-Prüfintervall (Sekunden)
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
                        Wie oft geprüft wird, ob eine geplante Aufgabe fällig ist (in Sekunden).
                    </p>
                </div>
            </div>

            <div className="setting-group">
                <h3>Systemsteuerung</h3>
                <div className="setting-item">
                    <label>
                        Server herunterfahren
                        <button
                            onClick={() => {
                                setIsBusy(true);
                                setShutdownError(null);
                                setPassword("");
                                setShowShutdownConfirm(true);
                            }}
                            disabled={loadingShutdown}
                            className="button-danger"
                        >
                            {loadingShutdown ? "Bitte warten..." : "Herunterfahren"}
                        </button>
                    </label>
                    <p className="setting-description">
                        Fährt den gesamten Anwendungsserver herunter. Erfordert eine Passwortbestätigung.
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
                                    <option value="">-- auswählen --</option>
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
                                    type="button"
                                    className="button"
                                    onClick={closeForm}
                                >
                                    Abbrechen
                                </button>
                                <button
                                    type="submit"
                                    className="button button-primary"
                                >
                                    Speichern
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showShutdownConfirm && (
                <div className="overlay">
                    <div className="modal-content shutdown-confirm-modal">
                        <h3>Identität bestätigen</h3>
                        <p>
                            Um mit dem Herunterfahren fortzufahren, bestätige bitte deine
                            Identität mit deinem Passwort.
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
                        />
                        <div className="modal-buttons">
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
                            <button
                                onClick={confirmShutdown}
                                className="button button-danger"
                            >
                                Bestätigen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showFinalShutdownConfirm && (
                <ConfirmModal
                    title="Herunterfahren bestätigen"
                    message="Bist du sicher, dass du den Server herunterfahren willst? Alle nicht gespeicherten Änderungen gehen verloren."
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

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
import { ConfirmModal } from "../modals/ConfirmModal.tsx";

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
    { value: "scanner", label: "Update Scanner" },
    { value: "file-structure", label: "Re-read Structure" },
    { value: "convert-index-ocr", label: "Convert Full Index to OCR" },
];
const FREQUENCIES: FrequencyOption[] = [
    { value: "hourly", label: "Hourly" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
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
            toast.error("Error loading events.");
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
            toast.error("Please fill out all fields.");
            return;
        }
        setIsBusy(true);
        try {
            if (editingIndex === "new") {
                await addEvent(frequency, times, event);
                toast.success("Event added");
            } else if (typeof editingIndex === "number") {
                await updateEvent(editingIndex, frequency, times, event);
                toast.success("Event updated");
            }
            closeForm();
            await loadEvents();
        } catch {
            toast.error("Error saving event");
        } finally {
            setIsBusy(false);
        }
    }, [formData, editingIndex, setIsBusy, closeForm, loadEvents]);

    const handleDelete = useCallback(
        async (i: number) => {
            setIsBusy(true);
            try {
                await deleteEvent(i);
                toast.success("Event deleted");
                await loadEvents();
            } catch {
                toast.error("Error deleting event");
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
                toast.success("Event executed");
            } catch {
                toast.error("Error executing event");
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
                setShutdownError("Incorrect password!");
                toast.error("Incorrect password!");
            }
        } catch (err) {
            setShutdownError("Error verifying password");
            toast.error("Error verifying password");
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
            toast.success("Server is shutting down");
            onLogout();
        } catch {
            toast.error("Error during shutdown");
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
                <h2>System & Events</h2>
            </div>

            <div className="setting-group">
                <h3>Scheduled Tasks (Events)</h3>
                <div className="events-grid">
                    {/* First, render all existing events */}
                    {events.map((ev, idx) => {
                        const eventOption = ALLOWED_EVENTS.find(
                            (o) => o.value === ev.event
                        );
                        const label = eventOption
                            ? eventOption.label
                            : "Unknown Event";
                        return (
                            <div key={ev.event} className="event-card">
                                <div className="event-card-header">{label}</div>
                                <div className="event-details">
                                    <div>Frequency: {ev.frequency}</div>
                                    <div>Times: {ev.times.join(", ")}</div>
                                </div>
                                <div className="event-card-actions">
                                    <button
                                        className="button-icon"
                                        onClick={() => openForm(idx)}
                                        title="Edit"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="button-icon"
                                        onClick={() => handleExecute(idx)}
                                        title="Execute Now"
                                    >
                                        ▶️
                                    </button>
                                    <button
                                        className="button-icon button-danger"
                                        onClick={() => handleDelete(idx)}
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Then, if there are fewer events than allowed types, show the "add new" button */}
                    {events.length < ALLOWED_EVENTS.length && (
                        <div
                            className="event-card add-new"
                            onClick={() => openForm("new")}
                            title="Add New Event"
                        >
                            <span>+</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="setting-group">
                <h3>Configuration</h3>
                <div className="setting-item">
                    <label htmlFor="checkInterval">
                        Event Check Interval (Seconds)
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
                        How often to check if a scheduled task is due (in
                        seconds).
                    </p>
                </div>
            </div>

            <div className="setting-group">
                <h3>System Control</h3>
                <div className="setting-item">
                    <label>
                        Shutdown Server
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
                            {loadingShutdown ? "Please wait..." : "Shutdown"}
                        </button>
                    </label>
                    <p className="setting-description">
                        Shuts down the entire application server. Requires
                        password confirmation.
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
                                    ? "New Task"
                                    : "Edit Task"}
                            </h3>
                            <div className="setting-item">
                                <label>Task Type</label>
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
                                    <option value="">-- select --</option>
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
                                <label>Frequency</label>
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
                                <label>Time(s) (HH:MM)</label>
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
                                    + Add Time
                                </button>
                            </div>
                            <div className="button-group">
                                <button
                                    type="button"
                                    className="button"
                                    onClick={closeForm}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="button button-primary"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showShutdownConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content shutdown-confirm-modal">
                        <h3>Confirm Identity</h3>
                        <p>
                            To proceed with the shutdown, please confirm your
                            identity with your password.
                        </p>
                        {shutdownError && (
                            <p className="error-message">{shutdownError}</p>
                        )}
                        <input
                            type="password"
                            placeholder="Password"
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
                                Cancel
                            </button>
                            <button
                                onClick={confirmShutdown}
                                className="button button-danger"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showFinalShutdownConfirm && (
                <ConfirmModal
                    title="Confirm Shutdown"
                    message="Are you sure you want to shut down the server? All unsaved changes will be lost."
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

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { readDatabase, writeDatabase, reloadDatabase } from "../../api/api.tsx";

// --- Typdefinitionen ---
interface JsonViewerProps {
    data: any;
}

interface DataManagementProps {
    isAdmin: boolean;
    maxFileSize: number;
    setMaxFileSize: React.Dispatch<React.SetStateAction<number>>;
    setIsBusy: React.Dispatch<React.SetStateAction<boolean>>;
}

interface AvailableFile {
    id: string;
    name: string;
    description: string;
    actions: ("view" | "download" | "refresh" | "rebuild" | "edit")[];
}

interface FileData {
    filename: string;
    content: any;
    lastModified: number;
}

// --- Hilfskomponenten & Funktionen ---

// Stellt JSON-Daten formatiert dar.
const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
    const formattedJson =
        data === null || data === undefined
            ? "null"
            : JSON.stringify(data, null, 2);
    return (
        <pre className="json-viewer">
            <code>{formattedJson}</code>
        </pre>
    );
};

// Löst einen Browser-Download für JSON-Daten aus.
function downloadJsonFile(data: any, filename: string = "data.json") {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- Hauptkomponente ---
export default function DataManagement({
    isAdmin,
    maxFileSize,
    setMaxFileSize,
    setIsBusy,
}: DataManagementProps) {
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isRawEditor, setIsRawEditor] = useState<boolean>(false);
    const [rawJsonContent, setRawJsonContent] = useState<string>("");
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Liste der verwaltbaren Dateien
    const availableFiles: AvailableFile[] = [
        {
            id: "users",
            name: "users.json",
            description: "Benutzerkonten und Hashes.",
            actions: ["view", "download"],
        },
        {
            id: "structure",
            name: "structure.json",
            description: "Gescannte Verzeichnisstruktur.",
            actions: ["view", "download", "refresh", "edit"],
        },
        {
            id: "index",
            name: "index.json",
            description: "Suchindex der Dateien.",
            actions: ["view", "download", "rebuild", "edit"],
        },
        {
            id: "events",
            name: "events.json",
            description: "Gespeicherte Zeitgesteuerte Events.",
            actions: ["view", "download", "edit"],
        },
    ];

    // Setzt den Zustand der Komponente zurück.
    const resetView = useCallback(() => {
        setSelectedFileId(null);
        setFileData(null);
        setError(null);
        setIsRawEditor(false);
    }, []);

    // Lädt den Inhalt einer ausgewählten Datei.
    const loadFileData = useCallback(
        async (fileId: string) => {
            const fileInfo = availableFiles.find((f) => f.id === fileId);
            if (!fileInfo) return;

            resetView();
            setSelectedFileId(fileId);
            setIsLoading(true);
            setIsBusy(true);

            try {
                const result = await readDatabase(fileInfo.name);
                const contentString = JSON.stringify(result?.content);

                if (maxFileSize > 0 && contentString.length > maxFileSize) {
                    setError(
                        `Datei ist zu groß für die Vorschau (${(
                            contentString.length / 1024
                        ).toFixed(1)} KB). Limit: ${(
                            maxFileSize / 1024
                        ).toFixed(1)} KB.`
                    );
                    setFileData(null);
                } else {
                    setFileData({
                        filename: fileInfo.name,
                        content: result?.content,
                        lastModified: Date.now(),
                    });
                    setRawJsonContent(JSON.stringify(result?.content, null, 2));
                }
                toast.success(`Datei ${fileInfo.name} geladen.`);
            } catch (err: any) {
                setError(
                    `Fehler beim Laden von ${fileInfo.name}: ${err.message}`
                );
                toast.error(`Fehler beim Laden von ${fileInfo.name}.`);
            } finally {
                setIsLoading(false);
                setIsBusy(false);
            }
        },
        [maxFileSize, setIsBusy, resetView, availableFiles]
    );

    // Speichert den bearbeiteten JSON-Inhalt.
    const handleSaveRawJson = async () => {
        if (!fileData) return;
        setIsSaving(true);
        setIsBusy(true);
        setError(null);
        try {
            const parsed = JSON.parse(rawJsonContent);
            await writeDatabase(fileData.filename, parsed);
            toast.success(`${fileData.filename} erfolgreich gespeichert.`);
            setIsRawEditor(false);
            if (selectedFileId) await loadFileData(selectedFileId); // Neu laden
        } catch (err: any) {
            setError(
                `Fehler beim Speichern: ${err.message}. Prüfe die JSON-Syntax.`
            );
            toast.error("Fehler beim Speichern.");
        } finally {
            setIsSaving(false);
            setIsBusy(false);
        }
    };

    // Löst Backend-Aktionen wie 'rebuild' oder 'refresh' aus.
    const handleTriggerAction = async (action: "rebuild" | "refresh") => {
        const fileInfo = availableFiles.find((f) => f.id === selectedFileId);
        if (!fileInfo) return;

        setIsBusy(true);
        toast.info(
            `Aktion '${action}' für ${fileInfo.name} wird ausgeführt...`
        );
        try {
            const resp = await reloadDatabase(fileInfo.name);
            toast.success(resp.message);
            await loadFileData(selectedFileId!); // Neu laden
        } catch (err: any) {
            toast.error(`Fehler bei Aktion '${action}': ${err.message}`);
        } finally {
            setIsBusy(false);
        }
    };

    // Lädt eine Datei herunter.
    const handleDownload = async () => {
        const fileInfo = availableFiles.find((f) => f.id === selectedFileId);
        if (!fileInfo) return;
        try {
            const result = await readDatabase(fileInfo.name);
            downloadJsonFile(result?.content, fileInfo.name);
        } catch (err: any) {
            toast.error(
                `Download für ${fileInfo.name} fehlgeschlagen: ${err.message}`
            );
        }
    };

    // Schließt die aktuelle Ansicht mit der Escape-Taste.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (isRawEditor) setIsRawEditor(false);
                else if (selectedFileId) resetView();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [selectedFileId, isRawEditor, resetView]);

    if (!isAdmin) {
        return (
            <div className="settings-section">
                <p>Zugriff verweigert.</p>
            </div>
        );
    }

    const currentFileInfo = availableFiles.find((f) => f.id === selectedFileId);
    const isBusyState = isLoading || isSaving;

    return (
        <div className="settings-section">
            <div className="settings-section-header">
                <h2>Datenbank-Dateien</h2>
            </div>
            <p
                className="setting-description"
                style={{ marginTop: "-1rem", marginBottom: "1.5rem" }}
            >
                Verwaltung der internen JSON-Datendateien. Änderungen hier
                können kritisch für die Funktion der Anwendung sein!
            </p>

            <div className="setting-group">
                <h3>Datei auswählen</h3>
                <div className="file-selector-tabs">
                    {availableFiles.map((file) => (
                        <button
                            key={file.id}
                            onClick={() => loadFileData(file.id)}
                            className={`file-tab ${
                                selectedFileId === file.id ? "active" : ""
                            }`}
                            disabled={isBusyState}
                        >
                            {file.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="setting-group">
                <h3>Vorschau-Limit</h3>
                <div className="setting-item">
                    <label htmlFor="maxFileSize">
                        Maximale Vorschaugröße (KB)
                    </label>
                    <input
                        type="number"
                        id="maxFileSize"
                        value={Math.round(maxFileSize / 1024)}
                        onChange={(e) =>
                            setMaxFileSize(parseInt(e.target.value, 10) * 1024)
                        }
                        min="1"
                    />
                    <p className="setting-description">
                        Begrenzt die Größe von JSON-Dateien, die direkt
                        angezeigt werden, um den Browser nicht zu überlasten.
                    </p>
                </div>
            </div>

            {isLoading && <p>Lade Dateidaten...</p>}

            {error && !isLoading && <p className="error-message">{error}</p>}

            {currentFileInfo && !isLoading && (
                <div className="setting-group">
                    <div className="settings-section-header">
                        <h3>Details für: {currentFileInfo.name}</h3>
                        <button
                            onClick={resetView}
                            className="close-button"
                            title="Ansicht schließen (Esc)"
                        >
                            &times;
                        </button>
                    </div>
                    <p
                        className="setting-description"
                        style={{ marginTop: "-1rem", marginBottom: "1.5rem" }}
                    >
                        {currentFileInfo.description}
                    </p>

                    <div
                        style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                            marginBottom: "1.5rem",
                        }}
                    >
                        {isRawEditor ? (
                            <>
                                <button
                                    onClick={handleSaveRawJson}
                                    disabled={isSaving}
                                    className="button confirm"
                                >
                                    {isSaving
                                        ? "Speichert..."
                                        : "Änderungen speichern"}
                                </button>
                                <button
                                    onClick={() => setIsRawEditor(false)}
                                    disabled={isSaving}
                                    className="button secondary"
                                >
                                    Abbrechen
                                </button>
                            </>
                        ) : (
                            <>
                                {currentFileInfo.actions.includes(
                                    "download"
                                ) && (
                                    <button
                                        onClick={handleDownload}
                                        disabled={isBusyState}
                                    >
                                        Download Backup
                                    </button>
                                )}
                                {currentFileInfo.actions.includes(
                                    "refresh"
                                ) && (
                                    <button
                                        onClick={() =>
                                            handleTriggerAction("refresh")
                                        }
                                        disabled={isBusyState}
                                        className="button primary"
                                    >
                                        Struktur neu einlesen
                                    </button>
                                )}
                                {currentFileInfo.actions.includes(
                                    "rebuild"
                                ) && (
                                    <button
                                        onClick={() =>
                                            handleTriggerAction("rebuild")
                                        }
                                        disabled={isBusyState}
                                        className="button primary"
                                    >
                                        Index neu aufbauen
                                    </button>
                                )}
                                {currentFileInfo.actions.includes("edit") && (
                                    <button
                                        onClick={() => setIsRawEditor(true)}
                                        disabled={isBusyState || !fileData}
                                        className="button-danger"
                                    >
                                        Roh-JSON bearbeiten
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {isRawEditor ? (
                        <textarea
                            className="json-editor"
                            value={rawJsonContent}
                            onChange={(e) => setRawJsonContent(e.target.value)}
                            disabled={isSaving}
                        />
                    ) : (
                        fileData?.content && (
                            <JsonViewer data={fileData.content} />
                        )
                    )}
                </div>
            )}
        </div>
    );
}

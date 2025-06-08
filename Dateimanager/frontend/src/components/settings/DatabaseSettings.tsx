import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
// KORRIGIERT: Der Import-Pfad wurde korrigiert, um die Dateiendung .tsx explizit anzugeben.
import { readDatabase, writeDatabase, reloadDatabase } from '../../api/api.tsx';

// --- Type Definitions ---

// Props for the JsonViewer component
interface JsonViewerProps {
    data: any;
}

// Props for the main DataManagement component
interface DataManagementProps {
    isAdmin: boolean;
    maxFileSize: number;
    setMaxFileSize: React.Dispatch<React.SetStateAction<number>>;
    setIsBusy: React.Dispatch<React.SetStateAction<boolean>>;
}

// Describes the structure of an available file for management
interface AvailableFile {
    id: string;
    name: string;
    description: string;
    actions: ('view' | 'download' | 'refresh' | 'rebuild' | 'edit')[];
}

// Describes the structure of the loaded file data
interface FileData {
    filename: string;
    content: any; // The content can be any valid JSON structure
    lastModified: number;
}


// --- Components ---

/**
 * A simple component to display formatted JSON data.
 */
const JsonViewer: React.FC<JsonViewerProps> = ({ data }) => {
    // Stringify data, providing a fallback for null/undefined to avoid errors.
    const formattedJson = data === null || data === undefined ? 'null' : JSON.stringify(data, null, 2);
    return (
        <pre style={{
            backgroundColor: 'var(--bg-code)',
            border: '1px solid var(--border-tertiary)',
            borderRadius: '4px',
            padding: '1rem',
            maxHeight: '400px',
            overflow: 'auto',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
        }}>
            <code>{formattedJson}</code>
        </pre>
    );
};

/**
 * Triggers a browser download for the given data as a JSON file.
 * @param data The JSON data to download.
 * @param filename The desired name for the downloaded file.
 */
function downloadJsonFile(data: any, filename: string = "data.json") {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * The main component for managing internal database JSON files.
 */
export default function DataManagement({ isAdmin, maxFileSize, setMaxFileSize, setIsBusy }: DataManagementProps) {
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [sizeLimitWarning, setSizeLimitWarning] = useState<string | null>(null);
    const [showRawEditor, setShowRawEditor] = useState<boolean>(false);
    const [rawJsonContent, setRawJsonContent] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [actionLoading, setActionLoading] = useState<boolean>(false);

    // List of manageable files with their properties and allowed actions
    const availableFiles: AvailableFile[] = [
        { id: 'users', name: 'users.json', description: 'Benutzerkonten und Hashes.', actions: ['view', 'download'] },
        { id: 'structure', name: 'structure.json', description: 'Gescannte Verzeichnisstruktur.', actions: ['view', 'download', 'refresh', 'edit'] },
        { id: 'index', name: 'index.json', description: 'Suchindex der Dateien.', actions: ['view', 'download', 'rebuild', 'edit'] },
        { id: 'events', name: 'events.json', description: 'Gespeicherte Zeitgesteuerte Events.', actions: ['view', 'download', 'edit'] },
    ];

    /**
     * Resets the entire component state to its initial view.
     */
    const handleClearSelectedFile = useCallback(() => {
        setSelectedFileId(null);
        setFileData(null);
        setLoading(false);
        setError(null);
        setSizeLimitWarning(null);
        setShowRawEditor(false);
        setRawJsonContent('');
        setIsSaving(false);
        setActionLoading(false);
    }, []);

    /**
     * Loads the content of a selected database file from the backend.
     */
    const loadFileData = useCallback(async (fileId: string) => {
        const info = availableFiles.find(f => f.id === fileId);
        if (!info) {
            const errorMsg = `Unbekannte Datei-ID: ${fileId}`;
            setError(errorMsg);
            toast.error(errorMsg);
            return;
        }

        setLoading(true);
        setIsBusy(true);
        setError(null);
        setSizeLimitWarning(null);
        setFileData(null);
        setShowRawEditor(false);
        setSelectedFileId(fileId);

        try {
            const result = await readDatabase(info.name);
            const fileContent = result?.content;

            // Check if the file content exceeds the user-defined size limit for preview
            if (maxFileSize > 0 && fileContent != null && JSON.stringify(fileContent).length > maxFileSize) {
                const warningMsg = `Datei ist zu groß um dargestellt zu werden (${JSON.stringify(fileContent).length} Zeichen). Maximale Größe: ${maxFileSize} Zeichen.`;
                setSizeLimitWarning(warningMsg);
                setError(null);
                setFileData(null); // Ensure no old data is shown
                return;
            }

            setFileData({
                filename: info.name,
                content: fileContent,
                lastModified: Date.now()
            });
            setRawJsonContent(JSON.stringify(fileContent, null, 2));
            toast.success(`Datei ${info.name} geladen.`);
        } catch (err: any) {
            const errorMsg = `Fehler beim Laden von ${info.name}: ${err.message}`;
            setError(errorMsg);
            setSizeLimitWarning(null);
            toast.error(`Fehler beim Laden von ${info.name}.`);
        } finally {
            setLoading(false);
            setIsBusy(false);
        }
    }, [maxFileSize, setIsBusy, availableFiles]); // availableFiles is stable, but including it for correctness


    /**
     * Saves the modified raw JSON content back to the server.
     */
    const handleSaveRawJson = async () => {
        if (!fileData) return;
        setIsSaving(true);
        setIsBusy(true);
        setError(null);
        setSizeLimitWarning(null);
        try {
            const parsed = JSON.parse(rawJsonContent);
            const res = await writeDatabase(fileData.filename, parsed);
            toast.success(res.message);
            setShowRawEditor(false);
            // Reload data after saving to show the updated, server-confirmed content
            if (selectedFileId) {
                await loadFileData(selectedFileId);
            }
        } catch (err: any) {
            const errorMsg = `Fehler beim Speichern: ${err.message}`;
            setError(errorMsg);
            setSizeLimitWarning(null);
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
            setIsBusy(false);
        }
    };

    /**
     * Triggers a specific backend action like 'rebuild' or 'refresh'.
     */
    const handleTriggerAction = async (action: 'rebuild' | 'refresh') => {
        if (!selectedFileId) return;

        setActionLoading(true);
        setIsBusy(true);
        setError(null);
        setSizeLimitWarning(null);

        try {
            const currentFileInfo = availableFiles.find(f => f.id === selectedFileId);
            if (!currentFileInfo) {
                throw new Error(`Dateiinformationen für ID ${selectedFileId} nicht gefunden.`);
            }
            const resp = await reloadDatabase(currentFileInfo.name);
            toast.success(resp.message);
            // Reload data to reflect the changes from the action
            await loadFileData(selectedFileId);
        } catch (err: any) {
            const errorMsg = `Fehler bei Aktion '${action}': ${err.message}`;
            setError(errorMsg);
            setSizeLimitWarning(null);
            toast.error(`Fehler bei Aktion '${action}'.`);
        } finally {
            setActionLoading(false);
            setIsBusy(false);
        }
    };

    /**
     * Fetches the latest file content and triggers a download.
     */
    const handleDownload = async () => {
        if (!selectedFileId) {
            toast.warn("Bitte wählen Sie eine Datei zum Herunterladen aus.");
            return;
        }
        const currentFileInfo = availableFiles.find(f => f.id === selectedFileId);
        if (!currentFileInfo) {
            toast.error(`Fehler: Dateiinformationen für Download von ID ${selectedFileId} nicht gefunden.`);
            return;
        }

        try {
            const result = await readDatabase(currentFileInfo.name);
            const content = result?.content;

            if (content !== undefined && content !== null) {
                downloadJsonFile(content, currentFileInfo.name);
            } else {
                toast.error(`Fehler: Inhalt für Download von ${currentFileInfo.name} konnte nicht abgerufen werden.`);
            }
        } catch (err: any) {
            toast.error(`Fehler beim Starten des Downloads für ${currentFileInfo.name}: ${err.message}`);
        }
    };

    /**
     * Handles global key presses, e.g., for closing views with the Escape key.
     */
    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // Don't interfere if user is typing in the editor
                const activeElement = document.activeElement;
                if (showRawEditor && activeElement && activeElement.tagName === 'TEXTAREA') {
                    return;
                }

                event.preventDefault();

                if (showRawEditor) {
                    setShowRawEditor(false);
                    toast.info('Raw Editor geschlossen.');
                } else if (selectedFileId) {
                    handleClearSelectedFile();
                    toast.info('Datei geschlossen.');
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [selectedFileId, showRawEditor, handleClearSelectedFile]);

    /**
     * Handles changes to the max file size input.
     */
    const handleMaxFileSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value)) {
            const clampedValue = Math.max(10, Math.min(1000000000, value));
            setMaxFileSize(clampedValue);
        } else if (event.target.value === '') {
            setMaxFileSize(0);
        }
    };

    /**
     * Updates the state for the raw JSON editor content.
     */
    const handleRawJsonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setRawJsonContent(event.target.value);
    };

    // --- Render Logic ---

    if (!isAdmin) {
        return <div className="container"><p>Zugriff verweigert. Diese Funktion ist nur für Administratoren.</p></div>;
    }

    // Find info for the currently selected file for easy access in JSX
    const currentFileInfo = availableFiles.find(f => f.id === selectedFileId);

    return (
        <div className="container data-management-container settings-section">
            <div className="data-management-header">
                <div>
                    <h2>Datenverwaltung</h2>
                    <p className="setting-description" style={{ marginBottom: '20px' }}>
                        Verwaltung der internen JSON-Datendateien. Änderungen können kritisch sein!
                    </p>
                </div>
                {selectedFileId && !loading && (
                    <button onClick={() => loadFileData(selectedFileId)} disabled={actionLoading || isSaving || loading}>Aktualisieren</button>
                )}
            </div>

            <div className="data-file-selector" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {availableFiles.map(file => (
                    <button
                        key={file.id}
                        onClick={() => loadFileData(file.id)}
                        className={`tab ${selectedFileId === file.id ? 'active' : ''}`}
                        disabled={loading || actionLoading || isSaving}
                    >
                        {file.name}
                    </button>
                ))}
            </div>

            <div className="settings-section">
                <h3>Dateivorschau-Limit</h3>
                <div className="setting-item">
                    <label htmlFor="maxFileSize" className="search-relevance-input">Maximale Dateigröße für Vorschau (Zeichen):
                        <input
                            type="number"
                            id="maxFileSize"
                            name="maxFileSize"
                            value={maxFileSize > 0 ? maxFileSize : ''}
                            onChange={handleMaxFileSizeChange}
                            min="10"
                        />
                    </label>
                    <p className="setting-description">
                        Begrenzt die Größe von JSON-Dateien, die direkt im Browser angezeigt werden.
                    </p>
                </div>
            </div>

            {loading && (
                <div className="spinner-container" style={{ margin: '2rem 0' }}>
                    <div className="spinner"></div>
                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Lade Dateidaten...</p>
                </div>
            )}

            {error && !loading && <p className="folder-selector-error" style={{ textAlign: 'left' }}>{error}</p>}

            {selectedFileId && !loading && currentFileInfo && (
                <div className="file-data-display settings-section" style={{ marginTop: '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Details für: {currentFileInfo.name}</h3>
                        <button onClick={handleClearSelectedFile} className="close-button" title="Datei schließen (Esc)">×</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 15px', alignItems: 'center', marginBottom: '15px', fontSize: '0.9rem' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Beschreibung:</strong>
                        <span>{currentFileInfo.description}</span>
                    </div>

                    <div className="data-actions" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        {showRawEditor ? (
                            <>
                                <button onClick={handleSaveRawJson} disabled={isSaving || loading || actionLoading} className="confirm">
                                    {isSaving ? 'Speichere...' : 'Änderungen speichern'}
                                </button>
                                <button onClick={() => setShowRawEditor(false)} disabled={isSaving || loading || actionLoading} className="disfirm">
                                    Abbrechen
                                </button>
                            </>
                        ) : (
                            <>
                                {currentFileInfo.actions.includes('download') && <button onClick={handleDownload} disabled={actionLoading || isSaving || loading}>Backup herunterladen</button>}
                                {currentFileInfo.actions.includes('rebuild') && <button onClick={() => handleTriggerAction('rebuild')} disabled={actionLoading || isSaving || loading} className="confirm">{actionLoading ? 'Läuft...' : 'Index neu laden'}</button>}
                                {currentFileInfo.actions.includes('refresh') && <button onClick={() => handleTriggerAction('refresh')} disabled={actionLoading || isSaving || loading} className="confirm">{actionLoading ? 'Läuft...' : 'Struktur neu einlesen'}</button>}
                                {currentFileInfo.actions.includes('edit') && <button onClick={() => setShowRawEditor(true)} disabled={actionLoading || isSaving || loading || !fileData} className="disfirm">Raw JSON bearbeiten (Riskant!)</button>}
                            </>
                        )}
                    </div>

                    {showRawEditor ? (
                        <div style={{ marginTop: '15px' }}>
                            <h4>Raw JSON Editor:</h4>
                            <textarea
                                style={{
                                    backgroundColor: 'var(--bg-code)',
                                    border: '1px solid var(--border-tertiary)',
                                    borderRadius: '4px',
                                    padding: '1rem',
                                    width: '100%',
                                    minHeight: '400px',
                                    fontSize: '0.85rem',
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--text-primary)',
                                    resize: 'vertical',
                                    boxSizing: 'border-box'
                                }}
                                value={rawJsonContent}
                                onChange={handleRawJsonChange}
                                disabled={isSaving || loading || actionLoading}
                            />
                        </div>
                    ) : (
                        fileData ? (
                            <div style={{ marginTop: '15px' }}>
                                <h4>Inhalt Vorschau:</h4>
                                <JsonViewer data={fileData.content} />
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', marginTop: '15px', color: 'var(--text-muted)' }}>
                                {sizeLimitWarning ? (
                                    <p>{sizeLimitWarning}</p>
                                ) : error ? (
                                    <p>{error}</p>
                                ) : (
                                    <p>Inhalt konnte nicht geladen werden.</p>
                                )}
                            </div>
                        )
                    )}
                </div>
            )}
            {!selectedFileId && !loading && !error && (
                <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text-muted)' }}>
                    <p>Bitte wählen Sie eine Datei zur Verwaltung aus.</p>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { readDatabase, writeDatabase, reloadDatabase } from '../../api/api.tsx';

// Komponente zur Anzeige von JSON (vereinfacht)
const JsonViewer = ({ data }) => {
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

function downloadJsonFile(data, filename = "data.json") {
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

export default function DataManagement({ isAdmin, maxFileSize, setMaxFileSize, setIsBusy }) {
    const [selectedFileId, setSelectedFileId] = useState(null);
    const [fileData, setFileData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sizeLimitWarning, setSizeLimitWarning] = useState(null);
    const [showRawEditor, setShowRawEditor] = useState(false);
    const [rawJsonContent, setRawJsonContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);


    const availableFiles = [
        { id: 'users', name: 'users.json', description: 'Benutzerkonten und Hashes.', actions: ['view', 'download'] },
        { id: 'structure', name: 'structure.json', description: 'Gescannte Verzeichnisstruktur.', actions: ['view', 'download', 'refresh', 'edit'] },
        { id: 'index', name: 'index.json', description: 'Suchindex der Dateien.', actions: ['view', 'download', 'rebuild', 'edit'] },
        { id: 'events', name: 'events.json', description: 'Gespeicherte Zeitgesteuerte Events.', actions: ['view', 'download'] },
    ];

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


    const loadFileData = useCallback(async (fileId) => {
        const info = availableFiles.find(f => f.id === fileId);
        if (!info) {
            setError(`Unbekannte Datei-ID: ${fileId}`);
            toast.error(`Unbekannte Datei-ID: ${fileId}`);
            return;
        }

        setLoading(true);
        setIsBusy(true); // Setze isBusy beim Start des Ladens
        setError(null);
        setSizeLimitWarning(null);
        setFileData(null);
        setShowRawEditor(false); // Editor immer schließen beim Laden einer neuen Datei
        setSelectedFileId(fileId);


        try {
            const result = await readDatabase(info.name);
            const fileContent = result?.content;

            if (maxFileSize > 0 && fileContent !== undefined && fileContent !== null && JSON.stringify(fileContent).length > maxFileSize) {
                const warningMsg = `Datei ist zu groß um dargestellt zu werden (${JSON.stringify(fileContent).length} Zeichen). Maximale Größe: ${maxFileSize} Zeichen.`;
                console.warn(warningMsg);
                setSizeLimitWarning(warningMsg);
                setError(null);
                setFileData(null);
                return;
            }

            setFileData({
                filename: info.name,
                content: fileContent,
                lastModified: Date.now()
            });
            setRawJsonContent(JSON.stringify(fileContent, null, 2));
            toast.success(`Datei ${info.name} geladen.`);
        } catch (err) {
            console.error(`Fehler beim Laden von ${info.name}:`, err);
            setError(`Fehler beim Laden von ${info.name}: ${err.message}`);
            setSizeLimitWarning(null);
            toast.error(`Fehler beim Laden von ${info.name}.`);
        } finally {
            setLoading(false);
            setIsBusy(false); // Setze isBusy im finally Block zurück
        }
    }, [availableFiles, isMounted, maxFileSize, setIsBusy]);


    const handleSaveRawJson = async () => {
        if (!fileData) return;
        setIsSaving(true);
        setIsBusy(true); // Setze isBusy beim Start des Speicherns
        setError(null);
        setSizeLimitWarning(null);
        try {
            const parsed = JSON.parse(rawJsonContent);
            const res = await writeDatabase(fileData.filename, parsed);
            toast.success(res.message);
            setShowRawEditor(false); // Schließe Editor nach erfolgreichem Speichern
            // Reload data after saving to show updated content
            // Verwende selectedFileId, da fileData nach dem Parsen nicht mehr aktuell ist
            loadFileData(selectedFileId);
        } catch (err) {
            console.error(`Fehler beim Speichern von ${fileData.filename}:`, err);
            setError(`Fehler beim Speichern: ${err.message}`);
            setSizeLimitWarning(null);
            toast.error(`Fehler beim Speichern: ${err.message}`);
        } finally {
            setIsSaving(false);
            setIsBusy(false); // Setze isBusy im finally Block zurück
        }
    };

    const handleTriggerAction = async (action) => {
        if (!selectedFileId) return;
        setActionLoading(true);
        setIsBusy(true); // Setze isBusy beim Start der Aktion
        setError(null);
        setSizeLimitWarning(null);
        try {
            const currentFileInfo = availableFiles.find(f => f.id === selectedFileId);
            if (!currentFileInfo) {
                throw new Error(`Dateiinformationen für ID ${selectedFileId} nicht gefunden.`);
            }
            const resp = await reloadDatabase(currentFileInfo.name);
            toast.success(resp.message);
            loadFileData(selectedFileId);
        } catch (err) {
            console.error(`Fehler bei Aktion '${action}' für ${selectedFileId}:`, err);
            setError(`Fehler bei Aktion '${action}': ${err.message}`);
            setSizeLimitWarning(null);
            toast.error(`Fehler bei Aktion '${action}'.`);
        } finally {
            setActionLoading(false);
            setIsBusy(false); // Setze isBusy im finally Block zurück
        }
    };

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
        } catch (err) {
            toast.error(`Fehler beim Starten des Downloads für ${currentFileInfo.name}: ${err.message}`);
        }
    };

    useEffect(() => {
        const handleGlobalKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();

                const activeElement = document.activeElement;
                if (showRawEditor && activeElement && activeElement.tagName === 'TEXTAREA') {
                    return;
                }

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
    }, [
        selectedFileId,
        showRawEditor,
        handleClearSelectedFile
    ]);

    const handleMaxFileSizeChange = (event) => {
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value)) {
            const clampedValue = Math.max(10, Math.min(1000000000, value));
            setMaxFileSize(clampedValue);
        } else if (event.target.value === '') {
            setMaxFileSize(0);
        }
    };

    const handleRawJsonChange = (event) => {
        setRawJsonContent(event.target.value);
    };


    if (!isAdmin) {
        return <div className="container"><p>Zugriff verweigert. Diese Funktion ist nur für Administratoren.</p></div>;
    }

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
                {/* Aktualisieren Button (nur sichtbar, wenn eine Datei ausgewählt ist UND NICHT geladen wird) */}
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
                        disabled={loading || actionLoading || isSaving} // Disable buttons while loading, saving, or action is running
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
                        Größere Dateien können weiterhin heruntergeladen werden.
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

            {selectedFileId && !loading && (
                <div className="file-data-display settings-section" style={{ marginTop: '0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3>Details für: {currentFileInfo?.name || 'Ausgewählte Datei'}</h3>
                        <button onClick={() => { handleClearSelectedFile(); toast.info('Datei geschlossen.'); }} className="close-button" title="Datei schließen">×</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 15px', alignItems: 'center', marginBottom: '15px', fontSize: '0.9rem' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>Beschreibung:</strong>
                        <span>{currentFileInfo?.description || 'N/A'}</span>
                    </div>

                    {/* === GEÄNDERT: Bedingtes Rendering der Buttons === */}
                    <div className="data-actions" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        {showRawEditor ? ( // Wenn der Raw Editor offen ist, zeige Speichern und Abbrechen
                            <>
                                <button onClick={handleSaveRawJson} disabled={isSaving || loading || actionLoading} className="confirm">
                                    {isSaving ? 'Speichere...' : 'Änderungen speichern'}
                                </button>
                                <button onClick={() => setShowRawEditor(false)} disabled={isSaving || loading || actionLoading} className="disfirm">
                                    Abbrechen
                                </button>
                            </>
                        ) : ( // Ansonsten zeige die Standard-Aktionsbuttons
                            <>
                                {currentFileInfo?.actions.includes('download') && <button onClick={handleDownload} disabled={actionLoading || isSaving || loading}>Backup herunterladen</button>}
                                {currentFileInfo?.actions.includes('rebuild') && <button onClick={() => handleTriggerAction('rebuild')} disabled={actionLoading || isSaving || loading} className="confirm">{actionLoading ? 'Läuft...' : 'Index neu laden'}</button>}
                                {currentFileInfo?.actions.includes('refresh') && <button onClick={() => handleTriggerAction('refresh')} disabled={actionLoading || isSaving || loading} className="confirm">{actionLoading ? 'Läuft...' : 'Struktur neu einlesen'}</button>}
                                {/* Der Edit Button schaltet showRawEditor um */}
                                {currentFileInfo?.actions.includes('edit') && <button onClick={() => setShowRawEditor(true)} disabled={actionLoading || isSaving || loading || !fileData} className="disfirm">Raw JSON bearbeiten (Riskant!)</button>}
                            </>
                        )}
                    </div>

                    {/* JSON Vorschau oder Raw Editor */}
                    {showRawEditor ? ( // Zeige den Raw Editor, wenn showRawEditor true ist
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
                            {/* === ENTFERNT: Buttons von hier entfernt === */}
                        </div>
                    ) : ( // Zeige Vorschau, wenn Raw Editor nicht offen ist
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

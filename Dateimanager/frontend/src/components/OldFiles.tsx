import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useContext,
} from "react";
import { toast } from "react-toastify";
import { findOldFiles, deleteFile } from "../api/api.tsx";
import { ConfirmModal } from "./ConfirmModal.tsx";
import { SettingsContext } from "../context/SettingsContext.tsx";

// --- Type Definitions ---

interface OldFile {
    path: string;
    name: string;
    size_bytes: number;
    modified_at: string;
    content?: string; // Content is optional
    score?: number; // Score is optional, added during filtering
}

interface OldFilesProps {
    setFindingOldFiles: (isFinding: boolean) => void;
    oldFilesLimit: number;
    sortBy: string;
    sortOrder: string;
    onFileSelected: (filePath: string) => void;
}

// --- Helper Functions ---

const formatBytes = (
    bytes: number | null | undefined,
    decimals: number = 2
): string => {
    if (bytes === null || bytes === undefined || bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const formatAge = (isoString: string | undefined): string => {
    if (!isoString) return "Unbekanntes Alter";
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor(
            (now.getTime() - date.getTime()) / 1000
        );

        if (diffInSeconds < 60) return "gerade eben";
        if (diffInSeconds < 3600)
            return `vor ${Math.floor(diffInSeconds / 60)} min`;
        if (diffInSeconds < 86400)
            return `vor ${Math.floor(diffInSeconds / 3600)} h`;
        if (diffInSeconds < 2592000)
            return `vor ${Math.floor(diffInSeconds / 86400)} t`;
        if (diffInSeconds < 31536000)
            return `vor ${Math.floor(diffInSeconds / 2592000)} m`;
        return `vor ${Math.floor(diffInSeconds / 31536000)} j`;
    } catch (e) {
        console.error("Fehler beim Berechnen des Alters:", isoString, e);
        return "Ungültiges Datum";
    }
};

const LOCAL_STORAGE_KEY = "oldFilesData";
const SEARCH_DEBOUNCE_DELAY = 300;

// --- Component ---

export default function OldFiles({
    setFindingOldFiles,
    oldFilesLimit,
    sortBy,
    sortOrder,
    onFileSelected,
}: OldFilesProps): React.ReactElement {
    const settings = useContext(SettingsContext);
    const maxAgeDaysFromContext = settings?.maxAgeDays ?? 1000;

    const [localMaxAgeDays, setLocalMaxAgeDays] = useState<number>(
        maxAgeDaysFromContext
    );
    const [oldFiles, setOldFiles] = useState<OldFile[]>([]);
    const [filteredFiles, setFilteredFiles] = useState<OldFile[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDeleteFilePath, setConfirmDeleteFilePath] = useState<
        string | null
    >(null);
    const [deletingFile, setDeletingFile] = useState<boolean>(false);

    const hasLoadedFromLocalStorage = useRef<boolean>(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Load from Local Storage on mount
    useEffect(() => {
        if (hasLoadedFromLocalStorage.current) return;
        try {
            const savedFiles = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedFiles) {
                const parsedFiles: OldFile[] = JSON.parse(savedFiles);
                setOldFiles(parsedFiles);
            }
        } catch (e) {
            console.error("Fehler beim Parsen von Local Storage Daten:", e);
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
        hasLoadedFromLocalStorage.current = true;
    }, []);

    // Save to Local Storage when oldFiles state changes
    useEffect(() => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(oldFiles));
        } catch (e) {
            console.error("Fehler beim Speichern in Local Storage:", e);
        }
    }, [oldFiles]);

    // Update local age days when context changes
    useEffect(() => {
        setLocalMaxAgeDays(maxAgeDaysFromContext);
    }, [maxAgeDaysFromContext]);

    // Filter and score list with debounce
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (!searchQuery) {
                setFilteredFiles(oldFiles);
                return;
            }
            const queryTerms = searchQuery
                .toLowerCase()
                .split(",")
                .map((term) => term.trim())
                .filter(Boolean);
            if (queryTerms.length === 0) {
                setFilteredFiles(oldFiles);
                return;
            }
            const scoredFiles = oldFiles
                .map((file) => {
                    let score = 0;
                    const fileContent = file.content?.toLowerCase() || "";
                    const fileName = file.name?.toLowerCase() || "";
                    const filePath = file.path?.toLowerCase() || "";
                    queryTerms.forEach((term) => {
                        if (fileName.includes(term)) score++;
                        if (filePath.includes(term)) score++;
                        if (fileContent.includes(term)) score++;
                    });
                    return { ...file, score };
                })
                .filter((file) => file.score > 0)
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

            setFilteredFiles(scoredFiles);
        }, SEARCH_DEBOUNCE_DELAY);
        return () => clearTimeout(debounceTimer);
    }, [oldFiles, searchQuery]);

    // Focus search input
    useEffect(() => {
        searchInputRef.current?.focus();
    }, []);

    const handleLocalMaxAgeDaysChange = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = event.target.value;
        setLocalMaxAgeDays(value === "" ? 0 : parseInt(value, 10));
    };

    const fetchOldFiles = useCallback(async (): Promise<number> => {
        setLoading(true);
        setFindingOldFiles(true);
        setError(null);

        try {
            const params = {
                max_files: oldFilesLimit > 0 ? oldFilesLimit : undefined,
                max_age_days: localMaxAgeDays > 0 ? localMaxAgeDays : undefined,
                sort_by: sortBy !== "age" ? sortBy : undefined,
                sort_order: sortOrder !== "normal" ? sortOrder : undefined,
            };
            const files: OldFile[] = await findOldFiles(params);
            setOldFiles(files);
            return files.length;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Fehler beim Laden der alten Dateien: ${message}`);
            toast.error(`❌ Fehler beim Laden der alten Dateien.`);
            throw err;
        } finally {
            setLoading(false);
            setFindingOldFiles(false);
        }
    }, [oldFilesLimit, localMaxAgeDays, sortBy, sortOrder, setFindingOldFiles]);

    const handleManualSearch = async () => {
        try {
            const fileCount = await fetchOldFiles();
            toast.success(`🎉 ${fileCount} alte Datei(en) gefunden!`);
        } catch {
            /* error toast is already handled in fetchOldFiles */
        }
    };

    const handleConfirmDelete = async () => {
        if (!confirmDeleteFilePath) return;
        setDeletingFile(true);
        try {
            await deleteFile(confirmDeleteFilePath);
            toast.success(
                `🗑️ Datei erfolgreich gelöscht: ${confirmDeleteFilePath}`
            );
            setOldFiles((prev) =>
                prev.filter((file) => file.path !== confirmDeleteFilePath)
            );
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Fehler beim Löschen der Datei: ${message}`);
            toast.error(`❌ Fehler beim Löschen der Datei.`);
        } finally {
            setDeletingFile(false);
            setConfirmDeleteFilePath(null);
        }
    };

    const noFilesMessage = (): React.ReactNode => {
        if (loading || error) return null;
        if (oldFiles.length === 0) {
            return (
                <p className="info-message">
                    Bitte klicken Sie auf "Suchen", um die Liste zu laden.
                </p>
            );
        }
        if (filteredFiles.length === 0 && searchQuery) {
            return (
                <p className="info-message">
                    Keine Dateien entsprechen der Suche nach "{searchQuery}".
                </p>
            );
        }
        return null;
    };

    return (
        <div className="settings-section old-files-container">
            <h2>Alte Dateien</h2>
            <div className="action-controls">
                <button
                    onClick={handleManualSearch}
                    disabled={loading || deletingFile}
                >
                    {loading ? "Suche läuft..." : "Alte Dateien suchen"}
                </button>
                <label htmlFor="maxAgeDays" className="input-label">
                    Mindestalter in Tagen:
                    <input
                        type="number"
                        id="maxAgeDays"
                        name="maxAgeDays"
                        value={localMaxAgeDays}
                        onChange={handleLocalMaxAgeDaysChange}
                        min="0"
                        placeholder="0 für kein Limit"
                    />
                </label>
            </div>

            {error && !loading && <p className="error-message">{error}</p>}

            {!loading && !error && oldFiles.length > 0 && (
                <div className="old-files-list">
                    <label
                        htmlFor="fileSearch"
                        className="search-relevance-input"
                    >
                        <h3>Gefundene Dateien ({filteredFiles.length}):</h3>
                        <input
                            ref={searchInputRef}
                            type="text"
                            id="fileSearch"
                            name="fileSearch"
                            value={searchQuery}
                            onChange={(
                                e: React.ChangeEvent<HTMLInputElement>
                            ) => setSearchQuery(e.target.value)}
                            placeholder="Dateinamen, Pfad oder Inhalt durchsuchen..."
                        />
                    </label>
                    <ul className="results-list">
                        {filteredFiles.map((file) => (
                            <li
                                key={file.path}
                                onClick={() => onFileSelected(file.path)}
                            >
                                <div className="file-info">
                                    <div className="file-name">{file.name}</div>
                                    <div className="file-path">{file.path}</div>
                                    <div className="file-meta">
                                        Größe: {formatBytes(file.size_bytes)} |
                                        Alter: {formatAge(file.modified_at)}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteFilePath(file.path);
                                    }}
                                    disabled={deletingFile}
                                    className="disfirm"
                                >
                                    {deletingFile &&
                                    confirmDeleteFilePath === file.path
                                        ? "Lösche..."
                                        : "Löschen"}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {noFilesMessage()}

            {confirmDeleteFilePath && (
                <ConfirmModal
                    title="Datei löschen?"
                    message={`Bist du sicher, dass du die Datei "${confirmDeleteFilePath}" unwiderruflich löschen möchtest?`}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmDeleteFilePath(null)}
                    isDanger={true}
                />
            )}
        </div>
    );
}

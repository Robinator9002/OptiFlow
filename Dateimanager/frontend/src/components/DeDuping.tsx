import React, { useEffect, useState, useRef, useContext } from "react";
import { toast } from "react-toastify";
import { FolderOpen, FileText, X } from "lucide-react";
import { SettingsContext } from "../context/SettingsContext.tsx";
import {
    findDuplicates,
    loadDuplicates,
    saveDuplicates,
    deleteFile,
} from "../api/api.tsx";
import { ConfirmModal } from "./ConfirmModal.tsx";

// --- Type Definitions ---
interface DeDupingProps {
    onFileSelected: (filePath: string) => void;
}

interface FileInGroup {
    path: string;
    name: string;
    size_bytes: number;
    modified_at: string;
}

interface DuplicateGroupData {
    file_count: number;
    avg_similarity: number;
    length_range: string;
    files: FileInGroup[];
}

interface DuplicateGroup extends DuplicateGroupData {
    group_id: string;
}

interface DuplicateGroupsState {
    [key: string]: DuplicateGroupData;
}

// --- Helper Functions ---
const formatBytes = (
    bytes: number | null | undefined,
    decimals: number = 2
): string => {
    if (bytes === null || bytes === undefined || bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes: string[] = [
        "Bytes",
        "KB",
        "MB",
        "GB",
        "TB",
        "PB",
        "EB",
        "ZB",
        "YB",
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const formatAge = (isoString: string | null | undefined): string => {
    if (!isoString) return "Unbekannt";
    try {
        const date: Date = new Date(isoString);
        if (isNaN(date.getTime())) return "Ungültiges Datum";
        const now: Date = new Date();
        const diffInSeconds: number = Math.floor(
            (now.getTime() - date.getTime()) / 1000
        );
        if (diffInSeconds < 60) return "gerade eben";
        if (diffInSeconds < 3600)
            return `vor ${Math.floor(diffInSeconds / 60)} min`;
        if (diffInSeconds < 86400)
            return `vor ${Math.floor(diffInSeconds / 3600)} h`;
        return `vor ${Math.floor(diffInSeconds / 86400)} t`;
    } catch (e) {
        return "Fehler";
    }
};

// --- Component ---
const DeDuping: React.FC<DeDupingProps> = ({ onFileSelected }) => {
    const settings = useContext(SettingsContext);
    const minCategoryLength = settings?.minCategoryLength;

    const [duplicateGroups, setDuplicateGroups] =
        useState<DuplicateGroupsState>({});
    const [loadingDupes, setLoadingDupes] = useState<boolean>(false);
    const [dupesError, setDupesError] = useState<string | null>(null);
    const [isDupeSearchRunning, setIsDupeSearchRunning] =
        useState<boolean>(false);
    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [confirmDeleteFilePath, setConfirmDeleteFilePath] = useState<
        string | null
    >(null);
    const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState<
        string | null
    >(null);
    const [deletingItem, setDeletingItem] = useState<boolean>(false);

    // States for search/filter functionality
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [filteredGroups, setFilteredGroups] = useState<DuplicateGroup[]>([]);

    const hasLoadedInitialDupes = useRef<boolean>(false);

    // --- Filter logic for search bar ---
    useEffect(() => {
        const allGroups: DuplicateGroup[] = Object.keys(duplicateGroups).map(
            (groupId: string): DuplicateGroup => ({
                group_id: groupId,
                ...duplicateGroups[groupId],
            })
        );

        if (!searchQuery.trim()) {
            setFilteredGroups(allGroups);
            return;
        }

        const lowercasedQuery = searchQuery.toLowerCase().trim();
        const filtered = allGroups.filter((group) => {
            // Check if query matches group details or any file within the group
            const inGroupName = group.group_id
                .toLowerCase()
                .includes(lowercasedQuery);
            const inLengthRange = group.length_range
                .toLowerCase()
                .includes(lowercasedQuery);

            const inFile = group.files.some(
                (file) =>
                    file.name.toLowerCase().includes(lowercasedQuery) ||
                    file.path.toLowerCase().includes(lowercasedQuery)
            );

            return inGroupName || inLengthRange || inFile;
        });

        setFilteredGroups(filtered);
    }, [searchQuery, duplicateGroups]);

    useEffect(() => {
        const loadInitialDuplicates = async (): Promise<void> => {
            if (hasLoadedInitialDupes.current) return;
            hasLoadedInitialDupes.current = true;

            setLoadingDupes(true);
            setDupesError(null);
            try {
                const loadedResult = await loadDuplicates();
                if (
                    loadedResult?.result &&
                    Object.keys(loadedResult.result).length > 0
                ) {
                    setDuplicateGroups(loadedResult.result);
                } else {
                    toast.info(
                        loadedResult?.message ||
                            "ℹ️ Keine Duplikatgruppen geladen."
                    );
                }
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : String(err);
                setDupesError(
                    `Fehler beim Laden der Duplikatgruppen: ${message}`
                );
                toast.error(`❌ Fehler beim Laden der Duplikatgruppen.`);
            } finally {
                setLoadingDupes(false);
            }
        };

        loadInitialDuplicates();
    }, []);

    const handleFindDuplicates = async (): Promise<void> => {
        if (isDupeSearchRunning || loadingDupes || deletingItem) return;
        setIsDupeSearchRunning(true);
        setLoadingDupes(true);
        setDupesError(null);
        setDuplicateGroups({});
        setExpandedGroupId(null);

        try {
            const result = await findDuplicates();
            if (result?.result) {
                setDuplicateGroups(result.result);
                toast.info(
                    `📁 ${
                        Object.keys(result.result).length
                    } Duplikatgruppen gefunden.`
                );
            } else {
                toast.info(
                    "ℹ️ Duplikatsuche abgeschlossen, keine Gruppen gefunden."
                );
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            setDupesError(`Fehler bei der Duplikatsuche: ${message}`);
            toast.error(`❌ Fehler bei der Duplikatsuche.`);
        } finally {
            setIsDupeSearchRunning(false);
            setLoadingDupes(false);
        }
    };

    const handleConfirmDelete = async (): Promise<void> => {
        if (!confirmDeleteFilePath && !confirmDeleteGroupId) return;

        setDeletingItem(true);
        setDupesError(null);
        try {
            if (confirmDeleteFilePath) {
                await deleteFile(confirmDeleteFilePath);
                toast.success(
                    `🗑️ Datei erfolgreich gelöscht: ${confirmDeleteFilePath}`
                );
                const newGroups = { ...duplicateGroups };
                let groupModified = false;
                for (const groupId in newGroups) {
                    const group = newGroups[groupId];
                    const fileIndex = group.files.findIndex(
                        (file) => file.path === confirmDeleteFilePath
                    );
                    if (fileIndex > -1) {
                        group.files.splice(fileIndex, 1);
                        group.file_count = group.files.length;
                        if (group.file_count < (minCategoryLength ?? 2)) {
                            delete newGroups[groupId];
                        }
                        groupModified = true;
                        break;
                    }
                }
                if (groupModified) {
                    setDuplicateGroups(newGroups);
                    await saveDuplicates();
                }
            } else if (confirmDeleteGroupId) {
                const groupToDelete = duplicateGroups[confirmDeleteGroupId];
                if (groupToDelete?.files?.length > 0) {
                    for (const file of groupToDelete.files) {
                        await deleteFile(file.path);
                    }
                    toast.success(
                        `🗑️ Gruppe ${confirmDeleteGroupId} gelöscht.`
                    );
                    const newGroups = { ...duplicateGroups };
                    delete newGroups[confirmDeleteGroupId];
                    setDuplicateGroups(newGroups);
                    if (expandedGroupId === confirmDeleteGroupId)
                        setExpandedGroupId(null);
                    await saveDuplicates();
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            toast.error(`❌ Fehler beim Löschen: ${message}`);
        } finally {
            setDeletingItem(false);
            setConfirmDeleteFilePath(null);
            setConfirmDeleteGroupId(null);
        }
    };

    return (
        <div className={"dedupe-container settings-section"}>
            <h2>Dateiduplikate finden</h2>
            <div
                className="action-button-group"
                style={{ marginBottom: "20px" }}
            >
                <button
                    onClick={handleFindDuplicates}
                    disabled={
                        loadingDupes || isDupeSearchRunning || deletingItem
                    }
                >
                    {isDupeSearchRunning
                        ? "Suche läuft..."
                        : "Duplikate suchen"}
                </button>
            </div>

            {Object.keys(duplicateGroups).length > 0 && (
                <div
                    className="old-files-list-header"
                    style={{ marginBottom: "1rem" }}
                >
                    <h3>Gefundene Gruppen ({filteredGroups.length}):</h3>
                    <div className="search-relevance-input">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Gruppen nach Dateiname oder Pfad filtern..."
                        />
                    </div>
                </div>
            )}

            {dupesError && !loadingDupes && (
                <p className="folder-selector-error">{dupesError}</p>
            )}

            {loadingDupes && <p>Lade Duplikate...</p>}

            {!loadingDupes && filteredGroups.length > 0 && (
                <ul
                    className="dedupe-groups-list"
                    style={{ listStyle: "none", padding: 0 }}
                >
                    {filteredGroups.map((group) => (
                        <li
                            key={group.group_id}
                            className={`dedupe-group-item ${
                                expandedGroupId === group.group_id
                                    ? "expanded"
                                    : ""
                            }`}
                            onClick={() =>
                                setExpandedGroupId((prev) =>
                                    prev === group.group_id
                                        ? null
                                        : group.group_id
                                )
                            }
                        >
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                }}
                            >
                                <div
                                    style={{
                                        flexGrow: 1,
                                        marginRight: "10px",
                                        display: "flex",
                                        alignItems: "center",
                                        cursor: "pointer",
                                    }}
                                >
                                    <FolderOpen
                                        size={20}
                                        style={{
                                            marginRight: "10px",
                                            color: "var(--text-secondary)",
                                        }}
                                    />
                                    <div
                                        style={{
                                            fontWeight: "bold",
                                            color: "var(--text-primary)",
                                        }}
                                    >
                                        Gruppe ({group.file_count} Dateien)
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "0.9rem",
                                            color: "var(--text-muted)",
                                            marginLeft: "15px",
                                        }}
                                    >
                                        Ähnlichkeit:{" "}
                                        {(group.avg_similarity * 100).toFixed(
                                            0
                                        )}
                                        % | Länge: {group.length_range} Zeichen
                                    </div>
                                </div>
                                <button
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setConfirmDeleteGroupId(group.group_id);
                                    }}
                                    disabled={deletingItem}
                                    className="disfirm"
                                >
                                    Gruppe löschen
                                </button>
                            </div>
                            {expandedGroupId === group.group_id && (
                                <ul
                                    className="dedupe-group-files"
                                    style={{
                                        listStyle: "none",
                                        padding: "10px 0 0 0",
                                        margin: "10px 0 0 0",
                                        borderTop:
                                            "1px solid var(--border-tertiary)",
                                    }}
                                >
                                    {group.files.map((file) => (
                                        <li
                                            key={file.path}
                                            className="dedupe-file-item"
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                onFileSelected(file.path);
                                            }}
                                        >
                                            <div
                                                style={{
                                                    flexGrow: 1,
                                                    marginRight: "10px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                }}
                                            >
                                                <FileText
                                                    size={16}
                                                    style={{
                                                        marginRight: "8px",
                                                        color: "var(--text-secondary)",
                                                    }}
                                                />
                                                <div
                                                    style={{
                                                        fontWeight: "normal",
                                                        color: "var(--text-primary)",
                                                    }}
                                                >
                                                    {file.name}
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "0.8rem",
                                                        color: "var(--text-secondary)",
                                                        marginLeft: "10px",
                                                    }}
                                                >
                                                    {file.path}
                                                </div>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "0.8rem",
                                                    color: "var(--text-muted)",
                                                    marginRight: "10px",
                                                }}
                                            >
                                                Größe:{" "}
                                                {formatBytes(file.size_bytes)} |
                                                Alter:{" "}
                                                {formatAge(file.modified_at)}
                                            </div>
                                            <button
                                                onClick={(
                                                    e: React.MouseEvent
                                                ) => {
                                                    e.stopPropagation();
                                                    setConfirmDeleteFilePath(
                                                        file.path
                                                    );
                                                }}
                                                disabled={deletingItem}
                                                className="disfirm-small"
                                            >
                                                <X size={14} />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {!loadingDupes &&
                filteredGroups.length === 0 &&
                Object.keys(duplicateGroups).length > 0 && (
                    <p className="info-message">
                        Keine Gruppen entsprechen der Suche nach "{searchQuery}
                        ".
                    </p>
                )}

            {(confirmDeleteFilePath || confirmDeleteGroupId) && (
                <ConfirmModal
                    title={
                        confirmDeleteFilePath
                            ? "Datei löschen?"
                            : "Gruppe löschen?"
                    }
                    message={
                        confirmDeleteFilePath
                            ? `Sicher, dass du die Datei "${confirmDeleteFilePath}" löschen willst?`
                            : `Sicher, dass du alle ${
                                  duplicateGroups[
                                      confirmDeleteGroupId as string
                                  ]?.file_count ?? ""
                              } Dateien in dieser Gruppe löschen willst?`
                    }
                    onConfirm={handleConfirmDelete}
                    onCancel={() => {
                        setConfirmDeleteFilePath(null);
                        setConfirmDeleteGroupId(null);
                    }}
                    isDanger={true}
                />
            )}
        </div>
    );
};

export default DeDuping;

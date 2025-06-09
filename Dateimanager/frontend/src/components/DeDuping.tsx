import React, { useEffect, useState, useRef, useContext } from "react";
import { toast } from "react-toastify";
import { FolderOpen, FileText, X } from "lucide-react";

// --- MOCK IMPLEMENTATIONS (PLACEHOLDERS) ---
// Since the original files are not accessible, these are mock implementations
// to make the component runnable and resolve the import errors.

// Mock for SettingsContext
// In your actual application, you would import this from its file.
const MockSettingsContext = React.createContext({
    minCategoryLength: 2,
});

// Mock for ConfirmModal component
const ConfirmModal: React.FC<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDanger: boolean;
}> = ({ title, message, onConfirm, onCancel, isDanger }) => (
    <div
        style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
        }}
    >
        <div
            style={{
                background: "white",
                padding: "20px",
                borderRadius: "8px",
                color: "black",
            }}
        >
            <h3>{title}</h3>
            <p>{message}</p>
            <div
                style={{
                    marginTop: "20px",
                    display: "flex",
                    justifyContent: "flex-end",
                }}
            >
                <button onClick={onCancel} style={{ marginRight: "10px" }}>
                    Abbrechen
                </button>
                <button
                    onClick={onConfirm}
                    className={isDanger ? "disfirm" : "confirm"}
                >
                    Bestätigen
                </button>
            </div>
        </div>
    </div>
);

// Mock API functions
const mockApi = {
    findDuplicates: async (): Promise<{ result: DuplicateGroupsState }> => {
        console.log("MOCK: findDuplicates called");
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate delay
        return {
            result: {
                group_1: {
                    file_count: 2,
                    avg_similarity: 0.95,
                    length_range: "1000-1100",
                    files: [
                        {
                            path: "/docs/report_final.txt",
                            name: "report_final.txt",
                            size_bytes: 12345,
                            modified_at: new Date().toISOString(),
                        },
                        {
                            path: "/docs/archive/report_final_copy.txt",
                            name: "report_final_copy.txt",
                            size_bytes: 12345,
                            modified_at: new Date().toISOString(),
                        },
                    ],
                },
            },
        };
    },
    loadDuplicates: async (): Promise<{
        result: DuplicateGroupsState;
        message: string;
    }> => {
        console.log("MOCK: loadDuplicates called");
        await new Promise((resolve) => setTimeout(resolve, 500));
        return {
            message: "Mock-Duplikate geladen.",
            result: {
                group_1: {
                    file_count: 2,
                    avg_similarity: 0.95,
                    length_range: "1000-1100",
                    files: [
                        {
                            path: "/docs/report_final.txt",
                            name: "report_final.txt",
                            size_bytes: 12345,
                            modified_at: new Date().toISOString(),
                        },
                        {
                            path: "/docs/archive/report_final_copy.txt",
                            name: "report_final_copy.txt",
                            size_bytes: 12345,
                            modified_at: new Date().toISOString(),
                        },
                    ],
                },
                group_2: {
                    file_count: 3,
                    avg_similarity: 0.88,
                    length_range: "500-600",
                    files: [
                        {
                            path: "/images/cat.jpg",
                            name: "cat.jpg",
                            size_bytes: 54321,
                            modified_at: new Date(
                                Date.now() - 86400000 * 5
                            ).toISOString(),
                        },
                        {
                            path: "/images/kitty.jpg",
                            name: "kitty.jpg",
                            size_bytes: 54322,
                            modified_at: new Date(
                                Date.now() - 86400000 * 10
                            ).toISOString(),
                        },
                        {
                            path: "/temp/cat_picture.jpg",
                            name: "cat_picture.jpg",
                            size_bytes: 54321,
                            modified_at: new Date(
                                Date.now() - 86400000 * 2
                            ).toISOString(),
                        },
                    ],
                },
            },
        };
    },
    saveDuplicates: async (): Promise<void> => {
        console.log("MOCK: saveDuplicates called");
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    },
    deleteFile: async (filePath: string): Promise<void> => {
        console.log(`MOCK: deleteFile called for ${filePath}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
    },
};

const { findDuplicates, loadDuplicates, saveDuplicates, deleteFile } = mockApi;
const SettingsContext = MockSettingsContext;
// --- END OF MOCK IMPLEMENTATIONS ---

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

// Interface for a single duplicate group as it comes from the API
interface DuplicateGroupData {
    file_count: number;
    avg_similarity: number;
    length_range: string;
    files: FileInGroup[];
}

// Interface for a duplicate group as used in the state (with group_id)
interface DuplicateGroup extends DuplicateGroupData {
    group_id: string;
}

// Type for the state that stores the duplicate groups.
// The key is the group_id (string), the value is the group object without the ID itself.
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

    const hasLoadedInitialDupes = useRef<boolean>(false);
    const initialDuplicateGroups = useRef<DuplicateGroupsState>({});

    const extractAndSetLengthRanges = (groups: DuplicateGroupsState): void => {
        const ranges = new Set<string>();
        for (const groupId in groups) {
            if (
                Object.prototype.hasOwnProperty.call(groups, groupId) &&
                groups[groupId].length_range
            ) {
                ranges.add(groups[groupId].length_range);
            }
        }
    };

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
                    initialDuplicateGroups.current = loadedResult.result;
                    extractAndSetLengthRanges(loadedResult.result);
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
        initialDuplicateGroups.current = {};
        setExpandedGroupId(null);

        try {
            const result = await findDuplicates();
            if (result?.result) {
                setDuplicateGroups(result.result);
                initialDuplicateGroups.current = result.result;
                extractAndSetLengthRanges(result.result);
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

                // Update state locally to reflect deletion
                const newGroups = { ...initialDuplicateGroups.current };
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
                    initialDuplicateGroups.current = newGroups;
                    extractAndSetLengthRanges(newGroups);
                    await saveDuplicates();
                }
            } else if (confirmDeleteGroupId) {
                const groupToDelete = duplicateGroups[confirmDeleteGroupId];
                if (groupToDelete?.files?.length > 0) {
                    const filesToDeletePaths = groupToDelete.files.map(
                        (file) => file.path
                    );
                    for (const filePath of filesToDeletePaths) {
                        try {
                            await deleteFile(filePath);
                        } catch (err) {
                            console.error(
                                `Fehler beim Löschen von Datei ${filePath}`,
                                err
                            );
                        }
                    }
                    toast.success(
                        `🗑️ Gruppe ${confirmDeleteGroupId} gelöscht.`
                    );

                    // Update state locally
                    const newGroups = { ...initialDuplicateGroups.current };
                    delete newGroups[confirmDeleteGroupId];
                    setDuplicateGroups(newGroups);
                    initialDuplicateGroups.current = newGroups;
                    extractAndSetLengthRanges(newGroups);
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

    const displayedGroups: DuplicateGroup[] = Object.keys(duplicateGroups).map(
        (groupId: string): DuplicateGroup => ({
            group_id: groupId,
            ...duplicateGroups[groupId],
        })
    );

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
            {dupesError && !loadingDupes && (
                <p
                    className="folder-selector-error"
                    style={{ textAlign: "left" }}
                >
                    {dupesError}
                </p>
            )}

            {/* Render Groups */}
            {displayedGroups.length > 0 && (
                <ul
                    className="dedupe-groups-list"
                    style={{ listStyle: "none", padding: 0 }}
                >
                    {displayedGroups.map((group) => (
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
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "5px",
                                                cursor: "pointer",
                                            }}
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

import React, {
    useEffect,
    useState,
    useCallback,
    useRef,
    forwardRef,
} from "react";
import { toast } from "react-toastify";
import {
    X,
    ChevronUp,
    ChevronDown,
    Search as SearchIcon,
    Loader2,
} from "lucide-react";

// --- START: SELF-CONTAINED DEPENDENCIES ---
// To prevent external file resolution errors, helper components are included here.

const ConfirmModal: React.FC<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDanger?: boolean;
}> = ({ title, message, onConfirm, onCancel, isDanger }) => (
    <div className="confirm-modal-overlay">
        <div className="confirm-modal-content">
            <h3>{title}</h3>
            <p>{message}</p>
            <div className="confirm-modal-actions">
                <button onClick={onCancel} className="disfirm">
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className={isDanger ? "remove-button" : "confirm"}
                >
                    Confirm
                </button>
            </div>
        </div>
    </div>
);

// --- TYPE DEFINITIONS ---
interface SelectedFile {
    path: string;
    name: string;
}
interface FileInfo {
    content: string;
    path: string;
    name: string;
    size_bytes: number;
    created_at: string;
    modified_at: string;
    type: "file" | "folder";
}
interface Snippet {
    text: string;
    score?: number;
}
interface ApiSearchResponse {
    data?: { file: { path: string }; match_count: number; snippets: Snippet[] };
}
export interface HighlightPosition {
    start: number;
    end: number;
    snippetIndex: number;
}
interface FilePreviewContainerProps {
    selectedFile: SelectedFile | null;
    setSelectedFile: (file: SelectedFile | null) => void;
    onFileDeleted: (filePath: string) => void;
    isAdmin: boolean;
    setIsSearchCollapsed: (isCollapsed: boolean) => void;
}

// --- RENDER-ONLY SUB-COMPONENTS ---

const FileContentView: React.FC<{
    content: string | null;
    highlightPositions: HighlightPosition[];
    activeSnippetIndex: number;
}> = ({ content, highlightPositions, activeSnippetIndex }) => {
    if (content === null) return null;
    if (highlightPositions.length === 0) return <>{content}</>;

    const parts: (string | React.JSX.Element)[] = [];
    let lastIndex = 0;

    highlightPositions.forEach((pos, i) => {
        if (pos.start > lastIndex) {
            parts.push(content.substring(lastIndex, pos.start));
        }
        const isActive = pos.snippetIndex === activeSnippetIndex;
        parts.push(
            <mark
                key={i}
                className={
                    isActive
                        ? "highlighted-text active-highlight"
                        : "highlighted-text"
                }
            >
                {content.substring(pos.start, pos.end)}
            </mark>
        );
        lastIndex = pos.end;
    });

    if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
    }
    return <>{parts}</>;
};

const SnippetItem = forwardRef<
    HTMLLIElement,
    { snippet: Snippet; isActive: boolean; onClick: () => void }
>(({ snippet, isActive, onClick }, ref) => {
    const createMarkup = (htmlString: string) => ({
        __html: htmlString.replace(
            /\*\*(.*?)\*\*/g,
            '<mark class="snippet-highlight">$1</mark>'
        ),
    });
    return (
        <li
            ref={ref}
            onClick={onClick}
            className={`snippet-item ${isActive ? "active" : ""}`}
            dangerouslySetInnerHTML={createMarkup(snippet.text)}
        />
    );
});

// --- MAIN COMPONENT ---

const FilePreviewContainer: React.FC<FilePreviewContainerProps> = ({
    selectedFile,
    setSelectedFile,
    onFileDeleted,
    isAdmin,
    setIsSearchCollapsed,
}) => {
    // --- STATE MANAGEMENT ---
    const [content, setContent] = useState<string | null>(null);
    const [originalContent, setOriginalContent] = useState<string>("");
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [loadingContent, setLoadingContent] = useState<boolean>(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [editingFile, setEditingFile] = useState<boolean>(false);
    const [savingFile, setSavingFile] = useState<boolean>(false);
    const [showConfirmSaveModal, setShowConfirmSaveModal] =
        useState<boolean>(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] =
        useState<boolean>(false);

    // In-file search state
    const [highlightPositions, setHighlightPositions] = useState<
        HighlightPosition[]
    >([]);
    const [activeSnippetIndex, setActiveSnippetIndex] = useState<number>(-1);
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [snippets, setSnippets] = useState<Snippet[]>([]);

    // --- REFS ---
    const previewContentRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const activeSnippetRef = useRef<HTMLLIElement>(null);

    // --- HELPER FUNCTIONS & API CALLS ---
    const resetSearchState = useCallback(() => {
        setHighlightPositions([]);
        setActiveSnippetIndex(-1);
        setSearchTerm("");
        setSnippets([]);
    }, []);

    const closeFile = useCallback(() => {
        setSelectedFile(null);
        setContent(null);
        setOriginalContent("");
        setFileInfo(null);
        setEditingFile(false);
        setContentError(null);
        resetSearchState();
        setIsSearchCollapsed(false);
    }, [setSelectedFile, setIsSearchCollapsed, resetSearchState]);

    const executeSearch = useCallback(async () => {
        if (!searchTerm.trim() || !content || !selectedFile) {
            return;
        }
        setSearchLoading(true);
        setHighlightPositions([]);
        try {
            const { searchInFile } = await import("../api/api.tsx");
            const result: ApiSearchResponse = await searchInFile(
                searchTerm,
                selectedFile.path
            );
            const foundSnippets = result?.data?.snippets || [];
            setSnippets(foundSnippets);

            if (foundSnippets.length > 0) {
                const positions: HighlightPosition[] = [];
                const lowerContent = content.toLowerCase();
                const match = foundSnippets[0].text.match(/\*\*(.*?)\*\*/);
                const termToFind = match
                    ? match[1].toLowerCase()
                    : searchTerm.toLowerCase().trim();
                let lastIndex = -1;
                let currentSnippetIndex = 0;

                while (
                    (lastIndex = lowerContent.indexOf(
                        termToFind,
                        lastIndex + 1
                    )) !== -1
                ) {
                    positions.push({
                        start: lastIndex,
                        end: lastIndex + termToFind.length,
                        snippetIndex: currentSnippetIndex,
                    });
                    currentSnippetIndex++;
                }

                setHighlightPositions(positions);
                setActiveSnippetIndex(0);
                toast.success(`${currentSnippetIndex} Treffer gefunden.`);
            } else {
                toast.info("Keine Treffer in dieser Datei gefunden.");
                setActiveSnippetIndex(-1);
            }
        } catch (error) {
            toast.error(
                `❌ Fehler bei der Suche: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        } finally {
            setSearchLoading(false);
        }
    }, [searchTerm, content, selectedFile]);

    // --- ACTION HANDLERS ---
    const handleOpenFile = async () => {
        if (!selectedFile) return;
        try {
            const { openFile } = await import("../api/api.tsx");
            await openFile(selectedFile.path);
            toast.info("Datei wird geöffnet...");
        } catch (error) {
            toast.error(
                `❌ Fehler beim Öffnen: ${
                    error instanceof Error
                        ? error.message
                        : "Unbekannter Fehler"
                }`
            );
        }
    };

    const handleOpenInExplorer = async () => {
        if (!selectedFile) return;
        try {
            const { openFileInExplorer } = await import("../api/api.tsx");
            await openFileInExplorer(selectedFile.path);
        } catch (error) {
            toast.error(
                `❌ Fehler: ${
                    error instanceof Error
                        ? error.message
                        : "Unbekannter Fehler"
                }`
            );
        }
    };

    const handleEdit = () => {
        if (content === null) return;
        setOriginalContent(content);
        setEditingFile(true);
        setIsSearchCollapsed(true);
        resetSearchState();
    };

    const handleCancelEdit = () => {
        setContent(originalContent);
        setEditingFile(false);
        toast.info("↩ Änderungen verworfen.");
    };

    const handleConfirmSave = async () => {
        if (!selectedFile || content === null) return;
        setShowConfirmSaveModal(false);
        setSavingFile(true);
        try {
            const { writeFile } = await import("../api/api.tsx");
            await writeFile({ file_path: selectedFile.path, content });
            setOriginalContent(content);
            setEditingFile(false);
            toast.success("✅ Datei erfolgreich gespeichert!");
        } catch (error) {
            toast.error(
                `❌ Speicherfehler: ${
                    error instanceof Error
                        ? error.message
                        : "Unbekannter Fehler"
                }`
            );
        } finally {
            setSavingFile(false);
        }
    };

    const handleDeleteFile = async () => {
        if (!selectedFile) return;
        setShowDeleteConfirmModal(false);
        try {
            const { deleteFile } = await import("../api/api.tsx");
            await deleteFile(selectedFile.path);
            toast.success(`🗑️ Datei "${selectedFile.name}" gelöscht!`);
            onFileDeleted(selectedFile.path);
            closeFile();
        } catch (error) {
            toast.error(
                `❌ Löschfehler: ${
                    error instanceof Error
                        ? error.message
                        : "Unbekannter Fehler"
                }`
            );
        }
    };

    // --- EFFECTS ---
    useEffect(() => {
        if (!selectedFile?.path) {
            closeFile();
            return;
        }
        const loadFileData = async () => {
            setLoadingContent(true);
            setContentError(null);
            setEditingFile(false);
            resetSearchState();
            try {
                const { getFileInfo } = await import("../api/api.tsx");
                const data: FileInfo = await getFileInfo(selectedFile.path);
                setFileInfo(data);
                const displayContent = data.content ?? "(Datei ist leer)";
                setContent(displayContent);
                setOriginalContent(displayContent);
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                setContentError(`Fehler beim Laden der Datei: ${message}`);
                toast.error(`Fehler beim Laden der Datei: ${message}`);
            } finally {
                setLoadingContent(false);
            }
        };
        loadFileData();
    }, [selectedFile?.path, closeFile, resetSearchState]);

    useEffect(() => {
        if (activeSnippetIndex === -1 || !previewContentRef.current) return;
        const activeMark =
            previewContentRef.current.querySelector(".active-highlight");
        if (activeMark) {
            activeMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [activeSnippetIndex]);

    useEffect(() => {
        activeSnippetRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
        });
    }, [activeSnippetIndex]);

    if (!selectedFile) {
        return (
            <div className="file-preview-container empty-preview">
                <p>Keine Datei ausgewählt.</p>
            </div>
        );
    }

    return (
        <div className="file-preview-container">
            <div className="header">
                <h2 title={selectedFile.name} className="file-preview-title">
                    Vorschau: {selectedFile.name}
                </h2>
                <button
                    className="close-button"
                    onClick={closeFile}
                    title="Vorschau schließen (Esc)"
                >
                    <X size={20} />
                </button>
            </div>

            <div className="file-metadata">
                <p title={selectedFile.path}>
                    <strong>Pfad:</strong> {selectedFile.path}
                </p>
                {fileInfo && (
                    <p>
                        <strong>Größe:</strong>{" "}
                        {(fileInfo.size_bytes / 1024).toFixed(2)} KB |
                        <strong> Erstellt:</strong>{" "}
                        {new Date(fileInfo.created_at).toLocaleString("de-DE")}
                    </p>
                )}
                {contentError && (
                    <p className="error-message">{contentError}</p>
                )}
            </div>

            <div
                className={`file-content-area ${editingFile ? "editing" : ""}`}
            >
                <div className="file-content" ref={previewContentRef}>
                    {loadingContent ? (
                        <div className="spinner-container">
                            <div className="spinner"></div>
                        </div>
                    ) : editingFile ? (
                        <textarea
                            value={content ?? ""}
                            onChange={(e) => setContent(e.target.value)}
                            className="file-editor"
                        />
                    ) : (
                        <pre className="file-preview-content">
                            <FileContentView
                                content={content}
                                highlightPositions={highlightPositions}
                                activeSnippetIndex={activeSnippetIndex}
                            />
                        </pre>
                    )}
                </div>

                <div className="file-sidebar">
                    {!editingFile && (
                        <div className="in-file-search-panel">
                            <div className="in-file-search-bar">
                                <input
                                    ref={searchInputRef}
                                    type="search"
                                    placeholder="In Datei suchen..."
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") executeSearch();
                                    }}
                                />
                                <button
                                    onClick={executeSearch}
                                    disabled={
                                        searchLoading || !searchTerm.trim()
                                    }
                                >
                                    {searchLoading ? (
                                        <Loader2
                                            size={18}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <SearchIcon size={18} />
                                    )}
                                </button>
                            </div>
                            {snippets.length > 0 && !searchLoading && (
                                <div className="search-results-area">
                                    <div className="snippet-navigation">
                                        <span>
                                            {activeSnippetIndex + 1} /{" "}
                                            {snippets.length}
                                        </span>
                                        <button
                                            onClick={() =>
                                                setActiveSnippetIndex((i) =>
                                                    Math.max(i - 1, 0)
                                                )
                                            }
                                            disabled={activeSnippetIndex <= 0}
                                        >
                                            <ChevronUp size={18} />
                                        </button>
                                        <button
                                            onClick={() =>
                                                setActiveSnippetIndex((i) =>
                                                    Math.min(
                                                        i + 1,
                                                        snippets.length - 1
                                                    )
                                                )
                                            }
                                            disabled={
                                                activeSnippetIndex >=
                                                snippets.length - 1
                                            }
                                        >
                                            <ChevronDown size={18} />
                                        </button>
                                    </div>
                                    <ul className="search-snippet-list">
                                        {snippets.map((snippet, index) => (
                                            <SnippetItem
                                                key={index}
                                                ref={
                                                    index === activeSnippetIndex
                                                        ? activeSnippetRef
                                                        : null
                                                }
                                                snippet={snippet}
                                                isActive={
                                                    index === activeSnippetIndex
                                                }
                                                onClick={() =>
                                                    setActiveSnippetIndex(index)
                                                }
                                            />
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="file-actions">
                        {!editingFile && isAdmin && (
                            <div className="action-button-group">
                                <div>
                                    <button
                                        onClick={handleOpenFile}
                                        title="Datei öffnen"
                                    >
                                        Öffnen
                                    </button>
                                    <button
                                        onClick={handleOpenInExplorer}
                                        title="Ordner öffnen"
                                    >
                                        In Explorer öffnen
                                    </button>
                                </div>
                                <div>
                                    <button onClick={handleEdit}>
                                        Bearbeiten
                                    </button>
                                    <button
                                        onClick={() =>
                                            setShowDeleteConfirmModal(true)
                                        }
                                        className="remove-button"
                                    >
                                        Löschen
                                    </button>
                                </div>
                            </div>
                        )}
                        {editingFile && (
                            <div className="action-button-group">
                                <button
                                    onClick={() =>
                                        setShowConfirmSaveModal(true)
                                    }
                                    className="confirm"
                                    disabled={savingFile}
                                >
                                    {savingFile ? "Speichern..." : "Speichern"}
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="disfirm"
                                    disabled={savingFile}
                                >
                                    Abbrechen
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {(showConfirmSaveModal || showDeleteConfirmModal) && (
                <ConfirmModal
                    title={
                        showConfirmSaveModal
                            ? "Änderungen speichern?"
                            : "Datei löschen?"
                    }
                    message={
                        showConfirmSaveModal
                            ? "Möchtest du die Änderungen an dieser Datei wirklich speichern?"
                            : `Soll die Datei "${selectedFile.name}" wirklich endgültig gelöscht werden?`
                    }
                    onConfirm={
                        showConfirmSaveModal
                            ? handleConfirmSave
                            : handleDeleteFile
                    }
                    isDanger={!!showDeleteConfirmModal}
                    onCancel={() => {
                        setShowConfirmSaveModal(false);
                        setShowDeleteConfirmModal(false);
                    }}
                />
            )}
        </div>
    );
};

export default FilePreviewContainer;

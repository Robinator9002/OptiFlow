import React, {
    useEffect,
    useState,
    useCallback,
    useRef,
} from "react";
import { toast } from "react-toastify";
import { X, Loader2 } from "lucide-react";
import FileSearchPanel, { type HighlightPosition } from "./FileSearchPanel.tsx";
import { ConfirmModal } from "./ConfirmModal.tsx";

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

interface FilePreviewContainerProps {
    selectedFile: SelectedFile | null;
    setSelectedFile: (file: SelectedFile | null) => void;
    onFileDeleted: (filePath: string) => void;
    isAdmin: boolean;
    setIsSearchCollapsed: (isCollapsed: boolean) => void;
}

// --- RENDER-ONLY SUB-COMPONENTS ---
// This internal FileContentView is kept as its simple, array-based rendering is
// tightly coupled with the editor's overlay functionality.
const FileContentView: React.FC<{
    content: string | null;
    highlightPositions: HighlightPosition[];
    activeSnippetIndex: number;
    onHighlightClick: (snippetIndex: number) => void;
}> = ({
    content,
    highlightPositions,
    activeSnippetIndex,
    onHighlightClick,
}) => {
    if (content === null) return null;
    if (highlightPositions.length === 0) return <>{content}</>;

    const parts: (string | React.JSX.Element)[] = [];
    let lastIndex = 0;

    highlightPositions.forEach((pos, i) => {
        if (pos.start > lastIndex) {
            parts.push(content.substring(lastIndex, pos.start));
        }

        const isSnippetActive = pos.snippetIndex === activeSnippetIndex;
        let className = "highlighted-text";
        if (pos.isFullSnippet) {
            className = isSnippetActive
                ? "full-snippet-highlight active"
                : "full-snippet-highlight";
        }

        parts.push(
            <mark
                key={i}
                className={className}
                onClick={() => onHighlightClick(pos.snippetIndex)}
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

// --- MAIN COMPONENT ---

const FilePreviewContainer: React.FC<FilePreviewContainerProps> = ({
    selectedFile,
    setSelectedFile,
    onFileDeleted,
    isAdmin,
    setIsSearchCollapsed,
}) => {
    // --- STATE MANAGEMENT ---
    // Note how search-related states are now gone from here.
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

    // State for highlights is now controlled by FileSearchPanel via callbacks.
    const [highlightPositions, setHighlightPositions] = useState<
        HighlightPosition[]
    >([]);
    const [activeSnippetIndex, setActiveSnippetIndex] = useState<number>(-1);

    // --- REFS ---
    const previewContentRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLTextAreaElement>(null);

    // --- HELPER FUNCTIONS & API CALLS ---
    const resetSearchState = useCallback(() => {
        setHighlightPositions([]);
        setActiveSnippetIndex(-1);
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
        resetSearchState(); // Clear highlights when entering edit mode
        setIsSearchCollapsed(true);
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
                setContentError(`Fehler: ${message}`);
                toast.error(`Fehler: ${message}`);
            } finally {
                setLoadingContent(false);
            }
        };
        loadFileData();
    }, [selectedFile?.path, closeFile, resetSearchState]);

    useEffect(() => {
        if (activeSnippetIndex === -1) return;

        const activeHighlight = highlightPositions.find(
            (p) => p.snippetIndex === activeSnippetIndex && p.isFullSnippet
        );
        if (!activeHighlight) return;

        const targetElement = editingFile
            ? editorRef.current
            : previewContentRef.current?.querySelector(
                  ".full-snippet-highlight.active"
              );

        if (editingFile && editorRef.current) {
            const editor = editorRef.current;
            editor.focus();
            editor.setSelectionRange(
                activeHighlight.start,
                activeHighlight.end
            );
            // Simple scroll logic
            const textBefore = editor.value.substring(0, activeHighlight.start);
            const lines = textBefore.split("\n").length;
            const approxScrollTop = lines * 1.5 * 16; // Approximation
            editor.scrollTop = approxScrollTop - editor.clientHeight / 2;
        } else if (!editingFile && targetElement) {
            targetElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [activeSnippetIndex, editingFile, highlightPositions]);

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
                {fileInfo && (
                    <p>
                        <strong>Größe:</strong>{" "}
                        {(fileInfo.size_bytes / 1024).toFixed(2)} KB |{" "}
                        <strong>Geändert:</strong>{" "}
                        {new Date(fileInfo.modified_at).toLocaleString("de-DE")}{" "}
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
                            <Loader2 className="animate-spin" size={48} />
                        </div>
                    ) : editingFile ? (
                        <div
                            className="file-editor-wrapper"
                            style={{
                                position: "relative",
                                width: "100%",
                                height: "100%",
                            }}
                        >
                            {/* The visual layer with highlights is disabled during editing for simplicity and performance */}
                            <textarea
                                ref={editorRef}
                                value={content ?? ""}
                                onChange={(e) => setContent(e.target.value)}
                                className="file-editor"
                                style={{
                                    zIndex: 1,
                                    backgroundColor: "transparent",
                                    color: "inherit",
                                }}
                            />
                        </div>
                    ) : (
                        <pre className="file-preview-content">
                            <FileContentView
                                content={content}
                                highlightPositions={highlightPositions}
                                activeSnippetIndex={activeSnippetIndex}
                                onHighlightClick={setActiveSnippetIndex}
                            />
                        </pre>
                    )}
                </div>

                <div className="file-sidebar">
                    {/* THE BIG CHANGE: Delegate all search functionality to the dedicated panel */}
                    <FileSearchPanel
                        filePath={selectedFile.path}
                        fileContent={content}
                        activeSnippetIndex={activeSnippetIndex}
                        onHighlightPositionsChange={setHighlightPositions}
                        onActiveSnippetIndexChange={setActiveSnippetIndex}
                    />

                    <div className="file-actions">
                        {!editingFile && isAdmin && (
                            <div className="action-button-group">
                                <div>
                                    <button
                                        onClick={handleOpenFile}
                                        title="Datei im Standardprogramm öffnen"
                                    >
                                        Öffnen
                                    </button>
                                    <button
                                        onClick={handleOpenInExplorer}
                                        title="Datei im Explorer anzeigen"
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
                    isDanger={showDeleteConfirmModal}
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

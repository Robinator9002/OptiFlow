import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { X } from "lucide-react";
import FileSearchPanel, {
    type HighlightPosition,
    type FileSearchPanelRef,
} from "./FileSearchPanel";
import { ConfirmModal } from "../modals/ConfirmModal";
import FileContentView from "./FileContentView";
import { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { openFile, openFileInExplorer, writeFile, deleteFile, getFileInfo } from "../../api/api"

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
    setIsFileSearchActive: (isActive: boolean) => void;
    setEditingFile: (isEditing: boolean) => void;
    setSnippetNavCallback: (
        callback: { navigate: (dir: "next" | "prev") => void } | null
    ) => void;
}

// --- MAIN COMPONENT ---

const FilePreviewContainer: React.FC<FilePreviewContainerProps> = ({
    selectedFile,
    setSelectedFile,
    onFileDeleted,
    isAdmin,
    setIsSearchCollapsed,
    setIsFileSearchActive,
    setEditingFile,
    setSnippetNavCallback,
}) => {
    // --- STATE MANAGEMENT ---
    const [content, setContent] = useState<string | null>(null);
    const [originalContent, setOriginalContent] = useState<string>("");
    const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
    const [loadingContent, setLoadingContent] = useState<boolean>(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [editingFile, setLocalEditingFile] = useState<boolean>(false);
    const [savingFile, setSavingFile] = useState<boolean>(false);
    const [showConfirmSaveModal, setShowConfirmSaveModal] =
        useState<boolean>(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] =
        useState<boolean>(false);

    const [highlightPositions, setHighlightPositions] = useState<
        HighlightPosition[]
    >([]);
    const [activeSnippetIndex, setActiveSnippetIndex] = useState<number>(-1);

    // --- REFS ---
    const previewContentRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<ReactCodeMirrorRef>(null);
    const searchPanelRef = useRef<FileSearchPanelRef>(null);

    // --- HELPER FUNCTIONS & API CALLS ---

    // UPDATED: This function now also calls the search panel's clearSearch method.
    const resetSearchState = useCallback(() => {
        searchPanelRef.current?.clearSearch();
        setHighlightPositions([]);
        setActiveSnippetIndex(-1);
        setIsFileSearchActive(false);
    }, [setIsFileSearchActive]);

    const handleSetEditing = (isEditing: boolean) => {
        setLocalEditingFile(isEditing);
        setEditingFile(isEditing);
    };

    const closeFile = useCallback(() => {
        setSelectedFile(null);
        setContent(null);
        setOriginalContent("");
        setFileInfo(null);
        handleSetEditing(false);
        setContentError(null);
        resetSearchState();
        setIsSearchCollapsed(false);
    }, [setSelectedFile, setIsSearchCollapsed, resetSearchState]);

    // --- ACTION HANDLERS ---
    const handleOpenFile = async () => {
        if (!selectedFile) return;
        try {
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
        handleSetEditing(true);
        resetSearchState(); // Clear highlights when entering edit mode
        setIsSearchCollapsed(true);
    };

    const handleCancelEdit = () => {
        setContent(originalContent);
        handleSetEditing(false);
        resetSearchState(); // Clear search on cancel
        toast.info("↩ Änderungen verworfen.");
    };

    const handleConfirmSave = async () => {
        if (!selectedFile || content === null) return;
        setShowConfirmSaveModal(false);
        setSavingFile(true);
        try {
            await writeFile({ file_path: selectedFile.path, content });
            setOriginalContent(content);
            handleSetEditing(false);
            resetSearchState(); // Clear search on save
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
        if (searchPanelRef.current) {
            setSnippetNavCallback({
                navigate: searchPanelRef.current.navigateSnippet,
            });
        } else {
            setSnippetNavCallback(null);
        }
    }, [searchPanelRef, setSnippetNavCallback, activeSnippetIndex]);

    useEffect(() => {
        if (!selectedFile?.path) {
            closeFile();
            return;
        }
        const loadFileData = async () => {
            setLoadingContent(true);
            setContentError(null);
            handleSetEditing(false);
            resetSearchState();
            try {
                const data: FileInfo = await getFileInfo(selectedFile.path);
                setFileInfo(data);

                // Wir normalisieren die Zeilenumbrüche, bevor wir den State setzen.
                // Dadurch wird sichergestellt, dass die Zeichen-Offsets vom Backend
                // sowohl für die <pre>-Ansicht als auch für CodeMirror konsistent sind.
                const rawContent = data.content ?? "(Datei ist leer)";
                const normalizedContent = rawContent.replace(/\r\n/g, "\n");

                setContent(normalizedContent);
                setOriginalContent(normalizedContent);
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
        // This effect is now ONLY for the read-only preview mode.
        // Scrolling in the editor is handled by CodeMirror itself.
        if (editingFile || activeSnippetIndex === -1) return;

        const activeHighlight = highlightPositions.find(
            (p) => p.snippetIndex === activeSnippetIndex
        );
        if (!activeHighlight) return;

        const targetElement = previewContentRef.current?.querySelector(
            ".full-snippet-highlight.active"
        );

        if (targetElement) {
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
                    <FileContentView
                        ref={editorRef}
                        isLoading={loadingContent}
                        isEditing={editingFile}
                        content={content}
                        // UPDATED: The new editor passes the value directly.
                        onContentChange={(value) => setContent(value)}
                        highlightPositions={highlightPositions}
                        activeSnippetIndex={activeSnippetIndex}
                        onHighlightClick={setActiveSnippetIndex}
                    />
                </div>

                <div className="file-sidebar">
                    <FileSearchPanel
                        ref={searchPanelRef}
                        filePath={selectedFile.path}
                        fileContent={content}
                        activeSnippetIndex={activeSnippetIndex}
                        onHighlightPositionsChange={setHighlightPositions}
                        onActiveSnippetIndexChange={setActiveSnippetIndex}
                        onSearchStatusChange={setIsFileSearchActive}
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

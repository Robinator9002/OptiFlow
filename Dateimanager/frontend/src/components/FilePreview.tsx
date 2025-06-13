import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { X } from "lucide-react";
import { ConfirmModal } from "./ConfirmModal.tsx"; // Assuming path is correct
import FileContentView from "./FileContentView.tsx";
// Import the new panel and the HighlightPosition type from it
import FileSearchPanel, { type HighlightPosition } from "./FileSearchPanel.tsx";
import {
    getFileInfo,
    openFile,
    openFileInExplorer,
    writeFile,
    deleteFile,
    ocrConvertFile,
} from "../api/api.tsx"; // Assuming path is correct

// --- Type Definitions ---

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
    // This is still needed to collapse the main file list search panel
    setIsSearchCollapsed: (isCollapsed: boolean) => void;
}

/**
 * Container for viewing and interacting with a single file. It displays content,
 * allows editing, and integrates the in-file search panel.
 */
const FilePreviewContainer: React.FC<FilePreviewContainerProps> = ({
    selectedFile,
    setSelectedFile,
    onFileDeleted,
    isAdmin,
    setIsSearchCollapsed,
}) => {
    // === State Definitions ===
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

    // State for search results, controlled here and passed to children
    const [highlightPositions, setHighlightPositions] = useState<
        HighlightPosition[]
    >([]);
    const [activeSnippetIndex, setActiveSnippetIndex] = useState<number>(-1);

    // === Ref Definitions ===
    const previewContentRef = useRef<HTMLPreElement>(null);

    // --- Helper Functions ---
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
        setIsSearchCollapsed(false); // Show the main file search again
    }, [setSelectedFile, setIsSearchCollapsed, resetSearchState]);

    // === Effect for Loading File Data ===
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
                const data: FileInfo = await getFileInfo(selectedFile.path);
                const displayContent = data.content ?? "(Datei ist leer)";
                setContent(displayContent);
                setOriginalContent(displayContent);
                setFileInfo(data);
            } catch (error: unknown) {
                const message =
                    error instanceof Error ? error.message : String(error);
                const errorMsg = `Fehler beim Laden der Datei: ${message}`;
                console.error(errorMsg, error);
                setContentError(errorMsg);
                setContent("Fehler beim Laden des Inhalts.");
                setOriginalContent("Fehler beim Laden des Inhalts.");
                setFileInfo(null);
                toast.error(errorMsg);
            } finally {
                setLoadingContent(false);
            }
        };
        loadFileData();
    }, [selectedFile?.path, closeFile, resetSearchState]);

    // === Action Handlers ===
    const handleEdit = (): void => {
        if (content === null) return;
        setOriginalContent(content);
        setEditingFile(true);
        setIsSearchCollapsed(true); // Hide main search while editing
        resetSearchState();
    };

    const handleContentChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
    ): void => {
        setContent(e.target.value);
    };

    const handleConfirmSave = async (): Promise<void> => {
        if (!selectedFile || content === null) return;
        setShowConfirmSaveModal(false);
        setSavingFile(true);
        try {
            await writeFile({ file_path: selectedFile.path, content });
            setOriginalContent(content);
            setEditingFile(false);
            toast.success("✅ Gespeichert!");
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            toast.error(`❌ Speicherfehler: ${message}`);
        } finally {
            setSavingFile(false);
        }
    };

    const handleCancelEdit = (): void => {
        setContent(originalContent);
        setEditingFile(false);
        toast.info("↩ Änderungen verworfen.");
        resetSearchState();
    };

    const handleDeleteFile = async (): Promise<void> => {
        if (!selectedFile) return;
        setShowDeleteConfirmModal(false);
        try {
            await deleteFile(selectedFile.path);
            toast.success("🗑️ Gelöscht!");
            onFileDeleted(selectedFile.path);
            closeFile();
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            toast.error(`❌ Löschfehler: ${message}`);
        }
    };

    const convertPDFFile = async (): Promise<void> => {
        if (!selectedFile?.path) return;
        toast.info("PDF wird konvertiert...");
        try {
            await ocrConvertFile(selectedFile.path, selectedFile.path);
            toast.success("✅ PDF konvertiert! Lade neu...");
            const data: FileInfo = await getFileInfo(selectedFile.path);
            const displayContent = data.content ?? "(Datei ist leer)";
            setContent(displayContent);
            setOriginalContent(displayContent);
            setFileInfo(data);
            resetSearchState();
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            const errorMsg = `❌ Konvertierungsfehler: ${message}`;
            console.error(errorMsg, error);
            toast.error(errorMsg);
        }
    };

    const handleContentClick = useCallback(
        (event: React.MouseEvent<HTMLPreElement>): void => {
            const target = event.target as HTMLElement;
            if (
                target.tagName === "MARK" &&
                target.classList.contains("highlighted-text") &&
                target.hasAttribute("data-snippet-indices")
            ) {
                const indicesAttr = target.getAttribute("data-snippet-indices");
                if (indicesAttr) {
                    const firstIndex = parseInt(indicesAttr.split(",")[0], 10);
                    if (!isNaN(firstIndex) && firstIndex >= 0) {
                        setActiveSnippetIndex(firstIndex);
                    }
                }
            }
        },
        []
    );

    // === Global Keybindings Effect (Simplified) ===
    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                if (showConfirmSaveModal || showDeleteConfirmModal) {
                    setShowConfirmSaveModal(false);
                    setShowDeleteConfirmModal(false);
                } else if (editingFile) {
                    handleCancelEdit();
                } else if (highlightPositions.length > 0) {
                    resetSearchState();
                } else if (selectedFile) {
                    closeFile();
                }
            }
        };

        document.addEventListener("keydown", handleGlobalKeyDown);
        return () =>
            document.removeEventListener("keydown", handleGlobalKeyDown);
    }, [
        editingFile,
        selectedFile,
        highlightPositions,
        showConfirmSaveModal,
        showDeleteConfirmModal,
        closeFile,
        resetSearchState,
        handleCancelEdit,
    ]);

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
                    <p style={{ margin: "2px 0" }}>
                        <strong>Größe:</strong>{" "}
                        {(fileInfo.size_bytes / 1024)?.toFixed(2) ?? "N/A"} KB |
                        <strong> Erstellt:</strong>{" "}
                        {fileInfo.created_at
                            ? new Date(fileInfo.created_at).toLocaleString(
                                  "de-DE"
                              )
                            : "N/A"}
                    </p>
                )}
                {contentError && (
                    <p className="error-message">{contentError}</p>
                )}
            </div>

            <div
                className={`file-content-area ${
                    editingFile ? "editing" : "previewing"
                }`}
            >
                <FileContentView
                    content={content}
                    isEditing={editingFile}
                    highlightPositions={highlightPositions}
                    activeSnippetIndex={activeSnippetIndex}
                    onContentChange={handleContentChange}
                    onContentClick={handleContentClick}
                    previewContentRef={previewContentRef}
                    isLoading={loadingContent}
                />
                <div className="file-sidebar">
                    {!editingFile && selectedFile.path && (
                        <FileSearchPanel
                            filePath={selectedFile.path}
                            fileContent={content}
                            onHighlightPositionsChange={setHighlightPositions}
                            activeSnippetIndex={activeSnippetIndex}
                            onActiveSnippetIndexChange={setActiveSnippetIndex}
                        />
                    )}
                    <div className={"file-actions"}>
                        {!editingFile && isAdmin && (
                            <div className="action-button-group">
                                <div>
                                    <button
                                        onClick={() =>
                                            openFile(selectedFile.path)
                                        }
                                        title="Datei öffnen"
                                    >
                                        Öffnen
                                    </button>
                                    {fileInfo?.type !== "folder" &&
                                        selectedFile.path && (
                                            <button
                                                onClick={() =>
                                                    openFileInExplorer(
                                                        selectedFile.path
                                                    )
                                                }
                                                title="Ordner öffnen"
                                            >
                                                In Explorer öffnen
                                            </button>
                                        )}
                                </div>
                                <div>
                                    {fileInfo?.type !== "folder" &&
                                        !selectedFile.name
                                            .toLowerCase()
                                            .endsWith(".pdf") &&
                                        !loadingContent &&
                                        !contentError && (
                                            <button onClick={handleEdit}>
                                                Bearbeiten
                                            </button>
                                        )}
                                    {fileInfo?.type !== "folder" &&
                                        selectedFile.name
                                            .toLowerCase()
                                            .endsWith(".pdf") &&
                                        !loadingContent &&
                                        !contentError && (
                                            <button onClick={convertPDFFile}>
                                                OCR Konvertieren
                                            </button>
                                        )}
                                    {fileInfo?.type !== "folder" &&
                                        selectedFile.path && (
                                            <button
                                                onClick={() =>
                                                    setShowDeleteConfirmModal(
                                                        true
                                                    )
                                                }
                                                className="remove-button"
                                            >
                                                Löschen
                                            </button>
                                        )}
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
                            ? "Speichern bestätigen"
                            : "Löschen bestätigen"
                    }
                    message={
                        showConfirmSaveModal
                            ? "Möchtest du die Änderungen wirklich speichern?"
                            : `Möchtest du die Datei "${selectedFile.name}" wirklich löschen?`
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

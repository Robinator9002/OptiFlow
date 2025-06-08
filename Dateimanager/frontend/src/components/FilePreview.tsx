import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { X } from "lucide-react";
import { ConfirmModal } from "./ConfirmModal.tsx";
import FileContentView from "./FileContentView.tsx";
// Assuming FileSearchPanel exists and has its own types. We'll use props based on usage here.
// import FileSearchPanel from "./FileSearchPanel.tsx";
import {
    getFileInfo,
    openFile,
    openFileInExplorer,
    writeFile,
    deleteFile,
    ocrConvertFile,
} from "../api/api.tsx";

// --- Type Definitions ---

// A simplified version of what FileSearchPanel might need.
// Replace with the actual component if available.
const FileSearchPanel: React.FC<any> = () => (
    <div>Search Panel Placeholder</div>
);

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

interface HighlightPosition {
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

const FilePreviewContainer: React.FC<FilePreviewContainerProps> = ({
    selectedFile,
    setSelectedFile,
    onFileDeleted,
    isAdmin,
    setIsSearchCollapsed,
}) => {
    // === State Definitions ===
    const [content, setContent] = useState<string>("");
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
    const [searchTermInFile, setSearchTermInFile] = useState<string>("");
    const [highlightPositions, setHighlightPositions] = useState<
        HighlightPosition[]
    >([]);
    const [activeSnippetIndex, setActiveSnippetIndex] = useState<number>(-1);
    const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
    const [snippetCount, setSnippetCount] = useState<number>(0);

    // === Ref Definitions ===
    const snippetListRef = useRef<HTMLDivElement>(null);
    const previewContentRef = useRef<HTMLPreElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const activeSnippetRef = useRef<HTMLLIElement>(null);

    // --- Snippet Navigation ---
    const navigateSnippet = useCallback(
        (direction: "prev" | "next") => {
            setActiveSnippetIndex((prev) => {
                if (snippetCount === 0) return -1;
                if (direction === "prev") {
                    return Math.max(0, prev - 1);
                } else {
                    // 'next'
                    return Math.min(snippetCount - 1, prev + 1);
                }
            });
        },
        [snippetCount]
    );

    // --- Close File ---
    const closeFile = useCallback(() => {
        setSelectedFile(null);
        setContent("");
        setOriginalContent("");
        setFileInfo(null);
        setEditingFile(false);
        setContentError(null);
        setHighlightPositions([]);
        setActiveSnippetIndex(-1);
        setIsSearchActive(false);
        setSnippetCount(0);
        setSearchTermInFile("");
        setIsSearchCollapsed(false);
    }, [setSelectedFile, setIsSearchCollapsed]);

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
            setHighlightPositions([]);
            setActiveSnippetIndex(-1);
            setIsSearchActive(false);
            setSnippetCount(0);
            setSearchTermInFile("");

            try {
                const data: FileInfo = await getFileInfo(selectedFile.path);
                const displayContent =
                    data.content === null ||
                    data.content === undefined ||
                    data.content === ""
                        ? "(Datei ist leer)"
                        : data.content;
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
    }, [selectedFile?.path, closeFile]);

    // === Action Handlers ===
    const handleEdit = (): void => {
        setOriginalContent(content);
        setEditingFile(true);
        setIsSearchCollapsed(true);
        setHighlightPositions([]);
        setActiveSnippetIndex(-1);
        setIsSearchActive(false);
        setSnippetCount(0);
        setSearchTermInFile("");
    };

    const handleContentChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
    ): void => {
        setContent(e.target.value);
    };

    const handleConfirmSave = async (): Promise<void> => {
        if (!selectedFile) return;
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
        setHighlightPositions([]);
        setActiveSnippetIndex(-1);
        setIsSearchActive(false);
        setSnippetCount(0);
    };

    const handleDeleteFile = async (): Promise<void> => {
        if (!selectedFile) return;
        setShowDeleteConfirmModal(false);
        try {
            await deleteFile(selectedFile.path);
            toast.success("🗑️ Gelöscht!");
            if (onFileDeleted) onFileDeleted(selectedFile.path);
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
            const displayContent =
                data.content === null ||
                data.content === undefined ||
                data.content === ""
                    ? "(Datei ist leer)"
                    : data.content;
            setContent(displayContent);
            setOriginalContent(displayContent);
            setFileInfo(data);
            setHighlightPositions([]);
            setActiveSnippetIndex(-1);
            setIsSearchActive(false);
            setSnippetCount(0);
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
                    if (
                        !isNaN(firstIndex) &&
                        firstIndex >= 0 &&
                        firstIndex < snippetCount
                    ) {
                        setActiveSnippetIndex(firstIndex);
                    }
                }
            }
        },
        [snippetCount]
    );

    // === Global Keybindings Effect ===
    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                if (editingFile) handleCancelEdit();
                else if (isSearchActive || searchTermInFile.trim()) {
                    setSearchTermInFile("");
                    setHighlightPositions([]);
                    setActiveSnippetIndex(-1);
                    setIsSearchActive(false);
                    setSnippetCount(0);
                } else if (selectedFile) {
                    closeFile();
                }
                return;
            }

            if (!editingFile && isSearchActive && snippetCount > 0) {
                if (event.key === "ArrowDown") {
                    event.preventDefault();
                    navigateSnippet("next");
                } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    navigateSnippet("prev");
                }
            }
        };

        document.addEventListener("keydown", handleGlobalKeyDown);
        return () => {
            document.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, [
        isSearchActive,
        snippetCount,
        editingFile,
        selectedFile,
        searchTermInFile,
        closeFile,
        navigateSnippet,
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
                        <strong>Erstellt:</strong>{" "}
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
                className={`file-content ${
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
                    {!editingFile && (
                        <FileSearchPanel
                            filePath={selectedFile.path}
                            fileContent={content}
                            isEditing={editingFile}
                            isLoading={loadingContent}
                            onHighlightPositionsChange={setHighlightPositions}
                            onActiveSnippetIndexChange={setActiveSnippetIndex}
                            onSearchActiveChange={setIsSearchActive}
                            onSetIsSearchCollapsed={setIsSearchCollapsed}
                            searchInputRef={searchInputRef}
                            snippetListRef={snippetListRef}
                            activeSnippetRef={activeSnippetRef}
                            navigateSnippet={navigateSnippet}
                            onSnippetCountChange={setSnippetCount}
                            activeSnippetIndex={activeSnippetIndex}
                            snippetCount={snippetCount}
                            isSearchActive={isSearchActive}
                            searchTerm={searchTermInFile}
                            onSearchTermChange={setSearchTermInFile}
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

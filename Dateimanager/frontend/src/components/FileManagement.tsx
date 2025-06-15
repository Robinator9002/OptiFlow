import React, { useState, useCallback, useEffect } from "react";
import FileSearch from "./FileSearch.tsx";
import FilePreview from "./FilePreview.tsx";

// --- Type Definitions ---
interface FileObject {
    path: string;
    name: string;
}

interface SearchResultItem {
    file: FileObject;
    match_count: number;
}

interface FileManagementProps {
    searchingFiles: boolean;
    setSearchingFiles: React.Dispatch<React.SetStateAction<boolean>>;
    showRelevance: boolean;
    isAdmin: boolean;
    selectedFile: FileObject | null;
    setSelectedFile: React.Dispatch<React.SetStateAction<FileObject | null>>;
}

// --- Component ---
const FileManagement: React.FC<FileManagementProps> = ({
    searchingFiles,
    setSearchingFiles,
    showRelevance,
    isAdmin,
    selectedFile,
    setSelectedFile,
}) => {
    const [deletedFile, setDeletedFile] = useState<string | null>(null);
    const [isSearchCollapsed, setIsSearchCollapsed] = useState<boolean>(false);

    // States for keybindings
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [isFileSearchActive, setIsFileSearchActive] =
        useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);

    // Callback for snippet navigation
    const [snippetNavCallback, setSnippetNavCallback] = useState<{
        navigate: (dir: "next" | "prev") => void;
    } | null>(null);

    const onFileDeleted = (filePath: string) => {
        setDeletedFile(filePath);
        setSearchResults((prev) =>
            prev.filter((r) => r.file.path !== filePath)
        );
    };

    const toggleSearchCollapse = () => {
        setIsSearchCollapsed((prevState) => !prevState);
    };

    const handleNavigateSearchResults = useCallback(
        (direction: "next" | "prev") => {
            if (searchResults.length === 0) return;

            const currentIndex = selectedFile
                ? searchResults.findIndex(
                      (r) => r.file.path === selectedFile.path
                  )
                : -1;

            let nextIndex;
            if (direction === "next") {
                nextIndex =
                    currentIndex >= searchResults.length - 1
                        ? 0
                        : currentIndex + 1;
            } else {
                nextIndex =
                    currentIndex <= 0
                        ? searchResults.length - 1
                        : currentIndex - 1;
            }

            setSelectedFile(searchResults[nextIndex].file);
        },
        [searchResults, selectedFile, setSelectedFile]
    );

    const handleNavigateSnippets = useCallback(
        (direction: "next" | "prev") => {
            snippetNavCallback?.navigate(direction);
        },
        [snippetNavCallback]
    );

    // --- Keybinding Logic ---
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            // UPDATED: Check for the CodeMirror editor class instead of TEXTAREA
            const isTypingInEditor = target.closest(".cm-editor");

            // Rule 2: Prioritize in-file search navigation
            if (
                (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                isFileSearchActive &&
                !isTypingInEditor // Allow arrows in editor, but hijack for navigation otherwise
            ) {
                // If focus is on search input, let it navigate snippets
                    event.preventDefault();
                    handleNavigateSnippets(
                        event.key === "ArrowDown" ? "next" : "prev"
                    );
                    return;
            }

            // Rule 1: Navigate main search results
            if (
                (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                searchResults.length > 0 &&
                !isSearchCollapsed &&
                !isEditing
            ) {
                event.preventDefault();
                handleNavigateSearchResults(
                    event.key === "ArrowDown" ? "next" : "prev"
                );
                return;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [
        searchResults,
        isSearchCollapsed,
        isEditing,
        isFileSearchActive,
        handleNavigateSearchResults,
        handleNavigateSnippets,
    ]);

    return (
        <div
            className={`file-management-container ${
                isSearchCollapsed ? "search-collapsed" : ""
            }`}
        >
            <FileSearch
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                searchingFiles={searchingFiles}
                setSearchingFiles={setSearchingFiles}
                showRelevance={showRelevance}
                deletedFile={deletedFile}
                setDeletedFile={setDeletedFile}
                isSearchCollapsed={isSearchCollapsed}
                onToggleCollapse={toggleSearchCollapse}
                onSearchResults={setSearchResults}
            />
            <FilePreview
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                onFileDeleted={onFileDeleted}
                isAdmin={isAdmin}
                setIsSearchCollapsed={setIsSearchCollapsed}
                setIsFileSearchActive={setIsFileSearchActive}
                setEditingFile={setIsEditing}
                setSnippetNavCallback={setSnippetNavCallback}
            />
        </div>
    );
};

export default FileManagement;

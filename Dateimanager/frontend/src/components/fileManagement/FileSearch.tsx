import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { searchFiles } from "../../api/api.tsx";
import {
    ChevronLeft,
    ChevronRight,
    Search as SearchIcon,
    Loader2,
    X,
} from "lucide-react";

// --- Type Definitions ---
interface FileObject {
    path: string;
    name: string;
}

interface SearchResultItem {
    file: FileObject;
    match_count: number;
}

interface FileSearchProps {
    selectedFile: FileObject | null;
    setSelectedFile: React.Dispatch<React.SetStateAction<FileObject | null>>;
    searchingFiles: boolean;
    setSearchingFiles: React.Dispatch<React.SetStateAction<boolean>>;
    showRelevance: boolean;
    deletedFile: string | null;
    setDeletedFile: React.Dispatch<React.SetStateAction<string | null>>;
    isSearchCollapsed: boolean;
    onToggleCollapse: () => void;
    onSearchResults: (results: SearchResultItem[]) => void;
}

// --- Component ---
const FileSearch: React.FC<FileSearchProps> = ({
    selectedFile,
    setSelectedFile,
    searchingFiles,
    setSearchingFiles,
    showRelevance,
    deletedFile,
    setDeletedFile,
    isSearchCollapsed,
    onToggleCollapse,
    onSearchResults,
}) => {
    const [query, setQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const resultsContainerRef = useRef<HTMLUListElement>(null);

    const clearSearch = () => {
        setQuery("");
        setSearchResults([]);
        onSearchResults([]);
    };

    const handleSearch = async () => {
        if (query.trim() === "") {
            clearSearch();
            return;
        }
        setSearchingFiles(true);
        try {
            const responseData = await searchFiles(query);
            if (responseData?.data && Array.isArray(responseData.data)) {
                setSearchResults(responseData.data);
                onSearchResults(responseData.data); // Lift state up
                toast.success(
                    `✅ ${responseData.data.length} Ergebnisse gefunden!`
                );
            } else {
                setSearchResults([]);
                onSearchResults([]); // Lift state up
                toast.info("⚠️ Keine passenden Dateien gefunden.");
            }
        } catch (error: any) {
            toast.error(`❌ Fehler bei der Suche: ${error.message}`);
            setSearchResults([]);
            onSearchResults([]); // Lift state up
        } finally {
            setSearchingFiles(false);
        }
    };

    useEffect(() => {
        if (deletedFile) {
            const newResults = searchResults.filter(
                (result) => result.file.path !== deletedFile
            );
            setSearchResults(newResults);
            onSearchResults(newResults);
            setDeletedFile(null);
        }
    }, [deletedFile, setDeletedFile, searchResults, onSearchResults]);

    useEffect(() => {
        if (!isSearchCollapsed) {
            searchInputRef.current?.focus();
        }
    }, [isSearchCollapsed]);

    // Scroll to selected file
    useEffect(() => {
        if (selectedFile && resultsContainerRef.current) {
            const selectedItem = resultsContainerRef.current.querySelector(
                ".selected"
            ) as HTMLLIElement;
            if (selectedItem) {
                selectedItem.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                });
            }
        }
    }, [selectedFile]);

    return (
        <div
            className={`file-search-container ${
                isSearchCollapsed ? "collapsed" : ""
            }`}
        >
            <div className="file-search-header">
                <h2>Datei-Suche</h2>
                <button
                    onClick={onToggleCollapse}
                    className="collapse-toggle-button"
                    title={
                        isSearchCollapsed
                            ? "Suche ausklappen"
                            : "Suche einklappen"
                    }
                >
                    {isSearchCollapsed ? (
                        <ChevronRight size={20} />
                    ) : (
                        <ChevronLeft size={20} />
                    )}
                </button>
            </div>
            {!isSearchCollapsed && (
                <>
                    <div className="file-search-bar">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSearch();
                                // Prevent default browser behavior for arrow keys in this input
                                if (
                                    e.key === "ArrowUp" ||
                                    e.key === "ArrowDown"
                                ) {
                                    e.preventDefault();
                                }
                            }}
                            placeholder="Suchbegriff eingeben"
                        />
                        {query && (
                            <button
                                onClick={clearSearch}
                                className="clear-search-button-inside"
                            >
                                <X size={16} />
                            </button>
                        )}
                        <button
                            onClick={handleSearch}
                            disabled={searchingFiles}
                            className="search-button"
                        >
                            {searchingFiles ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <SearchIcon size={18} />
                            )}
                        </button>
                    </div>
                    <div className="file-search-results-wrapper">
                        <ul className="file-list" ref={resultsContainerRef}>
                            {searchResults.map((resultItem) => (
                                <li
                                    key={resultItem.file.path}
                                    className={`file-item ${
                                        selectedFile?.path ===
                                        resultItem.file.path
                                            ? "selected"
                                            : ""
                                    }`}
                                >
                                    <button
                                        onClick={() =>
                                            setSelectedFile(resultItem.file)
                                        }
                                        title={resultItem.file.path}
                                    >
                                        <div className="file-info">
                                            <h3 className="file-name">
                                                {resultItem.file.name}
                                            </h3>
                                            <p className="file-path">
                                                {resultItem.file.path}
                                            </p>
                                            {showRelevance && (
                                                <p className="match-count">
                                                    Relevanz:{" "}
                                                    {resultItem.match_count}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
};

export default FileSearch;

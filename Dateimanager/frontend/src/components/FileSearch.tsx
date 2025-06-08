import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { searchFiles } from "../api/api.tsx";
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
}) => {
    const [query, setQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const clearSearch = () => {
        setQuery("");
        setSearchResults([]);
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
                toast.success(
                    `✅ ${responseData.data.length} Ergebnisse gefunden!`
                );
            } else {
                setSearchResults([]);
                toast.info("⚠️ Keine passenden Dateien gefunden.");
            }
        } catch (error: any) {
            toast.error(`❌ Fehler bei der Suche: ${error.message}`);
            setSearchResults([]);
        } finally {
            setSearchingFiles(false);
        }
    };

    useEffect(() => {
        if (deletedFile) {
            setSearchResults((prev) =>
                prev.filter((result) => result.file.path !== deletedFile)
            );
            setDeletedFile(null);
        }
    }, [deletedFile, setDeletedFile]);

    useEffect(() => {
        if (!isSearchCollapsed) {
            searchInputRef.current?.focus();
        }
    }, [isSearchCollapsed]);

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
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleSearch()
                            }
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
                        <ul className="file-list">
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

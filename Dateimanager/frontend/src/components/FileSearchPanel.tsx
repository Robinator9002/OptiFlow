import React, { useState, useCallback, forwardRef } from "react";
import { toast } from "react-toastify";
import {
    ChevronUp,
    ChevronDown,
    Search as SearchIcon,
    Loader2,
    X,
} from "lucide-react";
import { searchInFile } from "../api/api.tsx";

// --- Type Definitions ---
interface Snippet {
    text: string;
    score?: number;
}

interface FileContentResult {
    file: { path: string };
    match_count: number;
    snippets: Snippet[];
}

interface HighlightPosition {
    start: number;
    end: number;
    snippetIndex: number;
}

interface FileSearchPanelProps {
    filePath: string;
    fileContent: string;
    onHighlightPositionsChange: React.Dispatch<
        React.SetStateAction<HighlightPosition[]>
    >;
    activeSnippetIndex: number;
    onActiveSnippetIndexChange: React.Dispatch<React.SetStateAction<number>>;
}

const SnippetItem = forwardRef<
    HTMLLIElement,
    { snippet: Snippet; isActive: boolean; onClick: () => void }
>(({ snippet, isActive, onClick }, ref) => {
    const createMarkup = (htmlString: string) => {
        const markedHtml = htmlString.replace(
            /\*\*(.*?)\*\*/g,
            '<mark class="snippet-highlight">$1</mark>'
        );
        return { __html: markedHtml };
    };
    return (
        <li
            ref={ref}
            onClick={onClick}
            className={`snippet-item ${isActive ? "active" : ""}`}
            dangerouslySetInnerHTML={createMarkup(snippet.text)}
        />
    );
});

// --- Component ---
const FileSearchPanel: React.FC<FileSearchPanelProps> = ({
    filePath,
    fileContent,
    onHighlightPositionsChange,
    activeSnippetIndex,
    onActiveSnippetIndexChange,
}) => {
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const clearSearch = useCallback(() => {
        setSearchTerm("");
        setSnippets([]);
        onHighlightPositionsChange([]);
        onActiveSnippetIndexChange(-1);
    }, [onHighlightPositionsChange, onActiveSnippetIndexChange]);

    const executeSearch = useCallback(async () => {
        if (!searchTerm.trim()) {
            clearSearch();
            return;
        }
        setSearchLoading(true);
        try {
            const result: { data: FileContentResult } = await searchInFile(
                searchTerm,
                filePath
            );
            const foundSnippets = result?.data?.snippets || [];
            setSnippets(foundSnippets);

            if (foundSnippets.length > 0) {
                const positions: HighlightPosition[] = [];
                const lowerContent = fileContent.toLowerCase();
                foundSnippets.forEach((snippet, index) => {
                    const plainText = snippet.text
                        .replace(/\*\*(.*?)\*\*/g, "$1")
                        .toLowerCase();
                    let lastIndex = -1;
                    while (
                        (lastIndex = lowerContent.indexOf(
                            plainText,
                            lastIndex + 1
                        )) !== -1
                    ) {
                        positions.push({
                            start: lastIndex,
                            end: lastIndex + plainText.length,
                            snippetIndex: index,
                        });
                    }
                });
                onHighlightPositionsChange(positions);
                toast.success(`${foundSnippets.length} Treffer gefunden.`);
                onActiveSnippetIndexChange(0);
            } else {
                onHighlightPositionsChange([]);
                toast.info("Keine Treffer in dieser Datei gefunden.");
            }
        } catch (error: any) {
            toast.error(`❌ Fehler bei der Suche: ${error.message}`);
            clearSearch();
        } finally {
            setSearchLoading(false);
        }
    }, [
        searchTerm,
        filePath,
        fileContent,
        clearSearch,
        onHighlightPositionsChange,
        onActiveSnippetIndexChange,
    ]);

    const navigateSnippet = (direction: "prev" | "next") => {
        if (snippets.length === 0) return;
        const newIndex =
            direction === "next"
                ? Math.min(activeSnippetIndex + 1, snippets.length - 1)
                : Math.max(activeSnippetIndex - 1, 0);
        onActiveSnippetIndexChange(newIndex);
    };

    return (
        <div className="in-file-search-controls">
            <div className="in-file-search-bar">
                <input
                    ref={searchInputRef}
                    type="search"
                    placeholder="In Datei suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && executeSearch()}
                    disabled={searchLoading}
                />
                {searchTerm && (
                    <button
                        onClick={clearSearch}
                        className="clear-search-button-inside"
                    >
                        <X size={16} />
                    </button>
                )}
                <button
                    onClick={executeSearch}
                    disabled={searchLoading || !searchTerm.trim()}
                >
                    {searchLoading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <SearchIcon size={18} />
                    )}
                </button>
            </div>

            {snippets.length > 0 && !searchLoading && (
                <div>
                    <div className="snippet-navigation">
                        <span>
                            {activeSnippetIndex + 1} / {snippets.length}
                        </span>
                        <button
                            onClick={() => navigateSnippet("prev")}
                            disabled={activeSnippetIndex <= 0}
                        >
                            <ChevronUp size={18} />
                        </button>
                        <button
                            onClick={() => navigateSnippet("next")}
                            disabled={activeSnippetIndex >= snippets.length - 1}
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
                                        ? (el) =>
                                              el?.scrollIntoView({
                                                  behavior: "smooth",
                                                  block: "nearest",
                                              })
                                        : null
                                }
                                snippet={snippet}
                                isActive={index === activeSnippetIndex}
                                onClick={() =>
                                    onActiveSnippetIndexChange(index)
                                }
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default FileSearchPanel;

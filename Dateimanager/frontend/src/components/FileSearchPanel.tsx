import React, {
    useState,
    useCallback,
    useEffect,
    useRef,
    forwardRef,
} from "react";
import { toast } from "react-toastify";
import {
    ChevronUp,
    ChevronDown,
    Search as SearchIcon,
    Loader2,
    X,
} from "lucide-react";
// NOTE: The static API import has been removed to prevent build-time resolution errors.
// It will be imported dynamically when the search function is called.

// --- Type Definitions ---

interface Snippet {
    text: string;
    score?: number;
}

// Assuming the API response has a 'data' object
interface ApiSearchResponse {
    data?: {
        file: { path: string };
        match_count: number;
        snippets: Snippet[];
    };
}

// Exporting this interface so the parent component can use the same type.
export interface HighlightPosition {
    start: number;
    end: number;
    snippetIndex: number;
}

interface FileSearchPanelProps {
    // Data props from parent
    filePath: string;
    fileContent: string | null; // Content to search within
    activeSnippetIndex: number; // Controlled by parent

    // Callbacks to parent
    onHighlightPositionsChange: (positions: HighlightPosition[]) => void;
    onActiveSnippetIndexChange: (index: number) => void;
}

/**
 * A list item that displays a single search result snippet.
 * It uses dangerouslySetInnerHTML to render highlights from markdown.
 */
const SnippetItem = forwardRef<
    HTMLLIElement,
    { snippet: Snippet; isActive: boolean; onClick: () => void }
>(({ snippet, isActive, onClick }, ref) => {
    // This function safely creates HTML from a string.
    const createMarkup = (htmlString: string) => {
        // Replace markdown-style bold with <mark> tags for highlighting
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

/**
 * A panel for searching within a file's content. It handles the search input,
 * API call, and displays the results (snippets).
 */
const FileSearchPanel: React.FC<FileSearchPanelProps> = ({
    filePath,
    fileContent,
    activeSnippetIndex,
    onHighlightPositionsChange,
    onActiveSnippetIndexChange,
}) => {
    // --- Internal State Management ---
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [searchLoading, setSearchLoading] = useState<boolean>(false);
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const activeSnippetRef = useRef<HTMLLIElement>(null);

    // --- Actions ---
    const clearSearch = useCallback(() => {
        setSearchTerm("");
        setSnippets([]);
        onHighlightPositionsChange([]);
        onActiveSnippetIndexChange(-1);
        searchInputRef.current?.focus();
    }, [onHighlightPositionsChange, onActiveSnippetIndexChange]);

    const executeSearch = useCallback(async () => {
        if (!searchTerm.trim() || !fileContent) {
            clearSearch();
            return;
        }

        setSearchLoading(true);
        onHighlightPositionsChange([]); // Clear previous highlights immediately

        try {
            // FIX: Use dynamic import to load the API module at runtime.
            const { searchInFile } = await import("../api/api.tsx");
            const result: ApiSearchResponse = await searchInFile(
                searchTerm,
                filePath
            );
            const foundSnippets = result?.data?.snippets || [];
            setSnippets(foundSnippets);

            if (foundSnippets.length > 0) {
                const positions: HighlightPosition[] = [];
                const lowerContent = fileContent.toLowerCase();

                foundSnippets.forEach((snippet, index) => {
                    const match = snippet.text.match(/\*\*(.*?)\*\*/);
                    if (match && match[1]) {
                        const plainText = match[1].toLowerCase();
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
                    }
                });

                onHighlightPositionsChange(positions);
                onActiveSnippetIndexChange(0);
                toast.success(`${foundSnippets.length} Treffer gefunden.`);
            } else {
                toast.info("Keine Treffer in dieser Datei gefunden.");
                onActiveSnippetIndexChange(-1);
            }
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            toast.error(`❌ Fehler bei der Suche: ${message}`);
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

    // --- Navigation ---
    const navigateSnippet = useCallback(
        (direction: "prev" | "next") => {
            if (snippets.length === 0) return;
            const newIndex =
                direction === "next"
                    ? Math.min(activeSnippetIndex + 1, snippets.length - 1)
                    : Math.max(activeSnippetIndex - 1, 0);
            onActiveSnippetIndexChange(newIndex);
        },
        [activeSnippetIndex, snippets.length, onActiveSnippetIndexChange]
    );

    // --- Effects ---
    useEffect(() => {
        activeSnippetRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
        });
    }, [activeSnippetIndex]);

    return (
        <div className="in-file-search-panel">
            <div className="in-file-search-bar">
                <input
                    ref={searchInputRef}
                    type="search"
                    placeholder="In Datei suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") executeSearch();
                        if (e.key === "Escape") clearSearch();
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            navigateSnippet("next");
                        }
                        if (e.key === "ArrowUp") {
                            e.preventDefault();
                            navigateSnippet("prev");
                        }
                    }}
                    disabled={searchLoading}
                />
                {searchTerm && (
                    <button
                        onClick={clearSearch}
                        className="clear-search-button-inside"
                        title="Suche leeren (Esc)"
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
                <div className="search-results-area">
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
                                        ? activeSnippetRef
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

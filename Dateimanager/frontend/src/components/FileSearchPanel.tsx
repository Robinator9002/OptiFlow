import {
    useState,
    useCallback,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
} from "react";
import { toast } from "react-toastify";
import {
    ChevronUp,
    ChevronDown,
    Search as SearchIcon,
    Loader2,
    X,
} from "lucide-react";

// --- Type Definitions ---

interface Snippet {
    text: string;
    score?: number;
    start: number;
    end: number;
}

interface ApiSearchResponse {
    data?: {
        file: { path: string };
        match_count: number;
        snippets: Snippet[];
    };
}

export interface HighlightPosition {
    start: number;
    end: number;
    snippetIndex: number;
}

interface FileSearchPanelProps {
    filePath: string;
    fileContent: string | null;
    activeSnippetIndex: number;
    onHighlightPositionsChange: (positions: HighlightPosition[]) => void;
    onActiveSnippetIndexChange: (index: number) => void;
    onSearchStatusChange: (isActive: boolean) => void;
}

// UPDATED: Ref interface now includes clearSearch
export interface FileSearchPanelRef {
    navigateSnippet: (direction: "prev" | "next") => void;
    clearSearch: () => void;
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

const FileSearchPanel = forwardRef<FileSearchPanelRef, FileSearchPanelProps>(
    (
        {
            filePath,
            fileContent,
            activeSnippetIndex,
            onHighlightPositionsChange,
            onActiveSnippetIndexChange,
            onSearchStatusChange,
        },
        ref
    ) => {
        const [searchTerm, setSearchTerm] = useState<string>("");
        const [searchLoading, setSearchLoading] = useState<boolean>(false);
        const [snippets, setSnippets] = useState<Snippet[]>([]);
        const searchInputRef = useRef<HTMLInputElement>(null);
        const activeSnippetRef = useRef<HTMLLIElement>(null);

        const clearSearch = useCallback(() => {
            setSearchTerm("");
            setSnippets([]);
            onHighlightPositionsChange([]);
            onActiveSnippetIndexChange(-1);
            onSearchStatusChange(false);
            // We no longer focus here, as this function might be called
            // during context switches where focus should be elsewhere.
        }, [
            onHighlightPositionsChange,
            onActiveSnippetIndexChange,
            onSearchStatusChange,
        ]);

        const executeSearch = useCallback(async () => {
            if (!searchTerm.trim() || !fileContent) {
                clearSearch();
                return;
            }

            setSearchLoading(true);
            onHighlightPositionsChange([]);

            try {
                const { searchInFile } = await import("../api/api.tsx");
                const result: ApiSearchResponse = await searchInFile(
                    searchTerm,
                    filePath
                );
                const foundSnippets = result?.data?.snippets || [];
                setSnippets(foundSnippets);
                onSearchStatusChange(foundSnippets.length > 0);

                if (foundSnippets.length > 0) {
                    const positions: HighlightPosition[] = foundSnippets.map(
                        (snippet, index) => ({
                            start: snippet.start,
                            end: snippet.end,
                            snippetIndex: index,
                        })
                    );
                    positions.sort((a, b) => a.start - b.start);

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
            onSearchStatusChange,
        ]);

        const navigateSnippet = useCallback(
            (direction: "prev" | "next") => {
                if (snippets.length === 0) return;
                let newIndex = activeSnippetIndex;
                if (direction === "next") {
                    newIndex =
                        newIndex >= snippets.length - 1 ? 0 : newIndex + 1;
                } else {
                    newIndex =
                        newIndex <= 0 ? snippets.length - 1 : newIndex - 1;
                }
                onActiveSnippetIndexChange(newIndex);
            },
            [activeSnippetIndex, snippets.length, onActiveSnippetIndexChange]
        );

        // UPDATED: Expose the clearSearch function
        useImperativeHandle(ref, () => ({
            navigateSnippet,
            clearSearch,
        }));

        // This effect is to clear the search if the file path changes
        // This is a defensive measure; FilePreview also handles this.
        useEffect(() => {
            clearSearch();
        }, [filePath, clearSearch]);

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
                            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                e.preventDefault();
                                navigateSnippet(
                                    e.key === "ArrowDown" ? "next" : "prev"
                                );
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
                        className="search-button"
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
                                disabled={
                                    activeSnippetIndex >= snippets.length - 1
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
    }
);

export default FileSearchPanel;

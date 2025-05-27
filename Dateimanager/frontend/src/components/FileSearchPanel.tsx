import React, { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
	ChevronUp,
	ChevronDown,
	Search as SearchIcon,
	Loader2,
	X,
} from "lucide-react";
import { searchInFile } from "../api/api.tsx"; // Assuming this API call returns FileContentResult when file_path is set

// Interfaces
interface Occurrence {
	start: number;
	end: number;
}

interface HighlightPosition {
	start: number;
	end: number;
	snippetIndex: number;
}

// Helper function to remove ** markup from snippet text
const removeMarkup = (text) => {
	if (!text) return "";
	return text.replace(/\*\*(.*?)\*\*/g, "$1");
};

// Schritt 2 & 3: Typisiere die Funktion und das Array
const findAllOccurrences = (
	text: string | null | undefined, // Parameter 'text' typisieren
	content: string | null | undefined // Parameter 'content' typisieren
): Occurrence[] => {
	// Rückgabetyp der Funktion festlegen
	const occurrences: Occurrence[] = []; // Array explizit typisieren

	// Die Prüfung stellt sicher, dass text und content danach Strings sind
	if (!text || !content || text.length === 0) {
		return occurrences;
	}

	// Ab hier sind 'text' und 'content' garantiert strings (durch die obige Prüfung)
	const lowerText = text.toLowerCase();
	const lowerContent = content.toLowerCase();

	let startIndex = 0;
	while (startIndex !== -1) {
		startIndex = lowerContent.indexOf(lowerText, startIndex);
		if (startIndex !== -1) {
			// Kein Fehler mehr: Du pushst ein Occurrence-Objekt in ein Occurrence[]-Array
			occurrences.push({ start: startIndex, end: startIndex + text.length });
			// Kleine Korrektur: Besser die Länge des ursprünglichen 'text' für die Inkrementierung verwenden,
			// obwohl es bei toLowerCase meist gleich bleibt. Sicherer ist text.length.
			startIndex += text.length;
		}
	}
	return occurrences;
};

// Component to render a single Snippet with internal highlighting
const SnippetItem = React.forwardRef(({ snippet, isActive, onClick }, ref) => {
	const createMarkup = (htmlString) => {
		// Replace **text** with <mark class="snippet-highlight">text</mark>
		const markedHtml = htmlString.replace(
			/\*\*(.*?)\*\*/g,
			'<mark class="snippet-highlight">$1</mark>'
		);
		return { __html: markedHtml };
	};

	return (
		<li
			ref={ref} // Ref for ScrollIntoView
			onClick={onClick}
			className={`snippet-item ${isActive ? "active" : ""}`}
			title={`Score: ${snippet.score?.toFixed(0) ?? "N/A"}`}
			tabIndex={isActive ? 0 : -1} // Makes active element focusable
		>
			{/* Render snippet text with highlighting markup */}
			<span dangerouslySetInnerHTML={createMarkup(snippet.text)}></span>
		</li>
	);
});

/**
 * Component for the in-file search functionality and displaying search results (snippets).
 * Receives search term and state setters from the parent.
 * Manages internal search loading and API result state.
 */
const FileSearchPanel = ({
	filePath, // Path of the currently viewed file
	fileContent, // Full content of the file
	isEditing, // Whether the parent is in editing mode
	isLoading, // Whether the parent is loading content
	searchTerm, // Search term from Parent
	onSearchTermChange, // Callback to change search term in Parent
	onHighlightPositionsChange, // Callback to update highlight positions in parent
	onActiveSnippetIndexChange, // Callback to update active snippet index in parent
	onSearchActiveChange, // Callback to update search active state in parent
	onSetIsSearchCollapsed, // Callback to collapse/expand search panel in parent
	searchInputRef, // Ref for the search input element
	snippetListRef, // Ref for the snippet list container
	activeSnippetRef, // Ref for the active snippet item in the list
	navigateSnippet, // Callback from parent to navigate snippets (for keybindings and buttons)
	onSnippetCountChange, // Callback to update snippet count in parent
	activeSnippetIndex, // Active snippet index from parent state (PROP)
	snippetCount, // Snippet count from parent state (PROP)
	isSearchActive, // Is the Search currently active? (PROP)
}) => {
	// === State for In-File Search (Internal to this component) ===
	const [searchLoading, setSearchLoading] = useState(false);
	const [searchApiResult, setSearchApiResult] = useState(null); // Holds the FileContentResult object

	// --- Snippet Data (Derived from internal state) ---
	const snippets = searchApiResult?.snippets || [];

	// Notify parent about snippet count changes whenever internal search results change
	useEffect(() => {
		onSnippetCountChange(searchLoading ? 0 : snippets.length);
	}, [snippets.length, onSnippetCountChange, searchLoading]);

	// Notify parent about search active state changes whenever internal search results or term change
	useEffect(() => {
		const isActive = snippets.length > 0 && searchTerm.trim() !== "";
		onSearchActiveChange(isActive);
	}, [snippets.length, searchTerm, onSearchActiveChange]);

	// Effect to clear internal search state when parent indicates editing mode is entered
	useEffect(() => {
		if (isEditing) {
			setSearchApiResult(null);
		}
	}, [isEditing]);

	// Effect to bring the input into foreground
	useEffect(() => {
		const timer = setTimeout(() => {
			searchInputRef.current.focus();
		}, 50); // 50ms sollten reichen

		return () => clearTimeout(timer);
	});

	// Effect to clear internal search state when file path changes (new file selected or file closed)
	useEffect(() => {
		onSearchTermChange(""); // Clear search term in Parent
		setSearchApiResult(null);
	}, [filePath, onSearchTermChange]);

	// === Effect to scroll to the active snippet in the LIST ===
	useEffect(() => {
		if (activeSnippetIndex >= 0 && activeSnippetRef.current) {
			activeSnippetRef.current.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [activeSnippetIndex, activeSnippetRef]);

	// --- Snippet Navigation Function (Managed in parent) ---
	// This component calls the navigateSnippet function passed from the parent.

	// === Handler for In-File Search Input ===
	const handleSearchTermChange = (e) => {
		const term = e.target.value;
		onSearchTermChange(term); // Update search term in Parent
	};

	const clearSearchTerm = useCallback(() => {
		onSearchTermChange(""); // Clear search term in Parent
		setSearchApiResult(null); // Clear internal API result state

		// Explicitly notify parent to reset active index and highlights
		onActiveSnippetIndexChange(-1);
		onHighlightPositionsChange([]);
	}, [
		onSearchTermChange,
		onActiveSnippetIndexChange,
		onHighlightPositionsChange,
	]);

	// === Handler to Execute Search ===
	// This function is now called directly by handleSearchKeyDown (on Enter)
	const executeSearchInFile = useCallback(async () => {
		// No longer takes searchTerm as parameter, uses prop directly
		if (!filePath || !searchTerm.trim()) {
			// Use searchTerm PROP
			clearSearchTerm(); // Ensure state is clean if search is triggered with empty term
			if (searchTerm.trim()) toast.warn("Suchbegriff eingeben."); // Use searchTerm PROP for toast
			return;
		}
		setSearchLoading(true);
		setSearchApiResult(null); // Clear previous results

		onSetIsSearchCollapsed(true); // Collapse search panel on search start

		try {
			const result = await searchInFile(searchTerm, filePath); // Use searchTerm PROP
			console.log("FileSearchPanel: searchInFile API returned:", result);

			if (result?.data?.snippets && result.data.snippets.length > 0) {
				setSearchApiResult(result.data);

				const fetchedSnippets = result.data.snippets;
				const positions: HighlightPosition[] = [];
				fetchedSnippets.forEach((snippet, index) => {
					const plainText = removeMarkup(snippet.text);
					const occurrences = findAllOccurrences(plainText, fileContent);
					occurrences.forEach((occ) => {
						positions.push({ ...occ, snippetIndex: index });
					});
				});

				onHighlightPositionsChange(positions);

				toast.success(
					`${fetchedSnippets.length} Treffer-Snippets gefunden. ${positions.length} Vorkommnisse im Text.`
				);

				if (positions.length > 0) {
					const firstSnippetIndex =
						positions.find((p) => p.snippetIndex === 0)?.snippetIndex ?? -1;
					onActiveSnippetIndexChange(firstSnippetIndex);
				} else {
					toast.info(
						"Snippets gefunden, aber ihr Text konnte im aktuellen Inhalt nicht lokalisiert werden. Inhalt eventuell veraltet?"
					);
					onActiveSnippetIndexChange(-1);
				}
			} else {
				setSearchApiResult(null);
				onHighlightPositionsChange([]);
				onActiveSnippetIndexChange(-1);
				toast.info("Keine Treffer in dieser Datei gefunden.");
			}
		} catch (error) {
			console.error("FileSearchPanel: Error during search:", error);
			toast.error(`❌ Fehler bei der Suche: ${error.message}`);
			setSearchApiResult(null);
			onHighlightPositionsChange([]);
			onActiveSnippetIndexChange(-1);
		} finally {
			setSearchLoading(false);
		}
	}, [
		filePath,
		searchTerm,
		fileContent, // searchTerm is now a direct dependency
		onHighlightPositionsChange,
		onActiveSnippetIndexChange,
		onSearchActiveChange,
		onSetIsSearchCollapsed,
		onSnippetCountChange,
		clearSearchTerm, // Include clearSearchTerm as dependency
	]);

	const handleSearchKeyDown = (event) => {
		if (event.key === "Enter") {
			executeSearchInFile(); // Call executeSearchInFile directly
			event.preventDefault();
		}
		// F1 / F2 / Escape are handled by the global keybinding effect in the parent
	};

	// Handler for clicks on a snippet item in the list
	const handleSnippetClick = (index) => {
		onActiveSnippetIndexChange(index); // Notify parent to set active index
	};

	return (
		<div className={`in-file-search-controls ${isEditing ? "editing" : ""}`}>
			{/* Search Bar */}
			{!isEditing && (
				<div>
					<div className="in-file-search-bar" style={{ position: "relative" }}>
						<input
							ref={searchInputRef} // Attach the ref passed from parent
							type="search"
							placeholder="In Datei suchen..."
							value={searchTerm} // Uses searchTerm PROP
							onChange={handleSearchTermChange} // Updates searchTerm PROP in Parent
							onKeyDown={handleSearchKeyDown} // Triggers search on Enter
							disabled={isLoading || searchLoading} // Disable if parent is loading or search is loading
							className="search-input"
						/>
						{/* Search button - now triggers search on click */}
						<button
							onClick={executeSearchInFile} // Call executeSearchInFile on click
							disabled={isLoading || searchLoading || !searchTerm.trim()} // Disable if loading or term is empty
							title="Suchen (Enter)"
							className="search-button"
						>
							{searchLoading ? (
								<Loader2 size={18} className="animate-spin" />
							) : (
								<SearchIcon size={18} />
							)}
						</button>

						{searchTerm.trim() && ( // Show clear button if term is not empty (Uses searchTerm PROP)
							<button
								onClick={clearSearchTerm} // Clears searchTerm PROP in Parent
								title="Suche leeren (Esc)"
								className="clear-search-button-inside"
							>
								<X size={16} />
							</button>
						)}
					</div>

					{/* Display Snippets from Backend */}
					{/* isSearchActive and snippetCount come from Parent (PROPS) */}
					{isSearchActive && snippetCount > 0 && !searchLoading && (
						<div>
							<div className="snippet-navigation">
								<span
									className="snippet-count"
									title="Aktueller Treffer / Gesamt-Snippets"
								>
									{/* Uses activeSnippetIndex and snippetCount PROPS */}
									{activeSnippetIndex >= 0 ? activeSnippetIndex + 1 : 0} /{" "}
									{snippetCount}
								</span>
								{/* Uses navigateSnippet from parent state */}
								{/* Disable buttons based on activeSnippetIndex and snippetCount PROPS */}
								<button
									onClick={() => navigateSnippet("prev")}
									disabled={activeSnippetIndex <= 0}
									title="Vorheriger Treffer (F2)"
								>
									<ChevronUp size={18} />
								</button>
								<button
									onClick={() => navigateSnippet("next")}
									disabled={activeSnippetIndex >= snippetCount - 1}
									title="Nächster Treffer (F1)"
								>
									<ChevronDown size={18} />
								</button>
							</div>
							<div
								className="search-snippet-list-container"
								ref={snippetListRef}
							>
								{" "}
								{/* Attach ref from parent */}
								<ul className="search-snippet-list">
									{snippets.map((snippet, index) => (
										<SnippetItem
											key={index}
											ref={
												index === activeSnippetIndex ? activeSnippetRef : null
											} // Attach ref from parent if active (Uses activeSnippetIndex PROP)
											snippet={snippet}
											isActive={index === activeSnippetIndex} // Uses activeSnippetIndex PROP
											onClick={() => handleSnippetClick(index)} // Calls internal handler
										/>
									))}
								</ul>
							</div>
						</div>
					)}

					{/* Display Result Count / No Results Message */}
					{/* Uses searchTerm PROP and snippetCount PROP */}
					{!searchLoading && searchTerm.trim() !== "" && (
						<span
							className="snippet-count highlight-count"
							title="Gefundene Snippets"
						>
							{snippetCount} {snippetCount === 1 ? "Snippet" : "Snippets"}{" "}
							gefunden
						</span>
					)}
					{/* Uses searchTerm PROP and snippetCount PROP */}
					{!searchLoading && searchTerm.trim() !== "" && snippetCount === 0 && (
						<span
							className="snippet-count highlight-count"
							title="Keine Snippets gefunden"
						>
							Keine Snippets gefunden
						</span>
					)}
				</div>
			)}
		</div>
	);
};

export default FileSearchPanel;

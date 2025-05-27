import React, { useState, useEffect, useRef } from "react"; // useRef für Fokus auf Input behalten
import { toast } from "react-toastify";
import { searchFiles } from "../api/api.tsx";
import {
	ChevronLeft,
	ChevronRight,
	Search as SearchIcon,
	Loader2,
	X,
} from "lucide-react"; // Icons importieren, SearchIcon umbenannt

// isSearchCollapsed und onToggleCollapse als Props empfangen
const FileSearch = ({
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
	const [query, setQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const searchInputRef = useRef(null);
	const resultRefs = useRef({}); // Für Scrollen zu Items

	const getCurrentSelectedIndex = () => {
		return searchResults.findIndex(
			(item) => item.file.path === selectedFile?.path
		);
	};

	const moveSelection = (direction) => {
		if (searchResults.length === 0) return;

		let currentIndex = getCurrentSelectedIndex();
		let nextIndex =
			direction === "down"
				? Math.min(currentIndex + 1, searchResults.length - 1)
				: Math.max(currentIndex - 1, 0);

		const nextFile = searchResults[nextIndex]?.file;
		if (nextFile) {
			setSelectedFile(nextFile);
			const ref = resultRefs.current[nextFile.path];
			if (ref && ref.scrollIntoView) {
				ref.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
		}
	};

	// Tastatur-Handler erweitern
	useEffect(() => {
		const handleGlobalKeyDown = (event) => {
			if (isSearchCollapsed) return;

			switch (event.key) {
				case "Enter":
					if (!selectedFile) {
						event.preventDefault();
						handleSearch();
					}
					break;
				case "Escape":
					event.preventDefault();
					clearSearch();
					break;
				case "ArrowDown":
					event.preventDefault();
					moveSelection("down");
					break;
				case "ArrowUp":
					event.preventDefault();
					moveSelection("up");
					break;
				default:
					break;
			}
		};

		document.addEventListener("keydown", handleGlobalKeyDown);
		return () => document.removeEventListener("keydown", handleGlobalKeyDown);
	}, [selectedFile, searchResults, isSearchCollapsed]);

	// Funktion für manuelle Suche
	const handleSearch = async () => {
		if (query.trim() === "") {
			setSearchResults([]);
			toast.warn("⚠️ Bitte einen Suchbegriff eingeben.");
			return;
		}

		try {
			setSearchingFiles(true);
			const responseData = await searchFiles(query);
			console.log(responseData); // Eher unnötig im Produktivcode ;)
			setSearchingFiles(false);

			if (responseData.data && Array.isArray(responseData.data)) {
				setSearchResults(responseData.data);
				toast.success(`✅ ${responseData.data.length} Ergebnisse gefunden!`);
			} else {
				setSearchResults([]);
				toast.info("⚠️ Keine passenden Dateien gefunden."); // Geändert auf info, warn war vielleicht zu stark
			}
		} catch (error) {
			toast.error(`❌ Fehler bei der Suche: ${error.message}`);
			setSearchResults([]);
		}
	};

	// Effekt, um searchResults zu aktualisieren, wenn deletedFile sich ändert
	useEffect(() => {
		if (deletedFile) {
			setSearchResults((prevResults) =>
				prevResults.filter((result) => result.file.path !== deletedFile)
			);
			setDeletedFile(null);
		}
	}, [deletedFile, setDeletedFile]);

	// Effekt, um Fokus auf Input zu setzen, wenn Suche eingeblendet wird
	useEffect(() => {
		if (!isSearchCollapsed && searchInputRef.current) {
			// Kleinen Timeout geben, damit das Element sicher sichtbar ist
			const timer = setTimeout(() => {
				searchInputRef.current.focus();
			}, 50); // 50ms sollten reichen

			return () => clearTimeout(timer);
		}
	}, [isSearchCollapsed]); // Abhängig vom Zustand des Einklappens

	const clearSearch = () => {
		setQuery("");
		setSearchResults([]);
	};

	const handleQueryChange = (e) => {
		const value = e.target.value;
		if (!value.trim()) clearSearch();
		else setQuery(value);
	};

	const searchInputKeyDown = (event) => {
		if (!selectedFile) {
			return; // Das hier wird nur genutzt wenn die Globalen Keys nicht genutzt werden
		}

		if (event.key === "Enter") {
			event.preventDefault();
			handleSearch();
		}
		if (event.key === "Escape") {
			event.preventDefault();
			clearSearch();
		}
	};

	useEffect(() => {
		const handleGlobalKeyDown = (event) => {
			if (selectedFile) {
				return; // Only Execute something if no File is Selected
			}

			if (event.key === "Enter") {
				event.preventDefault();
				handleSearch();
			}
			if (event.key === "Escape") {
				event.preventDefault();
				clearSearch();
			}
		};

		// Event Listener hinzufügen, wenn Komponente mountet
		document.addEventListener("keydown", handleGlobalKeyDown);

		// Event Listener entfernen, wenn Komponente unmountet
		return () => {
			document.removeEventListener("keydown", handleGlobalKeyDown);
		};
	}, [selectedFile, handleSearch, clearSearch]);

	return (
		// CSS-Klasse wird vom Parent (FileManagement) gesetzt
		<div
			className={`file-search-container ${
				isSearchCollapsed ? "collapsed" : ""
			}`}
		>
			{/* Überschrift und Toggle Button */}
			<div className="file-search-header">
				{" "}
				{/* Neues Div für Überschrift und Toggle */}
				<h2>Datei-Suche</h2>
				<button
					onClick={onToggleCollapse}
					className="collapse-toggle-button"
					title={isSearchCollapsed ? "Suche ausklappen" : "Suche einklappen"}
				>
					{isSearchCollapsed ? (
						<ChevronRight size={20} />
					) : (
						<ChevronLeft size={20} />
					)}
				</button>
			</div>

			{/* Search Bar und Results Wrapper nur anzeigen, wenn nicht eingeklappt */}
			{/* Oder per CSS steuern, aber einfaches Bedingtes Rendering ist auch OK */}
			{!isSearchCollapsed && (
				<>
					<div className="file-search-bar">
						<label>
							<input
								ref={searchInputRef} // Ref hier zuweisen
								type="text"
								value={query}
								onKeyDown={searchInputKeyDown}
								onChange={(e) => handleQueryChange(e)}
								placeholder="Suchbegriff eingeben"
							/>
							{query.trim() && (
								<button
									onClick={clearSearch}
									title="Suche leeren (Esc)"
									className="clear-search-button clear-search-button-inside"
								>
									<X size={16} />
								</button>
							)}
						</label>
						<button
							onClick={handleSearch}
							disabled={searchingFiles}
							title="Suchen (Enter)"
							className="search-button"
						>
							{/* Lade-Icon anzeigen, wenn Suche läuft */}
							{searchingFiles ? (
								<Loader2 size={18} className="animate-spin" />
							) : (
								<SearchIcon size={18} />
							)}
						</button>
					</div>
					<div className="file-search-results-wrapper">
						<div className="file-list-container">
							<ul className="file-list">
								{searchResults.length === 0 &&
									query.trim() !== "" &&
									!setSearchingFiles && (
										<li className="no-results">Keine Treffer gefunden.</li>
									)}
								{searchResults.length === 0 && query.trim() === "" && (
									<li className="no-results">
										Suchbegriff eingeben, um Ergebnisse zu sehen.
									</li>
								)}
								{searchResults.map((resultItem) => {
									const file = resultItem.file;
									return (
										<li
											key={file.path}
											className={`file-item ${
												selectedFile && selectedFile.path === file.path
													? "selected"
													: ""
											}`}
										>
											<button
												onClick={() => setSelectedFile(file)}
												title={file.path}
											>
												{" "}
												{/* Pfad als Titel */}
												<div className="file-info">
													<h3 className="file-name">{file.name}</h3>
													{/* Pfad nur anzeigen, wenn nicht eingeklappt und Platz da ist? Oder immer? */}
													<p className="file-path">{file.path}</p>
													{showRelevance && (
														<p className="match-count">
															Relevanz: {resultItem.match_count}
														</p>
													)}
												</div>
											</button>
										</li>
									);
								})}
							</ul>
						</div>
					</div>
				</>
			)}
			{/* Optional: Ein kleiner Hinweis im eingeklappten Zustand */}
			{isSearchCollapsed && (
				<div className="collapsed-hint">
					<p>Suche eingeklappt</p>
				</div>
			)}
		</div>
	);
};

export default FileSearch;

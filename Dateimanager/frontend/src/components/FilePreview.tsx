import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { X } from "lucide-react"; // Only need X icon here now
import { ConfirmModal } from "./ConfirmModal.tsx";
// Import the new components
import FileContentView from "./FileContentView.tsx";
import FileSearchPanel from "./FileSearchPanel.tsx";
// Keep necessary API calls here
import {
	getFileInfo,
	openFile,
	openFileInExplorer,
	writeFile,
	deleteFile,
	ocrConvertFile,
	// searchInFile is moved to FileSearchPanel
} from "../api/api.tsx";

/**
 * Main component to preview a file, orchestrating content display, editing,
 * actions, and search functionality.
 */
const FilePreviewContainer = ({
	selectedFile,
	setSelectedFile,
	onFileDeleted,
	isAdmin,
	setIsSearchCollapsed,
}) => {
	// === State für Dateiinhalt & Metadaten ===
	const [content, setContent] = useState(""); // Raw content
	const [originalContent, setOriginalContent] = useState(""); // Original content for reverting edits
	const [fileInfo, setFileInfo] = useState(null);
	const [loadingContent, setLoadingContent] = useState(false);
	const [contentError, setContentError] = useState(null);

	// === State für Bearbeitung ===
	const [editingFile, setEditingFile] = useState(false);
	const [savingFile, setSavingFile] = useState(false);
	const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
	const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

	// === State für In-File-Suche (Managed here now, updated by FileSearchPanel) ===
	const [searchTermInFile, setSearchTermInFile] = useState("");
	const [highlightPositions, setHighlightPositions] = useState([]); // Highlight positions received from FileSearchPanel
	const [activeSnippetIndex, setActiveSnippetIndex] = useState(-1); // Active snippet index received from FileSearchPanel
	const [isSearchActive, setIsSearchActive] = useState(false); // Search active state received from FileSearchPanel
	const [snippetCount, setSnippetCount] = useState(0); // Snippet count received from FileSearchPanel

	// === Refs (Managed here, passed down to children) ===
	const snippetListRef = useRef(null); // Ref for scrolling the snippet list (passed to FileSearchPanel)
	const previewContentRef = useRef(null); // Ref for scrolling the main content (<pre>) (passed to FileContentView)
	const searchInputRef = useRef(null); // Ref for focusing the search field (passed to FileSearchPanel)
	const activeSnippetRef = useRef(null); // Ref for the active snippet element in the LIST (passed to FileSearchPanel)

	// --- Snippet Navigation Function (Defined here, passed down and used in keybinding) ---
	const navigateSnippet = useCallback(
		(direction) => {
			setActiveSnippetIndex((prev) => {
				// If no snippets, index must be -1
				if (snippetCount === 0) {
					console.log("navigateSnippet: No snippets, staying at -1");
					return -1;
				}

				let nextIndex = prev;

				if (direction === "prev") {
					// If currently at index 0 or less (-1), stay at current index
					if (prev > 0) {
						nextIndex = prev - 1;
						console.log(
							"navigateSnippet: Navigating prev, new index:",
							nextIndex
						);
					} else {
						nextIndex = prev; // Stays at 0 or -1
						console.log(
							"navigateSnippet: Cannot navigate prev from index",
							prev,
							", staying at",
							nextIndex
						);
					}
				} else if (direction === "next") {
					// If currently at the last index or more, stay at current index
					if (prev < snippetCount - 1) {
						// If currently at -1, the next index is 0 (the first snippet)
						if (prev === -1) {
							nextIndex = 0;
							console.log(
								"navigateSnippet: Navigating next from -1, new index:",
								nextIndex
							);
						} else {
							// If at a valid index, move to the next
							nextIndex = prev + 1;
							console.log(
								"navigateSnippet: Navigating next from index",
								prev,
								", new index:",
								nextIndex
							);
						}
					} else {
						nextIndex = prev; // Stays at snippetCount - 1
						console.log(
							"navigateSnippet: Cannot navigate next from index",
							prev,
							", staying at",
							nextIndex
						);
					}
				}

				// Ensure the index is within valid bounds [-1, snippetCount - 1]
				// This check is mostly a safeguard, the logic above should handle it.
				nextIndex = Math.max(-1, nextIndex);
				if (snippetCount > 0) {
					nextIndex = Math.min(snippetCount - 1, nextIndex);
				} else {
					nextIndex = -1;
				}

				// console.log(nextIndex); // Keeping your original log for now, but the others are more detailed.

				return nextIndex;
			});
		},
		[snippetCount]
	); // Dependency on snippetCount

	// --- Close File Function ---
	const closeFile = () => {
		// Schließe die momentan geöffnete Datei, und klappe die Suche wieder auf
		setSelectedFile(null);
		// Reset all file-specific state when closing
		setContent("");
		setOriginalContent("");
		setFileInfo(null);
		setEditingFile(false);
		setContentError(null);
		setHighlightPositions([]);
		setActiveSnippetIndex(-1);
		setIsSearchActive(false);
		setSnippetCount(0);
		// FileSearchPanel should also clear its internal state? Yes, it does on filePath change.
		setIsSearchCollapsed(false); // Ensure search panel is expanded when file is closed
	};

	// === Effekt zum Laden der Datei ===
	useEffect(() => {
		if (!selectedFile?.path) {
			// Reset state when no file is selected
			closeFile(); // Use the closeFile function to reset state
			return;
		}

		const loadFileData = async () => {
			// Reset state before loading new file
			setLoadingContent(true);
			setContentError(null);
			setEditingFile(false);
			// Reset search states managed here
			setHighlightPositions([]);
			setActiveSnippetIndex(-1);
			setIsSearchActive(false);
			setSnippetCount(0);
			// FileSearchPanel will reset its internal state based on filePath change

			try {
				const data = await getFileInfo(selectedFile.path);
				let displayContent = "Kein Vorschauinhalt verfügbar.";
				if (
					data.content === "" ||
					data.content === null ||
					data.content === undefined
				) {
					displayContent = "(Datei ist leer)";
				} else {
					displayContent = data.content;
				}
				setContent(displayContent);
				setOriginalContent(displayContent);
				setFileInfo(data);
			} catch (error) {
				const errorMsg = `Fehler beim Laden der Datei: ${error.message}`;
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
	}, [selectedFile?.path, setSelectedFile]); // Dependency on selectedFile.path and setSelectedFile

	// === Handler für Aktionen ===
	const handleEdit = () => {
		setOriginalContent(content);
		setEditingFile(true);
		setIsSearchCollapsed(true); // Collapse search when editing
		// Clear search state when entering edit mode
		setHighlightPositions([]);
		setActiveSnippetIndex(-1);
		setIsSearchActive(false);
		setSnippetCount(0);
		// FileSearchPanel should also clear its internal state (searchTerm, results)
		// It should react to editingFile becoming true.
	};

	const handleContentChange = (e) => {
		setContent(e.target.value);
	};

	const handleConfirmSave = async () => {
		setShowConfirmSaveModal(false);
		setSavingFile(true);
		try {
			await writeFile({ file_path: selectedFile.path, content });
			setOriginalContent(content);
			setEditingFile(false);
			toast.success("✅ Gespeichert!");
		} catch (error) {
			toast.error(`❌ Speicherfehler: ${error.message}`);
		} finally {
			setSavingFile(false);
		}
	};

	const handleCancelEdit = () => {
		setContent(originalContent);
		setEditingFile(false);
		toast.info("↩ Änderungen verworfen.");
		// Clear search state
		setHighlightPositions([]);
		setActiveSnippetIndex(-1);
		setIsSearchActive(false);
		setSnippetCount(0);
	};

	const handleDeleteFile = async () => {
		setShowDeleteConfirmModal(false);
		try {
			await deleteFile(selectedFile.path);
			toast.success("🗑️ Gelöscht!");
			if (onFileDeleted) onFileDeleted(selectedFile.path);
			closeFile(); // Close the deleted file and reset state
		} catch (error) {
			toast.error(`❌ Löschfehler: ${error.message}`);
		}
	};

	const convertPDFFile = async () => {
		if (!selectedFile?.path) return;
		toast.info("PDF wird konvertiert...");
		try {
			// Assuming ocrConvertFile takes input and output path, converting in place
			await ocrConvertFile(selectedFile.path, selectedFile.path);
			toast.success("✅ PDF konvertiert! Lade neu...");
			// Reload content after conversion
			const data = await getFileInfo(selectedFile.path);
			let displayContent = "Kein Vorschauinhalt verfügbar.";
			if (
				data.content === "" ||
				data.content === null ||
				data.content === undefined
			) {
				displayContent = "(Datei ist leer)";
			} else {
				displayContent = data.content;
			}
			setContent(displayContent);
			setOriginalContent(displayContent);
			setFileInfo(data);
			// Clear search state as content has changed
			setHighlightPositions([]);
			setActiveSnippetIndex(-1);
			setIsSearchActive(false);
			setSnippetCount(0);
		} catch (error) {
			const errorMsg = `❌ Konvertierungsfehler: ${error.message}`;
			console.error(errorMsg, error);
			toast.error(errorMsg);
		}
	};

	// Handler for clicks on the main content area to detect clicks on highlighted marks
	// This handler is passed down to FileContentView
	const handleContentClick = useCallback(
		(event) => {
			const target = event.target;
			// Check if the clicked element is a <mark> and has the highlight class
			// and has the data-snippet-index attribute
			if (
				target.tagName === "MARK" &&
				target.classList.contains("highlighted-text") &&
				target.hasAttribute("data-snippet-index")
			) {
				const snippetIndex = parseInt(
					target.getAttribute("data-snippet-index"),
					10
				);
				// Make sure the data-snippet-index is a valid number and corresponds to a snippet
				// Use the snippetCount state managed here.
				if (
					!isNaN(snippetIndex) &&
					snippetIndex >= 0 &&
					snippetIndex < snippetCount
				) {
					setActiveSnippetIndex(snippetIndex); // Set active snippet based on clicked highlight's index
				} else {
					console.warn(
						"Clicked highlight has invalid data-snippet-index:",
						target.getAttribute("data-snippet-index"),
						"Snippets count:",
						snippetCount
					);
				}
			}
		},
		[snippetCount]
	); // Dependency: snippetCount to ensure index check is valid

	// === Effekt für globale Keybindings (F2 etc.) ===
	// This effect remains here as it handles global key events and interacts with parent state
	useEffect(() => {
		const handleGlobalKeyDown = (event) => {
			console.log(
				"Global Keydown:",
				event.key,
				"isSearchActive:",
				isSearchActive,
				"snippetCount:",
				snippetCount,
				"editingFile:",
				editingFile,
				"showConfirmSaveModal:",
				showConfirmSaveModal,
				"showDeleteConfirmModal:",
				showDeleteConfirmModal,
				"searchTermInFile:",
				searchTermInFile
			);

			// Nur reagieren, wenn Suche aktiv ist, Snippets vorhanden sind und keine Datei editiert wird
			if (isSearchActive && snippetCount > 0 && !editingFile) {
				if (event.key === "ArrowDown") {
					event.preventDefault();
					console.log('Keybinding: Calling navigateSnippet("next")');
					navigateSnippet("next");
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					console.log('Keybinding: Calling navigateSnippet("prev")');
					navigateSnippet("prev");
				}
			}

			// Escape behandelt diverse Fälle
			if (event.key === "Escape") {
				if (showConfirmSaveModal || showDeleteConfirmModal) {
					console.log("Escape pressed, modal is open. Ignoring.");
					return;
				}

				const activeElement = document.activeElement;
				if (
					activeElement &&
					(activeElement.tagName === "INPUT" ||
						activeElement.tagName === "TEXTAREA") &&
					activeElement !== searchInputRef.current
				) {
					console.log("Escape pressed, input/textarea focused. Ignoring.");
					return;
				}

				event.preventDefault();
				console.log("Escape pressed. Handling...");

				if (editingFile) {
					console.log("Escape: Exiting edit mode.");
					handleCancelEdit();
					return;
				}

				if (isSearchActive || searchTermInFile.trim()) {
					console.log("Escape: Clearing search.");
					setSearchTermInFile("");
					setHighlightPositions([]);
					setActiveSnippetIndex(-1);
					setIsSearchActive(false);
					setSnippetCount(0);
					return;
				} else if (selectedFile) {
					console.log("Escape: Closing file preview.");
					closeFile();
					return;
				}

				console.log("Escape: No action taken.");
			}
		};

		// Event Listener hinzufügen, wenn Komponente mountet
		document.addEventListener("keydown", handleGlobalKeyDown);

		// Event Listener entfernen, wenn Komponente unmountet
		return () => {
			document.removeEventListener("keydown", handleGlobalKeyDown);
		};
	}, [
		isSearchActive,
		snippetCount,
		navigateSnippet,
		searchInputRef,
		handleCancelEdit,
		editingFile,
		selectedFile,
		closeFile,
		showConfirmSaveModal,
		showDeleteConfirmModal,
		searchTermInFile,
		setSearchTermInFile, // <-- setSearchTermInFile als Dependency hinzugefügt
		setHighlightPositions,
		setActiveSnippetIndex,
		setIsSearchActive,
		setSnippetCount, // Add setters as dependencies if used in useCallback (though often not strictly needed for state setters)
	]); // Dependencies updated

	// Don't render anything if no file is selected
	if (!selectedFile) {
		return (
			<div className="file-preview-container empty-preview">
				<p>Keine Datei ausgewählt.</p>
			</div>
		);
	}

	return (
		<div className="file-preview-container">
			{/* Header */}
			<div className="header">
				<h2 title={selectedFile.name} className="file-preview-title">
					Vorschau: {selectedFile.name}
				</h2>
				<button
					className="close-button"
					onClick={closeFile}
					title="Vorschau schließen (Esc)"
				>
					<X size={20} /> {/* Icon statt Text */}
				</button>
			</div>
			{/* Metadaten */}
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
							? new Date(fileInfo.created_at).toLocaleString("de-DE")
							: "N/A"}
					</p>
				)}
				{contentError && <p className="error-message">{contentError}</p>}
			</div>
			{/* Hauptinhalt - Use the original file-content class for layout */}
			<div className={`file-content ${editingFile ? "editing" : "previewing"}`}>
				{/* File Content View (Left Column) */}
				<FileContentView
					content={content}
					isEditing={editingFile}
					highlightPositions={highlightPositions} // Pass highlight positions down
					activeSnippetIndex={activeSnippetIndex} // Pass active snippet index down
					onContentChange={handleContentChange} // Pass content change handler down
					onContentClick={handleContentClick} // Pass content click handler down
					previewContentRef={previewContentRef} // Pass ref down
					isLoading={loadingContent} // Pass loading state down
				/>
				{/* Sidebar (Right Column) - Re-introduce the file-sidebar div */}
				<div className="file-sidebar">
					{/* In-File Suchleiste & Navigation */}
					{/* Only show search controls if not editing */}
					{!editingFile && (
						<FileSearchPanel
							filePath={selectedFile.path}
							fileContent={content}
							isEditing={editingFile} // Pass editing state
							isLoading={loadingContent} // Pass loading state
							onHighlightPositionsChange={setHighlightPositions} // Pass setter for highlights
							onActiveSnippetIndexChange={setActiveSnippetIndex} // Pass setter for active index
							onSearchActiveChange={setIsSearchActive} // Pass setter for search active state
							onSetIsSearchCollapsed={setIsSearchCollapsed} // Pass setter for collapsing search
							searchInputRef={searchInputRef} // Pass ref
							snippetListRef={snippetListRef} // Pass ref
							activeSnippetRef={activeSnippetRef} // Pass ref
							navigateSnippet={navigateSnippet} // Pass navigate function
							onSnippetCountChange={setSnippetCount} // Pass setter for snippet count
							activeSnippetIndex={activeSnippetIndex} // Pass active index down
							snippetCount={snippetCount} // Pass snippet count down
							isSearchActive={isSearchActive} // Pass is Search Active down for Reactions
							searchTerm={searchTermInFile} // <-- Pass searchTerm
							onSearchTermChange={setSearchTermInFile} // <-- Pass setSearchTerm
						/>
					)}

					{/* Aktionen */}
					<div className={"file-actions"}>
						{!editingFile && isAdmin && (
							<div className="action-button-group">
								<div>
									<button
										onClick={() => openFile(selectedFile.path)}
										title="Datei öffnen"
									>
										Öffnen
									</button>
									{/* Only show "Open in Explorer" for non-folder types */}
									{fileInfo?.type !== "folder" && selectedFile.path && (
										<button
											onClick={() => openFileInExplorer(selectedFile.path)}
											title="Ordner öffnen"
										>
											In Explorer öffnen
										</button>
									)}
								</div>
								<div>
									{/* Disable edit button if content loading or error, or if it's a folder or PDF */}
									{fileInfo?.type !== "folder" &&
										!selectedFile.name.toLowerCase().endsWith(".pdf") &&
										content !== "Kein Vorschauinhalt verfügbar." &&
										content !== "Fehler beim Laden des Inhalts." &&
										!loadingContent &&
										!contentError && (
											<button onClick={handleEdit}>Bearbeiten</button>
										)}
									{/* Show OCR Convert button only for PDFs */}
									{fileInfo?.type !== "folder" &&
										selectedFile.name.toLowerCase().endsWith(".pdf") &&
										!loadingContent &&
										!contentError && (
											<button onClick={convertPDFFile}>OCR Konvertieren</button>
										)}
									{fileInfo?.type !== "folder" && selectedFile.path && (
										<button
											onClick={() => setShowDeleteConfirmModal(true)}
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
									onClick={() => setShowConfirmSaveModal(true)}
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
				</div>{" "}
				{/* END file-sidebar */}
			</div>{" "}
			{/* END file-content */}
			{/* Modals */}
			{(showConfirmSaveModal || showDeleteConfirmModal) && (
				<ConfirmModal
					title={
						showConfirmSaveModal ? "Speichern bestätigen" : "Löschen bestätigen"
					}
					message={
						showConfirmSaveModal
							? "Möchtest du die Änderungen wirklich speichern?"
							: `Möchtest du die Datei "${selectedFile.name}" wirklich löschen?`
					}
					onConfirm={
						showConfirmSaveModal ? handleConfirmSave : handleDeleteFile
					}
					isDanger={showConfirmSaveModal ? false : true}
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

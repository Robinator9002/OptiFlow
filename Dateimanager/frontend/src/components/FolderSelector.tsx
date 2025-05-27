import React, { useState, useEffect, useCallback } from "react";
import { getFileStructure, rescanFileStructure } from "../api/api.tsx";
// Import Lucide icons for folder states
import { Folder, FolderOpen, X, RotateCw, Check } from "lucide-react"; // Added Check icon

// Assuming toast is properly configured elsewhere
// If you have a global toast implementation, remove this placeholder
const toast = {
	success: (message) => console.log(`Toast Success: ${message}`),
	error: (message) => console.error(`Toast Error: ${message}`),
	warn: (message) => console.warn(`Toast Warn: ${message}`),
};

// Component for a single Folder Item
// Added preSelectedPath and onPreSelect props
const FolderItem = React.memo(
	({ node, onSelectPath, onPreSelect, preSelectedPath, level = 0 }) => {
		const [isOpen, setIsOpen] = useState(false);
		// Check if node has children and if children is an array with elements
		const hasChildren =
			node.children && Array.isArray(node.children) && node.children.length > 0;

		// Check if this node is the currently pre-selected one
		const isPreSelected = preSelectedPath === node.path;

		// Toggle handler - toggles open state and pre-selects the folder
		// This is triggered by clicking the main folder-item-content div
		const handleItemClick = useCallback(
			(e) => {
				e.stopPropagation(); // Prevent bubbling up

				// Pre-select this folder
				onPreSelect(node.path);

				// Toggle open state only if it has children
				if (hasChildren) {
					setIsOpen((prev) => !prev); // Toggle the open state
				}
			},
			[onPreSelect, node.path, hasChildren]
		); // Dependencies

		// Calculate indentation based on level
		// Use a CSS variable for consistency and easier theming/adjustment
		const indentSize = 20; // px per level
		const indentStyle = { paddingLeft: `${level * indentSize}px` };

		return (
			<li className={`folder-item ${isPreSelected ? "pre-selected" : ""}`}>
				{" "}
				{/* Add pre-selected class */}
				{/* The entire content div is now clickable for toggling and pre-selection */}
				{/* Add role="button" and tabIndex for accessibility */}
				<div
					className="folder-item-content"
					style={indentStyle}
					onClick={handleItemClick}
					role="button"
					tabIndex={0}
				>
					{/* Toggle icon - only shown if has children */}
					{/* Use Lucide icons */}
					{/* The toggle icon click is now part of the handleItemClick on the parent div */}
					<span className="folder-item-toggle">
						{hasChildren ? (
							isOpen ? (
								<FolderOpen size={18} />
							) : (
								<Folder size={18} />
							)
						) : (
							// Placeholder to maintain vertical alignment for items without children
							// Use a div with explicit size matching the icon
							<div style={{ width: "18px", height: "18px" }}></div>
						)}
					</span>
					<span className="folder-item-name">{node.name}</span>
					{/* Removed the explicit "Auswählen" button from here */}
				</div>
				{/* Render nested tree if open and has children */}
				{/* Ensure node.children is an array before passing */}
				{isOpen && hasChildren && Array.isArray(node.children) && (
					<FolderTree
						nodes={node.children}
						onSelectPath={onSelectPath} // Pass down original select handler (used by final button)
						onPreSelect={onPreSelect} // Pass down pre-select handler
						preSelectedPath={preSelectedPath} // Pass down pre-selected path
						level={level + 1}
					/>
				)}
			</li>
		);
	}
);

// Component for the recursive Folder Tree structure
// Added onPreSelect and preSelectedPath props
const FolderTree = React.memo(
	({ nodes, onSelectPath, onPreSelect, preSelectedPath, level = 0 }) => {
		// Ensure nodes is a valid array before mapping
		if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
			return null; // Don't render empty or invalid lists
		}
		return (
			<ul className={`folder-tree ${level > 0 ? "folder-tree-nested" : ""}`}>
				{nodes.map((node) =>
					// Add a check for node validity before rendering FolderItem
					node && node.path && node.name ? (
						<FolderItem
							key={node.path} // Use path as key (assuming unique paths)
							node={node}
							onSelectPath={onSelectPath} // Pass down original select handler
							onPreSelect={onPreSelect} // Pass down pre-select handler
							preSelectedPath={preSelectedPath} // Pass down pre-selected path
							level={level}
						/>
					) : (
						// Optional: Log a warning for invalid nodes
						(console.warn("Skipping invalid node in FolderTree:", node), null) // Render nothing for invalid nodes
					)
				)}
			</ul>
		);
	}
);

// Main Folder Selector Component (Modal/Overlay)
export const FolderSelector = React.memo(({ setPath, onCancel }) => {
	const [treeData, setTreeData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [preSelectedPath, setPreSelectedPath] = useState(null); // <-- New State for pre-selected path

	// Fetch the directory tree from the backend
	const fetchTree = useCallback(async () => {
		setLoading(true);
		setError(null); // Clear previous error
		setTreeData([]); // Clear current tree data visually while loading
		setPreSelectedPath(null); // <-- Reset pre-selected path on new fetch
		try {
			const data = await getFileStructure(null, null); // Assuming null fetches the root
			const structure = data?.structure; // Use optional chaining

			// Validate the structure received from the API
			if (Array.isArray(structure)) {
				setTreeData(structure);
				if (structure.length === 0) {
					toast.warn("Keine Ordnerstruktur von API erhalten.");
				} else {
					// Optional: Automatically pre-select the first folder if tree is not empty
					// if (structure.length > 0 && structure[0].path) {
					//      setPreSelectedPath(structure[0].path);
					// }
					// Optional: toast.success("Verzeichnisbaum geladen.");
				}
			} else {
				console.error(
					"Ungültige Baumstruktur von API empfangen (nicht Array):",
					structure
				);
				setError("Ungültige Baumstruktur von API empfangen.");
				toast.error("Ungültige Baumstruktur von API.");
				setTreeData([]); // Ensure treeData is an empty array on invalid data
			}
		} catch (err) {
			console.error("Fehler beim Laden des Verzeichnisbaums:", err);
			const errorMsg = err.message || "Ein unbekannter Fehler ist aufgetreten.";
			setError(errorMsg);
			toast.error(`Fehler beim Laden des Verzeichnisbaums: ${errorMsg}`);
			setTreeData([]); // Ensure treeData is an empty array on error
		} finally {
			setLoading(false);
		}
	}, []); // fetchTree has no external dependencies that change during the component's life

	// Effect to fetch the tree on component mount
	useEffect(() => {
		fetchTree();
	}, [fetchTree]); // Dependency array includes fetchTree

	// Effect for global keybindings (Escape to cancel)
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Check if the target is an input or textarea to allow typing Escape there
			const targetTagName = e.target.tagName;
			if (targetTagName === "INPUT" || targetTagName === "TEXTAREA") {
				return; // Do nothing if typing in an input field
			}

			if (e.key === "Escape") {
				e.preventDefault(); // Prevent default browser action
				onCancel(); // Call the onCancel prop
			}
			// Allow Enter key to confirm selection if a path is pre-selected
			if (e.key === "Enter" && preSelectedPath) {
				e.preventDefault();
				handleConfirmSelection(); // Call the confirmation handler
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [onCancel, preSelectedPath]); // Dependencies on onCancel and preSelectedPath for Enter key

	// Handler for pre-selecting a folder path
	// This is passed down to FolderItem and called on item click
	const handlePreSelect = useCallback((path) => {
		setPreSelectedPath(path);
		console.log(`Vorläufig ausgewählt: ${path}`);
	}, []); // No dependencies needed

	// Handler for confirming the selection (called by the "Auswählen" button)
	const handleConfirmSelection = useCallback(() => {
		if (preSelectedPath) {
			// Normalize path: replace backslashes with forward slashes and ensure trailing slash
			// Use a robust way to handle different path separators
			let processedPath = preSelectedPath.replace(/[\\/]/g, "/"); // Replace both backslash and forward slash with forward slash
			if (!processedPath.endsWith("/")) {
				processedPath += "/";
			}

			console.log(`Endgültig ausgewählt: ${processedPath}`);
			setPath(processedPath); // Call the setPath prop with the final path
			toast.success(`Ordner ausgewählt: ${processedPath}`);
			onCancel(); // Close the selector after selection
		} else {
			toast.warn("Bitte wählen Sie zuerst einen Ordner aus.");
		}
	}, [preSelectedPath, setPath, onCancel]); // Dependencies on preSelectedPath, setPath, onCancel - Removed handleSelectPath

	// Handler for refreshing the directory tree
	const handleRefresh = useCallback(async () => {
		// Prevent multiple refreshes or refresh while loading
		if (loading) {
			console.log("Aktualisierung läuft bereits.");
			return;
		}
		setLoading(true); // Starte Ladezustand
		setError(null); // Clear previous error
		setTreeData([]); // Clear current tree data visually
		setPreSelectedPath(null); // <-- Reset pre-selected path on refresh
		try {
			await rescanFileStructure(null); // Assuming null rescans the root
			// Give the backend a moment if needed, though fetchTree should wait for rescan to finish
			// await new Promise(resolve => setTimeout(resolve, 500)); // Optional: small delay
			await fetchTree(); // Fetch the updated tree data
			toast.success("Verzeichnisbaum aktualisiert.");
		} catch (error) {
			console.error("Fehler beim Aktualisieren des Verzeichnisbaums:", error);
			const errorMsg =
				error.message ||
				"Ein unbekannter Fehler ist beim Aktualisieren aufgetreten.";
			toast.error(`Fehler beim Aktualisieren: ${errorMsg}`);
			setError(errorMsg); // Setze den Fehlerzustand
			setTreeData([]); // Ensure treeData is empty on refresh error
		} finally {
			setLoading(false); // Beende Ladezustand
		}
	}, [loading, fetchTree]); // Dependencies on loading state and fetchTree

	// Don't render the overlay if onCancel is not provided (shouldn't happen if used as modal)
	if (!onCancel) {
		console.error("FolderSelector: onCancel prop is required.");
		return null;
	}

	return (
		<div className="folder-selector-overlay">
			<div className="folder-selector-container">
				<div className="folder-selector-header">
					<h2>Zielordner auswählen</h2>
					{/* Use a standard close button class if available, or style explicitly */}
					{/* Assuming 'close-button' is a standard class */}
					<button
						className="close-button"
						onClick={onCancel}
						title="Schließen (Esc)"
					>
						<X size={20} /> {/* Use Lucide X icon */}
					</button>
				</div>
				<div className="folder-selector-content">
					{loading ? (
						// Use a spinner component if you have one, or simple text
						<p className="folder-selector-message">Lade Verzeichnisbaum...</p>
					) : error ? (
						<p className="folder-selector-message folder-selector-error">
							Fehler: {error}
						</p>
					) : treeData.length === 0 ? (
						<p className="folder-selector-message">
							Keine Ordner gefunden oder leer.
						</p>
					) : (
						// Render the FolderTree with the fetched data
						// Pass down onPreSelect and preSelectedPath
						<FolderTree
							nodes={treeData}
							onPreSelect={handlePreSelect} // Pass the new pre-select handler
							preSelectedPath={preSelectedPath} // Pass the pre-selected path state
						/>
					)}
				</div>
				{/* Footer with Refresh and Select buttons */}
				<div className="folder-selector-footer">
					{" "}
					{/* Footer div for styling */}
					{/* Auswählen Button */}
					<button
						className="folder-selector-button confirm-button" // Added confirm-button class for styling
						onClick={handleConfirmSelection}
						disabled={!preSelectedPath || loading} // Disable if no path is pre-selected or loading
						title="Ausgewählten Ordner bestätigen (Enter)"
					>
						<Check size={18} className="mr-2" /> Auswählen
					</button>
					{/* Aktualisieren Button */}
					<button
						className="folder-selector-button"
						onClick={handleRefresh}
						disabled={loading}
						title="Verzeichnisbaum aktualisieren"
					>
						{/* Show spinner icon when loading */}
						{loading ? (
							<>
								<RotateCw size={18} className="animate-spin mr-2" />{" "}
								Aktualisiere...
							</>
						) : (
							<>
								<RotateCw size={18} className="mr-2" /> Aktualisieren
							</>
						)}{" "}
						{/* Add icon */}
					</button>
				</div>
			</div>
		</div>
	);
});

export default FolderSelector; // Export as default

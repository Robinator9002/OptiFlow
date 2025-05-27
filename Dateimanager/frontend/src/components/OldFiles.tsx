import React, {
	useState,
	useEffect,
	useCallback,
	useRef,
	useContext,
} from "react";
import { toast } from "react-toastify";
import { findOldFiles, deleteFile } from "../api/api.tsx"; // Importiere die API-Funktionen
import { ConfirmModal } from "./ConfirmModal.tsx"; // Importiere das ConfirmModal
import { SettingsContext } from "../context/SettingsContext.tsx"; // Importiere die Settings aus dem Context

// Helferfunktion zum Formatieren der Dateigröße
const formatBytes = (bytes, decimals = 2) => {
	if (bytes === null || bytes === undefined || bytes === 0) return "0 Bytes";
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// Helferfunktion zum Berechnen und Anzeigen des Alters
const formatAge = (isoString) => {
	if (!isoString) return "Unbekanntes Alter";
	try {
		const date = new Date(isoString);
		const now = new Date();
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diffInSeconds < 60) return "vor weniger als einer Minute";
		if (diffInSeconds < 3600) {
			const minutes = Math.floor(diffInSeconds / 60);
			return `vor ${minutes} Minute${minutes > 1 ? "n" : ""}`;
		}
		if (diffInSeconds < 86400) {
			const hours = Math.floor(diffInSeconds / 3600);
			return `vor ${hours} Stunde${hours > 1 ? "n" : ""}`;
		}
		if (diffInSeconds < 2592000) {
			// Ca. 30 Tage
			const days = Math.floor(diffInSeconds / 86400);
			return `vor ${days} Tag${days > 1 ? "en" : ""}`;
		}
		if (diffInSeconds < 31536000) {
			// Ca. 365 Tage
			const months = Math.floor(diffInSeconds / 2592000);
			return `vor ${months} Monat${months > 1 ? "en" : ""}`;
		}
		const years = Math.floor(diffInSeconds / 31536000);
		return `vor ${years} Jahr${years > 1 ? "en" : ""}`;
	} catch (e) {
		console.error("Fehler beim Berechnen des Alters:", isoString, e);
		return "Ungültiges Datum";
	}
};

// Schlüssel für Local Storage
const LOCAL_STORAGE_KEY = "oldFilesData";

// Debounce-Verzögerung (in Millisekunden)
const SEARCH_DEBOUNCE_DELAY = 500;

export default function OldFiles({
	setFindingOldFiles,
	// Einstellungen werden als Props übergeben
	oldFilesLimit,
	sortBy,
	sortOrder,
	// === NEU: onFileSelected Prop von App.js ===
	onFileSelected,
}) {
	const { maxAgeDays } = useContext(SettingsContext); // Lade den maxAgeDays Wert aus dem Context
	const [localMaxAgeDays, setLocalMaxAgeDays] = useState(maxAgeDays);
	const [oldFiles, setOldFiles] = useState([]); // Originale Liste der gefundenen Dateien
	const [filteredFiles, setFilteredFiles] = useState([]); // Gefilterte und sortierte Liste für die Anzeige
	const [searchQuery, setSearchQuery] = useState(""); // Zustand für das Suchfeld
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [confirmDeleteFilePath, setConfirmDeleteFilePath] = useState(null);
	const [deletingFile, setDeletingFile] = useState(false);

	// Ref, um zu verfolgen, ob der initiale Ladeeffekt bereits ausgeführt wurde
	const hasLoadedFromLocalStorage = useRef(false);

	// Ref für das Suchfeld (falls wir Fokus setzen wollen)
	const searchInputRef = useRef(null);

	// === EFFECT 1: Laden aus Local Storage beim Mounten (läuft nur einmal dank Ref) ===
	useEffect(() => {
		if (hasLoadedFromLocalStorage.current) {
			return;
		}

		const savedFiles = localStorage.getItem(LOCAL_STORAGE_KEY);

		if (savedFiles) {
			try {
				const parsedFiles = JSON.parse(savedFiles);
				setOldFiles(parsedFiles); // Setze die originale Liste
				// filteredFiles wird durch Effect 3 gesetzt
			} catch (e) {
				console.error("Fehler beim Parsen von Local Storage Daten:", e);
				localStorage.removeItem(LOCAL_STORAGE_KEY);
				setOldFiles([]);
				setFilteredFiles([]); // Auch die gefilterte Liste leeren
			}
		} else {
			setOldFiles([]);
			setFilteredFiles([]); // Auch die gefilterte Liste leeren
		}

		hasLoadedFromLocalStorage.current = true;
	}, []);

	// === EFFECT 2: Speichern in Local Storage, wenn sich oldFiles State ändert ===
	useEffect(() => {
		if (oldFiles !== null && oldFiles !== undefined) {
			try {
				const dataToSave = JSON.stringify(oldFiles);
				localStorage.setItem(LOCAL_STORAGE_KEY, dataToSave);
			} catch (e) {
				console.error("Fehler beim Speichern in Local Storage:", e);
			}
		}
	}, [oldFiles]);

	// === EFFECT 3: Filtern und Bewerten der Liste mit Debounce ===
	useEffect(() => {
		let handler;

		if (!searchQuery) {
			setFilteredFiles(oldFiles);
		} else {
			handler = setTimeout(() => {
				const queryTerms = searchQuery
					.toLowerCase()
					.split(",")
					.map((term) => term.trim())
					.filter((term) => term.length > 0);

				const scoredFiles = oldFiles
					.map((file) => {
						let score = 0;
						const fileContent = file.content ? file.content.toLowerCase() : "";
						const fileName = file.name ? file.name.toLowerCase() : "";
						const filePath = file.path ? file.path.toLowerCase() : "";

						queryTerms.forEach((term) => {
							if (fileName.includes(term)) score++;
							if (filePath.includes(term)) score++;
							if (fileContent.includes(term)) score++;
						});

						return { ...file, score };
					})
					.filter((file) => file.score > 0);

				scoredFiles.sort((a, b) => b.score - a.score);

				setFilteredFiles(scoredFiles);
			}, SEARCH_DEBOUNCE_DELAY);
		}

		return () => {
			if (handler) {
				clearTimeout(handler);
			}
		};
	}, [oldFiles, searchQuery]);

	useEffect(() => {
		if (searchInputRef.current) {
			const timer = setTimeout(() => {
				searchInputRef.current.focus();
			}, 50); // 50ms sollten reichen

			return () => clearTimeout(timer);
		}
	}, [searchInputRef]);

	// Handler für Änderungen am Input-Feld für localMaxAgeDays
	const handleLocalMaxAgeDaysChange = (event) => {
		const value = parseInt(event.target.value, 10);
		// Stelle sicher, dass der Wert eine nicht-negative Zahl ist
		if (!isNaN(value) && value >= 0) {
			setLocalMaxAgeDays(value);
		} else if (event.target.value === "") {
			// Erlaube leeres Feld, interpretiere es als 0 oder null
			setLocalMaxAgeDays(0); // Oder null
		}
	};

	// === fetchOldFiles function (holt Daten, updated State, KEINE internen Toasts) ===
	const fetchOldFiles = useCallback(async () => {
		setLoading(true);
		setFindingOldFiles(true);
		setError(null);

		try {
			const params = {
				max_files: oldFilesLimit >= 0 ? oldFilesLimit : undefined,
				max_age_days: localMaxAgeDays >= 0 ? localMaxAgeDays : undefined,
				sort_by: sortBy !== "age" ? sortBy : undefined,
				sort_order: sortOrder !== "normal" ? sortOrder : undefined,
			};
			const cleanParams = Object.fromEntries(
				Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
			);

			console.log(localMaxAgeDays, cleanParams);

			const files = await findOldFiles(cleanParams);

			setOldFiles(files);
			// filteredFiles wird durch Effect 3 gesetzt

			return files.length;
		} catch (err) {
			console.error("Fehler beim Abrufen alter Dateien:", err);
			setError(`Fehler beim Laden der vergessenen Dateien: ${err.message}`);
			toast.error(`❌ Fehler beim Laden der vergessenen Dateien.`);
			throw err;
		} finally {
			setLoading(false);
			setFindingOldFiles(false);
		}
	}, [oldFilesLimit, sortBy, sortOrder, setFindingOldFiles, localMaxAgeDays]);

	// Handler zum manuellen Auslösen der Suche (mit Toasts)
	const handleManualSearch = async () => {
		try {
			const fileCount = await fetchOldFiles();
			if (fileCount === 0) {
				toast.info(
					"🤷‍♂️ Keine vergessenen Dateien gefunden, die den Kriterien entsprechen."
				);
			} else {
				toast.success(`🎉 ${fileCount} vergessene Datei(en) gefunden!`);
			}
		} catch (err) {
			// Fehler-Toast wird bereits in fetchOldFiles angezeigt
		}
	};

	// Handler für Änderungen im Suchfeld
	const handleSearchInputChange = (event) => {
		setSearchQuery(event.target.value);
	};

	// Handler zum Öffnen des Bestätigungsmodals vor dem Löschen
	const handleDeleteClick = (filePath) => {
		setConfirmDeleteFilePath(filePath);
	};

	// Handler zum Bestätigen des Löschens
	const handleConfirmDelete = async () => {
		if (!confirmDeleteFilePath) return;

		setDeletingFile(true);
		setError(null);
		try {
			await deleteFile(confirmDeleteFilePath);
			toast.success(`🗑️ Datei erfolgreich gelöscht: ${confirmDeleteFilePath}`);
			setOldFiles((prevFiles) =>
				prevFiles.filter((file) => file.path !== confirmDeleteFilePath)
			);
		} catch (err) {
			console.error("Fehler beim Löschen der Datei:", err);
			setError(`Fehler beim Löschen der Datei: ${err.message}`);
			toast.error(`❌ Fehler beim Löschen der Datei.`);
		} finally {
			setDeletingFile(false);
			setConfirmDeleteFilePath(null);
		}
	};

	// Handler zum Abbrechen des Löschens
	const handleCancelDelete = () => {
		setConfirmDeleteFilePath(null);
		toast.info("Löschvorgang abgebrochen.");
	};

	// Bestimme die Nachricht, wenn keine Dateien angezeigt werden
	const noFilesMessage = () => {
		if (loading) return null;
		if (error) return null;

		if (oldFiles.length === 0) {
			return (
				<p
					style={{
						textAlign: "center",
						marginTop: "20px",
						color: "var(--text-muted)",
					}}
				>
					Bitte klicken Sie auf "Vergessene Dateien suchen", um die Liste zu
					laden.
				</p>
			);
		}

		if (filteredFiles.length === 0 && searchQuery) {
			return (
				<p
					style={{
						textAlign: "center",
						marginTop: "20px",
						color: "var(--text-muted)",
					}}
				>
					Keine Dateien entsprechen dem Suchbegriff "{searchQuery}".
				</p>
			);
		}
		return null;
	};

	return (
		<div className="settings-section old-files-container dedupe-container">
			{/* CSS für die Scrollbar wird extern bereitgestellt */}

			<h2>Vergessene Dateien</h2>

			{/* Button zum manuellen Auslösen der Suche */}
			<div style={{ marginBottom: "20px" }}>
				<label
					className="search-relevance-input"
					style={{ marginBottom: "1.25rem" }}
				>
					<button
						onClick={handleManualSearch}
						disabled={loading || deletingFile}
					>
						{loading ? "Suche läuft..." : "Vergessene Dateien suchen"}
					</button>
					<label htmlFor="maxAgeDays" style={{ width: "50vw" }}>
						<p style={{ fontSize: "1.25rem" }}>Mindestalter in Tagen:</p>
						<input
							type="number"
							id="maxAgeDays"
							name="maxAgeDays"
							value={localMaxAgeDays >= 0 ? localMaxAgeDays : ""}
							onChange={(e) => handleLocalMaxAgeDaysChange(e)}
							min="0" // Mindestens 0
							placeholder="0 für kein Alterslimit"
						/>
					</label>
				</label>
			</div>

			{/* Fehleranzeige */}
			{error && !loading && (
				<p className="folder-selector-error" style={{ textAlign: "left" }}>
					{error}
				</p>
			)}

			{/* Ergebnisse anzeigen */}
			{!loading && !error && (
				<div className="old-files-list" style={{ marginTop: "1rem" }}>
					<label htmlFor="fileSearch" className="search-relevance-input">
						<h3>Gefundene Dateien:</h3>
						<input
                            ref={searchInputRef}
							type="text"
							id="fileSearch"
							name="fileSearch"
							value={searchQuery}
							onChange={handleSearchInputChange}
							placeholder="Dateiname, Pfad oder Inhalt durchsuchen..."
						/>
					</label>
					<div
						className="old-files-list-container"
						style={{ marginTop: "-1rem" }}
					>
						<ul style={{ listStyle: "none", padding: 0 }}>
							{filteredFiles.map((file) => (
								// === GEÄNDERT: Rufe onFileSelected Prop auf ===
								<li
									key={file.path}
									onClick={() => onFileSelected(file.path)} // Rufe onFileSelected Prop auf
									style={{
										border: "1px solid var(--border-tertiary)",
										borderRadius: "4px",
										padding: "10px",
										marginBottom: "10px",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										backgroundColor: "var(--bg-secondary)",
										cursor: "pointer",
										transition: "background-color 0.2s ease",
									}}
									onMouseEnter={(e) =>
										(e.currentTarget.style.backgroundColor = "var(--bg-hover)")
									}
									onMouseLeave={(e) =>
										(e.currentTarget.style.backgroundColor =
											"var(--bg-secondary)")
									}
								>
									<div style={{ flexGrow: 1, marginRight: "10px" }}>
										<div
											style={{
												fontWeight: "bold",
												color: "var(--text-primary)",
											}}
										>
											{file.name}
										</div>
										<div
											style={{
												fontSize: "0.85rem",
												color: "var(--text-secondary)",
											}}
										>
											{file.path}
										</div>
										<div
											style={{
												fontSize: "0.85rem",
												color: "var(--text-muted)",
											}}
										>
											Größe: {formatBytes(file.size_bytes)} | Alter:{" "}
											{formatAge(file.modified_at)}
										</div>
									</div>
									{/* Stoppe Klick-Propagation vom Button */}
									<button
										onClick={(e) => {
											e.stopPropagation();
											handleDeleteClick(file.path);
										}}
										disabled={deletingFile}
										className="disfirm"
									>
										{deletingFile && confirmDeleteFilePath === file.path
											? "Lösche..."
											: "Löschen"}
									</button>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			{/* Nachricht anzeigen, wenn keine Dateien angezeigt werden */}
			{noFilesMessage()}

			{/* Bestätigungsmodal für das Löschen */}
			{confirmDeleteFilePath && (
				<ConfirmModal
					title="Datei löschen?"
					message={`Bist du sicher, dass du die Datei "${confirmDeleteFilePath}" unwiderruflich löschen möchtest?`}
					onConfirm={handleConfirmDelete}
					onCancel={handleCancelDelete}
					isDanger={true}
				/>
			)}
		</div>
	);
}

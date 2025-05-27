import React, { useEffect, useState, useRef, useContext } from "react";
import { toast } from "react-toastify";
import { SettingsContext } from "../context/SettingsContext.tsx";
import {
	findDuplicates,
	searchDuplicates,
	loadDuplicates,
	saveDuplicates, // Brauchen wir vielleicht auch zum manuellen Speichern
	deleteFile, // Brauchen wir zum Löschen von Dateien
} from "../api/api.tsx"; // Api Imports
import {
	Search as SearchIcon, // Icon für Suche
	Loader2, // Icon für Ladezustand
	X, // Icon zum Schließen/Löschen
	FolderOpen, // Icon für Ordner/Gruppe
	FileText, // Icon für Datei
	ChevronDown, // Icon für aufgeklappte Gruppe
	ChevronUp, // Icon für zugeklappte Gruppe
} from "lucide-react"; // Icons importieren
import { ConfirmModal } from "./ConfirmModal.tsx"; // Importiere das ConfirmModal

// Helper function to format file size (assuming it's available elsewhere, but good to have locally)
const formatBytes = (bytes, decimals = 2) => {
	if (bytes === null || bytes === undefined || bytes === 0) return "0 Bytes";
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

// Helper function to format age (assuming it's available elsewhere)
// const formatAge = (isoString) => { // Original
const formatAge = (isoString: string | null | undefined): string => {
	// Vorgeschlagene Änderung
	if (!isoString) return "Unbekanntes Alter";
	try {
		const date = new Date(isoString);
		// NEU: Prüfen, ob das Datum gültig ist
		if (isNaN(date.getTime())) {
			console.error("Ungültiges Datumsobjekt erstellt aus:", isoString);
			return "Ungültiges Datum";
		}
		const now = new Date();
		// Sicherer: .getTime() verwenden
		const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

		// Zusätzliche Prüfung für NaN, falls doch etwas schiefgeht
		if (isNaN(diffInSeconds)) {
			console.error("Fehler bei der Differenzberechnung für Alter:", isoString);
			return "Datumsberechnungsfehler";
		}

		if (diffInSeconds < 60) return "vor weniger als einer Minute"; // Zeile 38 (ca.)
		// ... Rest der Funktion
	} catch (e) {
		console.error("Fehler beim Berechnen des Alters:", isoString, e);
		return "Ungültiges Datum";
	}
	// Fallback, sollte durch die Logik eigentlich nicht erreicht werden
	return "Unbekanntes Alter";
};

// Props, die von App.js übergeben werden könnten:
// - onFileSelected: Funktion, um eine Datei im Preview zu öffnen
// - isLoading: Boolean, ob die App gerade etwas globales lädt (z.B. Index Scan)
// - setIsLoading: Setter für den globalen Ladezustand
// - settings: Das Settings-Objekt aus dem Context oder von App.js (enthält min_category_length)
// - onSettingsChange: Callback, wenn Einstellungen in dieser Komponente geändert werden (falls hier Settings-Inputs sind)

const DeDuping = ({ onFileSelected }) => {
	// === Context ===
	const { minCategoryLength } = useContext(SettingsContext);
	// === State für Duplikatergebnisse ===
	// duplicateGroups wird ein Objekt sein, dessen Keys die Gruppen-IDs sind
	// und die Values die Gruppen-Infos (avg_similarity, files, etc.)
	const [duplicateGroups, setDuplicateGroups] = useState({});
	const [loadingDupes, setLoadingDupes] = useState(false); // Ladezustand für Duplikatsuche/Laden
	const [dupesError, setDupesError] = useState(null); // Fehlerzustand
	const [isDupeSearchRunning, setIsDupeSearchRunning] = useState(false); // Zustand, ob die Suche gerade läuft (findDuplicates)

	// === State für Filter & Sortierung ===
	const [dedupeSearchQuery, setDedupeSearchQuery] = useState(""); // Suchbegriff für Duplikatgruppen
	const [selectedLengthRange, setSelectedLengthRange] = useState(""); // Ausgewählter Längenbereich Filter
	const [sortBy, setSortBy] = useState("similarity"); // Sortierkriterium ('similarity', 'length', 'file_count')
	const [sortOrder, setSortOrder] = useState("desc"); // Sortierreihenfolge ('asc', 'desc')

	// === State für UI Interaktionen ===
	const [expandedGroupId, setExpandedGroupId] = useState(null); // ID der aktuell aufgeklappten Gruppe
	const [confirmDeleteFilePath, setConfirmDeleteFilePath] = useState(null); // Pfad der zu löschenden Datei
	const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState(null); // ID der zu löschenden Gruppe
	const [deletingItem, setDeletingItem] = useState(false); // Zustand, ob gerade gelöscht wird

	// Ref für das Suchfeld (falls wir Fokus setzen wollen)
	const searchInputRef = useRef(null);

	// === Ref, um zu verfolgen, ob die initialen Duplikate bereits geladen wurden ===
	const hasLoadedInitialDupes = useRef(false);

	// === Ref, um die volle, ungefilterte Liste der Duplikate zu speichern ===
	const initialDuplicateGroups = useRef({});

	// === State für verfügbare Längenbereiche (für das Dropdown) ===
	const [availableLengthRanges, setAvailableLengthRanges] = useState([]);

	useEffect(() => {
		if (searchInputRef.current) {			
			const timer = setTimeout(() => {
				searchInputRef.current.focus();
			}, 50); // 50ms sollten reichen
	
			return () => clearTimeout(timer);
		}
	}, [searchInputRef]);

	// === Effekt zum Laden der Duplikate beim Mounten (Läuft nur einmal dank Ref) ===
	useEffect(() => {
		const loadInitialDuplicates = async () => {
			// Prüfe Ref, um sicherzustellen, dass dies nur einmal ausgeführt wird
			if (hasLoadedInitialDupes.current) {
				return;
			}
			hasLoadedInitialDupes.current = true; // Setze Ref sofort

			setLoadingDupes(true);
			setDupesError(null);
			try {
				// Versuche zuerst, aus der lokalen Datei zu laden
				const loadedResult = await loadDuplicates();
				// loadDuplicates gibt {"message": ..., "result": {...}} zurück (BASIEREND AUF DEINER LETZTEN RÜCKMELDUNG)
				// Korrigiere hier, um .result statt .data zu verwenden
				if (
					loadedResult &&
					loadedResult.result &&
					Object.keys(loadedResult.result).length > 0
				) {
					// <-- HIER GEÄNDERT: .result statt .data
					setDuplicateGroups(loadedResult.result); // <-- HIER GEÄNDERT: .result statt .data
					initialDuplicateGroups.current = loadedResult.result; // SPEICHERE INITIALE DATEN IM REF
					extractAndSetLengthRanges(loadedResult.result); // Extrahiere Längenbereiche
				} else if (loadedResult && loadedResult.message) {
					// Nachricht anzeigen, auch wenn keine Daten da sind (z.z. "Datei nicht gefunden")
					toast.info(`ℹ️ ${loadedResult.message}`);
					setDuplicateGroups({}); // Stelle sicher, dass der State leer ist
					initialDuplicateGroups.current = {}; // Setze Ref auf leer
					setAvailableLengthRanges([]); // Leere Längenbereiche
				} else {
					toast.info("ℹ️ Keine Duplikatgruppen geladen.");
					setDuplicateGroups({}); // Stelle sicher, dass der State leer ist
					initialDuplicateGroups.current = {}; // Setze Ref auf leer
					setAvailableLengthRanges([]); // Leere Längenbereiche
				}
			} catch (err) {
				console.error("Fehler beim Laden der Duplikatgruppen:", err);
				setDupesError(`Fehler beim Laden der Duplikatgruppen: ${err.message}`);
				toast.error(`❌ Fehler beim Laden der Duplikatgruppen.`);
				setDuplicateGroups({}); // Bei Fehler leeren
				initialDuplicateGroups.current = {}; // Setze Ref auf leer
				setAvailableLengthRanges([]); // Leere Längenbereiche
			} finally {
				setLoadingDupes(false);
			}
		};

		loadInitialDuplicates();

		// Globaler Escape-Handler, um z.B. eine aufgeklappte Gruppe zu schließen oder das Suchfeld zu leeren
		const handleGlobalKeyDown = (event) => {
			if (event.key === "Escape") {
				// Wenn ein Modal offen ist, nicht reagieren
				if (confirmDeleteFilePath || confirmDeleteGroupId) {
					return;
				}
				// Wenn eine Gruppe aufgeklappt ist, zuklappen
				if (expandedGroupId) {
					setExpandedGroupId(null);
					event.preventDefault(); // Standardverhalten verhindern
				} else if (
					searchInputRef.current &&
					searchInputRef.current === document.activeElement
				) {
					// Wenn das Suchfeld fokussiert ist und Escape gedrückt wird, leere das Suchfeld
					// und setze die Anzeige auf die initiale Liste zurück
					handleClearSearch(); // Ruft handleClearSearch auf, die den State setzt
					event.preventDefault(); // Standardverhalten verhindern (z.B. Seite neu laden)
				}
			}
		};

		document.addEventListener("keydown", handleGlobalKeyDown);
		return () => {
			document.removeEventListener("keydown", handleGlobalKeyDown);
		};
	}, []); // Leeres Array bedeutet, dieser Effekt läuft nur einmal beim Mounten

	// === Helper Funktion zum Extrahieren und Setzen der verfügbaren Längenbereiche ===
	const extractAndSetLengthRanges = (groups) => {
		const ranges = new Set<string>();
		for (const groupId in groups) {
			if (groups.hasOwnProperty(groupId) && groups[groupId].length_range) {
				ranges.add(groups[groupId].length_range);
			}
		}
		// Konvertiere Set zu Array und sortiere (optional, aber hilfreich)
		const sortedRanges = Array.from(ranges).sort((a, b) => {
			// Versuche, die Startwerte der Bereiche für die Sortierung zu extrahieren
			try {
				const aStart = parseInt(a.split("-")[0], 10);
				const bStart = parseInt(b.split("-")[0], 10);
				return aStart - bStart;
			} catch (e) {
				// Bei Fehlern (ungültiges Format) alphabetisch sortieren
				return a.localeCompare(b);
			}
		});
		setAvailableLengthRanges(sortedRanges);
	};

	// === Funktion zum Ausführen der Suche/Filterung ===
	// Diese Funktion akzeptiert die Filterparameter als Argumente
	const performSearch = async (
		query,
		sort_by,
		sort_order,
		length_range_filter
	) => {
		// Führe Suche nur aus, wenn das System nicht beschäftigt ist
		if (isDupeSearchRunning || loadingDupes || deletingItem) {
			console.log("Suche/Filterung übersprungen: System ist beschäftigt.");
			return;
		}

		// Prüfe, ob das Suchfeld leer ist UND Filter/Sortierung auf Standardwerten stehen
		const isDefaultSearch =
			query === "" &&
			length_range_filter === "" &&
			sort_by === "similarity" &&
			sort_order === "desc";

		if (
			isDefaultSearch &&
			Object.keys(initialDuplicateGroups.current).length > 0
		) {
			// Wenn es sich um eine "leere" Suche handelt UND initiale Daten vorhanden sind,
			// zeige die initiale, ungefilterte Liste
			console.log("Suche/Filterung: Zeige initiale, ungefilterte Liste.");
			setDuplicateGroups(initialDuplicateGroups.current);
			setDupesError(null); // Stelle sicher, dass kein Fehler angezeigt wird
			// Kein Ladezustand setzen, da dies sofort passiert
			return; // Beende die Funktion hier
		}

		// Wenn es sich NICHT um eine Standard-Suche handelt oder keine initialen Daten da sind,
		// führe die Backend-Suche/Filterung aus
		console.log("Suche/Filterung: Führe Backend-Suche/Filterung aus.");
		setLoadingDupes(true); // Setze Ladezustand für die Suche/Filterung
		setDupesError(null);

		try {
			const searchParams = {
				query: query, // Nutze das übergebene Query
				sort_by: sort_by, // Nutze den übergebenen SortBy
				sort_order: sort_order, // Nutze den übergebenen SortOrder
				length_range_filter: length_range_filter, // Nutze den übergebenen Längenfilter
			};
			// searchDuplicates filtert und sortiert die BEREITS GELADENEN Duplikate im Backend
			// und gibt das gefilterte/sortierte Ergebnis zurück.
			const result = await searchDuplicates(searchParams);
			// searchDuplicates gibt ein Dict { group_id: { ...group_info... }, ... } zurück (Root Model)
			setDuplicateGroups(result); // <-- Hier wird das gesamte Ergebnis gesetzt (Root Model)
			// Info-Toast nur anzeigen, wenn es auch Ergebnisse gibt oder die Suche explizit war (z.B. Button/Enter)
			// toast.info(`Suche/Filterung abgeschlossen. ${Object.keys(result).length} Gruppen gefunden.`);
		} catch (err) {
			console.error("Fehler bei der Suche/Filterung der Duplikatgruppen:", err);
			setDupesError(`Fehler bei der Suche/Filterung: ${err.message}`);
			toast.error(`❌ Fehler bei der Suche/Filterung der Duplikatgruppen.`);
			// Bei Fehler bei der Suche/Filterung leeren wir nicht unbedingt die Gruppen,
			// sondern zeigen den Fehler an. Die vorher geladenen Gruppen bleiben sichtbar.
			// setDuplicateGroups({}); // <-- Entfernt, um nicht bei jedem Tippfehler alles zu leeren
		} finally {
			setLoadingDupes(false); // Ladezustand zurücksetzen
		}
	};

	// === Handler für Aktionen ===

	const handleFindDuplicates = async () => {
		// Verhindere mehrfaches Auslösen
		if (isDupeSearchRunning || loadingDupes || deletingItem) {
			console.log("Duplikatsuche läuft bereits oder System ist beschäftigt.");
			return;
		}

		setIsDupeSearchRunning(true); // Zustand setzen, dass die Suche läuft
		setLoadingDupes(true); // Ladezustand setzen
		setDupesError(null);
		setDuplicateGroups({}); // Vorherige Ergebnisse leeren
		initialDuplicateGroups.current = {}; // Leere auch den Ref
		setExpandedGroupId(null); // Aufgeklappte Gruppe zurücksetzen
		// Setze Suchfeld und Filter auf Standard zurück, wenn eine neue Suche gestartet wird
		setDedupeSearchQuery("");
		setSortBy("similarity");
		setSortOrder("desc");
		setSelectedLengthRange(""); // Setze Längenfilter zurück
		setAvailableLengthRanges([]); // Leere Längenbereiche
		// TODO: Optional: Globalen Ladezustand in App.js setzen, falls vorhanden (setIsLoading(true))

		try {
			const result = await findDuplicates(); // API-Aufruf
			// findDuplicates speichert die Ergebnisse im Backend und gibt {"message": ..., "result": {...}} zurück
			// Nach erfolgreichem Finden, setze die Ergebnisse direkt aus dem "result" Feld in den State
			if (result && result.result) {
				// <-- Hier wird .result verwendet
				setDuplicateGroups(result.result);
				initialDuplicateGroups.current = result.result; // SPEICHERE DIE GEFUNDENEN DATEN IM REF
				extractAndSetLengthRanges(result.result); // Extrahiere Längenbereiche
				toast.info(
					`📁 ${Object.keys(result.result).length} Duplikatgruppen gefunden.`
				);
			} else {
				toast.info(
					"ℹ️ Duplikatsuche abgeschlossen, aber keine Gruppen gefunden."
				);
				setDuplicateGroups({}); // Stelle sicher, dass der State leer ist
				initialDuplicateGroups.current = {}; // Setze Ref auf leer
				setAvailableLengthRanges([]); // Leere Längenbereiche
			}
		} catch (err) {
			console.error("Fehler beim Finden von Duplikaten:", err);
			setDupesError(`Fehler bei der Duplikatsuche: ${err.message}`);
			toast.error(`❌ Fehler bei der Duplikatsuche.`);
			setDuplicateGroups({}); // Bei Fehler leeren
			initialDuplicateGroups.current = {}; // Setze Ref auf leer
			setAvailableLengthRanges([]); // Leere Längenbereiche
		} finally {
			setIsDupeSearchRunning(false); // Zustand zurücksetzen
			setLoadingDupes(false); // Ladezustand zurücksetzen
			// TODO: Optional: Globalen Ladezustand in App.js zurücksetzen (setIsLoading(false))
		}
	};

	const handleLoadDuplicates = async () => {
		// Verhindere mehrfaches Auslösen oder Laden während Suche/Löschen
		if (loadingDupes || isDupeSearchRunning || deletingItem) {
			console.log("Laden läuft bereits oder System ist beschäftigt.");
			return;
		}
		setLoadingDupes(true);
		setDupesError(null);
		setDuplicateGroups({}); // Vorherige Ergebnisse leeren
		initialDuplicateGroups.current = {}; // Leere auch den Ref
		setExpandedGroupId(null); // Aufgeklappte Gruppe zurücksetzen
		// Setze Suchfeld und Filter auf Standard zurück, wenn neu geladen wird
		setDedupeSearchQuery("");
		setSortBy("similarity");
		setSortOrder("desc");
		setSelectedLengthRange(""); // Setze Längenfilter zurück
		setAvailableLengthRanges([]); // Leere Längenbereiche

		try {
			const result = await loadDuplicates(); // API-Aufruf
			// loadDuplicates gibt {"message": ..., "result": {...}} zurück (BASIEREND AUF DEINER LETZTEN RÜCKMELDUNG)
			// Korrigiere hier, um .result statt .data zu verwenden
			if (result && result.result && Object.keys(result.result).length > 0) {
				// <-- HIER GEÄNDERT: .result statt .data
				setDuplicateGroups(result.result); // <-- HIER GEÄNDERT: .result statt .data
				initialDuplicateGroups.current = result.result; // SPEICHERE DIE GELADENEN DATEN IM REF
				extractAndSetLengthRanges(result.result); // Extrahiere Längenbereiche
				toast.success(
					`📁 ${Object.keys(result.result).length} Duplikatgruppen geladen.`
				); // <-- HIER GEÄNDERT: .result statt .data
			} else if (result && result.message) {
				// Nachricht anzeigen, auch wenn keine Daten da sind (z.z. "Datei nicht gefunden")
				toast.info(`ℹ️ ${result.message}`);
				setDuplicateGroups({}); // Stelle sicher, dass der State leer ist
				initialDuplicateGroups.current = {}; // Setze Ref auf leer
				setAvailableLengthRanges([]); // Leere Längenbereiche
			} else {
				toast.info("ℹ️ Keine Duplikatgruppen geladen.");
				setDuplicateGroups({}); // Stelle sicher, dass der State leer ist
				initialDuplicateGroups.current = {}; // Setze Ref auf leer
				setAvailableLengthRanges([]); // Leere Längenbereiche
			}
		} catch (err) {
			console.error("Fehler beim Laden der Duplikatgruppen:", err);
			setDupesError(`Fehler beim Laden der Duplikatgruppen: ${err.message}`);
			toast.error(`❌ Fehler beim Laden der Duplikatgruppen.`);
			setDuplicateGroups({}); // Bei Fehler leeren
			initialDuplicateGroups.current = {}; // Setze Ref auf leer
			setAvailableLengthRanges([]); // Leere Längenbereiche
		} finally {
			setLoadingDupes(false);
		}
	};

	const handleSaveDuplicates = async () => {
		// Optional: Manuelles Speichern ermöglichen
		// Verhindere Speichern während Suche/Laden/Löschen
		if (loadingDupes || isDupeSearchRunning || deletingItem) {
			console.log("Speichern nicht möglich während anderer Operationen.");
			return;
		}
		setLoadingDupes(true); // Ladezustand setzen
		setDupesError(null);
		try {
			const result = await saveDuplicates(); // API-Aufruf
			toast.success(`💾 ${result.message}`);
		} catch (err) {
			console.error("Fehler beim Speichern der Duplikatgruppen:", err);
			setDupesError(`Fehler beim Speichern: ${err.message}`);
			toast.error(`❌ Fehler beim Speichern der Duplikatgruppen.`);
		} finally {
			setLoadingDupes(false); // Ladezustand zurücksetzen
		}
	};

	// Handler für Änderungen im Suchfeld (aktualisiert nur den State)
	const handleSearchInputChange = (event) => {
		setDedupeSearchQuery(event.target.value);
		// Die Suche wird NICHT hier ausgelöst, sondern nur bei Enter oder Button-Klick
	};

	// Handler für Tastendrücke im Suchfeld (für Enter-Taste)
	const handleSearchKeyPress = (event) => {
		// Prüfe, ob die Enter-Taste gedrückt wurde und kein Shift/Ctrl/Alt/Meta aktiv ist
		if (
			event.key === "Enter" &&
			!event.shiftKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.metaKey
		) {
			event.preventDefault(); // Verhindere Standardverhalten (z.z. Formular-Submit)
			handleSearchSubmit(); // Löse die Suche aus
		}
	};

	// Handler zum Auslösen der Suche (Button-Klick oder Enter-Taste)
	const handleSearchSubmit = () => {
		// Stelle sicher, dass die Suche nur ausgelöst wird, wenn das System nicht beschäftigt ist
		if (isDupeSearchRunning || loadingDupes || deletingItem) {
			console.log("Suche nicht möglich während anderer Operationen.");
			return;
		}
		// Rufe die Funktion auf, die den API-Aufruf macht, mit den aktuellen Filterwerten
		performSearch(dedupeSearchQuery, sortBy, sortOrder, selectedLengthRange);
	};

	// Handler zum Leeren des Suchfeldes und Auslösen einer neuen Suche (zeigt alle Gruppen)
	const handleClearSearch = () => {
		// Setze Suchfeld auf leer
		setDedupeSearchQuery("");
		// Setze Filter/Sortierung auf Standard zurück (falls sie nicht schon so sind)
		setSortBy("similarity");
		setSortOrder("desc");
		setSelectedLengthRange(""); // Setze Längenfilter zurück

		// Setze den State der angezeigten Gruppen auf die initiale, ungefilterte Liste zurück
		setDuplicateGroups(initialDuplicateGroups.current);
		setDupesError(null); // Stelle sicher, dass kein Fehler angezeigt wird

		// Optional: Fokus zurück auf das Suchfeld setzen
		searchInputRef.current?.focus();
		toast.info("Suchfeld geleert und Filter zurückgesetzt.");
	};

	// Handler für Änderungen in Filter/Sortierung (Dropdowns)
	// Diese Handler rufen jetzt auch performSearch auf, da sie die Suchkriterien ändern
	const handleSortByChange = (event) => {
		const newSortBy = event.target.value;
		setSortBy(newSortBy);
		// Löse die Suche mit den neuen Kriterien aus
		// performSearch() wird jetzt am Ende von handleSortOrderChange aufgerufen,
		// da oft SortBy und SortOrder zusammen geändert werden.
		// Wenn du möchtest, dass die Suche bei JEDER Änderung feuert,
		// verschiebe performSearch() hierher und entferne es aus handleSortOrderChange.
		// Für jetzt lassen wir es so, dass es nur bei Änderung der Reihenfolge feuert.
		// performSearch(dedupeSearchQuery, newSortBy, sortOrder, selectedLengthRange); // <-- Hier aufrufen, wenn sofortige Suche gewünscht
	};

	const handleSortOrderChange = (event) => {
		const newSortOrder = event.target.value;
		setSortOrder(newSortOrder);
		// Löse die Suche mit den neuen Kriterien aus
		performSearch(dedupeSearchQuery, sortBy, newSortOrder, selectedLengthRange); // Ruft performSearch mit den NEUEN Sortierkriterien auf
	};

	// Handler für Änderungen im Längenbereichs-Dropdown
	const handleLengthRangeChange = (event) => {
		const newLengthRange = event.target.value;
		setSelectedLengthRange(newLengthRange);
		// Löse die Suche mit dem neuen Längenfilter aus
		performSearch(dedupeSearchQuery, sortBy, sortOrder, newLengthRange); // Ruft performSearch mit dem NEUEN Längenfilter auf
	};

	// Handler zum Aufklappen/Zuklappen einer Gruppe
	const handleToggleGroup = (groupId) => {
		setExpandedGroupId((prevId) => (prevId === groupId ? null : groupId));
	};

	// Handler zum Öffnen einer Datei im Preview
	const handleFileClick = (filePath) => {
		if (onFileSelected) {
			onFileSelected(filePath);
		} else {
			console.warn("onFileSelected prop not provided to DeDuping component.");
			toast.info("Funktion zum Öffnen der Datei nicht verfügbar.");
		}
	};

	// Handler zum Öffnen des Bestätigungsmodals für Datei löschen
	const handleDeleteFileClick = (event, filePath) => {
		event.stopPropagation(); // Verhindere, dass der Klick das Aufklappen der Gruppe auslöst
		setConfirmDeleteFilePath(filePath);
	};

	// Handler zum Öffnen des Bestätigungsmodals für Gruppe löschen
	const handleDeleteGroupClick = (event, groupId) => {
		event.stopPropagation(); // Verhindere, dass der Klick das Aufklappen der Gruppe auslöst
		setConfirmDeleteGroupId(groupId);
	};

	// Handler zum Bestätigen des Löschens (Datei oder Gruppe)
	const handleConfirmDelete = async () => {
		setDeletingItem(true);
		setDupesError(null);

		try {
			if (confirmDeleteFilePath) {
				// Lösche eine einzelne Datei
				await deleteFile(confirmDeleteFilePath); // API-Aufruf zum Löschen der Datei im Backend
				toast.success(
					`🗑️ Datei erfolgreich gelöscht: ${confirmDeleteFilePath}`
				);
				// Entferne die Datei aus dem lokalen State (duplicateGroups)
				setDuplicateGroups((prevGroups) => {
					const newGroups = { ...prevGroups };
					let groupToDeleteId: string | null = null;

					for (const groupId in newGroups) {
						// groupId ist hier immer ein string
						// Stelle sicher, dass die Gruppe existiert, bevor wir darauf zugreifen
						if (newGroups.hasOwnProperty(groupId)) {
							// Finde die Datei in der aktuellen Gruppe
							const fileIndex = newGroups[groupId].files.findIndex(
								(file) => file.path === confirmDeleteFilePath
							);

							if (fileIndex !== -1) {
								// ... (Datei entfernen, file_count anpassen) ...
								const minLen = minCategoryLength ?? 2;

								if (
									newGroups[groupId].files.length > 0 &&
									newGroups[groupId].files.length < minLen
								) {
									// PROBLEM HIER: groupId (ein string) wird groupToDeleteId zugewiesen
									groupToDeleteId = groupId;
								} else if (newGroups[groupId].files.length === 0) {
									// PROBLEM HIER: groupId (ein string) wird groupToDeleteId zugewiesen
									groupToDeleteId = groupId;
								}
								// Da jede Datei nur in einer Gruppe sein sollte, können wir hier aufhören zu suchen
								break;
							}
						}
					}

					// Entferne die Gruppe, wenn sie zu klein oder leer geworden ist
					if (groupToDeleteId && newGroups[groupToDeleteId]) {
						delete newGroups[groupToDeleteId];
						// Wenn die aufgeklappte Gruppe gelöscht wurde, klappe sie zu
						if (expandedGroupId === groupToDeleteId) {
							setExpandedGroupId(null);
						}
					}

					// Nach dem Löschen einer Datei müssen wir die Duplikatgruppen im Backend neu speichern
					// saveDuplicates() wird im finally Block aufgerufen

					return newGroups;
				});

				// Nach erfolgreichem Löschen einer Datei, aktualisiere auch den initialDuplicateGroups Ref
				// Dies ist wichtig, damit das Leeren des Suchfeldes die korrekte Liste anzeigt
				initialDuplicateGroups.current = { ...initialDuplicateGroups.current };
				// Finde und entferne die Datei im Ref
				let refGroupDeleted = false;
				for (const groupId in initialDuplicateGroups.current) {
					if (initialDuplicateGroups.current.hasOwnProperty(groupId)) {
						const fileIndex = initialDuplicateGroups.current[
							groupId
						].files.findIndex((file) => file.path === confirmDeleteFilePath);
						if (fileIndex !== -1) {
							initialDuplicateGroups.current[groupId].files.splice(
								fileIndex,
								1
							);
							initialDuplicateGroups.current[groupId].file_count =
								initialDuplicateGroups.current[groupId].files.length;
							// Prüfe auch hier, ob die Gruppe im Ref zu klein wird
							const minLen = minCategoryLength ?? 2;
							if (
								initialDuplicateGroups.current[groupId].files.length > 0 &&
								initialDuplicateGroups.current[groupId].files.length < minLen
							) {
								delete initialDuplicateGroups.current[groupId];
								refGroupDeleted = true;
							} else if (
								initialDuplicateGroups.current[groupId].files.length === 0
							) {
								delete initialDuplicateGroups.current[groupId];
								refGroupDeleted = true;
							}
							break;
						}
					}
				}
				// Wenn eine Gruppe im Ref gelöscht wurde, müssen wir die verfügbaren Längenbereiche neu extrahieren
				if (refGroupDeleted) {
					extractAndSetLengthRanges(initialDuplicateGroups.current);
				}
			} else if (confirmDeleteGroupId) {
				const groupToDelete = duplicateGroups[confirmDeleteGroupId];
				if (
					groupToDelete &&
					groupToDelete.files &&
					groupToDelete.files.length > 0
				) {
					// TODO: Implementiere Logik, um EINE Datei pro Gruppe zu BEHALTEN!
					// Momentan löscht dieser Code ALLE Dateien in der Gruppe.

					const filesToDeletePaths = groupToDelete.files.map(
						(file) => file.path
					);
					let successCount = 0;
					let failCount = 0;

					// Führe Löschungen sequenziell oder parallel aus
					// Sequenziell ist einfacher zu debuggen
					for (const filePath of filesToDeletePaths) {
						try {
							await deleteFile(filePath); // API-Aufruf für jede Datei
							successCount++;
						} catch (err) {
							console.error(
								`Fehler beim Löschen von Datei ${filePath} in Gruppe ${confirmDeleteGroupId}:`,
								err
							);
							failCount++;
							// Optional: Zeige einen Toast für jede fehlgeschlagene Löschung
							// toast.error(`❌ Konnte Datei ${filePath} nicht löschen.`);
						}
					}

					if (successCount > 0) {
						toast.success(
							`🗑️ ${successCount} Datei(en) aus Gruppe ${confirmDeleteGroupId} gelöscht.`
						);
					}
					if (failCount > 0) {
						// Zeige einen zusammenfassenden Fehler-Toast, wenn es fehlgeschlagene Löschungen gab
						toast.error(
							`❌ Konnte ${failCount} Datei(en) aus Gruppe ${confirmDeleteGroupId} nicht löschen. Sie müssen möglicherweise manuell entfernt werden.`
						);
					}

					// Entferne die gesamte Gruppe aus dem lokalen State, da alle Dateien gelöscht wurden
					setDuplicateGroups((prevGroups) => {
						const newGroups = { ...prevGroups };
						// Stelle sicher, dass die Gruppe existiert, bevor wir sie löschen
						if (newGroups.hasOwnProperty(confirmDeleteGroupId)) {
							delete newGroups[confirmDeleteGroupId];
							// Wenn die aufgeklappte Gruppe gelöscht wurde, klappe sie zu
							if (expandedGroupId === confirmDeleteGroupId) {
								setExpandedGroupId(null);
							}
						}
						// Nach dem Löschen einer Gruppe müssen wir die Duplikatgruppen im Backend neu speichern
						// saveDuplicates() wird im finally Block aufgerufen
						return newGroups;
					});

					// Entferne die Gruppe auch aus dem initialDuplicateGroups Ref
					if (
						initialDuplicateGroups.current.hasOwnProperty(confirmDeleteGroupId)
					) {
						delete initialDuplicateGroups.current[confirmDeleteGroupId];
						// Wenn eine Gruppe im Ref gelöscht wurde, müssen wir die verfügbaren Längenbereiche neu extrahieren
						extractAndSetLengthRanges(initialDuplicateGroups.current);
					}
				} else {
					console.warn(
						"Gruppe zum Löschen nicht gefunden oder leer:",
						confirmDeleteGroupId
					);
					toast.info("Gruppe zum Löschen nicht gefunden oder bereits leer.");
				}
			}
		} catch (err) {
			// Der spezifische Fehler-Toast wird bereits in den einzelnen Lösch-Aufrufen angezeigt (falls failCount > 0)
			// Hier nur ein allgemeiner Log oder optional ein weiterer Toast, falls der erste deleteFile Aufruf fehlschlägt
			console.error("Allgemeiner Fehler während des Löschvorgangs:", err);
			if (!(confirmDeleteGroupId && err)) {
				// Vermeide doppelten Toast, wenn es schon einen failCount Toast gab
				// setDupesError(`Fehler beim Löschen: ${err.message}`); // Optional: Setze Fehlerzustand
			}
			// Wir setzen den deletingItem Zustand auch bei einem Fehler zurück
		} finally {
			setDeletingItem(false);
			setConfirmDeleteFilePath(null);
			setConfirmDeleteGroupId(null);
			// Speichere die Duplikate nach der State-Änderung, unabhängig vom Erfolg der Lösch-API-Aufrufe
			// Dies stellt sicher, dass der Backend-State den Änderungen im Frontend entspricht
			try {
				await saveDuplicates();
				// Optional: toast.info('Änderungen gespeichert.');
			} catch (saveErr) {
				console.error(
					"Fehler beim automatischen Speichern nach Löschvorgang:",
					saveErr
				);
				toast.error("❌ Fehler beim automatischen Speichern der Änderungen.");
				// Setze den Fehlerzustand, aber überschreibe nicht den Löschfehler, falls vorhanden
				if (!dupesError) {
					setDupesError(
						`Fehler beim Speichern nach Löschvorgang: ${saveErr.message}`
					);
				}
			}
		}
	};

	// Handler zum Abbrechen des Löschens
	const handleCancelDelete = () => {
		setConfirmDeleteFilePath(null);
		setConfirmDeleteGroupId(null);
		setDeletingItem(false);
		toast.info("Löschvorgang abgebrochen.");
	};

	// Bestimme die Nachricht, wenn keine Gruppen angezeigt werden
	const noGroupsMessage = () => {
		if (loadingDupes || isDupeSearchRunning) return null;
		if (dupesError) return null;

		// Wir prüfen, ob displayedGroups leer ist, aber es ÜBERHAUPT Gruppen im initialen Ref gibt.
		// Wenn der initiale Ref leer ist, bedeutet das, es wurden nie Gruppen geladen oder gefunden.
		if (
			displayedGroups.length === 0 &&
			Object.keys(initialDuplicateGroups.current).length > 0
		) {
			// Es gibt Gruppen im initialen Ref, aber keine entsprechen den aktuellen Filterkriterien
			let message = `Keine Duplikatgruppen entsprechen den aktuellen Filterkriterien.`;
			if (dedupeSearchQuery) {
				message += ` (Suchbegriff: "${dedupeSearchQuery}")`;
			}
			if (selectedLengthRange) {
				// <-- Nachricht für Längenfilter hinzufügen
				message += ` (Länge: ${selectedLengthRange})`;
			}
			return (
				<p
					style={{
						textAlign: "center",
						marginTop: "20px",
						color: "var(--text-muted)",
					}}
				>
					{message}
				</p>
			);
		} else if (Object.keys(initialDuplicateGroups.current).length === 0) {
			// Es gibt überhaupt keine Gruppen im initialen Ref (weder geladen noch gefunden)
			return (
				<p
					style={{
						textAlign: "center",
						marginTop: "20px",
						color: "var(--text-muted)",
					}}
				>
					Bitte klicken Sie auf "Duplikate suchen" oder "Duplikate laden".
				</p>
			);
		}

		return null; // Es gibt Gruppen, die angezeigt werden
	};

	// Erstelle ein Array der Gruppen, die basierend auf den Filterkriterien angezeigt werden sollen
	// Diese Filterung findet jetzt im Backend durch searchDuplicates statt.
	// displayedGroups ist einfach die Konvertierung des duplicateGroups State-Objekts in ein Array.
	const displayedGroups = Object.keys(duplicateGroups) // Nutze den State, der vom Backend gefiltert wurde
		.map((groupId) => ({
			group_id: groupId, // Füge die group_id hinzu
			...duplicateGroups[groupId], // Füge die restlichen Gruppendaten hinzu
		}));
	// Frontend-Filterung und Sortierung sind hier nicht mehr nötig, da das Backend das macht.
	// .filter(...)
	// .sort(...)

	return (
		// Use the original class name for the main container
		<div className={"dedupe-container settings-section"}>
			{" "}
			{/* Added settings-section for consistent padding */}
			<h2>Dateiduplikate finden</h2>
			{/* Action Buttons */}
			<div className="action-button-group" style={{ marginBottom: "20px" }}>
				<button
					onClick={handleFindDuplicates}
					disabled={loadingDupes || isDupeSearchRunning || deletingItem}
				>
					{isDupeSearchRunning
						? "Suche läuft..."
						: loadingDupes
						? "Lädt..."
						: "Duplikate suchen"}
				</button>
				<button
					onClick={handleLoadDuplicates}
					disabled={loadingDupes || isDupeSearchRunning || deletingItem}
				>
					{loadingDupes ? "Lädt..." : "Duplikate laden"}
				</button>
				{/* Optional: Button zum manuellen Speichern */}
				<button
					onClick={handleSaveDuplicates}
					disabled={loadingDupes || isDupeSearchRunning || deletingItem}
				>
					{loadingDupes ? "Speichert..." : "Duplikate speichern"}
				</button>
			</div>
			{/* Error Display */}
			{dupesError && !loadingDupes && (
				<p className="folder-selector-error" style={{ textAlign: "left" }}>
					{dupesError}
				</p>
			)}
			{/* Duplicate Groups List and Filter Controls Container */}
			{/* Dieses div wird zum Flex-Container für Liste und Filter */}
			<div className="deduping-results-container">
				{/* Filter and Sort Controls */}
				{/* Only show filters if the system is not globally busy */}
				{/* Die Bedingung Object.keys(duplicateGroups).length > 0 wurde entfernt */}
				{!loadingDupes && !isDupeSearchRunning && !dupesError && (
					<div className="filter-controls" style={{ marginBottom: "20px" }}>
						{" "}
						{/* Entferne display: flex etc. hier, das ist im CSS */}
						{/* Search Input */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "5px",
								flexGrow: 1,
							}}
						>
							<label htmlFor="dedupeSearchInput">Suche:</label>
							<input
								ref={searchInputRef}
								type="text"
								id="dedupeSearchInput"
								value={dedupeSearchQuery}
								onChange={handleSearchInputChange}
								onKeyDown={handleSearchKeyPress}
								placeholder="Nach Dateiname suchen..."
								disabled={loadingDupes || isDupeSearchRunning || deletingItem}
								style={{ flexGrow: 1 }}
							/>
							{/* Neuer "X" Button zum Leeren des Suchfeldes */}
							{dedupeSearchQuery && ( // Zeige den Button nur, wenn das Suchfeld nicht leer ist
								<button
									onClick={handleClearSearch}
									disabled={loadingDupes || isDupeSearchRunning || deletingItem}
									className="clear-dedupe-search-button action-button clear-search-button" // Wiederverwendung der Button-Klasse + spezifische Klasse
									title="Suchfeld leeren"
									// style={{ padding: '8px', minWidth: 'auto' }} // Kleineres, quadratisches Padding - jetzt im CSS
								>
									<X size={18} /> {/* X Icon */}
								</button>
							)}
							{/* Neuer Suchen Button */}
							<button
								onClick={handleSearchSubmit}
								disabled={loadingDupes || isDupeSearchRunning || deletingItem}
								className="action-button" // Oder eine passende Klasse für kleine Buttons
								title="Suche starten"
								style={{ padding: "8px 12px" }} // Kleineres Padding für diesen Button
							>
								<SearchIcon size={18} /> {/* Icon für den Button */}
							</button>
						</div>
						{/* Sort By */}
						<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
							<label htmlFor="sortBy">Sortieren nach:</label>
							<select
								id="sortBy"
								value={sortBy}
								onChange={handleSortByChange}
								disabled={loadingDupes || isDupeSearchRunning || deletingItem}
							>
								<option value="similarity">Ähnlichkeit</option>
								<option value="length">Länge</option>
								<option value="file_count">Anzahl Dateien</option>
								{/* Add other sort options if needed */}
							</select>
						</div>
						{/* Sort Order */}
						<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
							<label htmlFor="sortOrder">Reihenfolge:</label>
							<select
								id="sortOrder"
								value={sortOrder}
								onChange={handleSortOrderChange}
								disabled={loadingDupes || isDupeSearchRunning || deletingItem}
							>
								<option value="desc">Absteigend</option>
								<option value="asc">Aufsteigend</option>
							</select>
						</div>
						{/* Length Range Filter Dropdown */} {/* <-- New Dropdown */}
						<div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
							<label htmlFor="lengthRangeFilter">Länge:</label>
							<select
								id="lengthRangeFilter"
								value={selectedLengthRange}
								onChange={handleLengthRangeChange}
								disabled={loadingDupes || isDupeSearchRunning || deletingItem}
							>
								<option value="">Alle Längen</option>
								{/* Generiere Optionen basierend auf den vorhandenen Längenbereichen */}
								{availableLengthRanges.map((range) => (
									<option key={range} value={range}>
										{range} Zeichen
									</option>
								))}
							</select>
						</div>
					</div>
				)}

				{/* Duplicate Groups List */}
				{/* Show spinner only if loadingDupes is true AND there are no groups yet */}
				{/* Oder wenn deletingItem true ist */}
				{(loadingDupes || isDupeSearchRunning || deletingItem) &&
					Object.keys(duplicateGroups).length === 0 && (
						<div className="spinner-container" style={{ marginTop: "20px" }}>
							<div className="spinner"></div>
						</div>
					)}
				{/* Show spinner if deletingItem is true AND there are groups */}
				{deletingItem && Object.keys(duplicateGroups).length > 0 && (
					<div className="spinner-container" style={{ marginTop: "20px" }}>
						<div className="spinner"></div>
					</div>
				)}

				{/* Zeige die Liste nur, wenn nicht geladen wird, kein Fehler vorliegt UND es Gruppen gibt */}
				{!loadingDupes &&
					!isDupeSearchRunning &&
					!dupesError &&
					displayedGroups.length > 0 && (
						<div className="dedupe-groups-list-container">
							{" "}
							{/* Entferne margin-top hier, das wird durch gap im Parent geregelt */}
							<h3>Gefundene Duplikatgruppen:</h3>{" "}
							{/* H3 ist jetzt innerhalb dieses Containers */}
							<ul
								className="dedupe-groups-list"
								style={{ listStyle: "none", padding: 0 }}
							>
								{/* Iterate through the displayedGroups array */}
								{displayedGroups.map((group) => (
									<li
										key={group.group_id} // Assuming backend provides a unique group_id
										className={`dedupe-group-item ${
											expandedGroupId === group.group_id ? "expanded" : ""
										}`}
										// Inline styles für Hover und Expanded entfernen, da sie jetzt im CSS sind
										// style={{
										//     border: '1px solid var(--border-tertiary)',
										//     borderRadius: '4px',
										//     padding: '10px',
										//     marginBottom: '10px',
										//     backgroundColor: 'var(--bg-secondary)',
										//     cursor: 'pointer',
										//     transition: 'background-color 0.2s ease',
										// }}
										// onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
										// onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
										onClick={() => handleToggleGroup(group.group_id)} // Toggle expand/collapse
									>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
											}}
										>
											{/* Group Summary */}
											<div
												style={{
													flexGrow: 1,
													marginRight: "10px",
													display: "flex",
													alignItems: "center",
												}}
											>
												<FolderOpen
													size={20}
													style={{
														marginRight: "10px",
														color: "var(--text-secondary)",
													}}
												/>
												<div
													style={{
														fontWeight: "bold",
														color: "var(--text-primary)",
													}}
												>
													Gruppe ({group.file_count} Dateien)
												</div>
												<div
													style={{
														fontSize: "0.9rem",
														color: "var(--text-muted)",
														marginLeft: "15px",
													}}
												>
													Ähnlichkeit: {(group.avg_similarity * 100).toFixed(0)}
													% | Länge: {group.length_range} Zeichen
												</div>
											</div>

											{/* Group Actions */}
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "5px",
												}}
											>
												{/* Delete Group Button */}
												<button
													onClick={(e) =>
														handleDeleteGroupClick(e, group.group_id)
													}
													disabled={deletingItem}
													className="disfirm"
													title="Gruppe löschen (Alle Dateien in der Gruppe löschen)"
												>
													{deletingItem &&
													confirmDeleteGroupId === group.group_id
														? "Lösche Gruppe..."
														: "Gruppe löschen"}
												</button>
												{/* Expand/Collapse Icon */}
												{expandedGroupId === group.group_id ? (
													<ChevronUp
														size={20}
														style={{ color: "var(--text-secondary)" }}
													/>
												) : (
													<ChevronDown
														size={20}
														style={{ color: "var(--text-secondary)" }}
													/>
												)}
											</div>
										</div>

										{/* Files within the group (conditionally rendered when expanded) */}
										{expandedGroupId === group.group_id && (
											<ul
												className="dedupe-group-files"
												style={{
													listStyle: "none",
													padding: "10px 0 0 0",
													margin: "10px 0 0 0",
													borderTop: "1px solid var(--border-tertiary)",
												}}
											>
												{group.files.map((file) => (
													<li
														key={file.path}
														onClick={() => handleFileClick(file.path)} // Open file in preview
														// Inline styles für Hover entfernen, da sie jetzt im CSS sind
														// style={{
														//     padding: '8px',
														//     marginBottom: '5px',
														//     backgroundColor: 'var(--bg-tertiary)',
														//     borderRadius: '3px',
														//     display: 'flex',
														//     justifyContent: 'space-between',
														//     alignItems: 'center',
														//     cursor: 'pointer',
														//     transition: 'background-color 0.1s ease',
														// }}
														// onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
														// onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
													>
														<div
															style={{
																flexGrow: 1,
																marginRight: "10px",
																display: "flex",
																alignItems: "center",
															}}
														>
															<FileText
																size={16}
																style={{
																	marginRight: "8px",
																	color: "var(--text-secondary)",
																}}
															/>
															<div
																style={{
																	fontWeight: "normal",
																	color: "var(--text-primary)",
																}}
															>
																{file.name}
															</div>
															<div
																style={{
																	fontSize: "0.8rem",
																	color: "var(--text-secondary)",
																	marginLeft: "10px",
																}}
															>
																{file.path}
															</div>
														</div>
														<div
															style={{
																fontSize: "0.8rem",
																color: "var(--text-muted)",
																marginRight: "10px",
															}}
														>
															Größe: {formatBytes(file.size_bytes)} | Alter:{" "}
															{formatAge(file.modified_at)}
														</div>
														{/* Delete File Button */}
														<button
															onClick={(e) =>
																handleDeleteFileClick(e, file.path)
															}
															disabled={deletingItem}
															className="disfirm-small" // Use a smaller class for file delete button
															title={`Datei löschen: ${file.name}`}
														>
															{deletingItem &&
															confirmDeleteFilePath === file.path ? (
																"Lösche..."
															) : (
																<X size={14} />
															)}
														</button>
													</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ul>
						</div>
					)}
			</div>{" "}
			{/* Ende .deduping-results-container */}
			{/* Message when no groups are displayed */}
			{noGroupsMessage()}
			{/* Confirmation Modal */}
			{(confirmDeleteFilePath || confirmDeleteGroupId) && (
				<ConfirmModal
					title={confirmDeleteFilePath ? "Datei löschen?" : "Gruppe löschen?"}
					message={
						confirmDeleteFilePath
							? `Bist du sicher, dass du die Datei "${confirmDeleteFilePath}" unwiderruflich löschen möchtest?`
							: `Bist du sicher, dass du die Duplikatgruppe (enthält ${
									duplicateGroups[confirmDeleteGroupId]?.file_count ?? "?"
							  } Datei(en)) unwiderruflich löschen möchtest? Dies löscht alle Dateien in dieser Gruppe.`
					}
					onConfirm={handleConfirmDelete}
					onCancel={handleCancelDelete}
					isDanger={true}
				/>
			)}
		</div>
	);
};

export default DeDuping;

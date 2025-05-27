import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { ConfirmModal } from "./ConfirmModal.tsx";
import { updateScannerConfig } from "../api/api.tsx";
import { FolderSelector } from "./FolderSelector.tsx";
import { SettingsContext } from "../context/SettingsContext.tsx"; // Pfad anpassen

const ALL_EXTENSIONS = [
	".txt",
	".md",
	".csv",
	".json",
	".xml",
	".html",
	".css",
	".js",
	".py",
	".pdf",
	".docx",
];

const EXTENSION_OPTIONS = [
	{ label: "Alle", value: ALL_EXTENSIONS },
	{
		label: "Textformate (.txt, .md, .csv, .json, .xml)",
		value: [".txt", ".md", ".csv", ".json", ".xml"],
	},
	{ label: "Web & Styles (.html, .css, .js)", value: [".html", ".css", ".js"] },
	{ label: "Skripte & Code (.py, .js)", value: [".py", ".js"] },
	{ label: "Dokumente (.pdf, .docx)", value: [".pdf", ".docx"] },
	{ label: "Eigene", value: null },
];

interface ExtensionOption {
	label: string;
	value: string[] | null; // Wichtig: value kann string[] oder null sein
}

const ScannerConfig = ({ configs, setConfigs }) => {
	const [baseDirs, setBaseDirs] = useState([]);
	const [extensions, setExtensions] = useState([]);
	const [indexContent, setIndexContent] = useState(false);
	const [convertPDF, setConvertPDF] = useState(false);
	const [maxSizeKb, setMaxSizeKb] = useState("");
	const [maxContentSizeLet, setMaxContentSizeLet] = useState("");
	const [selectedOption, setSelectedOption] = useState("Eigene");
	const [showConfirmModal, setShowConfirmModal] = useState(false);
	const [showFolderSelector, setShowFolderSelector] = useState(false);
	const { scannerUsableExtensions } = useContext(SettingsContext); // useContext verwenden
	const [filteredExtensions, setFilteredExtensions] = useState([]); // Neuer State für gefilterte Extensions

	// Filtert die ALL_EXTENSIONS basierend auf scannerUsableExtensions
	useEffect(() => {
		if (scannerUsableExtensions && Array.isArray(scannerUsableExtensions)) {
			setFilteredExtensions(
				ALL_EXTENSIONS.filter((ext) => scannerUsableExtensions.includes(ext))
			);
		} else {
			setFilteredExtensions(ALL_EXTENSIONS); // Fallback, falls context nicht richtig geladen
		}
	}, [scannerUsableExtensions]);

	// Passt die EXTENSION_OPTIONS basierend auf filteredExtensions an
	const filteredExtensionOptions = EXTENSION_OPTIONS.map((option) => ({
		...option,
		value: option.value
			? option.value.filter((ext) => filteredExtensions.includes(ext))
			: null,
	})).filter(
		(option) =>
			option.value === null ||
			option.value.length > 0 ||
			option.label === "Eigene"
	);

	// Setzt die initialen Werte aus `configs`, wenn sich diese ändern
	useEffect(() => {
		if (configs) {
			resetConfigs();
		}
	}, [configs]);

	const resetConfigs = () => {
		setBaseDirs(configs.base_dirs || []);
		// Stelle sicher, dass nur nutzbare Extensions gesetzt werden
		setExtensions(
			(configs.extensions || []).filter((ext) =>
				filteredExtensions.includes(ext)
			)
		);
		setIndexContent(configs.index_content || false);
		setConvertPDF(configs.convert_pdf || false);
		setMaxSizeKb(configs.max_size_kb || "");
		setMaxContentSizeLet(configs.max_content_size_let || "");

		const matchedOption = filteredExtensionOptions.find((option) => {
			const currentOptionValue = option.value; // Hole option.value in eine Variable

			// Expliziter Null-Check für currentOptionValue
			if (currentOptionValue) {
				// Innerhalb dieses Blocks weiß TypeScript, dass currentOptionValue nicht null ist
				// und (basierend auf der Annahme oben) vom Typ string[] sein sollte.
				return (
					extensions.length === currentOptionValue.length &&
					extensions.every((ext) => currentOptionValue.includes(ext))
				);
			}
			// Wenn currentOptionValue null (oder ein anderer falsy Wert) war, gib false zurück
			return false;
		});

		setSelectedOption(matchedOption ? matchedOption.label : "Eigene");
	};

	const handleUpdate = async () => {
		try {
			setShowConfirmModal(false);
			const newConfig = {
				base_dirs: baseDirs.length > 0 ? baseDirs : null,
				extensions: extensions.length > 0 ? extensions : null,
				index_content: indexContent,
				convert_pdf: convertPDF,
				max_size_kb: maxSizeKb ? parseInt(maxSizeKb, 10) : null,
				max_content_size_let: maxContentSizeLet
					? parseInt(maxContentSizeLet, 10)
					: null,
			};
			// Update Configs
			const data = await updateScannerConfig(newConfig);
			// Actualize Configs
			setConfigs(data.configs);
			toast.success("✅ Konfiguration erfolgreich aktualisiert!");
		} catch (error) {
			toast.error("❌ Fehler beim Speichern der Konfiguration!");
		}
	};

	const handleGetFolder = () => {
		setShowFolderSelector(true);
	};

	const handleFolderSelect = (folderPath) => {
		if (folderPath && !baseDirs.includes(folderPath)) {
			setBaseDirs((prevDirs) => [...prevDirs, folderPath]);
		} else {
			toast.warn(
				folderPath ? "⚠️ Ordner schon vorhanden!" : "⚠️ Kein Ordner ausgewählt."
			);
		}
		setShowFolderSelector(false);
	};

	const handleDropdownChange = (e) => {
		const selectedLabel = e.target.value;
		setSelectedOption(selectedLabel);

		const selectedConfig = filteredExtensionOptions.find(
			(option) => option.label === selectedLabel
		);
		if (selectedConfig) {
			setExtensions(selectedConfig.value || []);
		}
	};

	const handleCheckboxChange = (ext) => {
		setExtensions((prev) => {
			const newExtensions = prev.includes(ext)
				? prev.filter((e) => e !== ext)
				: [...prev, ext];

			const matchedOption = filteredExtensionOptions.find(
				(option) =>
					option.value &&
					option.value.length === newExtensions.length &&
					option.value.every((e) => newExtensions.includes(e))
			);
			setSelectedOption(matchedOption ? matchedOption.label : "Eigene");
			return newExtensions;
		});
	};

	const removeBaseDir = (dir) => {
		setBaseDirs(baseDirs.filter((d) => d !== dir));
	};

	return (
		<div className="container scanner-config-container">
			{/* Base Directories */}
			<label>
				<h2>Zielordner:</h2>
				<div className="base-dir-list">
					{baseDirs.map((dir, index) => (
						<div key={index} className="base-dir-item input-with-tooltip">
							<input type="text" value={dir} readOnly />
							<button
								className="remove-button"
								onClick={() => removeBaseDir(dir)}
							>
								Entfernen
							</button>
							{/* Tooltip für den vollständigen Pfad */}
							<div className="path-tooltip">{dir}</div>
						</div>
					))}
					<button onClick={handleGetFolder}>Neuer Ordner</button>
				</div>
			</label>

			<div className="scanner-configs">
				<h2>Scanner-Konfiguration</h2>

				{/* Extensions Dropdown */}
				<label>
					Dateierweiterungen:
					<select value={selectedOption} onChange={handleDropdownChange}>
						{filteredExtensionOptions.map((option, index) => (
							<option key={index} value={option.label}>
								{option.label}
							</option>
						))}
					</select>
				</label>

				{/* Checkbox for each available extension */}
				<div className="checkbox-group">
					{filteredExtensions.map((ext, index) => (
						<label
							key={ext}
							style={{
								display: "block",
								color: extensions.includes(ext) ? "black" : "gray",
							}}
							htmlFor={`checkbox-${index}`} // Verknüpft das Label mit dem Input über die id
						>
							<input
								type="checkbox"
								id={`checkbox-${index}`} // Geben Sie jedem Input eine eindeutige ID
								checked={extensions.includes(ext)}
								onChange={() => handleCheckboxChange(ext)}
							/>
							{ext} {/* Das Label selbst wird nun den Text anzeigen */}
						</label>
					))}
				</div>

				<div className="checkbox-container">
					<label>
						Inhalt Indexieren:
						<input
							type="checkbox"
							checked={indexContent}
							onChange={(e) => setIndexContent(e.target.checked)}
						/>
					</label>
					<label>
						PDF Konversion:
						<input
							type="checkbox"
							checked={convertPDF}
							onChange={(e) => setConvertPDF(e.target.checked)}
						/>
					</label>
				</div>

				<label>
					Maximale Dateigröße (kilobyte):
					<input
						type="number"
						value={maxSizeKb}
						onChange={(e) => setMaxSizeKb(e.target.value)}
						placeholder="Unbegrenzt (Leer)"
					/>
				</label>

				<label>
					Maximale Inhaltsgröße per Datei (Zeichen):
					<input
						type="number"
						value={maxContentSizeLet}
						onChange={(e) => setMaxContentSizeLet(e.target.value)}
						placeholder="Unbegrenzt (Leer)"
					/>
				</label>
			</div>

			{/* Button to show confirmation modal */}
			<button
				onClick={() => setShowConfirmModal(true)}
				className="update-button"
			>
				Konfiguration speichern
			</button>

			{/* Confirm Modal */}
			{showConfirmModal && (
				<ConfirmModal
					title="Konfigurieren bestätigen"
					message="Möchtest du die Konfiguration speichern?"
                    isDanger={false}
					onConfirm={handleUpdate}
					onCancel={() => {
						setShowConfirmModal(false);
						toast.warn("⚠️ Konfiguration nicht Aktualisiert");
						resetConfigs();
					}}
				/>
			)}

			{/* Folder Selector Modal */}
			{showFolderSelector && (
				<FolderSelector
					setPath={handleFolderSelect}
					onCancel={() => setShowFolderSelector(false)}
				/>
			)}
		</div>
	);
};

export default ScannerConfig;

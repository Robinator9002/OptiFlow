// src/components/Editor/PropertiesPanel.tsx
import React from "react";
import type { ExtendedFormElement } from "./FormEditorContainer"; // Import aus dem Hauptcontainer
import { LabelPosition } from "./FormEditorContainer";

interface PropertiesPanelProps {
	selectedElement: ExtendedFormElement | null;
	onPropertyChange: (
		elementId: string,
		propertyPath: string,
		value: any
	) => void;
	onDeleteElement: (elementId: string) => void;
	currentFormJson: string; // Für die JSON-Vorschau
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
	selectedElement,
	onPropertyChange,
	onDeleteElement,
	currentFormJson,
}) => {
	if (!selectedElement) {
		return (
			<aside className="properties-panel">
				<h3>Eigenschaften</h3>
				<p>
					Kein Element ausgewählt. Klicken Sie auf ein Element auf der
					Arbeitsfläche oder ziehen Sie ein neues Element aus der Palette.
				</p>
				<div className="json-preview-container">
					<h4>Formular JSON (Rohdaten):</h4>
					<pre className="json-preview">{currentFormJson}</pre>
				</div>
			</aside>
		);
	}

	const handleLocalPropertyChange = (propertyPath: string, value: any) => {
		if (selectedElement) {
			onPropertyChange(selectedElement.id, propertyPath, value);
		}
	};

	return (
		<aside className="properties-panel">
			<h3>Elementeigenschaften</h3>
			<div className="element-properties-editor">
				<h4>
					Typ: {selectedElement.type}
					<span
						style={{
							fontSize: "0.8em",
							color: "var(--text-color-secondary)",
							marginLeft: "10px",
						}}
					>
						(ID: {selectedElement.id.substring(0, 6)}...)
					</span>
				</h4>

				<div>
					<label>Größe (informativ):</label>
					<p style={{ fontSize: "var(--font-size-sm)", margin: "0" }}>
						Breite: {selectedElement.size.width.toFixed(0)}px, Höhe:{" "}
						{selectedElement.size.height.toFixed(0)}px
					</p>
				</div>

				{/* Text-spezifische Eigenschaften */}
				{selectedElement.type === "text" && (
					<>
						<div>
							<label htmlFor={`prop-content-${selectedElement.id}`}>
								Textinhalt:
							</label>
							<textarea
								id={`prop-content-${selectedElement.id}`}
								value={selectedElement.properties.content || ""}
								onChange={(e) =>
									handleLocalPropertyChange("content", e.target.value)
								}
							/>
						</div>
						<div>
							<label>Horizontale Ausrichtung:</label>
							<select
								value={selectedElement.properties.textAlignHorizontal || "left"}
								onChange={(e) =>
									handleLocalPropertyChange(
										"textAlignHorizontal",
										e.target.value
									)
								}
							>
								<option value="left">Links</option>
								<option value="center">Mitte</option>
								<option value="right">Rechts</option>
							</select>
						</div>
						<div>
							<label>Vertikale Ausrichtung:</label>
							<select
								value={
									selectedElement.properties.textAlignVertical || "flex-start"
								}
								onChange={(e) =>
									handleLocalPropertyChange("textAlignVertical", e.target.value)
								}
							>
								<option value="flex-start">Oben</option>
								<option value="center">Mitte</option>
								<option value="flex-end">Unten</option>
							</select>
						</div>
					</>
				)}

				{/* Input-spezifische Eigenschaften */}
				{selectedElement.type === "input" && (
					<>
						<div>
							<label htmlFor={`prop-label-${selectedElement.id}`}>
								Label Text:
							</label>
							<input
								type="text"
								id={`prop-label-${selectedElement.id}`}
								value={selectedElement.properties.label || ""}
								onChange={(e) =>
									handleLocalPropertyChange("label", e.target.value)
								}
							/>
						</div>
						<div>
							<label htmlFor={`prop-labelTextSize-${selectedElement.id}`}>
								Label Schriftgröße (px): {/* NEUES FELD */}
							</label>
							<input
								type="number"
								id={`prop-labelTextSize-${selectedElement.id}`}
								value={selectedElement.properties.labelTextSize || 14}
								onChange={(e) =>
									handleLocalPropertyChange(
										"labelTextSize",
										parseInt(e.target.value, 10) || 14 // Fallback auf 14, falls ungültig
									)
								}
								min="8"
							/>
						</div>
						<div>
							<label htmlFor={`prop-labelPos-${selectedElement.id}`}>
								Label Position:
							</label>
							<select
								id={`prop-labelPos-${selectedElement.id}`}
								value={selectedElement.properties.labelPosition || "top"}
								onChange={(e) =>
									handleLocalPropertyChange(
										"labelPosition",
										e.target.value as LabelPosition
									)
								}
							>
								<option value="top">Oben</option>
								<option value="left-top">Links (Oben)</option>
								<option value="left-center">Links (Mitte)</option>
								<option value="right-top">Rechts (Oben)</option>
								<option value="right-center">Rechts (Mitte)</option>
							</select>
						</div>
						<div>
							<label htmlFor={`prop-placeholder-${selectedElement.id}`}>
								Platzhalter:
							</label>
							<input
								type="text"
								id={`prop-placeholder-${selectedElement.id}`}
								value={selectedElement.properties.placeholder || ""}
								onChange={(e) =>
									handleLocalPropertyChange("placeholder", e.target.value)
								}
							/>
						</div>
						<div>
							<label>Textausrichtung (Input-Feld):</label>
							<select
								value={selectedElement.properties.textAlignHorizontal || "left"}
								onChange={(e) =>
									handleLocalPropertyChange(
										"textAlignHorizontal",
										e.target.value
									)
								}
							>
								<option value="left">Links</option>
								<option value="center">Mitte</option>
								<option value="right">Rechts</option>
							</select>
						</div>
					</>
				)}

				{/* Gemeinsame Styling-Eigenschaften für Text und Input (Schriftgröße des Inhalts) */}
				{(selectedElement.type === "text" ||
					selectedElement.type === "input") && (
					<>
						<div>
							<label htmlFor={`prop-fontSize-${selectedElement.id}`}>
								Schriftgröße Inhalt (px):{" "}
								{/* Präzisiert, dass es um den Inhalt geht */}
							</label>
							<input
								type="number"
								id={`prop-fontSize-${selectedElement.id}`}
								value={selectedElement.properties.fontSize || 16}
								onChange={(e) =>
									handleLocalPropertyChange(
										"fontSize",
										parseInt(e.target.value, 10) || 16 // Fallback auf 16
									)
								}
								min="8"
							/>
						</div>
						<div className="property-buttons">
							<label>Schriftstil Inhalt:</label> {/* Präzisiert */}
							<button
								onClick={() =>
									handleLocalPropertyChange(
										"fontWeight",
										selectedElement.properties.fontWeight === "bold"
											? "normal"
											: "bold"
									)
								}
								className={
									selectedElement.properties.fontWeight === "bold"
										? "active"
										: ""
								}
							>
								Fett
							</button>
							<button
								onClick={() =>
									handleLocalPropertyChange(
										"fontStyle",
										selectedElement.properties.fontStyle === "italic"
											? "normal"
											: "italic"
									)
								}
								className={
									selectedElement.properties.fontStyle === "italic"
										? "active"
										: ""
								}
							>
								Kursiv
							</button>
						</div>
					</>
				)}

				{/* Image-spezifische Eigenschaften */}
				{selectedElement.type === "image" && (
					<>
						<div>
							<label htmlFor={`prop-src-${selectedElement.id}`}>
								Bild-URL:
							</label>
							<input
								type="text"
								id={`prop-src-${selectedElement.id}`}
								value={selectedElement.properties.src || ""}
								onChange={(e) =>
									handleLocalPropertyChange("src", e.target.value)
								}
							/>
						</div>
						<div>
							<label htmlFor={`prop-alt-${selectedElement.id}`}>
								Alternativtext:
							</label>
							<input
								type="text"
								id={`prop-alt-${selectedElement.id}`}
								value={selectedElement.properties.alt || ""}
								onChange={(e) =>
									handleLocalPropertyChange("alt", e.target.value)
								}
							/>
						</div>
						<div>
							<label>Bildform:</label>
							<select
								value={selectedElement.properties.imageShape || "rectangle"}
								onChange={(e) =>
									handleLocalPropertyChange("imageShape", e.target.value)
								}
							>
								<option value="rectangle">Rechteck</option>
								<option value="circle">Kreis</option>
							</select>
						</div>
					</>
				)}

				{/* Line-spezifische Eigenschaften */}
				{selectedElement.type === "line" && (
					<>
						<div>
							<label>Ausrichtung:</label>
							<select
								value={selectedElement.properties.orientation || "horizontal"}
								onChange={(e) =>
									handleLocalPropertyChange(
										"orientation",
										e.target.value as "horizontal" | "vertical"
									)
								}
							>
								<option value="horizontal">Horizontal</option>
								<option value="vertical">Vertikal</option>
							</select>
						</div>
						<div>
							<label htmlFor={`prop-thickness-${selectedElement.id}`}>
								Dicke (px):
							</label>
							<input
								type="number"
								min="1"
								id={`prop-thickness-${selectedElement.id}`}
								value={selectedElement.properties.thickness || 2}
								onChange={(e) =>
									handleLocalPropertyChange(
										"thickness",
										parseInt(e.target.value, 10) || 1 // Fallback auf 1
									)
								}
							/>
						</div>
						<div>
							<label htmlFor={`prop-color-${selectedElement.id}`}>Farbe:</label>
							<input
								type="color"
								id={`prop-color-${selectedElement.id}`}
								value={selectedElement.properties.color || "#000000"}
								onChange={(e) =>
									handleLocalPropertyChange("color", e.target.value)
								}
							/>
						</div>
					</>
				)}
				<button
					onClick={() => onDeleteElement(selectedElement.id)}
					className="button button-danger delete-element-button"
				>
					Element löschen (Entf)
				</button>
			</div>

			<div className="json-preview-container">
				<h4>Formular JSON (Rohdaten):</h4>
				<pre className="json-preview">{currentFormJson}</pre>
			</div>
		</aside>
	);
};

export default PropertiesPanel;

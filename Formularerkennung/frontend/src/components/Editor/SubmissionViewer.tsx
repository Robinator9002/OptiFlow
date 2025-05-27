// src/components/Viewer/SubmissionViewer.tsx
import React, { useEffect } from "react";
import type { EnrichedSubmission } from "../Forms/StaffReceivedFormsView";
import type { FormElementBase } from "../../api/api";
// import { ToastType } from '../Layout/ToastNotifications'; // Falls Toasts hier benötigt

interface SubmissionViewerProps {
	submission: EnrichedSubmission | null; // Bleibt gleich, enthält jetzt formElements
	// isOpen und onClose entfallen, da es jetzt ein eigener Tab ist
	onCloseViewer: () => void; // Callback, um zum vorherigen Tab zurückzukehren
	// addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const SubmissionViewer: React.FC<SubmissionViewerProps> = ({
	submission,
	onCloseViewer,
	// addToast
}) => {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onCloseViewer();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onCloseViewer]);

	if (!submission) {
		return (
			<div className="submission-viewer-container error-state">
				<p>Keine Einreichung zum Anzeigen ausgewählt.</p>
				<button onClick={onCloseViewer} className="button button-secondary">
					Zurück zur Übersicht
				</button>
			</div>
		);
	}

	// Hilfsfunktion, um den Wert für ein Element zu finden
	const getElementValue = (elementId: string): any => {
		const entry = submission.entries?.find((e) => e.element_id === elementId);
		return entry?.value;
	};

	// Funktion zum Rendern der Formularelemente (ähnlich CustomerFormEditor, aber read-only)
	const renderFormElement = (element: FormElementBase): React.ReactNode => {
		const baseStyle: React.CSSProperties = {
			position: "absolute",
			left: `${element.position.x}px`,
			top: `${element.position.y}px`,
			width: `${element.size.width}px`,
			height: `${element.size.height}px`,
			boxSizing: "border-box",
			fontSize: `${element.properties.fontSize || 16}px`,
			fontWeight: element.properties.fontWeight || "normal",
			fontStyle: element.properties.fontStyle || "normal",
			pointerEvents: "none", // Alle Elemente sind standardmäßig nicht interaktiv
		};

		const textContainerStyle: React.CSSProperties = {
			display: "flex",
			alignItems: element.properties.textAlignVertical || "flex-start",
			justifyContent: element.properties.textAlignHorizontal || "left",
			textAlign: element.properties.textAlignHorizontal || "left",
			padding: "2px",
			width: "100%",
			height: "100%",
			overflow: "hidden",
			whiteSpace: "pre-wrap",
		};

		switch (element.type) {
			case "text":
				return (
					<div style={baseStyle} className="form-view-element form-view-text">
						<div style={textContainerStyle}>
							{element.properties.content || ""}
						</div>
					</div>
				);
			case "input":
				const value = getElementValue(element.id);
				const { labelPosition = "top", textAlignHorizontal } =
					element.properties;
				const inputWrapperStyle: React.CSSProperties = {
					...baseStyle,
					display: "flex",
					padding: "5px",
					pointerEvents: "auto",
				};
				const finalLabelStyle: React.CSSProperties = {
					display: "block",
					whiteSpace: "nowrap",
					flexShrink: 0,
					userSelect: "none",
				};
				// Angepasstes Styling für das Input-Feld, um es wie Text aussehen zu lassen oder als deaktiviertes Feld
				const finalInputFieldStyle: React.CSSProperties = {
					fontSize: "inherit",
					fontWeight: "inherit",
					fontStyle: "inherit",
					padding: "6px 8px",
					borderRadius: "4px",
					textAlign: textAlignHorizontal || "left",
					boxSizing: "border-box",
					width: "100%",
					cursor: "default", // Zeigt an, dass es nicht editierbar ist
				};

				if (labelPosition === "top") {
					inputWrapperStyle.flexDirection = "column";
					inputWrapperStyle.alignItems = "stretch";
					finalLabelStyle.marginBottom = "4px";
				} else if (labelPosition.startsWith("left")) {
					inputWrapperStyle.flexDirection = "row";
					inputWrapperStyle.alignItems =
						labelPosition === "left-center" ? "center" : "flex-start";
					finalLabelStyle.marginRight = "8px";
					finalInputFieldStyle.flexGrow = 1;
				} else if (labelPosition.startsWith("right")) {
					inputWrapperStyle.flexDirection = "row";
					inputWrapperStyle.alignItems =
						labelPosition === "right-center" ? "center" : "flex-start";
					finalLabelStyle.order = 2;
					finalLabelStyle.marginLeft = "8px";
					finalInputFieldStyle.order = 1;
					finalInputFieldStyle.flexGrow = 1;
				}

				return (
					<div
						style={inputWrapperStyle}
						className="form-view-element form-view-input-wrapper"
					>
						{element.properties.label && (
							<label
								style={finalLabelStyle}
								htmlFor={element.id + "-view"}
								className="form-element-label"
							>
								{element.properties.label}
							</label>
						)}
						{/* Verwende ein div oder ein readOnly input, um den Wert anzuzeigen */}
						<input
							id={element.id + "-view"}
							type="text" // Typ ist hier weniger relevant, da readOnly
							value={String(value) || ""} // Stelle sicher, dass es ein String ist
							style={finalInputFieldStyle}
							className="form-element-input-field form-element-input-readonly"
							readOnly
						/>
						{/* Alternative als div:
                        <div style={{...finalInputFieldStyle, padding: "6px 8px", overflow: "auto"}}>
                            {String(value) || <em>(Keine Angabe)</em>}
                        </div>
                        */}
					</div>
				);
			case "image":
				return (
					<div style={baseStyle} className="form-view-element form-view-image">
						<img
							src={
								element.properties.src ||
								"https://placehold.co/100x100/e0e0e0/999999?text=Bild"
							}
							alt={element.properties.alt || "Bild"}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								borderRadius:
									element.properties.imageShape === "circle" ? "50%" : "0px",
							}}
							onError={(e) =>
								(e.currentTarget.src =
									"https://placehold.co/100x100/ff0000/ffffff?text=Ladefehler")
							}
						/>
					</div>
				);
			case "line":
				return (
					<div
						style={{
							...baseStyle,
							backgroundColor: element.properties.color || "#000000",
						}}
						className="form-view-element form-view-line"
					/>
				);
			default:
				return (
					<div
						style={baseStyle}
						className={`form-view-element form-view-unknown form-view-${element.type}`}
					>
						<span style={textContainerStyle}>(Element: {element.type})</span>
					</div>
				);
		}
	};

	// Canvas-Größe (könnte dynamischer sein)
	const canvasWidth = "100%";

	return (
		<div className="submission-viewer-page-container">
			{" "}
			{/* Neuer äußerer Container für die Seite */}
			<div className="submission-viewer-header-bar">
				<h3>
					Ansicht der Einreichung:{" "}
					{submission.formName || "Unbenanntes Formular"}
				</h3>
				<div className="submission-viewer-page-actions">
					<button
						className="button button-secondary button-download"
						onClick={() =>
							alert(
								"Download-Funktion (PDF/DOCX) ist noch nicht implementiert."
							)
						}
						title="Formulardaten als Datei herunterladen"
					>
						Herunterladen (PDF/DOCX)
					</button>
					<button className="button button-primary" onClick={onCloseViewer}>
						Zurück zur Übersicht
					</button>
				</div>
			</div>
			<div className="submission-viewer-content-area">
				<aside className="submission-viewer-sidebar-details">
					<h4>Details zur Einreichung</h4>
					<div className="sidebar-submission-info">
						<p>
							<strong>Kunde:</strong> {submission.submittedByUsername || "N/A"}
						</p>
						<p>
							<strong>Template Version:</strong>{" "}
							{submission.formVersion || "N/A"}
						</p>
						<p>
							<strong>Eingereicht am:</strong>{" "}
							{new Date(submission.submitted_at).toLocaleString("de-DE", {
								dateStyle: "medium",
								timeStyle: "short",
							})}
						</p>
						<p>
							<strong>Einreichungs-ID:</strong>{" "}
							<span className="submission-id-value" title={submission.id}>
								{submission.id.substring(0, 12)}...
							</span>
						</p>
						<p>
							<strong>Template-ID:</strong>{" "}
							<span
								className="submission-id-value"
								title={submission.form_template_id}
							>
								{submission.form_template_id.substring(0, 12)}...
							</span>
						</p>
					</div>
				</aside>
				<main className="submission-viewer-canvas-main">
					<div
						className="submission-form-canvas-display"
						style={{
							position: "relative",
							width: canvasWidth,
							margin: "0", // Kein extra Margin hier
							borderRadius: "var(--border-radius-md, 4px)",
							boxShadow: "var(--box-shadow-sm, 0 1px 3px rgba(0,0,0,0.1))",
						}}
					>
						{submission.formElements && submission.formElements.length > 0 ? (
							submission.formElements.map((element) => (
								<React.Fragment key={element.id}>
									{renderFormElement(element)}
								</React.Fragment>
							))
						) : (
							<p>
								Das Layout des Originalformulars konnte nicht geladen werden.
							</p>
						)}
					</div>
				</main>
			</div>
		</div>
	);
};

export default SubmissionViewer;

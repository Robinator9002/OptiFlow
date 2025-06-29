// src/components/Editor/CanvasArea.tsx
import React from "react";
// Annahme: ExtendedFormElement und SnapLine werden von FormEditorContainer exportiert und hier importiert
// oder sind hier/global definiert. Für dieses Beispiel:
export interface ExtendedFormElement {
	// Minimaldefinition für dieses Beispiel
	id: string;
	type: string;
	position: { x: number; y: number };
	size: { width: number; height: number };
	properties: { [key: string]: any; label?: string; content?: string };
}
export interface SnapLine {
	type: "vertical" | "horizontal";
	position: number;
	isCenter?: boolean;
}
export type ResizeHandleType =
	| "nw"
	| "ne"
	| "sw"
	| "se"
	| "n"
	| "s"
	| "e"
	| "w";

interface CanvasAreaProps {
	elements: ExtendedFormElement[];
	selectedElementId: string | null;
	snapLines: SnapLine[];
	// Akzeptiere, dass die Ref 'null' sein kann
	canvasRef: React.RefObject<HTMLDivElement | null>;
	onDragOverCanvas: (event: React.DragEvent<HTMLDivElement>) => void;
	onDropOnCanvas: (event: React.DragEvent<HTMLDivElement>) => void;
	onElementMouseDown: (
		event: React.MouseEvent<HTMLDivElement>,
		elementId: string
	) => void;
	onResizeHandleMouseDown: (
		event: React.MouseEvent<HTMLDivElement>,
		elementId: string,
		handle: ResizeHandleType
	) => void;
	onCanvasClick: () => void;
	renderElementDisplay: (element: ExtendedFormElement) => React.ReactNode;
}

const resizeHandles: ResizeHandleType[] = [
	"nw",
	"ne",
	"sw",
	"se",
	"n",
	"s",
	"e",
	"w",
];

const CanvasAreaComponent: React.FC<CanvasAreaProps> = ({
	elements,
	selectedElementId,
	snapLines,
	canvasRef, // Wird jetzt korrekt als potenziell null akzeptiert
	onDragOverCanvas,
	onDropOnCanvas,
	onElementMouseDown,
	onResizeHandleMouseDown,
	onCanvasClick,
	renderElementDisplay,
}) => {
	return (
		<section
			ref={canvasRef} // Hier wird die Ref an das DOM-Element gebunden
			className="canvas-area"
			onDragOver={onDragOverCanvas}
			onDrop={onDropOnCanvas}
			onClick={onCanvasClick}
			role="application"
			aria-label="Formular Arbeitsfläche"
		>
			{elements.length === 0 && (
				<div className="canvas-area-placeholder">
					Ziehen Sie Elemente aus der Palette hierher.
				</div>
			)}
			{snapLines.map((line, index) => (
				<div
					key={`snap-${index}`}
					className={`snap-line ${line.type} ${
						line.isCenter ? "center-snap" : ""
					}`}
					style={
						line.type === "vertical"
							? { left: line.position }
							: { top: line.position }
					}
					aria-hidden="true"
				/>
			))}

			{elements.map((element) => (
				<div
					key={element.id}
					className={`form-element ${
						selectedElementId === element.id ? "selected" : ""
					}`}
					style={{
						left: `${element.position.x}px`,
						top: `${element.position.y}px`,
						width: `${element.size.width}px`,
						height: `${element.size.height}px`,
						backgroundColor: "transparent"}}
					onMouseDown={(e) => onElementMouseDown(e, element.id)}
					onClick={(e) => e.stopPropagation()}
					tabIndex={0}
					aria-label={`Formularelement ${element.type} ${
						element.properties.label || element.properties.content || ""
					}`}
				>
					{renderElementDisplay(element)}
					{selectedElementId === element.id && (
						<>
							{resizeHandles.map((handle) => (
								<div
									key={handle}
									className={`resize-handle resize-handle-${handle}`}
									onMouseDown={(e) =>
										onResizeHandleMouseDown(e, element.id, handle)
									}
									aria-label={`Größe ändern ${handle}`}
								/>
							))}
						</>
					)}
				</div>
			))}
		</section>
	);
};

export default CanvasAreaComponent;

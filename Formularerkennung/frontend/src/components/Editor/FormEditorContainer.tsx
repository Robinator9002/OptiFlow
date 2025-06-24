// src/components/Editor/FormEditorContainer.tsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import * as api from "../../api/api";
import type {
	FormPublic,
	FormCreate,
	FormUpdate,
	FormElementBase as ApiFormElementBase,
} from "../../api/api";

import PaletteComponent from "./Palette";
import type { PaletteItemData } from "./Palette";
import CanvasAreaComponent from "./CanvasArea";
import PropertiesPanelComponent from "./PropertiesPanel";
import SaveFormModal from "../Modals/SaveFormModal";

// CSS wird global importiert

const generateElementId = (): string =>
	`el_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

const SNAP_THRESHOLD = 10;
const MIN_ELEMENT_SIZE = 20;
const PASTE_OFFSET = 20;

export type LabelPosition =
	| "top"
	| "left-top"
	| "left-center"
	| "right-top"
	| "right-center";

export interface ExtendedFormElement
	extends Omit<ApiFormElementBase, "position" | "size"> {
	id: string;
	type: string;
	position: { x: number; y: number };
	size: { width: number; height: number };
	properties: {
		content?: string;
		fontSize?: number; // Schriftgröße für Text-Element oder Input-Feld-Text
		fontWeight?: "normal" | "bold";
		fontStyle?: "normal" | "italic";
		textAlignHorizontal?: "left" | "center" | "right";
		textAlignVertical?: "flex-start" | "center" | "flex-end";
		label?: string;
		placeholder?: string;
		labelPosition?: LabelPosition;
		labelTextSize?: number; //  Schriftgröße für das Label von Input-Feldern
		src?: string;
		alt?: string;
		imageShape?: "rectangle" | "circle";
		orientation?: "horizontal" | "vertical";
		thickness?: number;
		color?: string;
		[key: string]: any;
	};
}

interface EditorFormState
	extends Omit<
		FormPublic,
		"elements" | "id" | "created_at" | "updated_at" | "created_by_id"
	> {
	id?: string;
	elements: ExtendedFormElement[];
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

const paletteItems: PaletteItemData[] = [
	{
		type: "text",
		label: "Textfeld",
		defaultProperties: {
			content: "Neuer Text",
			fontSize: 16,
			fontWeight: "normal",
			fontStyle: "normal",
			textAlignHorizontal: "left",
			textAlignVertical: "flex-start",
		},
		defaultSize: { width: 150, height: 50 },
	},
	{
		type: "input",
		label: "Eingabefeld",
		defaultProperties: {
			label: "Label",
			placeholder: "Platzhalter",
			fontSize: 16, // Schriftgröße des Input-Textes
			labelTextSize: 14, //  Standard Schriftgröße für das Label
			labelPosition: "top",
			textAlignHorizontal: "left", // Textausrichtung im Input-Feld
		},
		defaultSize: { width: 200, height: 75 }, // Höhe ggf. anpassen, wenn Label größer wird
	},
	{
		type: "image",
		label: "Bild",
		defaultProperties: {
			src: "https://placehold.co/100x100/e0e0e0/999999?text=Bild",
			alt: "Platzhalterbild",
			imageShape: "rectangle",
		},
		defaultSize: { width: 100, height: 100 },
	},
	{
		type: "line",
		label: "Linie",
		defaultProperties: {
			orientation: "horizontal",
			thickness: 2,
			color: "var(--text-color-primary)",
		},
		defaultSize: { width: 150, height: 2 },
	},
];

const createInitialEditorFormState = (
	existingForm?: FormPublic | null
): EditorFormState => {
	const mapApiElementToEditorElement = (
		el: ApiFormElementBase,
		isTemplate: boolean
	): ExtendedFormElement => ({
		...el,
		id: isTemplate ? generateElementId() : el.id,
		position:
			el.position &&
			typeof el.position.x === "number" &&
			typeof el.position.y === "number"
				? { x: el.position.x, y: el.position.y }
				: { x: 0, y: 0 },
		size:
			el.size &&
			typeof el.size.width === "number" &&
			typeof el.size.height === "number"
				? { width: el.size.width, height: el.size.height }
				: { width: 100, height: 50 },
		properties: {
			// Standardwerte für alle Elemente, falls nicht vorhanden
			textAlignHorizontal: el.properties.textAlignHorizontal || "left",
			textAlignVertical: el.properties.textAlignVertical || "flex-start",
			fontSize: el.properties.fontSize || 16, // Gilt für Text-Element und Input-Feld-Text
			fontWeight: el.properties.fontWeight || "normal",
			fontStyle: el.properties.fontStyle || "normal",
			// Input-spezifische Defaults
			labelPosition: el.properties.labelPosition || "top",
			labelTextSize: el.properties.labelTextSize || 14, //  Default für LabelTextSize
			// Image-spezifische Defaults
			imageShape: el.properties.imageShape || "rectangle",
			// Line-spezifische Defaults
			// ... (falls nötig)
			...el.properties, // Überschreibe Defaults mit existierenden Werten
		},
	});

	if (existingForm && existingForm.id) {
		return {
			id: existingForm.id,
			name: existingForm.name,
			description: existingForm.description,
			version: existingForm.version,
			elements: ((existingForm.elements as ApiFormElementBase[]) || []).map(
				(el) => mapApiElementToEditorElement(el, false)
			),
			assigned_to_user_ids: Array.isArray(existingForm.assigned_to_user_ids)
				? existingForm.assigned_to_user_ids
				: [],
		};
	} else if (existingForm && !existingForm.id) {
		return {
			name: existingForm.name || "Unbenanntes Formular",
			description: existingForm.description || "",
			version: 1,
			elements: ((existingForm.elements as ApiFormElementBase[]) || []).map(
				(el) => mapApiElementToEditorElement(el, true)
			),
			assigned_to_user_ids: [],
		};
	} else {
		return {
			name: "Unbenanntes Formular",
			description: "",
			version: 1,
			elements: [],
			assigned_to_user_ids: [],
		};
	}
};

type InteractionMode =
	| null
	| { type: "dragging"; elementId: string; offsetX: number; offsetY: number }
	| {
			type: "resizing";
			elementId: string;
			handle: ResizeHandleType;
			startX: number;
			startY: number;
			initialWidth: number;
			initialHeight: number;
			initialX: number;
			initialY: number;
	  };

type ShowConfirmModalFn = (config: {
	title?: string;
	message: string;
	onConfirm: () => void;
	onCancel?: () => void;
	confirmText?: string;
	cancelText?: string;
	isDanger?: boolean;
}) => void;
type AddToastFn = (
	message: string,
	type?: "success" | "error" | "info" | "warning",
	duration?: number
) => void;

interface FormEditorContainerProps {
	initialForm: FormPublic | null;
	onFormSaved: (message: string, savedForm?: FormPublic) => void;
	onEditorClosed: () => void;
	showConfirmModal: ShowConfirmModalFn;
	addToast: AddToastFn;
}

const FormEditorContainer: React.FC<FormEditorContainerProps> = ({
	initialForm,
	onFormSaved,
	onEditorClosed,
	showConfirmModal,
	addToast,
}) => {
	const [currentEditorForm, setCurrentEditorForm] = useState<EditorFormState>(
		() => createInitialEditorFormState(initialForm)
	);
	const [selectedElementId, setSelectedElementId] = useState<string | null>(
		null
	);
	const [interactionMode, setInteractionMode] = useState<InteractionMode>(null);
	const [snapLinesVisual, setSnapLinesVisual] = useState<SnapLine[]>([]);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [editorError, setEditorError] = useState<string | null>(null);
	const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
	const [clipboard, setClipboard] = useState<ExtendedFormElement | null>(null);

	const canvasRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		setCurrentEditorForm(createInitialEditorFormState(initialForm));
		setSelectedElementId(null);
		setEditorError(null);
		setClipboard(null);
	}, [initialForm]);

	const getElements = useCallback(
		(): ExtendedFormElement[] => currentEditorForm.elements,
		[currentEditorForm.elements]
	);

	const handleDeleteElement = useCallback(
		(elementId: string) => {
			const elementToDelete = currentEditorForm.elements.find(
				(el) => el.id === elementId
			);
			showConfirmModal({
				title: "Element löschen",
				message: `Möchten Sie das Element "${
					elementToDelete?.type || "dieses Element"
				}" wirklich löschen?`,
				confirmText: "Löschen",
				cancelText: "Abbrechen",
				isDanger: true,
				onConfirm: () => {
					setCurrentEditorForm((prevForm) => ({
						...prevForm,
						elements: prevForm.elements.filter((el) => el.id !== elementId),
					}));
					if (selectedElementId === elementId) setSelectedElementId(null);
					addToast(
						`Element "${elementToDelete?.type || ""}" gelöscht.`,
						"info"
					);
				},
			});
		},
		[selectedElementId, currentEditorForm.elements, showConfirmModal, addToast]
	);

	const handleCopySelectedElement = useCallback(() => {
		if (!selectedElementId) {
			addToast("Kein Element zum Kopieren ausgewählt.", "warning");
			return;
		}
		const elementToCopy = currentEditorForm.elements.find(
			(el) => el.id === selectedElementId
		);
		if (elementToCopy) {
			setClipboard(JSON.parse(JSON.stringify(elementToCopy)));
			addToast(
				`Element "${elementToCopy.type}" in Zwischenablage kopiert.`,
				"info"
			);
		}
	}, [selectedElementId, currentEditorForm.elements, addToast]);

	const handlePasteElement = useCallback(() => {
		if (!clipboard || !canvasRef.current) {
			if (!clipboard) addToast("Zwischenablage ist leer.", "warning");
			return;
		}
		const newElement: ExtendedFormElement = {
			...JSON.parse(JSON.stringify(clipboard)),
			id: generateElementId(),
			position: {
				x: Math.max(0, clipboard.position.x + PASTE_OFFSET),
				y: Math.max(0, clipboard.position.y + PASTE_OFFSET),
			},
		};
		const canvasWidth = canvasRef.current.offsetWidth;
		const canvasHeight = canvasRef.current.offsetHeight;
		newElement.position.x = Math.min(
			newElement.position.x,
			canvasWidth - newElement.size.width
		);
		newElement.position.y = Math.min(
			newElement.position.y,
			canvasHeight - newElement.size.height
		);
		setCurrentEditorForm((prevForm) => ({
			...prevForm,
			elements: [...prevForm.elements, newElement],
		}));
		setSelectedElementId(newElement.id);
		addToast(`Element "${newElement.type}" eingefügt.`, "info");
	}, [clipboard, addToast]);

	const handlePropertyChange = useCallback(
		(elementId: string, propertyPath: string, value: any) => {
			setCurrentEditorForm((prevForm) => ({
				...prevForm,
				elements: prevForm.elements.map((el) => {
					if (el.id === elementId) {
						const newProperties = { ...el.properties, [propertyPath]: value };
						const newSize = { ...el.size };
						if (el.type === "line" && propertyPath === "thickness") {
							const newThickness = Number(value) || 1;
							if (newProperties.orientation === "horizontal")
								newSize.height = newThickness;
							else newSize.width = newThickness;
						}
						if (el.type === "line" && propertyPath === "orientation") {
							const oldThickness = newProperties.thickness || 2;
							const oldW = el.size.width;
							const oldH = el.size.height;
							if (value === "horizontal") {
								newSize.height = oldThickness;
								newSize.width = Math.max(MIN_ELEMENT_SIZE, oldH);
							} else {
								newSize.width = oldThickness;
								newSize.height = Math.max(MIN_ELEMENT_SIZE, oldW);
							}
						}
						return { ...el, properties: newProperties, size: newSize };
					}
					return el;
				}),
			}));
		},
		[]
	);

	const handleDragStartPaletteItem = (
		event: React.DragEvent<HTMLDivElement>,
		item: PaletteItemData
	) => {
		event.dataTransfer.setData("application/json", JSON.stringify(item));
		event.dataTransfer.effectAllowed = "copy";
	};
	const handleDragOverCanvas = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
	};
	const handleDropOnCanvas = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setSnapLinesVisual([]);
		if (!canvasRef.current) return;
		try {
			const item = JSON.parse(
				event.dataTransfer.getData("application/json")
			) as PaletteItemData;
			const canvasRect = canvasRef.current.getBoundingClientRect();
			const mouseX = event.clientX - canvasRect.left;
			const mouseY = event.clientY - canvasRect.top;
			let finalX = mouseX - item.defaultSize.width / 2;
			let finalY = mouseY - item.defaultSize.height / 2;
			const canvasWidth = canvasRef.current.offsetWidth;
			const canvasHeight = canvasRef.current.offsetHeight;

			finalX = Math.max(
				0,
				Math.min(finalX, canvasWidth - item.defaultSize.width)
			);
			finalY = Math.max(
				0,
				Math.min(finalY, canvasHeight - item.defaultSize.height)
			);
			const newElement: ExtendedFormElement = {
				id: generateElementId(),
				type: item.type,
				position: { x: finalX, y: finalY },
				properties: { ...item.defaultProperties },
				size: { ...item.defaultSize },
			};
			if (newElement.type === "line") {
				const thickness = newElement.properties.thickness || 1;
				if (newElement.properties.orientation === "horizontal")
					newElement.size.height = thickness;
				else newElement.size.width = thickness;
			}
			setCurrentEditorForm((prev) => ({
				...prev,
				elements: [...prev.elements, newElement],
			}));
			setSelectedElementId(newElement.id);
			addToast(`Element "${item.label}" hinzugefügt.`, "info");
		} catch (e: any) {
			addToast("Fehler beim Hinzufügen des Elements: " + e.message, "error");
		}
	};

	const handleElementMouseDown = (
		event: React.MouseEvent<HTMLDivElement>,
		elementId: string
	) => {
		event.stopPropagation();
		setSelectedElementId(elementId);
		const elRect = event.currentTarget.getBoundingClientRect();
		const canvasRect = canvasRef.current?.getBoundingClientRect();
		if (!canvasRect) return;
		setInteractionMode({
			type: "dragging",
			elementId,
			offsetX: event.clientX - elRect.left,
			offsetY: event.clientY - elRect.top,
		});
	};
	const handleResizeHandleMouseDown = (
		event: React.MouseEvent<HTMLDivElement>,
		elementId: string,
		handle: ResizeHandleType
	) => {
		event.stopPropagation();
		event.preventDefault();
		const element = getElements().find((el) => el.id === elementId);
		const canvasRect = canvasRef.current?.getBoundingClientRect();
		if (!element || !canvasRect) return;
		setInteractionMode({
			type: "resizing",
			elementId,
			handle,
			startX: event.clientX - canvasRect.left,
			startY: event.clientY - canvasRect.top,
			initialWidth: element.size.width,
			initialHeight: element.size.height,
			initialX: element.position.x,
			initialY: element.position.y,
		});
	};

	const handleClearCanvas = () => {
		showConfirmModal({
			title: "Arbeitsfläche leeren",
			message:
				"Möchten Sie wirklich alle Elemente von der Arbeitsfläche entfernen? Nicht gespeicherte Änderungen gehen verloren.",
			confirmText: "Leeren",
			isDanger: true,
			onConfirm: () => {
				setCurrentEditorForm((prev) => ({
					...prev,
					elements: [],
				}));
				setSelectedElementId(null);
				setEditorError(null);
				addToast("Arbeitsfläche geleert.", "info");
			},
		});
	};

	const handleOpenSaveModal = () => setIsSaveModalOpen(true);
	const handleCloseSaveModal = () => setIsSaveModalOpen(false);
	const handleActualSaveForm = async (details: {
		name: string;
		description?: string;
		version: number;
	}) => {
		setIsLoading(true);
		setEditorError(null);
		handleCloseSaveModal();
		const formPayload: FormCreate | FormUpdate = {
			name: details.name,
			description: details.description,
			version: details.version,
			elements: currentEditorForm.elements.map((el) => ({
				id: el.id,
				type: el.type,
				position: el.position,
				size: el.size,
				properties: el.properties,
			})),
		};
		try {
			let savedForm: FormPublic;
			if (currentEditorForm.id) {
				savedForm = await api.updateForm(
					currentEditorForm.id,
					formPayload as FormUpdate
				);
				onFormSaved(
					`Formular "${savedForm.name}" erfolgreich aktualisiert.`,
					savedForm
				);
			} else {
				savedForm = await api.createForm(formPayload as FormCreate);
				onFormSaved(
					`Formular "${savedForm.name}" erfolgreich erstellt.`,
					savedForm
				);
			}
			setCurrentEditorForm(createInitialEditorFormState(savedForm));
		} catch (e: any) {
			addToast("Fehler beim Speichern des Formulars: " + e.message, "error");
			setEditorError("Fehler beim Speichern: " + e.message);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const targetNodeName = (event.target as HTMLElement)?.nodeName;
			if (
				targetNodeName === "INPUT" ||
				targetNodeName === "TEXTAREA" ||
				targetNodeName === "SELECT"
			)
				return;

			if (
				(event.key === "Delete" || event.key === "Backspace") &&
				selectedElementId
			) {
				event.preventDefault();
				handleDeleteElement(selectedElementId);
			} else if (
				(event.ctrlKey || event.metaKey) &&
				(event.key === "c" || event.key === "C")
			) {
				event.preventDefault();
				handleCopySelectedElement();
			} else if (
				(event.ctrlKey || event.metaKey) &&
				(event.key === "v" || event.key === "V")
			) {
				event.preventDefault();
				handlePasteElement();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [
		selectedElementId,
		handleDeleteElement,
		handleCopySelectedElement,
		handlePasteElement,
	]);

	useEffect(() => {
		const handleGlobalMouseMove = (event: MouseEvent) => {
			if (!interactionMode || !canvasRef.current) return;
			const canvasRect = canvasRef.current.getBoundingClientRect();
			const mouseX = event.clientX - canvasRect.left;
			const mouseY = event.clientY - canvasRect.top;
			let activeSnapLines: SnapLine[] = [];
			const otherElements = getElements().filter(
				(el) => el.id !== interactionMode.elementId
			);
			const canvasWidth = canvasRef.current.offsetWidth;
			const canvasHeight = canvasRef.current.offsetHeight;

			if (interactionMode.type === "dragging") {
				const { elementId, offsetX, offsetY } = interactionMode;
				const draggedElement = getElements().find((el) => el.id === elementId);
				if (!draggedElement) return;
				let newX = mouseX - offsetX;
				let newY = mouseY - offsetY;
				const elHalfWidth = draggedElement.size.width / 2;
				const elHalfHeight = draggedElement.size.height / 2;
				const snapTargetsX = [{ pos: canvasWidth / 2, isCenter: true }];
				const snapTargetsY = [{ pos: canvasHeight / 2, isCenter: true }];
				otherElements.forEach((other) => {
					snapTargetsX.push(
						{ pos: other.position.x, isCenter: false },
						{ pos: other.position.x + other.size.width / 2, isCenter: true },
						{ pos: other.position.x + other.size.width, isCenter: false }
					);
					snapTargetsY.push(
						{ pos: other.position.y, isCenter: false },
						{ pos: other.position.y + other.size.height / 2, isCenter: true },
						{ pos: other.position.y + other.size.height, isCenter: false }
					);
				});
				for (const target of snapTargetsX) {
					if (Math.abs(newX - target.pos) < SNAP_THRESHOLD) {
						newX = target.pos;
						activeSnapLines.push({
							type: "vertical",
							position: target.pos,
							isCenter: target.isCenter,
						});
						break;
					}
					if (Math.abs(newX + elHalfWidth - target.pos) < SNAP_THRESHOLD) {
						newX = target.pos - elHalfWidth;
						activeSnapLines.push({
							type: "vertical",
							position: target.pos,
							isCenter: target.isCenter,
						});
						break;
					}
					if (
						Math.abs(newX + draggedElement.size.width - target.pos) <
						SNAP_THRESHOLD
					) {
						newX = target.pos - draggedElement.size.width;
						activeSnapLines.push({
							type: "vertical",
							position: target.pos,
							isCenter: target.isCenter,
						});
						break;
					}
				}
				for (const target of snapTargetsY) {
					if (Math.abs(newY - target.pos) < SNAP_THRESHOLD) {
						newY = target.pos;
						activeSnapLines.push({
							type: "horizontal",
							position: target.pos,
							isCenter: target.isCenter,
						});
						break;
					}
					if (Math.abs(newY + elHalfHeight - target.pos) < SNAP_THRESHOLD) {
						newY = target.pos - elHalfHeight;
						activeSnapLines.push({
							type: "horizontal",
							position: target.pos,
							isCenter: target.isCenter,
						});
						break;
					}
					if (
						Math.abs(newY + draggedElement.size.height - target.pos) <
						SNAP_THRESHOLD
					) {
						newY = target.pos - draggedElement.size.height;
						activeSnapLines.push({
							type: "horizontal",
							position: target.pos,
							isCenter: target.isCenter,
						});
						break;
					}
				}
				newX = Math.max(
					0,
					Math.min(newX, canvasWidth - draggedElement.size.width)
				);
				newY = Math.max(
					0,
					Math.min(newY, canvasHeight - draggedElement.size.height)
				);
				setSnapLinesVisual(activeSnapLines);
				setCurrentEditorForm((prev) => ({
					...prev,
					elements: prev.elements.map((el) =>
						el.id === elementId ? { ...el, position: { x: newX, y: newY } } : el
					),
				}));
			} else if (interactionMode.type === "resizing") {
				const {
					elementId,
					handle,
					startX,
					startY,
					initialWidth,
					initialHeight,
					initialX,
					initialY,
				} = interactionMode;
				let newX = initialX;
				let newY = initialY;
				let newWidth = initialWidth;
				let newHeight = initialHeight;
				const deltaX = mouseX - startX;
				const deltaY = mouseY - startY;
				if (handle.includes("e")) newWidth = initialWidth + deltaX;
				if (handle.includes("w")) {
					newWidth = initialWidth - deltaX;
					newX = initialX + deltaX;
				}
				if (handle.includes("s")) newHeight = initialHeight + deltaY;
				if (handle.includes("n")) {
					newHeight = initialHeight - deltaY;
					newY = initialY + deltaY;
				}
				const snapTargetsX = [0, canvasWidth / 2, canvasWidth];
				const snapTargetsY = [0, canvasHeight / 2, canvasHeight];
				otherElements.forEach((other) => {
					snapTargetsX.push(
						other.position.x,
						other.position.x + other.size.width,
						other.position.x + other.size.width / 2
					);
					snapTargetsY.push(
						other.position.y,
						other.position.y + other.size.height,
						other.position.y + other.size.height / 2
					);
				});
				if (handle.includes("e")) {
					const targetRight = newX + newWidth;
					for (const target of snapTargetsX) {
						if (Math.abs(targetRight - target) < SNAP_THRESHOLD) {
							newWidth = target - newX;
							activeSnapLines.push({ type: "vertical", position: target });
							break;
						}
					}
				}
				if (handle.includes("w")) {
					for (const target of snapTargetsX) {
						if (Math.abs(newX - target) < SNAP_THRESHOLD) {
							const diff = newX - target;
							newX = target;
							newWidth += diff;
							activeSnapLines.push({ type: "vertical", position: target });
							break;
						}
					}
				}
				if (handle.includes("s")) {
					const targetBottom = newY + newHeight;
					for (const target of snapTargetsY) {
						if (Math.abs(targetBottom - target) < SNAP_THRESHOLD) {
							newHeight = target - newY;
							activeSnapLines.push({ type: "horizontal", position: target });
							break;
						}
					}
				}
				if (handle.includes("n")) {
					for (const target of snapTargetsY) {
						if (Math.abs(newY - target) < SNAP_THRESHOLD) {
							const diff = newY - target;
							newY = target;
							newHeight += diff;
							activeSnapLines.push({ type: "horizontal", position: target });
							break;
						}
					}
				}
				if (newWidth < MIN_ELEMENT_SIZE) {
					if (handle.includes("w")) newX -= MIN_ELEMENT_SIZE - newWidth;
					newWidth = MIN_ELEMENT_SIZE;
				}
				if (newHeight < MIN_ELEMENT_SIZE) {
					if (handle.includes("n")) newY -= MIN_ELEMENT_SIZE - newHeight;
					newHeight = MIN_ELEMENT_SIZE;
				}
				newX = Math.max(0, newX);
				newY = Math.max(0, newY);
				if (newX + newWidth > canvasWidth) {
					if (handle.includes("w")) newX = canvasWidth - newWidth;
					else newWidth = canvasWidth - newX;
				}
				if (newY + newHeight > canvasHeight) {
					if (handle.includes("n")) newY = canvasHeight - newHeight;
					else newHeight = canvasHeight - newY;
				}
				const currentElement = getElements().find((el) => el.id === elementId);
				if (currentElement?.type === "line") {
					if (currentElement.properties.orientation === "horizontal")
						newHeight = Math.max(1, newHeight);
					else newWidth = Math.max(1, newWidth);
				}
				setSnapLinesVisual(activeSnapLines);
				setCurrentEditorForm((prev) => ({
					...prev,
					elements: prev.elements.map((el) =>
						el.id === elementId
							? {
									...el,
									position: { x: newX, y: newY },
									size: { width: newWidth, height: newHeight },
							  }
							: el
					),
				}));
			}
		};
		const handleGlobalMouseUp = () => {
			if (interactionMode?.type === "resizing" && interactionMode.elementId) {
				const element = getElements().find(
					(el) => el.id === interactionMode.elementId
				);
				if (element?.type === "line") {
					handlePropertyChange(
						interactionMode.elementId,
						"thickness",
						element.properties.orientation === "horizontal"
							? element.size.height
							: element.size.width
					);
				}
			}
			setInteractionMode(null);
			setSnapLinesVisual([]);
		};
		if (interactionMode) {
			document.addEventListener("mousemove", handleGlobalMouseMove);
			document.addEventListener("mouseup", handleGlobalMouseUp);
		}
		return () => {
			document.removeEventListener("mousemove", handleGlobalMouseMove);
			document.removeEventListener("mouseup", handleGlobalMouseUp);
		};
	}, [interactionMode, currentEditorForm.elements, handlePropertyChange]);

	const renderElementDisplay = (
		element: ExtendedFormElement
	): React.ReactNode => {
		const baseStyle: React.CSSProperties = {
			fontSize: `${element.properties.fontSize || 16}px`, // Gilt für Text-Element oder Input-Feld-Text
			fontWeight: element.properties.fontWeight || "normal",
			fontStyle: element.properties.fontStyle || "normal",
			pointerEvents:
				interactionMode?.elementId === element.id &&
				interactionMode.type === "dragging"
					? "none"
					: "auto",
			width: "100%",
			height: "100%",
			display: "flex",
			boxSizing: "border-box",
			overflow: "hidden",
			position: "relative",
		};
		const textContainerStyle: React.CSSProperties = {
			width: "100%",
			height: "100%",
			display: "flex",
			alignItems: element.properties.textAlignVertical || "flex-start",
			justifyContent: element.properties.textAlignHorizontal || "left",
			textAlign: element.properties.textAlignHorizontal || "left",
			padding: "2px 5px",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
		};

		switch (element.type) {
			case "text":
				return (
					<div style={{ ...baseStyle, ...textContainerStyle }}>
						{element.properties.content || ""}
					</div>
				);
			case "input":
				const {
					labelPosition = "top",
					textAlignHorizontal,
					labelTextSize,
				} = element.properties; //  labelTextSize hier destrukturieren
				const inputWrapperStyle: React.CSSProperties = { ...baseStyle };
				const finalLabelStyle: React.CSSProperties = {
					display: "block",
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					padding: "0 2px",
					flexShrink: 0,
					fontSize: labelTextSize ? `${labelTextSize}px` : "inherit", //  LabelTextSize anwenden
				};
				const finalInputFieldStyle: React.CSSProperties = {
					// fontSize: 'inherit', // Erbt von baseStyle (element.properties.fontSize)
					fontWeight: "inherit", // Erbt von baseStyle
					fontStyle: "inherit", // Erbt von baseStyle
					padding: "5px",
					border: "1px solid #ccc",
					borderRadius: "3px",
					textAlign: textAlignHorizontal || "left",
					boxSizing: "border-box",
					width: "100%",
					flexGrow: 1,
					minWidth: 0,
				};
				// Die Schriftgröße des Input-Feldes selbst wird über element.properties.fontSize gesteuert (via baseStyle)
				// finalInputFieldStyle.fontSize wird nicht separat gesetzt, es sei denn, es soll *anders* als das Label sein.

				if (labelPosition === "top") {
					inputWrapperStyle.flexDirection = "column";
					inputWrapperStyle.alignItems = "stretch"; // Sorgt dafür, dass Label und Input volle Breite nehmen
					finalLabelStyle.marginBottom = "4px";
					// finalInputFieldStyle.flexGrow = 0; // Nicht nötig, wenn Input volle Breite haben soll
				} else if (
					labelPosition === "left-top" ||
					labelPosition === "left-center"
				) {
					inputWrapperStyle.flexDirection = "row";
					inputWrapperStyle.alignItems =
						labelPosition === "left-top" ? "flex-start" : "center";
					finalLabelStyle.marginRight = "8px";
				} else if (
					labelPosition === "right-top" ||
					labelPosition === "right-center"
				) {
					inputWrapperStyle.flexDirection = "row";
					inputWrapperStyle.alignItems =
						labelPosition === "right-top" ? "flex-start" : "center";
					finalLabelStyle.order = 1; // Label nach rechts
					finalLabelStyle.marginLeft = "8px";
				}
				return (
					<div style={inputWrapperStyle}>
						{element.properties.label && (
							<label className="form-element-label" style={finalLabelStyle}>
								{element.properties.label}
							</label>
						)}
						<input
							type="text"
							placeholder={element.properties.placeholder || ""}
							style={{
								...finalInputFieldStyle,
								fontSize: `${element.properties.fontSize || 16}px`,
							}} // Schriftgröße für Input-Text explizit setzen
							readOnly // Im Editor nicht editierbar
							tabIndex={-1} // Nicht fokussierbar im Editor
						/>
					</div>
				);
			case "image":
				return (
					<img
						src={
							element.properties.src || "https://placehold.co/100x100?text=Bild"
						}
						alt={element.properties.alt || "Bild"}
						style={{
							...baseStyle,
							objectFit: "cover",
							borderRadius:
								element.properties.imageShape === "circle" ? "50%" : "0px",
						}}
						onError={(e) =>
							(e.currentTarget.src =
								"https://placehold.co/100x100/ff0000/ffffff?text=Fehler")
						}
						draggable={false}
					/>
				);
			case "line":
				return (
					<div
						style={{
							...baseStyle,
							backgroundColor: element.properties.color || "#000000",
						}}
					/>
				);
			default:
				return (
					<span style={{ ...baseStyle, ...textContainerStyle, color: "red" }}>
						Unbekannt: {element.type}
					</span>
				);
		}
	};

	return (
		<div className="form-editor-container-shell">
			<div className="form-editor-header">
				<h2>
					{currentEditorForm.id
						? `Formular bearbeiten: ${currentEditorForm.name}`
						: "Neues Formular erstellen"}
				</h2>
				<div className="editor-actions">
					<button
						onClick={handleClearCanvas}
						className="button button-secondary"
						disabled={isLoading}
						title="Alle Elemente von der Arbeitsfläche entfernen"
					>
						Leeren
					</button>
					<button
						onClick={handleOpenSaveModal}
						className="button button-primary"
						disabled={isLoading}
					>
						{isLoading
							? "Speichern..."
							: currentEditorForm.id
							? "Aktualisieren..."
							: "Speichern..."}
					</button>
					<button
						onClick={onEditorClosed}
						className="button"
						style={{ marginLeft: "var(--spacing-md)" }}
						title="Editor schließen und zur Übersicht zurückkehren"
					>
						Editor schließen
					</button>
				</div>
			</div>
			{editorError && (
				<div
					className="error-message-global editor-error-message"
					style={{ margin: "var(--spacing-md)" }}
				>
					<span>{editorError}</span>
					<button
						onClick={() => setEditorError(null)}
						className="button button-small"
						style={{ marginLeft: "10px", padding: "2px 5px" }}
						title="Fehlermeldung schließen"
					>
						OK
					</button>
				</div>
			)}
			<div className="form-editor-main">
				<PaletteComponent
					items={paletteItems}
					onDragStartPaletteItem={handleDragStartPaletteItem}
				/>
				<CanvasAreaComponent
					elements={getElements()}
					selectedElementId={selectedElementId}
					snapLines={snapLinesVisual}
					canvasRef={canvasRef}
					onDragOverCanvas={handleDragOverCanvas}
					onDropOnCanvas={handleDropOnCanvas}
					onElementMouseDown={handleElementMouseDown}
					onResizeHandleMouseDown={handleResizeHandleMouseDown}
					onCanvasClick={() => setSelectedElementId(null)}
					renderElementDisplay={renderElementDisplay}
				/>
				<PropertiesPanelComponent
					selectedElement={
						getElements().find((el) => el.id === selectedElementId) || null
					}
					onPropertyChange={handlePropertyChange}
					onDeleteElement={handleDeleteElement}
					currentFormJson={JSON.stringify(currentEditorForm, null, 2)}
				/>
			</div>
			<SaveFormModal
				isOpen={isSaveModalOpen}
				onClose={handleCloseSaveModal}
				onSave={handleActualSaveForm}
				initialData={{
					name: currentEditorForm.name,
					description: currentEditorForm.description,
					version: currentEditorForm.version,
				}}
				isUpdating={!!currentEditorForm.id}
			/>
		</div>
	);
};
export default FormEditorContainer;

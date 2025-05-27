// src/components/Editor/Palette.tsx
import React from "react";

// Typen müssen hier ggf. importiert oder neu definiert werden, wenn sie nicht global sind
// Für dieses Beispiel nehmen wir an, PaletteItem ist hier bekannt oder wird übergeben
export interface PaletteItemData {
	// Umbenannt, um Konflikt mit React-Komponentennamen zu vermeiden
	type: string;
	label: string;
	defaultProperties: Record<string, any>; // Allgemeiner für Flexibilität
	defaultSize: { width: number; height: number };
}

interface PaletteProps {
	items: PaletteItemData[];
	onDragStartPaletteItem: (
		event: React.DragEvent<HTMLDivElement>,
		item: PaletteItemData
	) => void;
}

const Palette: React.FC<PaletteProps> = ({ items, onDragStartPaletteItem }) => {
	return (
		<aside className="palette">
			<h3>Elemente</h3>
			{items.map((item) => (
				<div
					key={item.type}
					className="palette-item"
					draggable
					onDragStart={(e) => onDragStartPaletteItem(e, item)}
					title={`Element '${item.label}' ziehen`}
				>
					{item.label}
				</div>
			))}
		</aside>
	);
};

export default Palette;

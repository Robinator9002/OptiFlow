import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

// --- Schritt 1: Definiere den radikal-minimalistischen Highlight-Style ---
// Wir erstellen einen Style, der JEDEN erdenklichen Tag auf die Primärfarbe setzt.
const monochromeHighlightStyle = HighlightStyle.define([
    {
        tag: [
            tags.keyword,
            tags.operator,
            tags.className,
            tags.definition(tags.typeName),
            tags.typeName,
            tags.number,
            tags.string,
            tags.meta,
            tags.function(tags.variableName),
            tags.function(tags.propertyName),
            tags.definition(tags.variableName),
            tags.local(tags.variableName),
            tags.special(tags.variableName),
            tags.standard(tags.variableName),
            tags.lineComment,
            tags.blockComment,
            tags.quote,
            tags.escape,
            tags.regexp,
            tags.link,
            tags.heading,
            tags.strong,
            tags.emphasis,
            tags.inserted,
            tags.deleted,
            tags.changed,
            tags.invalid,
            tags.punctuation,
            tags.propertyName,
            tags.bracket,
            tags.tagName,
            tags.attributeName,
            tags.attributeValue,
            tags.angleBracket,
        ],
        color: "var(--text-primary)",
    },
    {
        tag: tags.comment,
        color: "var(--text-primary)",
        fontStyle: "italic", // Eine kleine Ausnahme für die Lesbarkeit von Kommentaren
    },
]);

// --- Schritt 2: Definiere das Theme für den Editor-Rahmen (wie bisher) ---
const editorChromeTheme = EditorView.theme({
    "&": {
        color: "var(--text-primary)",
        backgroundColor: "var(--bg-code)", // Important entfernt, da es nicht mehr nötig ist
        fontFamily: "var(--font-mono)",
        fontSize: "0.95rem !important",
    },
    ".cm-scroller": {
        fontFamily: "var(--font-mono)",
    },
    ".cm-content": {
        caretColor: "var(--accent-primary)",
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: "var(--accent-primary)",
    },
    "&.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "var(--bg-accent)",
        color: "var(--text-on-accent)",
    },
    ".cm-gutters": {
        backgroundColor: "var(--bg-code)",
        color: "var(--text-primary)",
        borderRight: "1px solid var(--border-tertiary)",
    },
    ".cm-activeLine, .cm-gutters .cm-activeLineGutter": {
        backgroundColor: "var(--bg-secondary)",
    },
});

// --- Schritt 3: Kombiniere alles in einem einzigen Export ---
// Dies ist die einzige Konstante, die du importieren musst.
export const monochromeTheme = [
    editorChromeTheme,
    syntaxHighlighting(monochromeHighlightStyle), // Hier wird der Standard-Highlighter ersetzt
];


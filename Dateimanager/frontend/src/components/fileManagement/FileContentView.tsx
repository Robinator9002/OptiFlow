import React, { forwardRef, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

// --- CodeMirror Imports ---
// NOTE: These dependencies would need to be added to your project.
// npm install @uiw/react-codemirror @codemirror/lang-javascript @codemirror/state @codemirror/view
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { monochromeTheme } from "../EditorTheme"; 
// --- Type Imports ---
import type { HighlightPosition } from "./FileSearchPanel";

// --- CodeMirror Decorations for Highlighting ---

// Decoration for the currently active search result
const activeHighlightDecoration = Decoration.mark({
    class: "cm-highlight-active",
});
// Decoration for all other search results
const inactiveHighlightDecoration = Decoration.mark({ class: "cm-highlight" });

// An "Effect" is CodeMirror's way of dispatching changes to its state.
// We define one to update our highlights.
const setHighlightsEffect = StateEffect.define<{
    positions: HighlightPosition[];
    activeIndex: number;
}>();

// A "StateField" holds and computes state for the editor.
// This field will manage our set of highlight decorations.
const highlightStateField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(highlights, tr) {
        // Move decorations along with text changes
        highlights = highlights.map(tr.changes);
        // Look for our specific effect to update the decorations
        for (let e of tr.effects) {
            if (e.is(setHighlightsEffect)) {
                const { positions, activeIndex } = e.value;
                // Create a new set of decorations based on the search results
                highlights = Decoration.set(
                    positions.map((p) => {
                        const deco =
                            p.snippetIndex === activeIndex
                                ? activeHighlightDecoration
                                : inactiveHighlightDecoration;
                        return deco.range(p.start, p.end);
                    })
                );
            }
        }
        return highlights;
    },
    // This provides the decorations to the editor view
    provide: (f) => EditorView.decorations.from(f),
});

// --- Type Definitions for Component Props ---
interface FileContentViewProps {
    isLoading: boolean;
    isEditing: boolean;
    content: string | null;
    highlightPositions: HighlightPosition[];
    activeSnippetIndex: number;
    onContentChange: (value: string) => void;
    onHighlightClick: (snippetIndex: number) => void;
}

/**
 * Renders file content.
 * - In read-only mode, it uses a <pre> tag with <mark> for highlights.
 * - In edit mode, it uses a full-featured CodeMirror editor with decorations
 * for highlighting search results.
 */
const FileContentView = forwardRef<ReactCodeMirrorRef, FileContentViewProps>(
    (
        {
            isLoading,
            isEditing,
            content,
            highlightPositions,
            activeSnippetIndex,
            onContentChange,
            onHighlightClick,
        },
        ref
    ) => {
        const editorViewRef = useRef<EditorView | null>(null);

        // This effect syncs the search results from the parent component
        // with the CodeMirror editor's state.
        useEffect(() => {
            const view = editorViewRef.current;
            if (view && isEditing) {
                // Dispatch effects to update highlights and scroll to the active one.
                const effects: StateEffect<any>[] = [
                    setHighlightsEffect.of({
                        positions: highlightPositions,
                        activeIndex: activeSnippetIndex,
                    }),
                ];

                const activePos = highlightPositions.find(
                    (p) => p.snippetIndex === activeSnippetIndex
                );

                if (activePos) {
                    effects.push(
                        EditorView.scrollIntoView(activePos.start, {
                            y: "center",
                        })
                    );
                }

                view.dispatch({ effects });
            }
        }, [highlightPositions, activeSnippetIndex, isEditing]);

        // 1. Show a spinner while content is loading
        if (isLoading) {
            return (
                <div className="spinner-container">
                    <Loader2 className="animate-spin" size={48} />
                </div>
            );
        }

        // 2. Show a CodeMirror editor for editing
        if (isEditing) {
            return (
                <CodeMirror
                    ref={ref}
                    value={content ?? ""}
                    height="50vh"
                    className="file-editor"
                    extensions={[
                        javascript({ jsx: true }), // Example language support
                        highlightStateField, // Our custom highlighting logic
                        EditorView.lineWrapping, // Enable line wrapping
                        ...monochromeTheme,
                    ]}
                    onChange={onContentChange}
                    onCreateEditor={(view) => {
                        // Keep a reference to the underlying EditorView instance
                        editorViewRef.current = view;
                    }}
                />
            );
        }

        // 3. Show a read-only view with optional highlights (unchanged)
        if (content === null) {
            return null;
        }

        if (highlightPositions.length === 0) {
            return <pre className="file-preview-content">{content}</pre>;
        }

        const parts: (string | React.JSX.Element)[] = [];
        let lastIndex = 0;
        const sortedPositions = [...highlightPositions].sort(
            (a, b) => a.start - b.start
        );

        sortedPositions.forEach((pos, i) => {
            if (pos.start > lastIndex) {
                parts.push(content.substring(lastIndex, pos.start));
            }
            const isSnippetActive = pos.snippetIndex === activeSnippetIndex;
            parts.push(
                <mark
                    key={`${pos.snippetIndex}-${pos.start}-${i}`}
                    className={
                        isSnippetActive
                            ? "full-snippet-highlight active"
                            : "full-snippet-highlight"
                    }
                    onClick={() => onHighlightClick(pos.snippetIndex)}
                >
                    {content.substring(pos.start, pos.end)}
                </mark>
            );
            lastIndex = Math.max(lastIndex, pos.end);
        });

        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        return <pre className="file-preview-content">{parts}</pre>;
    }
);

FileContentView.displayName = "FileContentView";

export default FileContentView;

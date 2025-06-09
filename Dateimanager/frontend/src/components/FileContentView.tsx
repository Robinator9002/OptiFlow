import React, { useEffect } from "react";

// Define the structure for a highlight position object
interface HighlightPosition {
    start: number;
    end: number;
    snippetIndex: number;
}

// Define the props for the FileContentView component
interface FileContentViewProps {
    content: string | null;
    isEditing: boolean;
    highlightPositions: HighlightPosition[];
    activeSnippetIndex: number;
    onContentChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onContentClick: (event: React.MouseEvent<HTMLPreElement>) => void;
    // --- FIX START ---
    // The previous type was too strict. `React.Ref<T>` is a more general type for refs
    // that correctly handles refs created with `useRef<T>(null)`. It accounts for
    // the .current property being `T | null`.
    previewContentRef: React.Ref<HTMLPreElement>;
    // --- FIX END ---
    isLoading: boolean;
}

// Helper function for basic HTML escaping
const escapeHtml = (text: string | null): string => {
    if (typeof text !== "string") {
        console.warn("escapeHtml received non-string input:", text);
        return String(text || "");
    }
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Helper function to compare two Sets
const areSetsEqual = (set1: Set<any>, set2: Set<any>): boolean => {
    if (set1.size !== set2.size) {
        return false;
    }
    for (const item of set1) {
        if (!set2.has(item)) {
            return false;
        }
    }
    return true;
};

// Helper function to generate HTML with highlights based on snippet positions
const generateHighlightedHtml = (
    content: string,
    highlightPositions: HighlightPosition[],
    activeSnippetIndex: number
): string => {
    if (!highlightPositions || highlightPositions.length === 0) {
        return escapeHtml(content);
    }

    const snippetIndicesAtIndex: Set<number>[] = new Array(content.length)
        .fill(null)
        .map(() => new Set());

    highlightPositions.forEach((pos) => {
        const start = Math.max(0, pos.start);
        const end = Math.min(content.length, pos.end);
        for (let i = start; i < end; i++) {
            snippetIndicesAtIndex[i].add(pos.snippetIndex);
        }
    });

    let html = "";
    let isCurrentlyHighlighted = false;
    let currentHighlightSnippetIndices: Set<number> = new Set();

    for (let i = 0; i < content.length; i++) {
        const snippetsHere = snippetIndicesAtIndex[i];
        const shouldBeHighlighted = snippetsHere.size > 0;

        const prevSnippets = i > 0 ? snippetIndicesAtIndex[i - 1] : new Set();
        const snippetSetChanged = !areSetsEqual(snippetsHere, prevSnippets);

        if (
            shouldBeHighlighted &&
            (!isCurrentlyHighlighted || snippetSetChanged)
        ) {
            if (isCurrentlyHighlighted) {
                html += `</mark>`;
            }

            isCurrentlyHighlighted = true;
            currentHighlightSnippetIndices = new Set(snippetsHere);

            const classes = ["highlighted-text"];
            if (
                activeSnippetIndex !== -1 &&
                currentHighlightSnippetIndices.has(activeSnippetIndex)
            ) {
                classes.push("active-highlight");
            }

            const dataAttr =
                currentHighlightSnippetIndices.size > 0
                    ? `data-snippet-indices="${Array.from(
                          currentHighlightSnippetIndices
                      ).join(",")}"`
                    : "";

            html += `<mark class="${classes.join(" ")}" ${dataAttr}>`;
        } else if (!shouldBeHighlighted && isCurrentlyHighlighted) {
            isCurrentlyHighlighted = false;
            html += `</mark>`;
        }

        html += escapeHtml(content[i]);
    }

    if (isCurrentlyHighlighted) {
        html += `</mark>`;
    }

    return html;
};

/**
 * Component to display or edit file content with optional highlighting.
 */
const FileContentView: React.FC<FileContentViewProps> = ({
    content,
    isEditing,
    highlightPositions,
    activeSnippetIndex,
    onContentChange,
    onContentClick,
    previewContentRef,
    isLoading,
}) => {
    const displayedContentHtml =
        isEditing || !content
            ? escapeHtml(content)
            : generateHighlightedHtml(
                  content,
                  highlightPositions,
                  activeSnippetIndex
              );
    // The useEffect hook doesn't need to change, because it already checks
    // for `previewContentRef.current` being truthy.
    useEffect(() => {
        const currentRef = (
            previewContentRef as React.RefObject<HTMLPreElement>
        )?.current;
        if (
            activeSnippetIndex >= 0 &&
            highlightPositions.length > 0 &&
            currentRef
        ) {
            const allMarks = Array.from(
                currentRef.querySelectorAll<HTMLElement>(
                    "mark.highlighted-text"
                )
            );

            allMarks.forEach((mark) =>
                mark.classList.remove("active-highlight")
            );

            const targetMark = allMarks.find((mark) => {
                const indicesAttr = mark.getAttribute("data-snippet-indices");
                if (!indicesAttr) return false;
                const indices = indicesAttr.split(",").map(Number);
                return indices.includes(activeSnippetIndex);
            });

            allMarks.forEach((mark) => {
                const indicesAttr = mark.getAttribute("data-snippet-indices");
                if (indicesAttr) {
                    const indices = indicesAttr.split(",").map(Number);
                    if (indices.includes(activeSnippetIndex)) {
                        mark.classList.add("active-highlight");
                    }
                }
            });

            if (targetMark) {
                targetMark.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
            } else {
                console.warn(
                    "Could not find mark element for activeSnippetIndex:",
                    activeSnippetIndex
                );
            }
        } else if (currentRef) {
            currentRef
                .querySelectorAll(".active-highlight")
                .forEach((mark) => mark.classList.remove("active-highlight"));
        }
    }, [activeSnippetIndex, highlightPositions, previewContentRef]);

    return (
        <div className={`file-content ${isEditing ? "editing" : "previewing"}`}>
            {isLoading ? (
                <div className="spinner-container">
                    <div className="spinner"></div>
                </div>
            ) : isEditing ? (
                <textarea
                    value={content || ""}
                    onChange={onContentChange}
                    spellCheck="false"
                    className="file-editor"
                />
            ) : (
                <pre
                    className="file-preview-content"
                    ref={previewContentRef}
                    dangerouslySetInnerHTML={{ __html: displayedContentHtml }}
                    onClick={onContentClick}
                ></pre>
            )}
        </div>
    );
};

export default FileContentView;

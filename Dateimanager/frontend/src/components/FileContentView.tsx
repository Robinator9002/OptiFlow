import React, { useRef, useEffect } from 'react';

// Helper function for basic HTML escaping
const escapeHtml = (text) => {
    // Ensure text is a string before replacing
    if (typeof text !== 'string') {
        console.warn("escapeHtml received non-string input:", text);
        return String(text);
    }
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

// Helper function to compare two Sets
const areSetsEqual = (set1, set2) => {
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
// This version handles overlapping highlights correctly using a scanline approach.
const generateHighlightedHtml = (content, highlightPositions, activeSnippetIndex) => {
    if (!content) return '';
    if (!highlightPositions || highlightPositions.length === 0) {
        // If no highlights, just escape and return the content
        return escapeHtml(content);
    }

    // Create a map where keys are character indices and values are Sets of snippet indices
    // covering that position.
    const snippetIndicesAtIndex = new Array(content.length).fill(null).map(() => new Set());

    // Populate snippet indices for each character position
    highlightPositions.forEach(pos => {
        // Ensure highlight positions are within content bounds
        const start = Math.max(0, pos.start);
        const end = Math.min(content.length, pos.end);
        for (let i = start; i < end; i++) {
            snippetIndicesAtIndex[i].add(pos.snippetIndex);
        }
    });

    let html = '';
    let isCurrentlyHighlighted = false; // True if *any* snippet covers the current position
    let currentHighlightSnippetIndices = new Set(); // Snippet indices covering the current character

    for (let i = 0; i < content.length; i++) {
        const snippetsHere = snippetIndicesAtIndex[i];
        const shouldBeHighlighted = snippetsHere.size > 0;

        // Check if the set of active snippets has changed from the previous character
        const prevSnippets = i > 0 ? snippetIndicesAtIndex[i - 1] : new Set();
        const snippetSetChanged = !areSetsEqual(snippetsHere, prevSnippets);

        if (shouldBeHighlighted && (!isCurrentlyHighlighted || snippetSetChanged)) {
            // Start of a new highlight block OR the set of covering snippets changed within a highlight
            if (isCurrentlyHighlighted) {
                // Close the previous mark tag if we were highlighting
                html += `</mark>`;
            }

            isCurrentlyHighlighted = true;
            currentHighlightSnippetIndices = new Set(snippetsHere); // Update the set of snippets covering this position

            const classes = ['highlighted-text'];
            // Apply active-highlight class if the active snippet is among the ones covering this position
            if (activeSnippetIndex !== -1 && currentHighlightSnippetIndices.has(activeSnippetIndex)) {
                classes.push('active-highlight');
            }

            // Add data-snippet-indices with all covering snippet indices for click handling.
            const dataAttr = currentHighlightSnippetIndices.size > 0
                ? `data-snippet-indices="${Array.from(currentHighlightSnippetIndices).join(',')}"`
                : '';

            html += `<mark class="${classes.join(' ')}" ${dataAttr}>`;

        } else if (!shouldBeHighlighted && isCurrentlyHighlighted) {
            // End of a highlight block
            isCurrentlyHighlighted = false;
            html += `</mark>`;
        }
        // If shouldBeHighlighted && isCurrentlyHighlighted && !snippetSetChanged, continue with the same tag.

        // Append the current character (escaped)
        html += escapeHtml(content[i]);
    }

    // Close any open mark tag at the end
    if (isCurrentlyHighlighted) {
        html += `</mark>`;
    }

    return html;
};


/**
 * Component to display or edit file content with optional highlighting.
 * Receives content, editing state, highlight positions, and handlers via props.
 */
const FileContentView = ({
    content,
    isEditing,
    highlightPositions,
    activeSnippetIndex, // Receive active snippet index from parent
    onContentChange, // Callback for textarea changes
    onContentClick, // Callback for clicks on the preview content (to detect highlights)
    previewContentRef, // Ref for the preview content element (for scrolling)
    isLoading // Added to show spinner when loading
}) => {

    // Generate the HTML content with highlights for display in the <pre> tag
    // Only generate highlights if not editing
    const displayedContentHtml = isEditing
        ? escapeHtml(content) // Just escape if editing, no highlights
        : generateHighlightedHtml(content, highlightPositions, activeSnippetIndex); // Pass activeSnippetIndex


    // Effect to scroll the active highlight into view
    // This effect remains here as it directly manipulates the content display element (previewContentRef)
    useEffect(() => {
        // Scroll only if a snippet is active and we have highlights
        if (activeSnippetIndex >= 0 && highlightPositions.length > 0 && previewContentRef.current) {

            // Remove active class from previous active marks
            // We need to find marks that *contain* the previously active snippet index
            // This requires parsing the data-snippet-indices attribute.
            // Let's simplify: remove active class from *all* marks first.
            previewContentRef.current.querySelectorAll('.active-highlight')
                .forEach(mark => mark.classList.remove('active-highlight'));


            // Find the mark element(s) corresponding to the active snippet by checking data-snippet-indices
            // We need to find the *first* mark that contains the activeSnippetIndex in its data-snippet-indices.
            let targetMark: HTMLElement | null = null;
            const allMarks = previewContentRef.current.querySelectorAll('mark.highlighted-text');
            for (const mark of allMarks) {
                const indicesAttr = mark.getAttribute('data-snippet-indices');
                if (indicesAttr) {
                    const indices = indicesAttr.split(',').map(Number);
                    if (indices.includes(activeSnippetIndex)) {
                        // Add active class to *all* marks that include the active snippet index
                        mark.classList.add('active-highlight');
                        // For scrolling, let's find the *first* one that includes the active index
                        if (!targetMark) {
                            targetMark = mark;
                        }
                    }
                }
            }

            if (targetMark) {
                // Scroll the specific mark element into view
                targetMark.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center', // Center the element in the viewport
                    inline: 'nearest'
                });
            } else {
                console.warn("Could not find mark element for activeSnippetIndex:", activeSnippetIndex);
            }
        } else if (previewContentRef.current) {
            // If no snippet is active or no highlights, ensure no active highlights remain
            previewContentRef.current.querySelectorAll('.active-highlight')
                .forEach(mark => mark.classList.remove('active-highlight'));
        }
        // Depend on highlightPositions to re-run if highlights change, and the ref element, and activeSnippetIndex
    }, [activeSnippetIndex, highlightPositions, previewContentRef.current]);


    return (
        <div className={`file-content ${isEditing ? 'editing' : 'previewing'}`}>
            {isLoading ? (
                <div className="spinner-container"><div className="spinner"></div></div>
            ) : isEditing ? (
                <textarea
                    value={content}
                    onChange={onContentChange}
                    spellCheck="false" // Disable spell check for code/text files
                    className="file-editor" // Use your editor class
                />
            ) : (
                // Display content in <pre> tag with custom highlighting
                <pre
                    className="file-preview-content"
                    ref={previewContentRef} // Attach the ref passed from the parent
                    dangerouslySetInnerHTML={{ __html: displayedContentHtml }}
                    onClick={onContentClick} // Add click handler to the pre tag, passed from parent
                >
                    {/* Content is set via dangerouslySetInnerHTML */}
                </pre>
            )}
        </div>
    );
};

export default FileContentView;

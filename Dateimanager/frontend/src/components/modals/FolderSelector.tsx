import React, { useState, useEffect, useCallback } from "react";
import { getFileStructure, rescanFileStructure } from "../../api/api.tsx";
import { Folder, FolderOpen, X, RotateCw, Check } from "lucide-react";

// Define the structure for a node in the folder tree
interface TreeNode {
    path: string;
    name: string;
    children?: TreeNode[];
}

// Define props for FolderItem
interface FolderItemProps {
    node: TreeNode;
    onSelectPath: (path: string) => void;
    onPreSelect: (path: string) => void;
    preSelectedPath: string | null;
    level?: number;
}

// Define props for FolderTree
interface FolderTreeProps {
    nodes: TreeNode[];
    onSelectPath: (path: string) => void;
    onPreSelect: (path: string) => void;
    preSelectedPath: string | null;
    level?: number;
}

// Define props for FolderSelector
interface FolderSelectorProps {
    setPath: (path: string) => void;
    onCancel: () => void;
}

// A simple toast placeholder with types
const toast = {
    success: (message: string) => console.log(`Toast Success: ${message}`),
    error: (message: string) => console.error(`Toast Error: ${message}`),
    warn: (message: string) => console.warn(`Toast Warn: ${message}`),
};

const FolderItem: React.FC<FolderItemProps> = React.memo(
    ({ node, onSelectPath, onPreSelect, preSelectedPath, level = 0 }) => {
        const [isOpen, setIsOpen] = useState(false);
        const hasChildren =
            node.children &&
            Array.isArray(node.children) &&
            node.children.length > 0;

        const isPreSelected = preSelectedPath === node.path;

        const handleItemClick = useCallback(
            (e: React.MouseEvent<HTMLDivElement>) => {
                e.stopPropagation();
                onPreSelect(node.path);
                if (hasChildren) {
                    setIsOpen((prev) => !prev);
                }
            },
            [onPreSelect, node.path, hasChildren]
        );

        const indentStyle = { paddingLeft: `${level * 20}px` };

        return (
            <li
                className={`folder-item ${isPreSelected ? "pre-selected" : ""}`}
            >
                <div
                    className="folder-item-content"
                    style={indentStyle}
                    onClick={handleItemClick}
                    onKeyDown={(e) =>
                        e.key === "Enter" && handleItemClick(e as any)
                    } // Allow keyboard activation
                    role="button"
                    tabIndex={0}
                >
                    <span className="folder-item-toggle">
                        {hasChildren ? (
                            isOpen ? (
                                <FolderOpen size={18} />
                            ) : (
                                <Folder size={18} />
                            )
                        ) : (
                            <div
                                style={{ width: "18px", height: "18px" }}
                            ></div>
                        )}
                    </span>
                    <span className="folder-item-name">{node.name}</span>
                </div>
                {isOpen && hasChildren && Array.isArray(node.children) && (
                    <FolderTree
                        nodes={node.children}
                        onSelectPath={onSelectPath}
                        onPreSelect={onPreSelect}
                        preSelectedPath={preSelectedPath}
                        level={level + 1}
                    />
                )}
            </li>
        );
    }
);

const FolderTree: React.FC<FolderTreeProps> = React.memo(
    ({ nodes, onSelectPath, onPreSelect, preSelectedPath, level = 0 }) => {
        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
            return null;
        }
        return (
            <ul
                className={`folder-tree ${
                    level > 0 ? "folder-tree-nested" : ""
                }`}
            >
                {nodes.map((node) =>
                    node && node.path && node.name ? (
                        <FolderItem
                            key={node.path}
                            node={node}
                            onSelectPath={onSelectPath}
                            onPreSelect={onPreSelect}
                            preSelectedPath={preSelectedPath}
                            level={level}
                        />
                    ) : (
                        (console.warn(
                            "Skipping invalid node in FolderTree:",
                            node
                        ),
                        null)
                    )
                )}
            </ul>
        );
    }
);

export const FolderSelector: React.FC<FolderSelectorProps> = React.memo(
    ({ setPath, onCancel }) => {
        const [treeData, setTreeData] = useState<TreeNode[]>([]);
        const [loading, setLoading] = useState<boolean>(true);
        const [error, setError] = useState<string | null>(null);
        const [preSelectedPath, setPreSelectedPath] = useState<string | null>(
            null
        );

        const fetchTree = useCallback(async () => {
            setLoading(true);
            setError(null);
            setTreeData([]);
            setPreSelectedPath(null);
            try {
                const data = await getFileStructure(null, null);
                const structure = data?.structure;

                if (Array.isArray(structure)) {
                    setTreeData(structure);
                    if (structure.length === 0) {
                        toast.warn("Keine Ordnerstruktur von API erhalten.");
                    }
                } else {
                    const errorMsg =
                        "Ungültige Baumstruktur von API empfangen.";
                    console.error(errorMsg, structure);
                    setError(errorMsg);
                    toast.error(errorMsg);
                    setTreeData([]);
                }
            } catch (err: any) {
                console.error("Fehler beim Laden des Verzeichnisbaums:", err);
                const errorMsg =
                    err.message || "Ein unbekannter Fehler ist aufgetreten.";
                setError(errorMsg);
                toast.error(
                    `Fehler beim Laden des Verzeichnisbaums: ${errorMsg}`
                );
                setTreeData([]);
            } finally {
                setLoading(false);
            }
        }, []);

        useEffect(() => {
            fetchTree();
        }, [fetchTree]);

        const handleConfirmSelection = useCallback(() => {
            if (preSelectedPath) {
                let processedPath = preSelectedPath.replace(/[\\/]/g, "/");
                if (!processedPath.endsWith("/")) {
                    processedPath += "/";
                }
                setPath(processedPath);
                toast.success(`Ordner ausgewählt: ${processedPath}`);
                onCancel();
            } else {
                toast.warn("Bitte wählen Sie zuerst einen Ordner aus.");
            }
        }, [preSelectedPath, setPath, onCancel]);

        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                const target = e.target as HTMLElement;
                if (
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA"
                ) {
                    return;
                }

                if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
                if (e.key === "Enter" && preSelectedPath) {
                    e.preventDefault();
                    handleConfirmSelection();
                }
            };

            document.addEventListener("keydown", handleKeyDown);
            return () => {
                document.removeEventListener("keydown", handleKeyDown);
            };
        }, [onCancel, preSelectedPath, handleConfirmSelection]);

        const handlePreSelect = useCallback((path: string) => {
            setPreSelectedPath(path);
        }, []);

        const handleRefresh = useCallback(async () => {
            if (loading) return;
            setLoading(true);
            setError(null);
            setTreeData([]);
            setPreSelectedPath(null);
            try {
                await rescanFileStructure(null);
                await fetchTree();
                toast.success("Verzeichnisbaum aktualisiert.");
            } catch (err: any) {
                const errorMsg =
                    err.message ||
                    "Ein unbekannter Fehler ist beim Aktualisieren aufgetreten.";
                console.error(
                    "Fehler beim Aktualisieren des Verzeichnisbaums:",
                    err
                );
                toast.error(`Fehler beim Aktualisieren: ${errorMsg}`);
                setError(errorMsg);
                setTreeData([]);
            } finally {
                setLoading(false);
            }
        }, [loading, fetchTree]);

        if (!onCancel) {
            console.error("FolderSelector: onCancel prop is required.");
            return null;
        }

        return (
            <div className="folder-selector-overlay">
                <div className="folder-selector-container">
                    <div className="folder-selector-header">
                        <h2>Zielordner auswählen</h2>
                        <button
                            className="close-button"
                            onClick={onCancel}
                            title="Schließen (Esc)"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="folder-selector-content">
                        {loading ? (
                            <p className="folder-selector-message">
                                Lade Verzeichnisbaum...
                            </p>
                        ) : error ? (
                            <p className="folder-selector-message folder-selector-error">
                                Fehler: {error}
                            </p>
                        ) : treeData.length === 0 ? (
                            <p className="folder-selector-message">
                                Keine Ordner gefunden oder leer.
                            </p>
                        ) : (
                            <FolderTree
                                nodes={treeData}
                                onSelectPath={() => {}} // Dummy, since selection is handled by confirm button
                                onPreSelect={handlePreSelect}
                                preSelectedPath={preSelectedPath}
                            />
                        )}
                    </div>
                    <div className="folder-selector-footer">
                        <button
                            className="folder-selector-button confirm-button"
                            onClick={handleConfirmSelection}
                            disabled={!preSelectedPath || loading}
                            title="Ausgewählten Ordner bestätigen (Enter)"
                        >
                            <Check size={18} className="mr-2" /> Auswählen
                        </button>
                        <button
                            className="folder-selector-button"
                            onClick={handleRefresh}
                            disabled={loading}
                            title="Verzeichnisbaum aktualisieren"
                        >
                            {loading ? (
                                <>
                                    <RotateCw
                                        size={18}
                                        className="animate-spin mr-2"
                                    />
                                    Aktualisiere...
                                </>
                            ) : (
                                <>
                                    <RotateCw size={18} className="mr-2" />{" "}
                                    Aktualisieren
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
);

export default FolderSelector;

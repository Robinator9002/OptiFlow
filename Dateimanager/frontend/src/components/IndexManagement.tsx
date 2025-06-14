import React, { useState } from "react";
import { toast } from "react-toastify";
import { ConfirmModal } from "./ConfirmModal.tsx";
import {
    scanFiles,
    actualizeIndex,
    loadIndex,
    deleteIndex,
} from "../api/api.tsx";
// NEU: Icons aus lucide-react importiert
import { RefreshCw, FileScan, Download, Trash2 } from "lucide-react";

// --- Type Definitions ---
interface IndexManagementProps {
    setScanningFiles: React.Dispatch<React.SetStateAction<boolean>>;
    setActualizingIndex: React.Dispatch<React.SetStateAction<boolean>>;
    setLoadingIndex: React.Dispatch<React.SetStateAction<boolean>>;
}

type ActionType = "scan" | "actualize" | "load" | "delete" | null;

// --- Component ---
const IndexManagement: React.FC<IndexManagementProps> = ({
    setScanningFiles,
    setActualizingIndex,
    setLoadingIndex,
}) => {
    const [confirmAction, setConfirmAction] = useState<ActionType>(null);

    // HINWEIS: Die Emojis hier sind nur für die Modal-Titel, nicht die Buttons.
    const actionConfig = {
        scan: {
            title: "🔍 Scannen bestätigen",
            message: "Möchtest du die Dateien neu Scannen?",
            handler: handleScanFiles,
            isDanger: false,
        },
        actualize: {
            title: "🔄 Aktualisieren bestätigen",
            message: "Möchtest du den Index Aktualisieren?",
            handler: handleActualizeIndex,
            isDanger: false,
        },
        load: {
            title: "📚 Laden bestätigen",
            message: "Möchtest du den Index Laden?",
            handler: handleLoadIndex,
            isDanger: false,
        },
        delete: {
            title: "🗑️ Löschen bestätigen",
            message: "Möchtest du den Index Löschen?",
            handler: handleDeleteIndex,
            isDanger: true,
        },
    };

    async function handleScanFiles() {
        setScanningFiles(true);
        try {
            await scanFiles();
            toast.success("🔍 Dateien erfolgreich gescannt!");
        } catch (error: any) {
            toast.error(`❌ Fehler beim Scannen: ${error.message}`);
        } finally {
            setScanningFiles(false);
        }
    }

    async function handleActualizeIndex() {
        setActualizingIndex(true);
        try {
            await actualizeIndex();
            toast.success("🔄 Index erfolgreich aktualisiert!");
        } catch (error: any) {
            toast.error(
                `❌ Fehler beim Aktualisieren des Index: ${error.message}`
            );
        } finally {
            setActualizingIndex(false);
        }
    }

    async function handleLoadIndex() {
        setLoadingIndex(true);
        try {
            await loadIndex();
            toast.success("📚 Index erfolgreich geladen!");
        } catch (error: any) {
            toast.error(`❌ Fehler beim Laden des Index: ${error.message}`);
        } finally {
            setLoadingIndex(false);
        }
    }

    async function handleDeleteIndex() {
        try {
            await deleteIndex();
            toast.warn("🗑️ Index wurde gelöscht.");
        } catch (error: any) {
            toast.error(`❌ Fehler beim Löschen des Index: ${error.message}`);
        }
    }

    const handleConfirm = () => {
        if (confirmAction && actionConfig[confirmAction]) {
            actionConfig[confirmAction].handler();
        }
        setConfirmAction(null);
    };

    const handleCancel = () => {
        toast.warn("⚠️ Aktion abgebrochen.");
        setConfirmAction(null);
    };

    return (
        <div className="container index-management-container">
            <h2>Index Verwaltung</h2>
            {/* HINWEIS: Du solltest noch CSS für .button-container hinzufügen, 
                damit die Buttons und Icons gut aussehen (z.B. mit display: flex und gap) */}
            <div className="button-container">
                <button onClick={() => setConfirmAction("actualize")}>
                    <RefreshCw size={16} /> Index aktualisieren
                </button>
                <button onClick={() => setConfirmAction("scan")}>
                    <FileScan size={16} /> Dateien scannen
                </button>
                <div>
                    <button onClick={() => setConfirmAction("load")}>
                        <Download size={16} /> Index laden
                    </button>
                    <button
                        className="remove-button"
                        onClick={() => setConfirmAction("delete")}
                    >
                        <Trash2 size={16} /> Index löschen
                    </button>
                </div>
            </div>

            {confirmAction && (
                <ConfirmModal
                    title={actionConfig[confirmAction].title}
                    isDanger={actionConfig[confirmAction].isDanger}
                    message={actionConfig[confirmAction].message}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            )}
        </div>
    );
};

export default IndexManagement;

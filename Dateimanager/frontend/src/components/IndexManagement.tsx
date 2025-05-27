import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { ConfirmModal } from './ConfirmModal.tsx';
import { scanFiles, actualizeIndex, loadIndex, deleteIndex } from '../api/api.tsx';

const IndexManagement = ({ setScanningFiles, setActualizingIndex, setLoadingIndex }) => {
    const [confirmScanFiles, setConfirmScanFiles] = useState(false);
    const [confirmActualizeIndex, setconfirmActualizeIndex] = useState(false);
    const [confirmLoadIndex, setConfirmLoadIndex] = useState(false);
    const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(false);

    const handleScanFiles = async () => {
        try {
            setConfirmScanFiles(false);
            setScanningFiles(true);
            await scanFiles();
            toast.success('🔍 Dateien erfolgreich gescannt!');
        } catch (error) {
            toast.error(`❌ Fehler beim Scannen: ${error.message}`);
        } finally {
            setScanningFiles(false);
        }
    };

    const handleActualizeIndex = async () => {
        try {
            setconfirmActualizeIndex(false);
            setActualizingIndex(true);
            await actualizeIndex();
            toast.success('🔄 Index erfolgreich aktualisiert!');
        } catch (error) {
            toast.error(`❌ Fehler beim Aktualisieren des Index: ${error.message}`);
        } finally {
            setActualizingIndex(false);
        }
    }

    const handleLoadIndex = async () => {
        try {
            setConfirmLoadIndex(false);
            setLoadingIndex(true);
            await loadIndex();
            toast.success('📚 Index erfolgreich geladen!');
        } catch (error) {
            toast.error(`❌ Fehler beim Laden des Index: ${error.message}`);
        } finally {
            setLoadingIndex(false);
        }
    };

    const handleDeleteIndex = async () => {
        try {
            setConfirmDeleteIndex(false);
            await deleteIndex();
            toast.warn('🗑️ Index wurde gelöscht.');
        } catch (error) {
            toast.error(`❌ Fehler beim Löschen des Index: ${error.message}`);
        }
    };

    return (
        <div className='container index-management-container'>
            <h2>Index Verwaltung</h2>
            <div className='button-container'>
                <button onClick={() => setconfirmActualizeIndex(true)}>Index aktualisieren</button>
                <button onClick={() => setConfirmScanFiles(true)}>Dateien scannen</button>
                <div>
                    <button onClick={() => setConfirmLoadIndex(true)}>Index laden</button>
                    <button className="remove-button" onClick={() => setConfirmDeleteIndex(true)}>Index löschen</button>
                </div>
            </div>

            {/* Bestätigungs-Modal für das Scannen / Laden / Löschen */}
            {(confirmScanFiles || confirmActualizeIndex || confirmLoadIndex || confirmDeleteIndex) && (
                <ConfirmModal
                    title={
                        confirmScanFiles ? '🔍 Scannen bestätigen' :
                            confirmActualizeIndex ? '🔄 Aktualisieren bestätigen' :
                                confirmLoadIndex ? '📚 Laden bestätigen' :
                                    '🗑️ Löschen bestätigen'
                    }
                    isDanger={confirmDeleteIndex ? true : false}
                    message={
                        confirmScanFiles ? 'Möchtest du die Dateien neu Scannen?' :
                            confirmActualizeIndex ? 'Möchtest du den Index Aktualisieren?' :
                                confirmLoadIndex ? 'Möchtest du den Index Laden?' :
                                    'Möchtest du den Index Löschen?'
                    }
                    onConfirm={() => {
                        confirmScanFiles ? handleScanFiles() :
                            confirmActualizeIndex ? handleActualizeIndex() :
                                confirmLoadIndex ? handleLoadIndex() :
                                    handleDeleteIndex()
                    }}
                    onCancel={() => {
                        confirmScanFiles ? setConfirmScanFiles(false) :
                            confirmActualizeIndex ? setconfirmActualizeIndex(false) :
                                confirmLoadIndex ? setConfirmLoadIndex(false) :
                                    setConfirmDeleteIndex(false);
                        toast.warn(
                            confirmScanFiles ? '⚠️ Scannen der Dateien abgebrochen' :
                                confirmActualizeIndex ? '⚠️ Aktualisieren des Indexes abgebrochen' :
                                    confirmLoadIndex ? '⚠️ Laden dex Indexes abgebrochen' :
                                        '⚠️ Löschen des Indexes abgebrochen'
                        )
                    }}
                />
            )}
        </div>
    );
};

export default IndexManagement;

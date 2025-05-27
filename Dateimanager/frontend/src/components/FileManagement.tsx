import FileSearch from './FileSearch.tsx'
import FilePreview from './FilePreview.tsx'
import React, { useState } from 'react';

const FileManagement = ({ searchingFiles, setSearchingFiles, showRelevance, isAdmin, selectedFile, setSelectedFile }) => {
    const [deletedFile, setDeletedFile] = useState(null);
    // Neuer State für das Einklappen der Suche
    const [isSearchCollapsed, setIsSearchCollapsed] = useState(false);

    const onFileDeleted = async (file_path) => {
        setDeletedFile(file_path);
    }

    // Funktion zum Umschalten des Zustands
    const toggleSearchCollapse = () => {
        setIsSearchCollapsed(!isSearchCollapsed);
    };

    return (
        // Klasse für CSS hinzufügen, abhängig vom Zustand
        <div className={`file-management-container ${isSearchCollapsed ? 'search-collapsed' : ''}`}>
            <FileSearch
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                searchingFiles={searchingFiles}
                setSearchingFiles={setSearchingFiles}
                showRelevance={showRelevance}
                deletedFile={deletedFile}
                setDeletedFile={setDeletedFile}
                // Prop für den Zustand übergeben
                isSearchCollapsed={isSearchCollapsed}
                // Prop für die Toggle-Funktion übergeben
                onToggleCollapse={toggleSearchCollapse}
            />
            <FilePreview
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                onFileDeleted={onFileDeleted}
                isAdmin={isAdmin}
                // Prop für den Zustand übergeben (optional, falls Preview reagieren soll)
                setIsSearchCollapsed={setIsSearchCollapsed}
            />
        </div>
    );
}

export default FileManagement;
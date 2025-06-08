import React, { useState } from "react";
import FileSearch from "./FileSearch.tsx";
import FilePreview from "./FilePreview.tsx";

// --- Type Definitions ---
interface FileObject {
    path: string;
    name: string;
    // Add other file properties if available
}

interface FileManagementProps {
    searchingFiles: boolean;
    setSearchingFiles: React.Dispatch<React.SetStateAction<boolean>>;
    showRelevance: boolean;
    isAdmin: boolean;
    selectedFile: FileObject | null;
    setSelectedFile: React.Dispatch<React.SetStateAction<FileObject | null>>;
}

// --- Component ---
const FileManagement: React.FC<FileManagementProps> = ({
    searchingFiles,
    setSearchingFiles,
    showRelevance,
    isAdmin,
    selectedFile,
    setSelectedFile,
}) => {
    const [deletedFile, setDeletedFile] = useState<string | null>(null);
    const [isSearchCollapsed, setIsSearchCollapsed] = useState<boolean>(false);

    const onFileDeleted = (filePath: string) => {
        setDeletedFile(filePath);
    };

    const toggleSearchCollapse = () => {
        setIsSearchCollapsed((prevState) => !prevState);
    };

    return (
        <div
            className={`file-management-container ${
                isSearchCollapsed ? "search-collapsed" : ""
            }`}
        >
            <FileSearch
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                searchingFiles={searchingFiles}
                setSearchingFiles={setSearchingFiles}
                showRelevance={showRelevance}
                deletedFile={deletedFile}
                setDeletedFile={setDeletedFile}
                isSearchCollapsed={isSearchCollapsed}
                onToggleCollapse={toggleSearchCollapse}
            />
            <FilePreview
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                onFileDeleted={onFileDeleted}
                isAdmin={isAdmin}
                setIsSearchCollapsed={setIsSearchCollapsed}
            />
        </div>
    );
};

export default FileManagement;

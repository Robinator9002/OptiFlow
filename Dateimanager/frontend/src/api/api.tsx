import api from "./axiosInstance";

// --- TypeScript Interfaces (abgeleitet von Pydantic-Modellen) ---

// Export the interface so it can be used in other files.
export interface ScannerConfigs {
    base_dirs?: string[];
    extensions?: string[];
    index_content?: boolean;
    convert_pdf?: boolean;
    max_size_kb?: number;
    max_content_size_let?: number;
}

// Interface für die Such-Match-Scores
export interface MatchScore {
    filename_exact?: number;
    filename_partial?: number;
    content?: number;
}

// NEW: Interface für die OCR-spezifischen Einstellungen
export interface OCRSettings {
    ocr_force?: boolean;
    ocr_skip_text_layer?: boolean;
    ocr_redo_text_layer?: boolean;
    ocr_image_dpi?: number;
    ocr_optimize_level?: number;
    ocr_tesseract_config?: string;
    ocr_clean_images?: boolean;
    ocr_language?: string;
}

// Interface für die Benutzereinstellungen
export interface Settings {
    search_limit?: number;
    snippet_limit?: number;
    old_files_limit?: number;
    show_relevance?: boolean;
    match_score?: MatchScore;
    scanner_cpu_cores?: number;
    usable_extensions?: string[];
    ignored_dirs?: string[];
    scan_delay?: number;
    snippet_window?: number;
    proximity_window?: number;
    max_age_days?: number;
    sort_by?: string;
    sort_order?: string;
    processor_excluded_folders?: string;
    subfolder?: string;
    prefix?: string;
    overwrite?: boolean;
    theme_name?: string;
    font_type?: string;
    font_size?: number;
    database_length?: number;
    check_interval?: number;
    max_file_size?: number;
    length_range_step?: number;
    min_category_length?: number;
    snippet_length?: number;
    snippet_step?: number;
    signature_size?: number;
    similarity_threshold?: number;
    ocr_processing?: OCRSettings;
}

// Interface für das Aktualisieren einer Datei
export interface FileUpdate {
    path: string;
    name?: string;
    content?: string;
}

// Interface zum Schreiben einer Datei
export interface FileWriteRequest {
    file_path: string;
    content: string;
}

// Interface für die Duplikat-Suche
export interface SearchDuplicatesParams {
    query?: string;
    sort_by?: string;
    sort_order?: string;
    length_range_filter?: string;
}

// Interface für die Suche nach alten Dateien
export interface FindOldFilesParams {
    max_files?: number;
    max_age_days?: number;
    sort_by?: string;
    sort_order?: string;
}

// --- API-Aufrufe ---

// API-Aufruf für das Laden des Index
export const loadIndex = async () => {
    const response = await api.post(`/load_index/`);
    return response.data;
};

// API-Aufruf für das Löschen des Index
export const deleteIndex = async () => {
    const response = await api.post(`/delete_index/`);
    return response.data;
};

// API-Aufruf für das Scannen der Dateien
export const scanFiles = async () => {
    const response = await api.post(`/scan_files/`);
    return response.data;
};

// API-Aufruf für das Aktualisieren des Indexes
export const actualizeIndex = async () => {
    const response = await api.post(`/actualize_index/`);
    return response.data;
};

// --- DEDUPLICATION API Calls ---
export const findDuplicates = async () => {
    const response = await api.post(`/find_duplicates/`);
    return response.data;
};

export const loadDuplicates = async () => {
    const response = await api.post(`/load_duplicates/`);
    return response.data;
};

export const saveDuplicates = async () => {
    const response = await api.post(`/save_duplicates/`);
    return response.data;
};

export const searchDuplicates = async (
    searchParams: SearchDuplicatesParams = {}
) => {
    const response = await api.post(`/search_duplicates/`, searchParams);
    return response.data;
};

// API-Aufrufe für die Datei-Suche
export const searchFiles = async (query: string) => {
    const response = await api.post(`/search/`, {
        query_input: query,
    });
    return response.data;
};

export const searchInFile = async (query: string, filePath: string) => {
    const response = await api.post(`/search/`, {
        query_input: query,
        file_path: filePath,
    });
    return response.data;
};

// Api-Aufruf zum Finden alter Dateien
export const findOldFiles = async (params: FindOldFilesParams = {}) => {
    const response = await api.get("/api/find_old_files", { params });
    return response.data;
};

// Öffnen einer Datei oder eines Ordners
export const openFile = async (path: string) => {
    const response = await api.post(`/open_file/${encodeURIComponent(path)}`);
    return response.data;
};

// Öffnet eine Datei im Explorer/Finder
export const openFileInExplorer = async (path: string) => {
    const response = await api.post(
        `/explorer_open_file/${encodeURIComponent(path)}`
    );
    return response.data;
};

// API-Aufruf für das Abrufen der Datei-Infos
export const getFileInfo = async (filePath: string) => {
    const response = await api.get(`/file/`, {
        params: { file_path: filePath },
    });
    return response.data;
};

// API-Aufruf zum Aktualisieren der Scanner-Konfiguration
export const updateScannerConfig = async (config: ScannerConfigs) => {
    const response = await api.post(`/update_scanner_config/`, config);
    return response.data;
};

// Eine Datei schreiben
export const writeFile = async (request: FileWriteRequest) => {
    const response = await api.post(`/write_file/`, request);
    return response.data;
};

// API-Aufruf zum Laden der Scanner-Konfiguration
export const getScannerConfig = async () => {
    const response = await api.get(`/get_scanner_config/`);
    return response.data;
};

// API-Aufruf zum Löschen einer Datei
export const deleteFile = async (filePath: string) => {
    const response = await api.delete(`/delete_file/`, {
        params: { file_path: filePath },
    });
    return response.data;
};

// --- OCR PROCESSING ---

export const ocrConvertIndex = async (overwrite: boolean) => {
    const response = await api.post(`/process_index/`, null, {
        params: {
            overwrite: overwrite,
        },
    });
    return response.data;
};

export const ocrConvertFolder = async (
    folderPath: string,
    outputSubdir: string | null,
    outputPrefix: string | null,
    overwrite: boolean,
    ignoredDirNames: string,
    maxWorkers: number
) => {
    const response = await api.post(`/process_pdf_directory/`, {
        base_dir: folderPath,
        output_subdir: outputSubdir,
        output_prefix: outputPrefix,
        overwrite: overwrite,
        ignored_dir_names: ignoredDirNames,
        max_workers: maxWorkers,
    });
    return response.data;
};

// --- FILE STRUCTURE ---
export const getFileStructure = async (
    path: string | null,
    forceRescan: boolean | null
) => {
    const response = await api.post(`/file_structure/`, null, {
        params: { path, forceRescan },
    });
    return response.data;
};

export const rescanFileStructure = async (path: string | null) => {
    const response = await api.post(`/rescan_file_structure/`, null, {
        params: { path },
    });
    return response.data;
};

// --- USER MANAGEMENT ---

// NEUER API AUFRUF
export const checkNoUsersExist = async () => {
    const response = await api.get(`/api/no_users_exist`);
    return response.data;
};

export const registerUser = async (
    username: string,
    password: string,
    adminUsername: string | null,
    adminPassword: string | null,
    isAdmin: boolean
) => {
    const response = await api.post(`/register/`, {
        username: username,
        password: password,
        admin_username: adminUsername,
        admin_password: adminPassword,
        is_admin: isAdmin,
    });
    if (response.data.access_token) {
        localStorage.setItem("accessToken", response.data.access_token);
    }
    return response.data;
};

export const loginUser = async (username: string, password: string) => {
    const response = await api.post(`/login/`, { username, password });
    if (response.data.access_token) {
        localStorage.setItem("accessToken", response.data.access_token);
    }
    return response.data;
};

export const verifyPassword = async (username: string, password: string) => {
    const response = await api.post(`/verify_password/`, {
        username,
        password,
    });
    return response.data;
};

export const logoutUser = async (username: string) => {
    const response = await api.post(`/logout/`, { username });
    localStorage.removeItem("accessToken");
    return response.data;
};

export const autoLogin = async (username: string) => {
    const response = await api.get(`/auto_login/${username}`);
    return response.data;
};

export const getUserAdminStatus = async (username: string) => {
    const response = await api.get(`/users/${username}/admin/`);
    return response.data;
};

export const getAllUsers = async () => {
    const response = await api.get(`/users/`);
    return response.data;
};

export const setUserAdminStatus = async (
    targetUsername: string,
    adminPassword: string,
    newStatus: boolean
) => {
    const response = await api.post(`/users/${targetUsername}/admin/`, {
        admin_password: adminPassword,
        new_status: newStatus,
    });
    return response.data;
};

export const deleteUser = async (username: string, password: string) => {
    const response = await api.delete(`/delete_user/`, {
        data: {
            username: username,
            password: password,
        },
    });
    return response.data;
};

export const changeUsername = async (
    username: string,
    password: string,
    newUsername: string
) => {
    const requestBody = {
        user: { username, password },
        new_username: newUsername,
    };
    const response = await api.post("/change_username/", requestBody);
    return response.data;
};

export const changePassword = async (
    username: string,
    oldPassword: string,
    admin_username: string | null = null,
    admin_password: string | null = null,
    password_reset: boolean = false,
    newPassword: string
) => {
    const requestBody = {
        user: { username: username, password: oldPassword },
        admin_user: { username: admin_username, password: admin_password },
        password_reset: password_reset,
        new_password: newPassword,
    };
    const response = await api.post("/change_password/", requestBody);
    return response.data;
};

// --- SETTINGS & DATABASE ---
export const getUserSettings = async (username: string) => {
    const response = await api.get(`/settings/${username}`);
    return response.data;
};

export const saveUserSettings = async (
    username: string,
    settings: Settings
) => {
    const response = await api.post(`/settings/${username}`, settings);
    return response.data;
};

export const readDatabase = async (databaseName: string) => {
    const response = await api.get(`/database/${databaseName}`);
    return response.data;
};

export const writeDatabase = async (
    databaseName: string,
    data: Record<string, any> | any[]
) => {
    const response = await api.post(`/database/${databaseName}`, {
        data: data,
    });
    return response.data;
};

export const reloadDatabase = async (databaseName: string) => {
    const response = await api.post(`/database/${databaseName}/reload/`);
    return response.data;
};

// --- SYSTEM ---
export const shutdown = async (password: string) => {
    const response = await api.post("/shutdown/", { password });
    return response.data;
};

// --- EVENTS ---
export const addEvent = async (
    frequency: string,
    times: string[],
    event: string
) => {
    const response = await api.post("/events", {
        frequency,
        times,
        event,
    });
    return response.data;
};

export const updateEvent = async (
    eventIndex: number,
    frequency: string,
    times: string[],
    event: string
) => {
    const response = await api.put(`/events/${eventIndex}`, {
        frequency,
        times,
        event,
    });
    return response.data;
};

export const deleteEvent = async (eventIndex: number) => {
    const response = await api.delete(`/events/${eventIndex}`);
    return response.data;
};

export const getAllEvents = async () => {
    const response = await api.get("/events");
    return response.data;
};

export const executeEvent = async (eventIndex: number) => {
    const response = await api.post(`/events/${eventIndex}/execute`);
    return response.data;
};

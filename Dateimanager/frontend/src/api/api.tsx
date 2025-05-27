import api from './axiosInstance.tsx';

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
}

// --- DEDUPLICATION API Calls ---
// API-Aufruf zum Starten der Duplikatsuche
export const findDuplicates = async () => {
    // Backend endpoint /find_duplicates/ is a POST request with no body
    const response = await api.post(`/find_duplicates/`);
    // Backend returns {"message": ..., "result": {...}}
    return response.data;
};

// API-Aufruf zum Laden der gespeicherten Duplikate
export const loadDuplicates = async () => {
    // Backend endpoint /load_duplicates/ is a POST request with no body
    const response = await api.post(`/load_duplicates/`);
     // Backend returns {"message": ..., "data": {...}} or {"message": ...}
    return response.data;
};

// API-Aufruf zum Speichern der aktuellen Duplikate
export const saveDuplicates = async () => {
    // Backend endpoint /save_duplicates/ is a POST request with no body
    const response = await api.post(`/save_duplicates/`);
     // Backend returns {"message": ...}
    return response.data;
};

// API-Aufruf zum Suchen und Sortieren geladener Duplikate
export const searchDuplicates = async (searchParams = {}) => {
    // Default values are handled by the backend model, but good practice to pass them if available
    const response = await api.post(`/search_duplicates/`, searchParams);
    // Backend returns DuplicateGroupsResponse model (__root__: Dict[str, DuplicateGroup])
    return response.data; // This should be the dictionary of duplicate groups
};

// API-Aufrufe für die Datei-Suche
export const searchFiles = async (query) => {
    const response = await api.post(`/search/`, {
        query_input: query
    });
    return response.data;
};
export const searchInFile = async (query, filePath) => {
    const response = await api.post(`/search/`, {
        query_input: query,
        file_path: filePath,
    });
    return response.data;
};

// Api-Aufruf zum finden alter Dateien
export const findOldFiles = async (params = {}) => {
    try {
        console.log(params);
        const response = await api.get('/api/find_old_files', {
            params: params // Übergibt die Parameter als Query-Parameter
        });
        return response.data;
    } catch (error) {
        console.error('Fehler beim Abrufen alter Dateien:', error);
        throw error; // Wirf den Fehler weiter zur Behandlung in der Komponente
    }
};

// Überschreiben eines Index-Wertes
export const updateFile = async (update) => {
    const response = await api.post(`/update/`, update);
    console.log("Finished")
    return response.data;
}

// Öffnen einer Datei
export const openFile = async (path) => {
    const response = await api.post(`/open_file/${path}`);
    return response.data;
};

// Öffnet eine Datei im Explorer
export const openFileInExplorer = async (path) => {
    const response = await api.post(`/explorer_open_file/${path}`);
    return response.data;
};

// API-Aufruf für das Abrufen der Datei-Infos
export const getFileInfo = async (filePath) => {
    const response = await api.get(`/file/`, {
        params: { file_path: filePath }    // Query Parameter
    });
    console.log(response.data);
    return response.data;
};

// API-Aufruf zum Aktualisieren der Scanner-Konfiguration
export const updateScannerConfig = async (config) => {
    const response = await api.post(`/update_scanner_config/`, config);
    return response.data;
};

// Eine Datei schreiben (neu)
export const writeFile = async (request) => {
    const response = await api.post(`/write_file/`, request)
    return response.data;
}

// API-Aufruf zum laden der Scanner-Konfiguration
export const getScannerConfig = async () => {
    const response = await api.get(`/get_scanner_config/`);
    return response.data;
};

// API-Aufruf zum Löschen einer Datei
export const deleteFile = async (filePath) => {
    const response = await api.delete(`/delete_file/`, { params: { file_path: filePath } });
    return response.data;
};

// API-Aufruf zum Konvertieren einer Datei (in OCR Format)
export const ocrConvertFile = async (filePath, outputPath) => {
    const response = await api.post(`/process_pdf_file/`, {
        input_file: filePath,
        output_file: outputPath
    });
    return response.data;
};

// API-Aufruf zur Konvertierung des Indexes
export const ocrConvertIndex = async (overwrite) => {
    const response = await api.post(`/process_index/`, {
        overwrite: overwrite
    });
    return response.data;
};

// API-Aufruf zum Konvertieren eines Ordners (in OCR Format)
export const ocrConvertFolder = async (folderPath, outputSubdir, outputPrefix, overwrite, ignoredDirNames, maxWorkers) => {
    const response = await api.post(`/process_pdf_directory/`, {
        base_dir: folderPath,
        output_subdir: outputSubdir,
        output_prefix: outputPrefix,
        overwrite: overwrite,
        ignored_dir_names: ignoredDirNames,
        max_workers: maxWorkers
    });
    return response.data;
};

// API-Aufruf zum Abrufen der Datei-Struktur
export const getFileStructure = async (path, forceRescan) => {
    const response = await api.post(`/file_structure/`, { path, forceRescan });
    return response.data;
};

// API-Aufruf zum erneuten Scannen der Datei-Struktur
export const rescanFileStructure = async (path) => {
    const response = await api.post(`/rescan_file_structure/`, { path });
    return response.data;
};

// --- Benutzerverwaltung ---
// API-Aufruf zur Benutzerregistrierung
export const registerUser = async (username, password, adminUsername, adminPassword, isAdmin) => {
    const response = await api.post(`/register/`, {
        username: username,
        password: password,
        admin_username: adminUsername,
        admin_password: adminPassword,
        is_admin: isAdmin,
    });

    // Zugriffstoken speichern
    if (response.data.access_token) {
        localStorage.setItem("accessToken", response.data.access_token);
    }

    return response.data;
};

// API-Aufruf zur Benutzeranmeldung
export const loginUser = async (username, password) => {
    const response = await api.post(`/login/`, {
        username,
        password,
    });

    // Zugriffstoken speichern
    if (response.data.access_token) {
        localStorage.setItem("accessToken", response.data.access_token);
    }

    return response.data;
};

// API-Aufruf zum Verifizieren des Nutzers
export const verifyPassword = async (username, password) => {
    const response = await api.post(`/verify_password/`, { username, password });
    console.log(response);
    return response.data;
};

// API-Aufruf zur Benutzerabmeldung
export const logoutUser = async (username) => {
    const response = await api.post(`/logout/`, {
        username: username,
    });
    localStorage.removeItem("accessToken");
    return response.data;
};

// API-Aufruf zur automatischen Anmeldung
export const autoLogin = async (username) => {
    const response = await api.get(`/auto_login/${username}`);
    return response.data;
};

// API-Aufruf zum erhalten des Admin-Status des momentanen Nutzers
export const getUserAdminStatus = async (username) => {
    const response = await api.get(`/users/${username}/admin/`);
    return response.data;
};

// API-Aufruf zum erhalten des Passwort-Reset-Status des momentanen Nutzers
export const getResetPasswordStatus = async (username) => {
    const response = await api.get(`/users/${username}/reset_password/`);
    return response.data;
};

// API-Aufruf zum Abrufen aller Benutzer (für Admin)
export const getAllUsers = async () => {
    const response = await api.get(`/users/`);
    return response.data;
};

// API-Aufruf zum Ändern des Admin-Status eines Benutzers (für Admin)
export const setUserAdminStatus = async (username, admin_username, admin_password) => {
    const response = await api.post(`/users/${username}/admin/`, {
        username: admin_username,  // das ist der echte Admin
        password: admin_password
    });
    return response.data;
};

// API-Aufruf zum Zurücksetzen des Passworts eines Benutzers (für Admin)
export const resetUserPassword = async (username, admin_username, admin_password) => {
    const response = await api.post(`/reset_password/${username}/`, {
        username: admin_username,
        password: admin_password
    });
    return response.data;
};

// API-Aufruf zum Löschen eines Benutzers
export const deleteUser = async (username, password) => {
    const response = await api.delete(`/delete_user/`, {
        data: {
            username: username,
            password: password
        }
    });
    return response.data;
};

// --- Einstellungen ---
// API-Aufruf zum Abrufen der Benutzereinstellungen
export const getUserSettings = async (username) => {
    const response = await api.get(`/settings/${username}`);
    return response.data;
};

// API-Aufruf zum Speichern der Benutzereinstellungen
export const saveUserSettings = async (username, settings) => {
    console.log(username, settings)
    const response = await api.post(`/settings/${username}`, settings);
    return response.data;
};

// --- Datenbankoperationen ---
// API-Aufruf zum Lesen einer Datenbank
export const readDatabase = async (databaseName) => {
    const response = await api.get(`/database/${databaseName}`);
    return response.data;
};

// API-Aufruf zum Schreiben in eine Datenbank
export const writeDatabase = async (databaseName, data) => {
    const response = await api.post(`/database/${databaseName}`, { data: data });
    return response.data;
};

// Api-Aufruf zum Neuauslesen der Datenbank
export const reloadDatabase = async (databaseName) => {
    const response = await api.post(`/database/${databaseName}/reload/`);
    return response.data;
}

// --- Nutzerveraltung ---
// API-Aufruf zum Ändern des Nutzernamens
export const changeUsername = async (username, password, newUsername) => {
    const response = await api.post('/change_username/', {
        user: { username, password },
        new_username: newUsername
    });
    return response.data;
};

// API-Aufruf zum Ändern des Passworts
export const changePassword = async (username, oldPassword, newPassword) => {
    const response = await api.post('/change_password/', {
        user: { username, password: oldPassword },
        new_password: newPassword
    });
    return response.data;
};

// API-Aufruf zum Herunterfahren des Servers
export const shutdown = async (password) => {
    const response = await api.post('/shutdown/', { password });
    return response.data;
}

// --- Events ---
// API-Aufruf zum Hinzufügen eines Events
export const addEvent = async (frequency, times, event) => {
    const response = await api.post("/events", {
        frequency,
        times,
        event
    });
    return response.data;
};

// API-Aufruf zum Aktualisieren eines Events
export const updateEvent = async (eventIndex, frequency, times, event) => {
    const response = await api.put(`/events/${eventIndex}`, {
        frequency,
        times,
        event
    });
    return response.data;
};

// API-Aufruf zum Löschen eines Events
export const deleteEvent = async (eventIndex) => {
    const response = await api.delete(`/events/${eventIndex}`);
    return response.data;
};

// API-Aufruf zum Abrufen aller Events
export const getAllEvents = async () => {
    const response = await api.get("/events");
    return response.data;
};

// API-Aufruf zum manuellen Ausführen eines Events
export const executeEvent = async (eventIndex) => {
    const response = await api.post(`/events/${eventIndex}/execute`);
    return response.data;
};

// API-Aufruf zum Abrufen eines Events anhand des Index
export const findEventByIndex = async (eventIndex) => {
    const response = await api.get(`/events/${eventIndex}`);
    return response.data;
};

// API-Aufruf zum Starten der Event-Überwachung
export const startEventMonitoring = async () => {
    const response = await api.post("/events/start-monitoring");
    return response.data;
};

// API-Aufruf zum Speichern der Events in der Datei
export const saveEventsToFile = async () => {
    const response = await api.post("/events/save");
    return response.data;
};

// API-Aufruf zum Laden der Events aus der Datei
export const loadEventsFromFile = async () => {
    const response = await api.post("/events/load");
    return response.data;
};

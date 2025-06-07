from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import unquote, urlparse
from contextlib import asynccontextmanager
from typing import Dict, List
from fastapi.security import OAuth2PasswordBearer  # Für Security
from datetime import timedelta
from backend.controller.datei_controller import DateiController
from backend.api.models import (
    FileInfo, FileUpdate, SearchRequest, SearchResult,
    FileScanResponse, ScannerConfig, FileWriteRequest,
    PDFProcessDirectoryRequest, PDFProcessFileRequest,
    User, AdminUser, Settings, LogoutRequest, ShutdownRequest,
    EventIn, OldFileInfo, OldFilesQueryParams, DataWrapper,
    DuplicateGroupsResponse, SearchDuplicatesRequest,
)
import datetime
import jwt
import os
import signal
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse
import asyncio
import platform, string

# Shutdown Logic
SHUTDOWN_FLAG_FILE = "data/_shutdown_request.flag"
async def check_for_shutdown(interval_seconds: int = 1):
    while True:
        if os.path.exists(SHUTDOWN_FLAG_FILE):
            print("Shutdown-Flag erkannt. Beende den Server...")
            try:
                os.remove(SHUTDOWN_FLAG_FILE)
            except OSError as e:
                print(f"Fehler beim Löschen des Shutdown-Flags: {e}")
            await asyncio.sleep(0.5)
            os.kill(os.getpid(), signal.SIGINT)
            break
        await asyncio.sleep(interval_seconds)

def get_base_directories():
    """
    Determines the base directories for scanning based on the operating system.
    """
    system = platform.system() # Get the operating system name (e.g., 'Windows', 'Linux', 'Darwin')

    if system == "Windows":
        # On Windows, we typically scan drives.
        # A common starting point is the C: drive.
        # To be more thorough, we can try to find all available drives.
        drives = []
        # Iterate through potential drive letters from A to Z
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\" # Windows drive format (e.g., C:\)
            # Check if the drive path exists
            if os.path.exists(drive):
                drives.append(drive)
        # Return found drives, fallback to C:\ if none found (unlikely on a functional Windows system)
        return drives if drives else [os.path.join("C:", os.sep)]

    elif system == "Linux" or system == "Darwin": # 'Darwin' is the system name for macOS
        # On Linux and macOS, the root directory '/' is the base.
        # You might want to add other common user directories like /home/user or /Users/user
        # depending on what you want to scan by default. For a broad scan, '/' is the start.
        # Note: Scanning the entire root on a large system can be time-consuming!
        return ["/"]

    else:
        # For any other operating system, we might not know the standard structure.
        # Log a warning and return an empty list or a sensible default.
        print(f"Warning: Unknown operating system '{system}'. Cannot determine base directories automatically.")
        # Return an empty list to prevent scanning unknown paths, or a default like ["."]
        return []

# --- Konfiguration ---
BASE_DIRS =  get_base_directories();
EXTENSIONS = [".txt", ".md", ".csv", ".json", ".xml", ".py", ".html", ".css", ".js", ".pdf", ".docx"]
INDEX_FILE = "data/index.json"
INDEX_CONTENT = True
MAX_SIZE_KB = 0
MAX_CONTENT_SIZE_LET = None
SEARCH_LIMIT = 30
STRUCTURE_FILE = "data/structure.json"
USER_FILE = "data/user.json"
AUTO_LOGIN_TIME = 24

# Secret Key
SECRET_KEY = os.getenv("OPTIFLOW_SECRET_KEY", "ein-sehr-zufaelliger-und-sicherer-standard-key-fuer-die-entwicklung")
if "entwicklung" in SECRET_KEY:
    print("\nWARNUNG: Es wird der Standard-Entwicklungsschlüssel verwendet. Setzen Sie die Umgebungsvariable 'OPTIFLOW_SECRET_KEY' für den produktiven Einsatz.\n")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440
# --- DEDUPING SETTINGS (Hardcoded for now, will be loaded from settings later) ---
LENGTH_RANGE_STEP = 100 # Step size for grouping by cleaned content length
MIN_CATEGORY_LENGTH = 2 # Minimum number of files in a group
SNIPPET_LENGTH_DEDUPE = 30 # Length of character shingles (K)
SNIPPET_STEP_DEDUPE = 1 # Step size for shingle generation
SIGNATURE_SIZE = 300 # Number of top hashes for the signature (M)
SIMILARITY_THRESHOLD = 0.8 # Minimum similarity score to group files

# --- Hilfsfunktionen ---
def prepare_path(file_path: str) -> str:
    cleaned_path = file_path.strip()
    if "%" in cleaned_path or urlparse(cleaned_path).scheme:
        cleaned_path = unquote(cleaned_path)
    return cleaned_path

def get_scanner_config() -> dict:
    scanner = controller.file_scanner
    return {
        'base_dirs': scanner.base_dirs,
        'extensions': scanner.extensions,
        'index_content': scanner.index_content,
        'convert_pdf': scanner.convert_pdf,
        'max_size_kb': scanner.max_size_kb,
        'max_content_size_let': scanner.max_content_size_let
    }

# --- Controller-Initialisierung ---
controller = DateiController(
    base_dirs=BASE_DIRS,
    extensions=EXTENSIONS,
    index_file=INDEX_FILE,
    index_content=INDEX_CONTENT,
    max_size_kb=MAX_SIZE_KB,
    max_content_size_let=MAX_CONTENT_SIZE_LET,
    search_limit=SEARCH_LIMIT,
    data_file=USER_FILE,
    auto_login_time=AUTO_LOGIN_TIME,
    structure_file=STRUCTURE_FILE,
    # Pass NEW dedupe settings
    length_range_step=LENGTH_RANGE_STEP,
    min_category_length=MIN_CATEGORY_LENGTH,
    snippet_length=SNIPPET_LENGTH_DEDUPE, # Use renamed parameter
    snippet_step=SNIPPET_STEP_DEDUPE, # Use renamed parameter
    signature_size=SIGNATURE_SIZE,
    similarity_threshold=SIMILARITY_THRESHOLD,
)

# --- FastAPI-Setup ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Serverstart: Lade Index...")
    controller.load_index()
    print("Serverstart: Starte Event Manager...")
    controller.start_event_monitoring()
    os.makedirs("data", exist_ok=True)
    shutdown_task = asyncio.create_task(check_for_shutdown())

    yield

    print("Serverende: Speichere Index...")
    controller.save_index()
    shutdown_task.cancel()


# --- Create App and Middleware ---
app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")  # Ersetze "token" ggf.

# Funktion zur Erzeugung von Tokens (JWT)
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Dependency zur Validierung von Tokens
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Ungültige Anmeldedaten",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        user = controller.account_manager.get_user(username)
        if user is None:
            raise credentials_exception
        return user
    except jwt.PyJWTError:
        raise credentials_exception

async def enforce_password_change(request: Request, current_user: Dict = Depends(get_current_user)):
    if current_user.get("passwordReset"):
        allowed_paths = ["/change_password/", "/logout/"]
        # Überprüfe, ob der Anfang des Pfades übereinstimmt
        if not any(request.url.path.startswith(p) for p in allowed_paths):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Passwortänderung erforderlich. Bitte ändern Sie Ihr Passwort."
            )

# --- Der Router für die Password_Reset_Sicherheit ---
router = APIRouter(
    dependencies=[Depends(enforce_password_change)]
)

# --- Routen ---
@app.get("/")
async def read_root():
    return {"message": "Hallo, Welt!"}

@router.post("/shutdown/")
async def shutdown_request(
    data: ShutdownRequest,
    current_user: dict = Depends(get_current_user)
):
    if not current_user or not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nicht autorisiert!")

    if not controller.account_manager.verify_password(current_user["username"], data.password):
        raise HTTPException(status_code=401, detail="Ungültiges Passwort.")

    with open(SHUTDOWN_FLAG_FILE, "w") as f:
        f.write("shutdown")
    return JSONResponse({"detail": "Shutdown-Anfrage erhalten. Server wird in Kürze beendet."})

# -- Events --
# 1. Event hinzufügen
@router.post("/events")
async def add_event(event: EventIn):
    try:
        success = controller.add_event(event.frequency, event.times, event.event)
        if not success:
            raise HTTPException(status_code=400, detail="Event konnte nicht hinzugefügt werden.")
        return {"message": "Event erfolgreich hinzugefügt"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 2. Event aktualisieren
@router.put("/events/{event_index}")
async def update_event(event_index: int, event: EventIn):
    try:
        success = controller.update_event(event_index, event.frequency, event.times, event.event)
        if not success:
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return {"message": "Event erfolgreich aktualisiert"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 3. Event löschen
@router.delete("/events/{event_index}")
async def delete_event(event_index: int):
    try:
        success = controller.delete_event(event_index)
        if not success:
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return {"message": "Event erfolgreich gelöscht"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 4. Alle Events abrufen
@router.get("/events", response_model=List[EventIn])
async def get_all_events():
    try:
        events = controller.get_all_events()
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 5. Event ausführen
@router.post("/events/{event_index}/execute")
async def execute_event(event_index: int):
    try:
        success = controller.execute_event(event_index)
        if not success:
            raise HTTPException(status_code=404, detail="Event nicht gefunden oder Ausführung fehlgeschlagen.")
        return {"message": "Event erfolgreich ausgeführt"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 6. Event nach Index finden
@router.get("/events/{event_index}", response_model=EventIn)
async def find_event_by_index(event_index: int):
    try:
        event = controller.find_event_by_index(event_index)
        if not event:
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return event
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 7. Event-Überwachung starten
@router.post("/events/start-monitoring")
async def start_event_monitoring():
    try:
        controller.start_event_monitoring()
        return {"message": "Event-Überwachung gestartet"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 8. Events in die Datei speichern
@router.post("/events/save")
async def save_events_to_file():
    try:
        controller.save_events_to_file()
        return {"message": "Events erfolgreich gespeichert"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 9. Events aus der Datei laden
@router.post("/events/load")
async def load_events_from_file():
    try:
        controller.load_events_from_file()
        return {"message": "Events erfolgreich geladen"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- DEDUPING ENDPOINTS (NEU) ---
@router.post("/find_duplicates/")
async def find_duplicates():
    """Endpoint to trigger the duplicate finding process."""
    try:
        result = controller.find_duplicates()
        # The result is stored in the controller, return a success message
        return {"message": "Duplikatsuche gestartet und Ergebnisse gespeichert.", "result": result} # Or return the number of groups found
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load_duplicates/")
async def load_duplicates():
    """Endpoint to load duplicate groups from file."""
    try:
        result = controller.load_duplicates()
        # The result is loaded into the controller, return a message
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save_duplicates/")
async def save_duplicates():
    """Endpoint to save current duplicate groups to file."""
    try:
        result = controller.save_duplicates()
        return result # Returns {"message": ...}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search_duplicates/", response_model=DuplicateGroupsResponse)
async def search_duplicates(request: SearchDuplicatesRequest):
    """Endpoint to search and sort loaded duplicate groups."""
    try:
        # Pass parameters from request body to controller
        result = controller.search_duplicates(
            query=request.query,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            length_range_filter=request.length_range_filter,
        )
        return result # Return the dictionary of groups
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load_index/", response_model=FileScanResponse)
async def load_index():
    controller.load_index()
    return {"message": "Index erfolgreich geladen."}

@router.post("/delete_index/", response_model=FileScanResponse)
async def delete_index():
    controller.file_scanner.delete_index()
    controller.save_index()
    controller.save_duplicates()
    return {"message": "Index gelöscht und neu geladen."}

@router.post("/scan_files/", response_model=FileScanResponse)
async def scan_files():
    result = controller.scan_files()
    return {"message": result["message"]}

@router.post("/actualize_index/", response_model=FileScanResponse)
async def actualize_index():
    result = controller.actualize_index()
    return {"message": result["message"]}

@router.post("/search/", response_model=SearchResult)
def unified_search(request: SearchRequest):
    try:
        if request.file_path:
            # Suche in einer einzelnen Datei
            # controller.search_file sollte die Struktur von FileContentResult zurückgeben:
            # {"file": {...}, "match_count": ..., "snippets": [...]}
            file_content_result_data = controller.search_file( # <-- Nenne es passend
                path=request.file_path,
                query=request.query_input,
            )
            # Verpacke das Ergebnis in das 'data' Feld des SearchResult Modells
            # Füge eine passende Nachricht hinzu
            return SearchResult(
                message=f"Suche in Datei '{request.file_path}' abgeschlossen.", # <-- Füge eine Nachricht hinzu
                data=file_content_result_data # <-- Setze das Ergebnis in das 'data' Feld
            )
        else:
            # Allgemeine Dateisuche
            # controller.search_files sollte die Struktur {"message": "...", "data": [...]} zurückgeben
            result = controller.search_files(
                query=request.query_input
            )
            # Das Ergebnis von search_files hat bereits die Struktur {"message": "...", "data": [...]},
            # die dem SearchResult Modell entspricht. Wir können es direkt zurückgeben.
            return SearchResult(**result) # <-- Hier passt es so


    except ValueError as ve:
        # Fange spezifische ValueErrors vom Scanner ab und gib eine 400 Bad Request zurück
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        # Fange andere unerwartete Fehler ab und gib eine 500 Internal Server Error zurück
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update/")
async def update_file(update: FileUpdate):
    response = controller.update_file(update.model_dump())
    return response

@router.post("/open_file/{file_path:path}")
async def open_file(file_path: str):
    try:
        result = controller.open(prepare_path(file_path))
        return {"message": result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/explorer_open_file/{file_path:path}")
async def explorer_open_file(file_path: str):
    msg = controller.open_explorer(prepare_path(file_path))
    return {"message": msg}

@router.post("/write_file/", response_model=dict[str, str])
async def write_file(request: FileWriteRequest):
    if not controller.write(request.file_path, request.content):
        raise HTTPException(status_code=500, detail="Fehler beim Schreiben der Datei.")
    return {"message": "Datei erfolgreich gespeichert", "path": request.file_path}

@router.post("/update_scanner_config/", response_model=FileScanResponse)
async def update_scanner_config(config: ScannerConfig):
    scanner = controller.file_scanner

    if config.base_dirs:
        scanner.base_dirs = [b.strip() for b in config.base_dirs if b.strip()]
    if config.extensions:
        scanner.extensions = [e.lower().strip() for e in config.extensions if e.strip()]
    if config.index_content is not None:
        scanner.index_content = config.index_content
    if config.convert_pdf is not None:
        scanner.convert_pdf = config.convert_pdf
    if config.max_size_kb:
        scanner.max_size_kb = config.max_size_kb
    if config.max_content_size_let:
        scanner.max_content_size_let = config.max_content_size_let

    return {"message": "Scanner-Konfiguration aktualisiert.", "config": get_scanner_config()}

@router.get("/file/", response_model=FileInfo)
async def get_file_info(file_path: str):
    file_info = controller.get_file_info(prepare_path(file_path))
    if not file_info:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    return FileInfo(**file_info)

@router.get("/get_scanner_config/", response_model=FileScanResponse)
async def get_scanner_configurations():
    return {'message': 'Scanner-Konfigurationen erfolgreich geladen.', 'config': get_scanner_config()}

@router.delete("/delete_file/")
async def delete_file(file_path: str):
    result = controller.delete_file(prepare_path(file_path))
    if "Fehler" in result["message"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result

@router.get("/api/find_old_files", response_model=List[OldFileInfo])
async def get_old_files(
    params: OldFilesQueryParams = Depends(),
):
    """
    Endpoint zum Finden alter Dateien basierend auf optionalen Parametern.
    """
    if params.max_files is not None and params.max_files < 0:
        raise HTTPException(status_code=400, detail="max_files muss >= 0 sein")
    if params.max_age_days is not None and params.max_age_days < 0:
        raise HTTPException(status_code=400, detail="max_age_days muss >= 0 sein")
    try:
        old_files = controller.find_old_files(
            max_files=params.max_files,
            max_age_days=params.max_age_days,
            sort_by=params.sort_by,
            sort_order=params.sort_order
        )
        return old_files # FastAPI serialisiert die Liste von OldFileInfo Objekten automatisch zu JSON
    except Exception as e:
        print(f"Interner Serverfehler beim Suchen alter Dateien: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler bei der Dateisuche")

@router.post("/process_pdf_directory/")
async def process_pdf_directory(request: PDFProcessDirectoryRequest):
    ignored_dir_names = [ignored_dir.strip() for ignored_dir in request.ignored_dir_names.split(',') if ignored_dir] if request.ignored_dir_names else []

    output_subdir = request.output_subdir if request.output_subdir else None
    output_prefix = request.output_prefix if request.output_prefix else None
    overwrite = request.overwrite if request.overwrite else None

    return controller.process_pdf_directory(
        prepare_path(request.base_dir),
        output_subdir,
        output_prefix,
        overwrite,
        ignored_dir_names,
        request.max_workers
    )

@router.post("/process_pdf_file/")
async def process_pdf_file(request: PDFProcessFileRequest):
    return controller.process_pdf_file(prepare_path(request.input_file), prepare_path(request.output_file))

@router.post("/process_index/")
async def process_index(overwrite: bool = False):
    result = controller.process_index(overwrite)
    return {"message": result["message"]}

@router.post("/file_structure/")
async def get_file_structure(path: str = None, force_rescan: bool = False):
    """
    Gibt eine JSON-Struktur der Datei-Struktur zurück.
    Optional kann ein Pfad angegeben werden, um die Struktur ab diesem Pfad zu erhalten.
    Mit force_rescan=True wird ein Neuscan erzwungen.
    """
    try:
        structure = controller.get_file_structure(path, force_rescan=force_rescan)
        if structure is None and path is not None:
            raise HTTPException(status_code=404, detail="Pfad nicht gefunden")
        return {'message': 'Dateistruktur erfolgreich abgerufen.', 'structure': structure}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rescan_file_structure/")
async def rescan_file_structure(path: str = None):
    """
    Erzwingt einen Neuscan der Datei-Struktur und aktualisiert den Cache.
    Optional kann ein Pfad angegeben werden, ab dem neu gescannt werden soll.
    """
    try:
        structure = controller.rescan_file_structure(path)
        return {'message': 'Datei-Struktur erfolgreich neu gescannt und aktualisiert.', 'structure': structure}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/register/")
def register_user(admin_user: AdminUser):
    success, message = controller.account_manager.create_user(admin_user.username, admin_user.password, admin_user.admin_username, admin_user.admin_password, admin_user.is_admin)
    if success:
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": admin_user.username},
            expires_delta=access_token_expires
        )
        return {"message": message, "access_token": access_token, "token_type": "bearer"}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.post("/login/")
def login_user(user: User):
    if controller.verify_login(user.username, user.password):
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")

@router.post("/verify_password/")
def verify_password(user: User):
    verified = controller.account_manager.verify_password(user.username, user.password)
    return {'message': f"Der Nutzer {user.username} wurde erfolgreich Verifiziert!" if verified else f"Der Nutzer {user.username} konnte nicht Verifiziert werden!", 'verified': verified}

@app.post("/logout/")
def logout(request: LogoutRequest):
    controller.logout_user(request.username)
    return {"message": "Logout erfolgreich"}

@router.get("/auto_login/{username}")
def auto_login(username: str):
    if controller.check_auto_login(username):
        return {"message": "Auto-Login erfolgreich"}
    else:
        raise HTTPException(status_code=401, detail="Auto-Login nicht möglich")

@router.get("/users/{username}/admin/")
def get_user_admin_status(username: str):
    return {"isAdmin": controller.get_user_admin_status(username)}

@router.get("/users/{username}/reset_password/")
def get_user_password_reset_status(username: str):
    return {"passwordReset": controller.get_user_password_reset_status(username)}

# --- Benutzerverwaltung ---
@router.get("/users/")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")
    users = controller.account_manager.load_users()
    return [{"username": user["username"], "isAdmin": user["isAdmin"], "lastLogin": user["lastLogin"]} for user in users]

@router.post("/users/{username}/admin/")
async def set_user_admin_status(username: str, admin_user: User = Body(...), current_user: dict = Depends(get_current_user)):
    """Ändert den Admin-Status eines Benutzers."""
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")

    if not controller.account_manager.verify_password(admin_user.username, admin_user.password):
        raise HTTPException(status_code=403, detail="Ungültige Administrator Daten.")

    target_user = controller.account_manager.get_user(username)
    if not target_user:
        raise HTTPException(status_code=404, detail=f"Benutzer '{username}' nicht gefunden.")

    try:
        controller.change_admin_status(target_user, admin_user.model_dump()) # Logik im Controller
        return {"message": f"Admin-Status für Benutzer '{username}' erfolgreich geändert."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/change_username/')
async def change_username(
    user: User = Body(...),
    new_username: str = Body(...)
):
    if controller.account_manager.verify_password(user.username, user.password):
        try:
            controller.change_username(user, new_username)
            return {"message": f"Benutzername für Benutzer '{user.username}' erfolgreich geändert."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=403, detail="Invalid Login Data")

@app.post("/change_password/")
async def change_password(
    user: User = Body(...),
    new_password: str = Body(...)
):
    if controller.account_manager.verify_password(user.username, user.password):
        try:
            controller.change_password(user, new_password)
            return {"message": f"Passwort für Benutzer '{user.username}' erfolgreich geändert."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=403, detail="Invalid Login Data")

# Ersetze den alten `@router.post("/reset_password/{username}/")`-Endpoint
@router.post("/reset_password/{username}/")
async def reset_user_password(username: str, admin_user: User = Body(...), current_user: dict = Depends(get_current_user)):
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")

    target_user = controller.account_manager.get_user(username)
    if not target_user:
        raise HTTPException(status_code=404, detail=f"Benutzer '{username}' nicht gefunden.")

    # Admin verifiziert sich mit eigenem Passwort, das im Body mitgeschickt wird
    if not controller.account_manager.verify_password(current_user["username"], admin_user.password):
        raise HTTPException(status_code=401, detail="Falsches Administrator-Passwort.")

    # Die alte Controller-Methode wurde in `reset_password` im Controller angepasst.
    # Hier müssen wir den Aufruf anpassen.
    if controller.reset_password(username, admin_user):
         return {"message": f"Passwort-Reset für Benutzer '{username}' erfolgreich eingeleitet."}
    else:
         raise HTTPException(status_code=500, detail="Fehler beim Einleiten des Passwort-Resets.")

@router.delete("/delete_user/")
async def delete_user(user_to_delete: User = Body(...), current_user: dict = Depends(get_current_user)):
    """Löscht einen Benutzer. Erfordert das Passwort des ausführenden Benutzers zur Bestätigung."""

    # Der Benutzer, der die Aktion ausführt (und sein Passwort zur Bestätigung liefert)
    acting_user_name = current_user["username"]
    confirmation_password = user_to_delete.password # Das Passwort aus dem Request-Body ist IMMER das des Admins/ausführenden Nutzers

    # Der Benutzer, der gelöscht werden soll
    target_username = user_to_delete.username

    # Logik ist jetzt im Controller + Manager, wir rufen nur noch die sichere Methode auf.
    # Der Controller erwartet (ziel, ausführender_admin, admin_passwort)
    success, message = controller.remove_user(target_username, acting_user_name, confirmation_password)

    if not success:
        # Der AccountManager gibt jetzt spezifische Fehlermeldungen zurück.
        raise HTTPException(status_code=400, detail=message)

    return {"message": message}

# --- Einstellungen ---
@router.get("/settings/{username}")
async def get_user_settings(username: str, current_user: dict = Depends(get_current_user)):
    """Ruft die Einstellungen eines Benutzers ab."""
    settings = controller.account_manager.load_settings(username)
    return {"settings": settings}

@router.post("/settings/{username}")
async def save_user_settings(username: str, settings: Settings, current_user: dict = Depends(get_current_user)):
    """Speichert die Einstellungen eines Benutzers und wendet sie an."""
    if current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Nicht autorisiert, die Einstellungen anderer Benutzer zu ändern.")
    success, message = controller.account_manager.save_settings(username, settings.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail=message)  # Oder eine andere passende Fehlerbehandlung
    controller.apply_settings(settings)  # Hier die apply_settings aufrufen
    return {"message": "Einstellungen erfolgreich gespeichert und angewendet"}

# --- Datenbank-Operationen ---
@router.get("/database/{database_name}")
async def read_database(database_name: str, current_user: dict = Depends(get_current_user)):
    """Liest den Inhalt einer Datenbankdatei (JSON)."""
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")
    database_path = controller.get_database_path_by_name(database_name)
    if not database_path:
        raise HTTPException(status_code=400, detail="Ungültiger Datenbankname.")
    try:
        content = controller.read_json_file(database_path)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Lesen der Datenbank: {e}")

@router.post("/database/{database_name}")
# === GEÄNDERT: Erwarte ein DataWrapper Modell als Body Parameter ===
# Der Body des Requests wird nun gegen dieses Modell validiert.
async def write_database(database_name: str, body: DataWrapper, current_user: dict = Depends(get_current_user)):
    """
    Überschreibt den Inhalt einer Datenbankdatei (JSON).
    Erwartet einen Body der Form {"data": ...}, wobei ... ein Dictionary oder eine Liste ist.
    """
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")

    # Annahme: controller.get_database_path_by_name existiert und funktioniert
    database_path = controller.get_database_path_by_name(database_name)
    if not database_path:
        raise HTTPException(status_code=400, detail="Ungültiger Datenbankname.")

    try:
        # === GEÄNDERT: Greife auf die eigentlichen Daten über body.data zu ===
        # Die Validierung durch Pydantic stellt sicher, dass body.data entweder ein Dict oder eine List ist.
        controller.save_json_file(database_path, body.data)
        return {"message": f"Datenbank '{database_name}' erfolgreich aktualisiert."}
    except Exception as e:
        # Logge den Fehler serverseitig für Debugging
        print(f"Interner Serverfehler beim Schreiben der Datenbank '{database_name}': {e}")
        # Gib einen generischen Fehler an den Client zurück
        raise HTTPException(status_code=500, detail=f"Fehler beim Schreiben der Datenbank: {e}")

@router.post("/database/{database_name}/reload/")
async def reload_database(database_name: str):
    """Reloadet die Datenbank."""
    controller.reload_database(database_name)
    return {"message": f"Datenbank '{database_name}' erfolgreich neu geladen."}

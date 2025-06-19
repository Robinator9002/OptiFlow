from fastapi import FastAPI, HTTPException, Depends, status, Body
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import unquote, urlparse
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from fastapi.security import OAuth2PasswordBearer  # Für Security
from datetime import timedelta
from backend.controller.datei_controller import DateiController
from backend.api.models import (
    FileInfo, FileUpdate, SearchRequest, SearchResult,
    FileScanResponse, ScannerConfig, FileWriteRequest,
    PDFProcessDirectoryRequest, PDFProcessFileRequest,
    User, AdminUser, Settings, LogoutRequest, EventIn,
    SetAdminStatusRequest, ChangeUsernameRequest, ShutdownRequest,

    OldFileInfo, OldFilesQueryParams, ChangePasswordRequest,
    DataWrapper, DuplicateGroupsResponse, SearchDuplicatesRequest,
)
import datetime
from jose import jwt as jose_jwt
from jose.exceptions import JWTError
import os
import sys
import signal
from starlette.background import BackgroundTask
from starlette.responses import JSONResponse
import asyncio
import platform, string

# --- Models anpassen ---
# Wir machen die Admin-Credentials optional, damit wir sie bei der Ersteinrichtung weglassen können
class AdminUser(AdminUser):
    admin_username: Optional[str] = None
    admin_password: Optional[str] = None


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
        drives = []
        for letter in string.ascii_uppercase:
            drive = f"{letter}:\\"
            if os.path.exists(drive):
                drives.append(drive)
        return drives if drives else [os.path.join("C:", os.sep)]

    elif system == "Linux" or system == "Darwin":
        return ["/"]

    else:
        print(f"Warning: Unknown operating system '{system}'. Cannot determine base directories automatically.")
        return []

# --- Konfiguration ---
SYSTEM_LOWER = platform.system().lower()
OS_TOOL_DIR = SYSTEM_LOWER if SYSTEM_LOWER != 'darwin' else 'macos'

if getattr(sys, 'frozen', False):
    # Im PyInstaller-Bundle:
    # PyInstaller legt den `backend` Ordner unter `sys._MEIPASS/_internal/backend/` ab.
    # Die Tools sind dann darin: `sys._MEIPASS/_internal/backend/tools/windows`.
    bundle_base_for_backend = os.path.join(sys._MEIPASS, '_internal', 'backend')
    TOOLS_DIR = os.path.join(bundle_base_for_backend, 'tools', OS_TOOL_DIR)
else:
    # Normale Entwicklungsumgebung: tools sind direkt in backend/tools/windows
    TOOLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tools', OS_TOOL_DIR)

BASE_DIRS = get_base_directories();
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
    tools_dir=TOOLS_DIR,
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

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jose_jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Ungültige Anmeldedaten",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        user = controller.account_manager.get_user(username)
        if user is None:
            raise credentials_exception
        return user
    except JWTError:
        raise credentials_exception

# --- Routen ---
@app.get("/")
async def read_root():
    return {"message": "Hallo, Welt!"}

@app.post("/shutdown/")
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

# --- NEUER ENDPUNKT ---
@app.get("/api/no_users_exist", response_model=Dict[str, bool])
async def no_users_exist():
    """Prüft, ob Benutzer in der Datenbank vorhanden sind."""
    return {"no_users": not controller.account_manager.users}


# -- Events --
@app.post("/events")
async def add_event(event: EventIn):
    try:
        success = controller.add_event(event.frequency, event.times, event.event)
        if not success:
            raise HTTPException(status_code=400, detail="Event konnte nicht hinzugefügt werden.")
        return {"message": "Event erfolgreich hinzugefügt"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/events/{event_index}")
async def update_event(event_index: int, event: EventIn):
    try:
        success = controller.update_event(event_index, event.frequency, event.times, event.event)
        if not success:
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return {"message": "Event erfolgreich aktualisiert"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/events/{event_index}")
async def delete_event(event_index: int):
    try:
        success = controller.delete_event(event_index)
        if not success:
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return {"message": "Event erfolgreich gelöscht"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/events", response_model=List[EventIn])
async def get_all_events():
    try:
        events = controller.get_all_events()
        return events
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/events/{event_index}/execute")
async def execute_event(event_index: int):
    try:
        success = controller.execute_event(event_index)
        if not success:
            raise HTTPException(status_code=404, detail="Event nicht gefunden oder Ausführung fehlgeschlagen.")
        return {"message": "Event erfolgreich ausgeführt"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/events/{event_index}", response_model=EventIn)
async def find_event_by_index(event_index: int):
    try:
        event = controller.find_event_by_index(event_index)
        if not event:
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return event
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/events/start-monitoring")
async def start_event_monitoring():
    try:
        controller.start_event_monitoring()
        return {"message": "Event-Überwachung gestartet"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/events/save")
async def save_events_to_file():
    try:
        controller.save_events_to_file()
        return {"message": "Events erfolgreich gespeichert"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/events/load")
async def load_events_from_file():
    try:
        controller.load_events_from_file()
        return {"message": "Events erfolgreich geladen"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- DEDUPING ENDPOINTS (NEU) ---
@app.post("/find_duplicates/")
async def find_duplicates():
    try:
        result = controller.find_duplicates()
        return {"message": "Duplikatsuche gestartet und Ergebnisse gespeichert.", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/load_duplicates/")
async def load_duplicates():
    try:
        result = controller.load_duplicates()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save_duplicates/")
async def save_duplicates():
    try:
        result = controller.save_duplicates()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search_duplicates/", response_model=DuplicateGroupsResponse)
async def search_duplicates(request: SearchDuplicatesRequest):
    try:
        result = controller.search_duplicates(
            query=request.query,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            length_range_filter=request.length_range_filter,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/load_index/", response_model=FileScanResponse)
async def load_index():
    controller.load_index()
    return {"message": "Index erfolgreich geladen."}

@app.post("/delete_index/", response_model=FileScanResponse)
async def delete_index():
    controller.file_scanner.delete_index()
    controller.save_index()
    controller.save_duplicates()
    return {"message": "Index gelöscht und neu geladen."}

@app.post("/scan_files/", response_model=FileScanResponse)
async def scan_files():
    result = controller.scan_files()
    return {"message": result["message"]}

@app.post("/actualize_index/", response_model=FileScanResponse)
async def actualize_index():
    result = controller.actualize_index()
    return {"message": result["message"]}

@app.post("/search/", response_model=SearchResult)
def unified_search(request: SearchRequest):
    try:
        if request.file_path:
            file_content_result_data = controller.search_file(
                path=request.file_path,
                query=request.query_input,
            )
            return SearchResult(
                message=f"Suche in Datei '{request.file_path}' abgeschlossen.",
                data=file_content_result_data
            )
        else:
            result = controller.search_files(
                query=request.query_input
            )
            return SearchResult(**result)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update/")
async def update_file(update: FileUpdate):
    response = controller.update_file(update.model_dump())
    return response

@app.post("/open_file/{file_path:path}")
async def open_file(file_path: str):
    try:
        result = controller.open(prepare_path(file_path))
        return {"message": result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.post("/explorer_open_file/{file_path:path}")
async def explorer_open_file(file_path: str):
    msg = controller.open_explorer(prepare_path(file_path))
    return {"message": msg}

@app.post("/write_file/", response_model=dict[str, str])
async def write_file(request: FileWriteRequest):
    if not controller.write(request.file_path, request.content):
        raise HTTPException(status_code=500, detail="Fehler beim Schreiben der Datei.")
    return {"message": "Datei erfolgreich gespeichert", "path": request.file_path}

@app.post("/update_scanner_config/", response_model=FileScanResponse)
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

@app.get("/file/", response_model=FileInfo)
async def get_file_info(file_path: str):
    file_info = controller.get_file_info(prepare_path(file_path))
    if not file_info:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    return FileInfo(**file_info)

@app.get("/get_scanner_config/", response_model=FileScanResponse)
async def get_scanner_configurations():
    return {'message': 'Scanner-Konfigurationen erfolgreich geladen.', 'config': get_scanner_config()}

@app.delete("/delete_file/")
async def delete_file(file_path: str):
    result = controller.delete_file(prepare_path(file_path))
    if "Fehler" in result["message"]:
        raise HTTPException(status_code=404, detail=result["message"])
    return result

@app.get("/api/find_old_files", response_model=List[OldFileInfo])
async def get_old_files(
    params: OldFilesQueryParams = Depends(),
):
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
        return old_files
    except Exception as e:
        print(f"Interner Serverfehler beim Suchen alter Dateien: {e}")
        raise HTTPException(status_code=500, detail="Interner Serverfehler bei der Dateisuche")

@app.post("/process_pdf_directory/")
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

@app.post("/process_pdf_file/")
async def process_pdf_file(request: PDFProcessFileRequest):
    return controller.process_pdf_file(prepare_path(request.input_file), prepare_path(request.output_file))

@app.post("/process_index/")
async def process_index(overwrite: bool = False):
    result = controller.process_index(overwrite)
    return {"message": result["message"]}

@app.post("/file_structure/")
async def get_file_structure(path: str = None, force_rescan: bool = False):
    try:
        structure = controller.get_file_structure(path, force_rescan=force_rescan)
        if structure is None and path is not None:
            raise HTTPException(status_code=404, detail="Pfad nicht gefunden")
        return {'message': 'Dateistruktur erfolgreich abgerufen.', 'structure': structure}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rescan_file_structure/")
async def rescan_file_structure(path: str = None):
    try:
        structure = controller.rescan_file_structure(path)
        return {'message': 'Datei-Struktur erfolgreich neu gescannt und aktualisiert.', 'structure': structure}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPUNKT FÜR REGISTRIERUNG ANGEPASST ---
@app.post("/register/")
def register_user(admin_user: AdminUser):
    # Die Logik wurde in AccountManager verschoben. Wir übergeben einfach die Daten.
    # admin_username und admin_password können None sein.
    success, message = controller.account_manager.create_user(
        admin_user.username,
        admin_user.password,
        admin_user.admin_username,
        admin_user.admin_password,
        admin_user.is_admin
    )
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

@app.post("/verify_password/")
def verify_password(user: User):
    verified = controller.account_manager.verify_password(user.username, user.password)
    return {'message': f"Der Nutzer {user.username} wurde erfolgreich Verifiziert!" if verified else f"Der Nutzer {user.username} konnte nicht Verifiziert werden!", 'verified': verified}

@app.post("/logout/")
def logout(request: LogoutRequest):
    controller.logout_user(request.username)
    return {"message": "Logout erfolgreich"}

@app.get("/auto_login/{username}")
def auto_login(username: str):
    if controller.check_auto_login(username):
        return {"message": "Auto-Login erfolgreich"}
    else:
        raise HTTPException(status_code=401, detail="Auto-Login nicht möglich")

@app.get("/users/{username}/admin/")
def get_user_admin_status(username: str):
    return {"isAdmin": controller.get_user_admin_status(username)}

# --- Benutzerverwaltung ---
@app.get("/users/")
async def get_all_users(current_user: dict = Depends(get_current_user)):
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")
    users = controller.account_manager.load_users()
    return [{"username": user["username"], "isAdmin": user["isAdmin"], "lastLogin": user["lastLogin"]} for user in users]

@app.post("/users/{target_username}/admin/")
async def set_user_admin_status(target_username: str, request_data: SetAdminStatusRequest, current_user: dict = Depends(get_current_user)):
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")
    
    admin_username = current_user["username"]
    success, message = controller.change_admin_status(
        target_username=target_username,
        admin_username=admin_username,
        admin_password=request_data.admin_password,
        new_status=request_data.new_status
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

@app.post('/change_username/')
async def change_username(request_data: ChangeUsernameRequest, current_user: dict = Depends(get_current_user)):
    if current_user["username"] != request_data.user.username:
         raise HTTPException(status_code=403, detail="Nicht autorisiert.")
         
    success, message = controller.change_username(request_data.user, request_data.new_username)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

@app.post("/change_password/")
async def change_password(request_data: ChangePasswordRequest):
    success = controller.change_password(request_data.user, request_data.admin_user, request_data.password_reset, request_data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Altes Passwort falsch oder Benutzer nicht gefunden.")
    return {"message": f"Passwort für Benutzer '{request_data.user.username}' erfolgreich geändert."}

@app.delete("/delete_user/")
async def delete_user(user_to_delete: User = Body(...), current_user: dict = Depends(get_current_user)):
    acting_user_name = current_user["username"]
    confirmation_password = user_to_delete.password 
    target_username = user_to_delete.username
    success, message = controller.remove_user(target_username, acting_user_name, confirmation_password)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}

# --- Einstellungen ---
@app.get("/settings/{username}")
async def get_user_settings(username: str, current_user: dict = Depends(get_current_user)):
    settings = controller.account_manager.load_settings(username)
    return {"settings": settings}

@app.post("/settings/{username}")
async def save_user_settings(username: str, settings: Settings, current_user: dict = Depends(get_current_user)):
    if current_user["username"] != username:
        raise HTTPException(status_code=403, detail="Nicht autorisiert, die Einstellungen anderer Benutzer zu ändern.")
    success, message = controller.account_manager.save_settings(username, settings.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail=message)
    controller.apply_settings(settings)
    return {"message": "Einstellungen erfolgreich gespeichert und angewendet"}

# --- Datenbank-Operationen ---
@app.get("/database/{database_name}")
async def read_database(database_name: str, current_user: dict = Depends(get_current_user)):
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

@app.post("/database/{database_name}")
async def write_database(database_name: str, body: DataWrapper, current_user: dict = Depends(get_current_user)):
    if not current_user["isAdmin"]:
        raise HTTPException(status_code=403, detail="Nur für Administratoren zugänglich.")

    database_path = controller.get_database_path_by_name(database_name)
    if not database_path:
        raise HTTPException(status_code=400, detail="Ungültiger Datenbankname.")

    try:
        controller.save_json_file(database_path, body.data)
        return {"message": f"Datenbank '{database_name}' erfolgreich aktualisiert."}
    except Exception as e:
        print(f"Interner Serverfehler beim Schreiben der Datenbank '{database_name}': {e}")
        raise HTTPException(status_code=500, detail=f"Fehler beim Schreiben der Datenbank: {e}")

@app.post("/database/{database_name}/reload/")
async def reload_database(database_name: str):
    controller.reload_database(database_name)
    return {"message": f"Datenbank '{database_name}' erfolgreich neu geladen."}

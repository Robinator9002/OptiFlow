import uvicorn
import multiprocessing
import os
import sys
import signal
import asyncio
import platform
import string
from fastapi import FastAPI, HTTPException, Depends, status, Body
from fastapi.middleware.cors import CORSMiddleware
from urllib.parse import unquote
from contextlib import asynccontextmanager
from typing import Dict, List, Optional
from fastapi.security import OAuth2PasswordBearer
from datetime import timedelta, datetime
from jose import jwt as jose_jwt, JWTError
from starlette.responses import JSONResponse

# Importiere deine eigenen Module
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

# ================================================================= #
#  Globale Variablen und Konfiguration (leichtgewichtige Objekte)
# ================================================================= #

if getattr(sys, 'frozen', False):
    base_path = os.path.dirname(sys.executable)
else:
    base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

DATA_DIR = os.path.join(base_path, "data")
os.makedirs(DATA_DIR, exist_ok=True)
SHUTDOWN_FLAG_FILE = os.path.join(DATA_DIR, "_shutdown_request.flag")
log_dir = os.path.join(base_path, 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file_path = os.path.join(log_dir, 'backend_runtime.log')


# Platzhalter für die schweren Objekte, die später initialisiert werden
controller: Optional[DateiController] = None
app: Optional[FastAPI] = None

# Logging-Konfiguration
LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "()": "uvicorn.logging.DefaultFormatter",
            "fmt": "%(levelprefix)s %(asctime)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
            "use_colors": False,
        },
    },
    "handlers": {
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "default",
            "filename": log_file_path,
            "maxBytes": 1024 * 1024 * 5,
            "backupCount": 3,
        },
    },
    "loggers": {
        "uvicorn": {"handlers": ["file"], "level": "INFO"},
        "uvicorn.error": {"handlers": ["file"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["file"], "level": "INFO", "propagate": False},
    },
}

# --- Models anpassen ---
class AdminUser(AdminUser):
    admin_username: Optional[str] = None
    admin_password: Optional[str] = None

# ================================================================= #
#  App-Erstellungsfunktion
# ================================================================= #

def create_app() -> FastAPI:
    """Erstellt, konfiguriert und gibt die FastAPI-Anwendung mit allen Routen zurück."""
    global controller, app

    # --- Controller-Initialisierung ---
    def get_base_directories():
        system = platform.system()
        if system == "Windows":
            drives = [f"{letter}:\\" for letter in string.ascii_uppercase if os.path.exists(f"{letter}:\\")]
            return drives if drives else ["C:\\"]
        return ["/"]

    SYSTEM_LOWER = platform.system().lower()
    OS_TOOL_DIR = SYSTEM_LOWER if SYSTEM_LOWER != 'darwin' else 'macos'
    if getattr(sys, 'frozen', False):
        bundle_base_for_backend = os.path.join(sys._MEIPASS, 'backend')
        TOOLS_DIR = os.path.join(bundle_base_for_backend, 'tools', OS_TOOL_DIR)
    else:
        TOOLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tools', OS_TOOL_DIR)
    
    controller = DateiController(
        tools_dir=TOOLS_DIR,
        base_dirs=get_base_directories(),
        extensions=[".txt", ".md", ".csv", ".json", ".xml", ".py", ".html", ".css", ".js", ".pdf", ".docx"],
        index_file=os.path.join(DATA_DIR, "index.json"),
        structure_file=os.path.join(DATA_DIR, "structure.json"),
        data_file=os.path.join(DATA_DIR, "user.json"),
        events_file=os.path.join(DATA_DIR, "events.json"),
        dupe_file=os.path.join(DATA_DIR, "dupes.json"),
        index_content=True,
    )

    # --- Lifespan-Manager ---
    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        print("Serverstart: Lade Index...")
        controller.load_index()
        print("Serverstart: Starte Event Manager...")
        controller.start_event_monitoring()
        shutdown_task = asyncio.create_task(check_for_shutdown())
        yield
        print("Serverende: Speichere Index...")
        controller.save_index()
        shutdown_task.cancel()

    # --- App-Initialisierung ---
    app = FastAPI(lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Security & Auth ---
    oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
    SECRET_KEY = os.getenv("OPTIFLOW_SECRET_KEY", "ein-sehr-zufaelliger-und-sicherer-standard-key-fuer-die-entwicklung")
    ALGORITHM = "HS256"

    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        expire = datetime.now(datetime.timezone.utc) + (expires_delta or timedelta(minutes=1440))
        to_encode.update({"exp": expire})
        return jose_jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    async def get_current_user(token: str = Depends(oauth2_scheme)):
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: Optional[str] = payload.get("sub")
            if not username: raise credentials_exception
            user = controller.account_manager.get_user(username)
            if not user: raise credentials_exception
            return user
        except JWTError:
            raise credentials_exception

    # --- Routen-Definitionen ---
    
    @app.get("/")
    def read_root():
        return {"message": "OptiFlow Backend läuft!"}

    @app.post("/shutdown/")
    async def shutdown_request(data: ShutdownRequest, current_user: dict = Depends(get_current_user)):
        if not current_user or not current_user.get("isAdmin"):
            raise HTTPException(status_code=403, detail="Nicht autorisiert!")
        if not controller.account_manager.verify_password(current_user["username"], data.password):
            raise HTTPException(status_code=401, detail="Ungültiges Passwort.")
        with open(SHUTDOWN_FLAG_FILE, "w") as f:
            f.write("shutdown")
        return JSONResponse({"detail": "Shutdown-Anfrage erhalten. Server wird in Kürze beendet."})

    @app.get("/api/no_users_exist", response_model=Dict[str, bool])
    async def no_users_exist():
        return {"no_users": not controller.account_manager.users}

    @app.post("/events")
    async def add_event_route(event: EventIn, current_user: dict = Depends(get_current_user)):
        if not current_user.get("isAdmin"): raise HTTPException(status_code=403, detail="Admin erforderlich.")
        if not controller.add_event(event.frequency, event.times, event.event):
            raise HTTPException(status_code=400, detail="Event konnte nicht hinzugefügt werden.")
        return {"message": "Event erfolgreich hinzugefügt"}

    @app.put("/events/{event_index}")
    async def update_event_route(event_index: int, event: EventIn, current_user: dict = Depends(get_current_user)):
        if not current_user.get("isAdmin"): raise HTTPException(status_code=403, detail="Admin erforderlich.")
        if not controller.update_event(event_index, event.frequency, event.times, event.event):
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return {"message": "Event erfolgreich aktualisiert"}

    @app.delete("/events/{event_index}")
    async def delete_event_route(event_index: int, current_user: dict = Depends(get_current_user)):
        if not current_user.get("isAdmin"): raise HTTPException(status_code=403, detail="Admin erforderlich.")
        if not controller.delete_event(event_index):
            raise HTTPException(status_code=404, detail="Event nicht gefunden.")
        return {"message": "Event erfolgreich gelöscht"}

    @app.get("/events", response_model=List[EventIn])
    async def get_all_events_route(current_user: dict = Depends(get_current_user)):
        if not current_user.get("isAdmin"): raise HTTPException(status_code=403, detail="Admin erforderlich.")
        return controller.get_all_events()

    @app.post("/events/{event_index}/execute")
    async def execute_event_route(event_index: int, current_user: dict = Depends(get_current_user)):
        if not current_user.get("isAdmin"): raise HTTPException(status_code=403, detail="Admin erforderlich.")
        if not controller.execute_event(event_index):
            raise HTTPException(status_code=404, detail="Event nicht gefunden oder Ausführung fehlgeschlagen.")
        return {"message": "Event erfolgreich ausgeführt"}

    @app.post("/scan_files/", response_model=FileScanResponse)
    async def scan_files_route(current_user: dict = Depends(get_current_user)):
        if not current_user.get("isAdmin"): raise HTTPException(status_code=403, detail="Admin erforderlich.")
        result = controller.scan_files()
        return {"message": result.get("message", "Scan abgeschlossen")}
        
    @app.post("/actualize_index/", response_model=FileScanResponse)
    async def actualize_index(current_user: dict = Depends(get_current_user)):
        if not current_user.get("isAdmin"): raise HTTPException(status_code=403, detail="Admin erforderlich.")
        result = controller.actualize_index()
        return {"message": result["message"]}

    @app.post("/search/", response_model=SearchResult)
    def unified_search(request: SearchRequest):
        try:
            if request.file_path:
                result_data = controller.search_file(path=request.file_path, query=request.query_input)
                return {"message": f"Suche in Datei '{request.file_path}' abgeschlossen.", "data": result_data}
            result = controller.search_files(query=request.query_input)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    @app.post("/login/")
    def login_for_access_token(user_data: User):
        if controller.verify_login(user_data.username, user_data.password):
            access_token = create_access_token(data={"sub": user_data.username})
            return {"access_token": access_token, "token_type": "bearer"}
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    @app.post("/register/")
    def register_user_route(admin_user: AdminUser):
        success, message = controller.account_manager.create_user(
            admin_user.username,
            admin_user.password,
            admin_user.admin_username,
            admin_user.admin_password,
            admin_user.is_admin
        )
        if not success:
            raise HTTPException(status_code=400, detail=message)
        access_token = create_access_token(data={"sub": admin_user.username})
        return {"message": message, "access_token": access_token, "token_type": "bearer"}

    @app.post("/settings/{username}")
    async def save_user_settings(username: str, settings: Settings, current_user: dict = Depends(get_current_user)):
        if current_user.get("username") != username and not current_user.get("isAdmin"):
            raise HTTPException(status_code=403, detail="Nicht autorisiert.")
        controller.apply_settings(settings)
        success, message = controller.account_manager.save_settings(username, settings.model_dump(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=500, detail=message)
        return {"message": "Einstellungen erfolgreich gespeichert und angewendet"}

    @app.get("/settings/{username}")
    async def get_user_settings(username: str, current_user: dict = Depends(get_current_user)):
        if current_user["username"] != username and not current_user["isAdmin"]:
            raise HTTPException(status_code=403, detail="Nicht autorisiert.")
        settings = controller.account_manager.load_settings(username)
        return {"settings": settings}
        
    @app.post("/find_duplicates/")
    async def find_duplicates(current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        result = controller.find_duplicates()
        return {"message": "Duplikatsuche gestartet und Ergebnisse gespeichert.", "result": result}

    @app.post("/load_duplicates/")
    async def load_duplicates(current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        return controller.load_duplicates()
        
    @app.post("/search_duplicates/", response_model=DuplicateGroupsResponse)
    async def search_duplicates(request: SearchDuplicatesRequest, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        return controller.search_duplicates(
            query=request.query,
            sort_by=request.sort_by,
            sort_order=request.sort_order,
            length_range_filter=request.length_range_filter,
        )

    @app.post("/load_index/", response_model=FileScanResponse)
    async def load_index(current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        controller.load_index()
        return {"message": "Index erfolgreich geladen."}

    @app.post("/delete_index/", response_model=FileScanResponse)
    async def delete_index(current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        return controller.delete_index()
        
    @app.post("/open_file/{file_path:path}")
    async def open_file(file_path: str, current_user: dict = Depends(get_current_user)):
        try:
            return {"message": controller.open(unquote(file_path))}
        except FileNotFoundError as e:
            raise HTTPException(status_code=404, detail=str(e))
    
    @app.post("/explorer_open_file/{file_path:path}")
    async def explorer_open_file(file_path: str, current_user: dict = Depends(get_current_user)):
        return {"message": controller.open_explorer(unquote(file_path))}

    @app.post("/write_file/", response_model=dict[str, str])
    async def write_file(request: FileWriteRequest, current_user: dict = Depends(get_current_user)):
        if not controller.write(request.file_path, request.content):
            raise HTTPException(status_code=500, detail="Fehler beim Schreiben der Datei.")
        return {"message": "Datei erfolgreich gespeichert", "path": request.file_path}

    @app.get("/file/", response_model=FileInfo)
    async def get_file_info(file_path: str):
        file_info = controller.get_file_info(unquote(file_path))
        if not file_info:
            raise HTTPException(status_code=404, detail="Datei nicht gefunden")
        return file_info

    @app.delete("/delete_file/")
    async def delete_file_route(file_path: str, current_user: dict = Depends(get_current_user)):
        result = controller.delete_file(unquote(file_path))
        if "Fehler" in result["message"]:
            raise HTTPException(status_code=404, detail=result["message"])
        return result

    @app.get("/api/find_old_files", response_model=List[OldFileInfo])
    async def get_old_files(params: OldFilesQueryParams = Depends(), current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        return controller.find_old_files(
            max_files=params.max_files,
            max_age_days=params.max_age_days,
            sort_by=params.sort_by,
            sort_order=params.sort_order
        )

    @app.post("/process_index/")
    async def process_index(overwrite: bool = False, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        return controller.process_index(overwrite)

    @app.post("/file_structure/")
    async def get_file_structure(path: str = None, force_rescan: bool = False, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        structure = controller.get_file_structure(path, force_rescan=force_rescan)
        if structure is None and path:
            raise HTTPException(status_code=404, detail="Pfad nicht gefunden")
        return {'message': 'Dateistruktur erfolgreich abgerufen.', 'structure': structure}

    @app.post("/rescan_file_structure/")
    async def rescan_file_structure(path: str = None, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        structure = controller.rescan_file_structure(path)
        return {'message': 'Datei-Struktur erfolgreich neu gescannt und aktualisiert.', 'structure': structure}

    @app.post("/verify_password/")
    def verify_password_route(user: User, current_user: dict = Depends(get_current_user)):
        if current_user.get("username") != user.username: raise HTTPException(status_code=403, detail="Nicht autorisiert.")
        verified = controller.account_manager.verify_password(user.username, user.password)
        return {'verified': verified}

    @app.get("/users/")
    async def get_all_users(current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        users = controller.account_manager.load_users()
        return [{"username": u["username"], "isAdmin": u["isAdmin"], "lastLogin": u.get("lastLogin")} for u in users]
    
    @app.post("/users/{target_username}/admin/")
    async def set_user_admin_status(target_username: str, request_data: SetAdminStatusRequest, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        success, message = controller.change_admin_status(target_username, current_user["username"], request_data.admin_password, request_data.new_status)
        if not success: raise HTTPException(status_code=400, detail=message)
        return {"message": message}

    @app.post('/change_username/')
    async def change_username_route(request_data: ChangeUsernameRequest, current_user: dict = Depends(get_current_user)):
        if current_user["username"] != request_data.user.username: raise HTTPException(status_code=403, detail="Nicht autorisiert.")
        success, message = controller.change_username(request_data.user, request_data.new_username)
        if not success: raise HTTPException(status_code=400, detail=message)
        return {"message": message}

    @app.post("/change_password/")
    async def change_password_route(request_data: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
        # Security check: User can only change their own password, or an admin can reset anyone's.
        is_self_change = current_user["username"] == request_data.user.username
        is_admin_reset = current_user["isAdmin"] and request_data.password_reset
        if not (is_self_change or is_admin_reset): raise HTTPException(status_code=403, detail="Nicht autorisiert.")
        
        success, message = controller.change_password(request_data.user, request_data.admin_user, request_data.password_reset, request_data.new_password)
        if not success: raise HTTPException(status_code=400, detail=message)
        return {"message": message}

    @app.delete("/delete_user/")
    async def delete_user_route(user_to_delete: User = Body(...), current_user: dict = Depends(get_current_user)):
        success, message = controller.remove_user(user_to_delete.username, current_user["username"], user_to_delete.password)
        if not success: raise HTTPException(status_code=400, detail=message)
        return {"message": message}

    @app.get("/database/{database_name}")
    async def read_database(database_name: str, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        path = controller.get_database_path_by_name(database_name)
        if not path: raise HTTPException(status_code=404, detail="Datenbank nicht gefunden.")
        return {"content": controller.read_json_file(path)}

    @app.post("/database/{database_name}")
    async def write_database(database_name: str, body: DataWrapper, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        path = controller.get_database_path_by_name(database_name)
        if not path: raise HTTPException(status_code=404, detail="Datenbank nicht gefunden.")
        result = controller.save_json_file(path, body.data)
        if "error" in result: raise HTTPException(status_code=500, detail=result["error"])
        return result

    @app.post("/database/{database_name}/reload/")
    async def reload_database(database_name: str, current_user: dict = Depends(get_current_user)):
        if not current_user["isAdmin"]: raise HTTPException(status_code=403, detail="Admin erforderlich.")
        controller.reload_database(database_name)
        return {"message": f"Datenbank '{database_name}' erfolgreich neu geladen."}

    return app

# ================================================================= #
#  Haupt-Ausführungspunkt des Skripts
# ================================================================= #

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

if __name__ == "__main__":
    multiprocessing.freeze_support()
    
    # Lazy-loaded app instance
    app_instance = create_app()

    if "entwicklung" in os.getenv("OPTIFLOW_SECRET_KEY", "entwicklung"):
        print("\nWARNUNG: Es wird der Standard-Entwicklungsschlüssel verwendet.\n")

    uvicorn.run(
        app_instance,
        host="127.0.0.1",
        port=8000,
        reload=False,
        workers=1,
        log_config=LOGGING_CONFIG,
    )

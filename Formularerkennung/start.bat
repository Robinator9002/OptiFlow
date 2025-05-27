@echo off
REM Aktiviere die virtuelle Umgebung
call .venv\Scripts\activate

REM Wechsle in das Backend-Verzeichnis und starte uvicorn
start cmd /k uvicorn backend.main:app

REM Warte, bis Uvicorn gestartet ist (Python-Skript verwenden)
cd backend/api
python wait_for_uvicorn.py

REM Wechsle in das Frontend-Verzeichnis und starte npm
cd ..\..\frontend
start cmd /k "npm run dev"

REM Warte kurz, damit npm den Dev-Server starten kann (alternativ: Port-Check wie unten)
timeout /t 5 /nobreak > NUL

REM Öffne Website im Standardbrowser
start http://localhost:5173
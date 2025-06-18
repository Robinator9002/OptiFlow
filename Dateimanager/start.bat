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
npm run app:dev
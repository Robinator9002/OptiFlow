@echo off
REM Aktiviere die virtuelle Umgebung
call .venv\Scripts\activate

REM Wechsle in das Backend-Verzeichnis und starte uvicorn
start cmd /k uvicorn backend.main:app
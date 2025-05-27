@echo off
REM Aktiviere die virtuelle Umgebung
call .venv\Scripts\activate

REM Wechsle in das Frontend-Verzeichnis und starte npm
cd frontend
npm start
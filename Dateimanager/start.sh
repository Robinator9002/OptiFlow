# =================================================================
# start.sh (Kombinierter Start für Backend & Frontend)
# =================================================================
#!/bin/bash

# Funktion zum sauberen Beenden im Fehlerfall oder bei Abbruch (Strg+C)
cleanup() {
    echo "Beende Hintergrundprozesse..."
    # Beendet den Uvicorn-Prozess, dessen PID wir gespeichert haben
    if [ -n "$UVICORN_PID" ]; then
        kill $UVICORN_PID
    fi
    exit
}

# Registriert die cleanup-Funktion, die bei Skript-Ende aufgerufen wird
trap cleanup INT TERM EXIT

# Aktiviere die virtuelle Umgebung
echo "Aktiviere virtuelle Umgebung..."
source .venv/bin/activate

# Starte Backend-Server (Uvicorn) im Hintergrund
echo "Starte Backend-Server (Uvicorn) im Hintergrund..."
# KORREKTUR: --app-dir ist expliziter und vermeidet Pfad-Probleme.
# Der Befehl 'uvicorn backend.main:app' funktioniert zwar oft,
# ist aber implizit. So ist es sauberer.
uvicorn main:app --app-dir backend &

# Speichere die Prozess-ID (PID) des zuletzt gestarteten Hintergrundprozesses
UVICORN_PID=$!

# Warte kurz, damit der Server hochfahren kann
echo "Warte 3 Sekunden, damit der Server starten kann..."
sleep 3

# Starte Frontend-Server (npm)
echo "Starte Frontend-Server (npm)..."
npm run app:dev --prefix frontend

# KORREKTUR: Die überflüssige schließende Klammer '}' wurde entfernt.
# Sie hätte einen Syntaxfehler verursacht.

# =================================================================
# start_app.sh (Startet NUR das Frontend)
# =================================================================
#!/bin/bash

# Aktiviert die virtuelle Umgebung
source .venv/bin/activate

# Wechselt ins Frontend-Verzeichnis und startet npm
echo "Starte Frontend-Server (npm)..."
# VERBESSERUNG: --prefix verwenden, um 'cd' zu vermeiden. Konsistent und robuster.
npm run app:dev --prefix frontend

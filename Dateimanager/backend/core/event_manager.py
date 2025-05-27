import json
import os
import datetime
import asyncio
from typing import List

# Event Klasse
class Event:
    def __init__(self, frequency, times, event, last_execution):
        self.frequency = frequency
        self.times = times
        self.event = event
        self.last_execution = last_execution

    def __str__(self):
        return f"Event({self.event}, {self.frequency}, {self.times}, {self.last_execution})"

# EventManager Klasse
class EventManager:
    def __init__(self, on_event_triggered, events_file: str = "data/events.json", check_interval: int = 60):
        self.events_file = events_file  # Pfad zur Events-Datei
        self.check_interval = check_interval  # Überprüfungsfrequenz in Sekunden
        self.events_db = self.load_events()  # Lädt Events aus der Datei
        self.on_event_triggered = on_event_triggered;
        
    # Starten
    def start(self):
        asyncio.create_task(self.monitor_events())

    # Event-Überprüfung
    def should_execute_event(self, event: Event) -> bool:
        print("Executing Event: %s" % event)

        now = datetime.datetime.now()
        last_execution = datetime.datetime.strptime(event.last_execution, '%Y-%m-%dT%H:%M:%SZ')
        
        if event.frequency == 'daily':
            for time_str in event.times:
                event_time = datetime.datetime.strptime(time_str, '%H:%M').replace(year=now.year, month=now.month, day=now.day)
                if now >= event_time and last_execution < event_time:
                    return True
        elif event.frequency == 'weekly':
            for time_str in event.times:
                event_time = datetime.datetime.strptime(time_str, '%H:%M').replace(year=now.year, month=now.month, day=now.day)
                if (now.weekday() + 1) % 7 == event_time.weekday() and last_execution < event_time:
                    return True
        elif event.frequency == 'hourly':
            for time_str in event.times:
                event_time = datetime.datetime.strptime(time_str, '%H:%M').replace(year=now.year, month=now.month, day=now.day, hour=now.hour)
                if now >= event_time and last_execution < event_time:
                    return True
        return False

    # Event-Ausführung
    def execute_event(self, event: Event) -> None:
        self.on_event_triggered(event.event)
        event.last_execution = datetime.datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
        self.save_events()  # Speichert die Events nach der Ausführung

    # Hintergrundüberwachung der Events
    async def monitor_events(self) -> None:
        print("Monitoring beginnt...")
        while True:
            for event in self.events_db:
                if self.should_execute_event(event):
                    self.execute_event(event)

            # Schlaf für die angegebene Zeit (check_interval)
            await asyncio.sleep(self.check_interval)

    # Events aus der Datei laden
    def load_events(self) -> List[Event]:
        if not os.path.exists(self.events_file):
            return []

        with open(self.events_file, 'r', encoding='utf-8') as file:
            events_data = json.load(file)
            return [Event(**event) for event in events_data]

    # Events in die Datei speichern
    def save_events(self) -> None:
        with open(self.events_file, 'w', encoding='utf-8') as file:
            # Speichern in der JSON-Datei
            json.dump([event.__dict__ for event in self.events_db], file, indent=4)

    # Event hinzufügen
    def add_event(self, event: Event) -> None:
        self.events_db.append(event)
        self.save_events()  # Speichern nach Hinzufügen

    # Event aktualisieren
    def update_event(self, event_index: int, updated_event: Event) -> bool:
        if 0 <= event_index < len(self.events_db):
            self.events_db[event_index] = updated_event
            self.save_events()  # Speichern nach dem Update
            return True
        return False

    # Event löschen
    def delete_event(self, event_index: int) -> bool:
        if 0 <= event_index < len(self.events_db):
            self.events_db.pop(event_index)
            self.save_events()  # Speichern nach Löschen
            return True
        return False
    
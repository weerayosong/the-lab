"""Repository layer for storing and retrieving log entries."""

import json
from pathlib import Path
from typing import List, Optional

from .models import LogEntry


class LogRepository:
    """Handles persistence of log entries using JSON file."""

    def __init__(self, file_path: str = "storage/logs.json"):
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.file_path.exists():
            self._write_data({"entries": []})

    def _read_data(self) -> dict:
        """Read all data from storage."""
        with self.file_path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _write_data(self, data: dict) -> None:
        """Write data to storage."""
        with self.file_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add(self, entry: LogEntry) -> LogEntry:
        """Add a new log entry."""
        data = self._read_data()
        data["entries"].append(entry.to_dict())
        self._write_data(data)
        return entry

    def get_all(self) -> List[LogEntry]:
        """Return all log entries."""
        data = self._read_data()
        return [LogEntry.from_dict(e) for e in data["entries"]]

    def get_by_date(self, date: str) -> List[LogEntry]:
        """Return entries for a specific date."""
        return [e for e in self.get_all() if e.date == date]

    def get_by_id(self, entry_id: str) -> Optional[LogEntry]:
        """Return single entry by ID."""
        for entry in self.get_all():
            if entry.id == entry_id:
                return entry
        return None

    def delete(self, entry_id: str) -> bool:
        """Delete entry by ID. Returns True if deleted."""
        data = self._read_data()
        original_count = len(data["entries"])
        data["entries"] = [e for e in data["entries"] if e["id"] != entry_id]
        
        if len(data["entries"]) < original_count:
            self._write_data(data)
            return True
        return False

"""Service layer for Daily Log business logic."""

from datetime import datetime
from typing import List, Optional

from .models import LogEntry
from .repository import LogRepository


class ValidationError(Exception):
    """Raised when input data fails validation."""
    pass


class LogService:
    """Handles business logic for daily logs."""

    VALID_CATEGORIES = {"work", "learning", "personal", "health", "other"}
    VALID_MOODS = {"focused", "neutral", "tired", "excited", "stressed"}

    def __init__(self, repository: LogRepository):
        self.repository = repository

    def _validate_date(self, date: str) -> None:
        """Validate date format YYYY-MM-DD."""
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise ValidationError(f"Invalid date format: {date}. Use YYYY-MM-DD")

    def _validate_category(self, category: str) -> None:
        """Validate category is allowed."""
        if category not in self.VALID_CATEGORIES:
            raise ValidationError(
                f"Invalid category: {category}. "
                f"Must be one of {sorted(self.VALID_CATEGORIES)}"
            )

    def _validate_mood(self, mood: str) -> None:
        """Validate mood is allowed."""
        if mood not in self.VALID_MOODS:
            raise ValidationError(
                f"Invalid mood: {mood}. "
                f"Must be one of {sorted(self.VALID_MOODS)}"
            )

    def _validate_detail(self, detail: str) -> None:
        """Validate detail is not empty and not too long."""
        if not detail or not detail.strip():
            raise ValidationError("Detail cannot be empty")
        if len(detail) > 500:
            raise ValidationError("Detail must be 500 characters or less")

    def create_entry(
        self,
        date: str,
        category: str,
        detail: str,
        mood: str = "neutral",
    ) -> LogEntry:
        """Create a new log entry with validation."""
        # Validate all inputs
        self._validate_date(date)
        self._validate_category(category)
        self._validate_detail(detail)
        self._validate_mood(mood)

        # Create and save entry
        entry = LogEntry(
            date=date,
            category=category,
            detail=detail.strip(),
            mood=mood,
        )
        return self.repository.add(entry)

    def get_all_entries(self) -> List[LogEntry]:
        """Get all entries sorted by date (newest first)."""
        entries = self.repository.get_all()
        return sorted(entries, key=lambda e: e.created_at, reverse=True)

    def get_entries_by_date(self, date: str) -> List[LogEntry]:
        """Get entries for specific date."""
        self._validate_date(date)
        return self.repository.get_by_date(date)

    def get_entry(self, entry_id: str) -> Optional[LogEntry]:
        """Get single entry by ID."""
        return self.repository.get_by_id(entry_id)

    def delete_entry(self, entry_id: str) -> bool:
        """Delete entry by ID."""
        return self.repository.delete(entry_id)

    def get_summary(self) -> dict:
        """Get summary statistics of all entries."""
        entries = self.get_all_entries()
        
        summary = {
            "total_entries": len(entries),
            "by_category": {},
            "by_mood": {},
            "unique_days": len(set(e.date for e in entries)),
        }
        
        for entry in entries:
            summary["by_category"][entry.category] = (
                summary["by_category"].get(entry.category, 0) + 1
            )
            summary["by_mood"][entry.mood] = (
                summary["by_mood"].get(entry.mood, 0) + 1
            )
        
        return summary

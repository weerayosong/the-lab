"""Data models for Daily Log Service."""

from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4


@dataclass
class LogEntry:
    """Represents a single daily log entry."""
    
    date: str  # YYYY-MM-DD
    category: str
    detail: str
    mood: str = "neutral"
    id: str = field(default_factory=lambda: str(uuid4()))
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        """Convert entry to dictionary for storage."""
        return {
            "id": self.id,
            "date": self.date,
            "category": self.category,
            "detail": self.detail,
            "mood": self.mood,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "LogEntry":
        """Create entry from dictionary (from storage)."""
        return cls(
            id=data["id"],
            date=data["date"],
            category=data["category"],
            detail=data["detail"],
            mood=data.get("mood", "neutral"),
            created_at=data["created_at"],
        )

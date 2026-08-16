"""Tests for LogService."""

import pytest
from daily_log.models import LogEntry
from daily_log.repository import LogRepository
from daily_log.service import LogService, ValidationError


@pytest.fixture
def service(tmp_path):
    """Create service with temporary repository."""
    repo = LogRepository(file_path=str(tmp_path / "test_logs.json"))
    return LogService(repository=repo)


class TestLogService:
    """Test cases for service layer."""

    def test_create_entry_success(self, service):
        """Test creating valid entry."""
        entry = service.create_entry(
            date="2026-08-14",
            category="learning",
            detail="Study Python architecture",
            mood="focused",
        )
        
        assert entry.id is not None
        assert entry.category == "learning"
        assert len(service.get_all_entries()) == 1

    def test_create_entry_default_mood(self, service):
        """Test that mood defaults to neutral."""
        entry = service.create_entry(
            date="2026-08-14",
            category="work",
            detail="Default mood test",
        )
        
        assert entry.mood == "neutral"

    def test_invalid_date(self, service):
        """Test validation of date format."""
        with pytest.raises(ValidationError):
            service.create_entry(
                date="14-08-2026",
                category="work",
                detail="Invalid date",
            )

    def test_invalid_category(self, service):
        """Test validation of category."""
        with pytest.raises(ValidationError):
            service.create_entry(
                date="2026-08-14",
                category="invalid_category",
                detail="Invalid category test",
            )

    def test_invalid_mood(self, service):
        """Test validation of mood."""
        with pytest.raises(ValidationError):
            service.create_entry(
                date="2026-08-14",
                category="work",
                detail="Invalid mood test",
                mood="angry",
            )

    def test_empty_detail(self, service):
        """Test validation of empty detail."""
        with pytest.raises(ValidationError):
            service.create_entry(
                date="2026-08-14",
                category="work",
                detail="",
            )

    def test_too_long_detail(self, service):
        """Test validation of detail length."""
        with pytest.raises(ValidationError):
            service.create_entry(
                date="2026-08-14",
                category="work",
                detail="x" * 501,
            )

    def test_get_entries_by_date(self, service):
        """Test filtering by date through service."""
        service.create_entry(date="2026-08-14", category="work", detail="First")
        service.create_entry(date="2026-08-15", category="work", detail="Second")
        
        entries = service.get_entries_by_date("2026-08-14")
        assert len(entries) == 1
        assert entries[0].detail == "First"

    def test_delete_entry(self, service):
        """Test deleting through service."""
        entry = service.create_entry(
            date="2026-08-14",
            category="personal",
            detail="Delete me",
        )
        
        result = service.delete_entry(entry.id)
        assert result is True
        assert service.get_all_entries() == []

    def test_get_summary(self, service):
        """Test summary statistics."""
        service.create_entry(date="2026-08-14", category="work", detail="Task 1")
        service.create_entry(date="2026-08-14", category="learning", detail="Study")
        service.create_entry(date="2026-08-15", category="work", detail="Task 2")
        
        summary = service.get_summary()
        
        assert summary["total_entries"] == 3
        assert summary["by_category"]["work"] == 2
        assert summary["by_category"]["learning"] == 1
        assert summary["unique_days"] == 2

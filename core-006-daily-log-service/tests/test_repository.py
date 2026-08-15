"""Tests for LogRepository."""

import pytest
from daily_log.models import LogEntry
from daily_log.repository import LogRepository


@pytest.fixture
def repo(tmp_path):
    """Create repository with temporary file."""
    test_file = tmp_path / "test_logs.json"
    return LogRepository(file_path=str(test_file))


@pytest.fixture
def sample_entry():
    """Create a sample log entry."""
    return LogEntry(
        date="2026-08-14",
        category="learning",
        detail="Test repository layer",
        mood="focused",
    )


class TestLogRepository:
    """Test cases for repository functionality."""

    def test_add_entry(self, repo, sample_entry):
        """Test adding a new entry."""
        added = repo.add(sample_entry)
        
        entries = repo.get_all()
        assert len(entries) == 1
        assert entries[0].id == added.id
        assert entries[0].category == "learning"

    def test_get_all_empty(self, repo):
        """Test getting entries from empty repository."""
        entries = repo.get_all()
        assert entries == []

    def test_get_by_date(self, repo):
        """Test filtering by date."""
        entry1 = LogEntry(date="2026-08-14", category="work", detail="First")
        entry2 = LogEntry(date="2026-08-15", category="work", detail="Second")
        
        repo.add(entry1)
        repo.add(entry2)
        
        result = repo.get_by_date("2026-08-14")
        assert len(result) == 1
        assert result[0].detail == "First"

    def test_get_by_id(self, repo, sample_entry):
        """Test getting entry by ID."""
        added = repo.add(sample_entry)
        
        found = repo.get_by_id(added.id)
        assert found is not None
        assert found.id == added.id

    def test_delete_entry(self, repo, sample_entry):
        """Test deleting an entry."""
        added = repo.add(sample_entry)
        
        result = repo.delete(added.id)
        assert result is True
        assert repo.get_all() == []

    def test_delete_nonexistent(self, repo):
        """Test deleting non-existent entry."""
        result = repo.delete("nonexistent-id")
        assert result is False

    def test_persistence_across_instances(self, tmp_path, sample_entry):
        """Test that data persists across repository instances."""
        file_path = tmp_path / "persist_test.json"
        
        # First instance
        repo1 = LogRepository(file_path=str(file_path))
        repo1.add(sample_entry)
        
        # Second instance - same file
        repo2 = LogRepository(file_path=str(file_path))
        entries = repo2.get_all()
        
        assert len(entries) == 1
        assert entries[0].id == sample_entry.id

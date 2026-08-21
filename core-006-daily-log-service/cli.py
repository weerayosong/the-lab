#!/usr/bin/env python3
"""Command Line Interface for Daily Log Service."""

import argparse
import sys
from datetime import datetime

from daily_log.repository import LogRepository
from daily_log.service import LogService, ValidationError


def create_service():
    """Create and return service instance."""
    repository = LogRepository()
    return LogService(repository)


def format_entry(entry) -> str:
    """Format a single entry for display."""
    return (
        f"ID: {entry.id}\n"
        f"Date: {entry.date}\n"
        f"Category: {entry.category}\n"
        f"Mood: {entry.mood}\n"
        f"Detail: {entry.detail}\n"
        f"Created: {entry.created_at}\n"
        f"{'-' * 40}"
    )


def cmd_add(args):
    """Handle add command."""
    service = create_service()
    try:
        entry = service.create_entry(
            date=args.date or datetime.now().strftime("%Y-%m-%d"),
            category=args.category,
            detail=args.detail,
            mood=args.mood,
        )
        print(f"✅ Entry added successfully!")
        print(format_entry(entry))
    except ValidationError as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_list(args):
    """Handle list command."""
    service = create_service()
    
    if args.date:
        entries = service.get_entries_by_date(args.date)
    else:
        entries = service.get_all_entries()
    
    if not entries:
        print("📭 No entries found.")
        return
    
    if args.summary:
        summary = service.get_summary()
        print("📊 Summary:")
        print(f"Total entries: {summary['total_entries']}")
        print(f"Unique days: {summary['unique_days']}")
        print(f"By category: {summary['by_category']}")
        print(f"By mood: {summary['by_mood']}")
        print()
    
    print(f"📋 Found {len(entries)} entries:")
    for entry in entries:
        print(format_entry(entry))


def cmd_delete(args):
    """Handle delete command."""
    service = create_service()
    
    if service.delete_entry(args.id):
        print(f"✅ Entry {args.id} deleted successfully!")
    else:
        print(f"❌ Entry {args.id} not found.", file=sys.stderr)
        sys.exit(1)


def cmd_show(args):
    """Handle show command for single entry."""
    service = create_service()
    
    entry = service.get_entry(args.id)
    if entry:
        print(format_entry(entry))
    else:
        print(f"❌ Entry {args.id} not found.", file=sys.stderr)
        sys.exit(1)


def main():
    """Main entry point for CLI."""
    parser = argparse.ArgumentParser(
        description="Daily Log Service - Track your daily activities",
        epilog="Example: python cli.py add -c learning -d 'Study Python' -m focused",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Add command
    parser_add = subparsers.add_parser("add", help="Add new entry")
    parser_add.add_argument(
        "-d", "--date",
        help="Date (YYYY-MM-DD). Defaults to today",
    )
    parser_add.add_argument(
        "-c", "--category",
        required=True,
        choices=["work", "learning", "personal", "health", "other"],
        help="Category of the entry",
    )
    parser_add.add_argument(
        "detail",
        help="Detail of what you did",
    )
    parser_add.add_argument(
        "-m", "--mood",
        default="neutral",
        choices=["focused", "neutral", "tired", "excited", "stressed"],
        help="Your mood (default: neutral)",
    )
    parser_add.set_defaults(func=cmd_add)

    # List command
    parser_list = subparsers.add_parser("list", help="List entries")
    parser_list.add_argument(
        "-d", "--date",
        help="Filter by date (YYYY-MM-DD)",
    )
    parser_list.add_argument(
        "-s", "--summary",
        action="store_true",
        help="Show summary statistics",
    )
    parser_list.set_defaults(func=cmd_list)

    # Delete command
    parser_delete = subparsers.add_parser("delete", help="Delete entry")
    parser_delete.add_argument(
        "id",
        help="ID of entry to delete",
    )
    parser_delete.set_defaults(func=cmd_delete)

    # Show command
    parser_show = subparsers.add_parser("show", help="Show single entry")
    parser_show.add_argument(
        "id",
        help="ID of entry to show",
    )
    parser_show.set_defaults(func=cmd_show)

    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(0)
    
    args.func(args)


if __name__ == "__main__":
    main()

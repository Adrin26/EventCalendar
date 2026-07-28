"""Seed CareerEvent rows from Talentbank's public events API."""

from __future__ import annotations

import json
import urllib.request
from datetime import date

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import CareerEvent

API = "https://api.handbook.tips/talentbank-io/events"
TYPE_MAP = {
    "campus": "career-fair",
    "sector": "career-fair",
    "public": "career-fair",
    "awards": "networking",
}


def fetch_events() -> list[dict]:
    req = urllib.request.Request(API, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return list(payload.get("data") or [])


def map_status(iso: str) -> str:
    try:
        return "completed" if date.fromisoformat(iso) < date.today() else "scheduled"
    except ValueError:
        return "scheduled"


def main() -> None:
    Base.metadata.create_all(bind=engine)
    rows = fetch_events()
    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        for x in rows:
            title = (x.get("name") or "").strip()
            iso = (x.get("iso") or "").strip()
            if not title or not iso:
                skipped += 1
                continue

            exists = (
                db.query(CareerEvent)
                .filter(CareerEvent.title == title, CareerEvent.date == iso)
                .first()
            )
            if exists:
                skipped += 1
                continue

            t = (x.get("type") or "public").strip().lower()
            fields = x.get("fields") or []
            region = (x.get("region") or "").strip()
            db.add(
                CareerEvent(
                    title=title,
                    description=f"Talentbank calendar event ({x.get('type') or 'fair'}).",
                    location=region,
                    state=region,
                    university="",
                    company="Talentbank",
                    industry=", ".join(str(f) for f in fields),
                    event_type=TYPE_MAP.get(t, "career-fair"),
                    date=iso,
                    start_time="09:00",
                    end_time="17:00",
                    capacity=100,
                    registered_count=0,
                    status=map_status(iso),
                    registration_url=(x.get("url") or "").strip(),
                    organiser="Talentbank",
                    created_by="seed",
                )
            )
            inserted += 1

        db.commit()
        print(f"API items: {len(rows)} | inserted: {inserted} | skipped: {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

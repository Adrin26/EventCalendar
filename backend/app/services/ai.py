"""AI feature implementations backed by Gemini (preferred) or Ollama, with heuristic fallbacks."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import CareerEvent
from app.schemas import (
    ChatAnswer,
    DescriptionRequest,
    NLAction,
    NLCommandPlan,
)
from app.services import llm
from app.services.events import search_events
from app.services.llm import LLMError

logger = logging.getLogger(__name__)

# Distinct MY uni tokens — never treat as substrings of each other.
_UNI_ACRONYMS = (
    "UTeM",
    "UTHM",
    "UiTM",
    "UTM",
    "UPM",
    "UKM",
    "USM",
    "UM",
    "IIUM",
    "UIA",
    "UNITAR",
    "MMU",
    "INTI",
    "SEGi",
)

NL_PLAN_SCHEMA: dict = {
    "type": "object",
    "properties": {
        "intent": {
            "type": "string",
            "description": "One of: cancel, reschedule, unknown",
        },
        "summary": {"type": "string"},
        "actions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "op": {
                        "type": "string",
                        "enum": ["update", "cancel", "delete", "create"],
                    },
                    "target_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "changes": {
                        "type": "object",
                        "properties": {
                            "date": {"type": "string"},
                            "start_time": {"type": "string"},
                            "end_time": {"type": "string"},
                            "location": {"type": "string"},
                            "status": {"type": "string"},
                        },
                    },
                },
                "required": ["op", "target_ids"],
            },
        },
        "affected_titles": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["intent", "summary", "actions", "affected_titles"],
}


def _heuristic_description(payload: DescriptionRequest) -> str:
    kind = payload.event_type.replace("-", " ")
    return (
        f"Join {payload.company} at {payload.university} for an immersive {kind} "
        f"focused on {payload.industry.lower()} careers. Meet hiring managers, explore "
        "internship and graduate opportunities, and take part in on-the-spot interviews "
        "and portfolio reviews."
    )


def generate_description(payload: DescriptionRequest) -> str:
    """Generate an event description via LLM; fall back to a template on failure."""
    prompt = (
        "Write a short professional event description for a Malaysia career-fair calendar.\n"
        "Rules: 2–3 sentences only. No markdown, no bullet points, no hashtags. "
        "Be concrete and inviting; do not invent employers, dates, or venues not given.\n\n"
        f"Title: {payload.title}\n"
        f"Company: {payload.company}\n"
        f"University: {payload.university}\n"
        f"Industry: {payload.industry}\n"
        f"Event type: {payload.event_type.replace('-', ' ')}\n"
    )
    try:
        text = llm.chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You write concise career-event blurbs for Malaysian universities "
                        "and employers."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
        )
        return text.strip().strip('"')
    except LLMError:
        logger.info("LLM unavailable for description; using heuristic")
        return _heuristic_description(payload)


def _event_catalog_line(e: CareerEvent) -> str:
    return (
        f"- id={e.id} | {e.title} | {e.company} @ {e.university} | "
        f"{e.state} | {e.date} {e.start_time}-{e.end_time} | status={e.status}"
    )


def _heuristic_nl_command(db: Session, command: str) -> NLCommandPlan:
    c = command.lower()
    events = [e for e in db.query(CareerEvent).all() if e.status not in ("cancelled", "deleted")]
    month_names = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
    ]
    states = ["kuala lumpur", "selangor", "penang", "johor", "sabah", "sarawak"]
    state_match = next((s for s in states if s in c), None)
    # Ignore blank/generic university values (e.g. "" or "all") which would
    # false-positive against common words in the command.
    uni_match = next(
        (
            e.university
            for e in events
            if e.university
            and len(e.university.strip()) > 2
            and e.university.strip().lower() not in {"all", "n/a", "na", "none"}
            and e.university.lower() in c
        ),
        None,
    )
    company_match = next(
        (
            e.company
            for e in events
            if e.company
            and len(e.company.strip()) > 2
            and e.company.lower() in c
        ),
        None,
    )

    def matches(e: CareerEvent) -> bool:
        if state_match and e.state.lower() != state_match:
            return False
        if uni_match and e.university != uni_match:
            return False
        if company_match and e.company != company_match:
            return False
        if "tomorrow" in c:
            tomorrow = (datetime.now() + timedelta(days=1)).date().isoformat()
            return e.date == tomorrow
        if "today" in c:
            return e.date == datetime.now().date().isoformat()
        return bool(state_match or uni_match or company_match)

    targets = [e for e in events if matches(e)]

    if "cancel" in c:
        return NLCommandPlan(
            intent="cancel",
            summary=f"Cancel {len(targets)} event(s).",
            actions=[NLAction(op="cancel", target_ids=[e.id for e in targets])],
            affected_titles=[e.title for e in targets],
        )

    if "move" in c or "reschedule" in c:
        now = datetime.now()
        target_idx = next((i for i, m in enumerate(month_names) if m in c), -1)
        new_month = (now.month % 12) + 1 if "next month" in c or target_idx < 0 else target_idx + 1
        new_year = now.year + (1 if new_month < now.month and "next month" in c else 0)
        if "next month" in c:
            new_month = now.month + 1
            new_year = now.year
            if new_month > 12:
                new_month = 1
                new_year += 1
        elif target_idx >= 0:
            new_month = target_idx + 1
            new_year = now.year
        actions = [
            NLAction(
                op="update",
                target_ids=[e.id],
                changes={"date": f"{new_year}-{new_month:02d}-{e.date[8:10]}"},
            )
            for e in targets
        ]
        return NLCommandPlan(
            intent="reschedule",
            summary=f"Move {len(targets)} event(s) to {month_names[new_month - 1]} {new_year}.",
            actions=actions,
            affected_titles=[e.title for e in targets],
        )

    return NLCommandPlan(
        intent="unknown",
        summary='I couldn\'t confidently interpret that command. Try: "Cancel tomorrow\'s event at UTM".',
        actions=[],
        affected_titles=[],
    )


def _validate_nl_plan(
    raw: dict,
    known_ids: set[str],
    id_to_title: dict[str, str],
    events_by_id: dict[str, CareerEvent],
    command: str,
) -> NLCommandPlan:
    """Parse LLM JSON and drop any target IDs that are not in the catalog."""
    intent = str(raw.get("intent") or "unknown").lower().strip()
    if intent not in {"cancel", "reschedule", "unknown"}:
        intent = "unknown"

    actions: list[NLAction] = []
    for item in raw.get("actions") or []:
        if not isinstance(item, dict):
            continue
        op = item.get("op")
        if op not in {"update", "cancel", "delete", "create"}:
            continue
        ids = [i for i in (item.get("target_ids") or []) if isinstance(i, str) and i in known_ids]
        ids = _filter_ids_by_command_acronyms(ids, events_by_id, command)
        if not ids:
            continue
        changes = item.get("changes") if isinstance(item.get("changes"), dict) else None
        actions.append(NLAction(op=op, target_ids=ids, changes=changes))

    affected: list[str] = []
    seen: set[str] = set()
    for action in actions:
        for tid in action.target_ids:
            title = id_to_title.get(tid)
            if title and title not in seen:
                affected.append(title)
                seen.add(title)

    summary = str(raw.get("summary") or "").strip()
    if not summary:
        if intent == "unknown" or not actions:
            summary = (
                'I couldn\'t confidently interpret that command. '
                'Try: "Cancel tomorrow\'s event at UTM".'
            )
            intent = "unknown"
            actions = []
        else:
            summary = f"Plan to {intent} {len(affected)} event(s)."

    if intent == "unknown" or not actions:
        return NLCommandPlan(
            intent="unknown",
            summary=(
                summary
                if intent == "unknown"
                else (
                    'I couldn\'t confidently interpret that command. '
                    'Try: "Cancel tomorrow\'s event at UTM".'
                )
            ),
            actions=[],
            affected_titles=[],
        )

    return NLCommandPlan(
        intent=intent,
        summary=summary,
        actions=actions,
        affected_titles=affected,
    )


def _acronyms_in_text(text: str) -> list[str]:
    found: list[str] = []
    for acr in _UNI_ACRONYMS:
        if re.search(rf"\b{re.escape(acr)}\b", text, flags=re.IGNORECASE):
            found.append(acr)
    return found


def _event_has_acronym(event: CareerEvent, acronym: str) -> bool:
    blob = f"{event.university} {event.title}"
    return bool(re.search(rf"\b{re.escape(acronym)}\b", blob, flags=re.IGNORECASE))


def _filter_ids_by_command_acronyms(
    ids: list[str],
    events_by_id: dict[str, CareerEvent],
    command: str,
) -> list[str]:
    """If the command names uni acronyms, keep only events that mention them as whole tokens."""
    mentioned = _acronyms_in_text(command)
    if not mentioned:
        return ids
    kept: list[str] = []
    for tid in ids:
        event = events_by_id.get(tid)
        if event is None:
            continue
        if any(_event_has_acronym(event, acr) for acr in mentioned):
            kept.append(tid)
    return kept


def plan_nl_command(db: Session, command: str) -> NLCommandPlan:
    """Interpret an admin NL command via LLM; fall back to keyword parsing."""
    events = [e for e in db.query(CareerEvent).all() if e.status not in ("cancelled", "deleted")]
    known_ids = {e.id for e in events}
    id_to_title = {e.id: e.title for e in events}
    events_by_id = {e.id: e for e in events}
    catalog = "\n".join(_event_catalog_line(e) for e in events) or "(no active events)"
    today = datetime.now().date().isoformat()

    user_prompt = (
        f"Today's date is {today}.\n"
        "You are an admin assistant for a Malaysia career-fair calendar.\n"
        "Interpret the admin command and return a plan. Only use event ids from the catalog.\n"
        "Supported intents: cancel, reschedule, unknown.\n"
        "For cancel: op=cancel with matching target_ids.\n"
        "For reschedule/move: op=update with changes.date as YYYY-MM-DD "
        "(keep day-of-month when only a month is mentioned, if possible).\n"
        "Matching rules:\n"
        "- Match on university, company, title, state, and date fields.\n"
        "- University acronyms are DISTINCT: UTM ≠ UTeM ≠ UTHM ≠ UM ≠ UKM ≠ USM.\n"
        "- Only match an acronym if it appears as a whole token in title or university "
        "(e.g. 'UTM' must not match 'UTeM' or 'UTHM').\n"
        "- If the command names a university/company and nothing clearly matches, "
        "return intent=unknown with empty actions.\n"
        "- If unsure, prefer unknown over guessing.\n\n"
        f"Event catalog:\n{catalog}\n\n"
        f"Admin command: {command}\n"
    )

    try:
        content = llm.chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You convert natural-language admin instructions into a strict JSON plan. "
                        "Never invent event ids. Never confuse similar university acronyms. "
                        "Prefer unknown when the match is ambiguous."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            format=NL_PLAN_SCHEMA,
            temperature=0.0,
        )
        raw = json.loads(content)
        if not isinstance(raw, dict):
            raise ValueError("expected JSON object")
        return _validate_nl_plan(raw, known_ids, id_to_title, events_by_id, command)
    except (LLMError, json.JSONDecodeError, ValueError, TypeError) as exc:
        logger.info("LLM NL planning failed (%s); using heuristic", exc)
        return _heuristic_nl_command(db, command)


def _heuristic_rag(db: Session, question: str) -> ChatAnswer:
    sources = search_events(db, question)
    if not sources:
        return ChatAnswer(
            answer=(
                "I couldn't find any matching events. Try asking about a state, company, "
                "university or industry."
            ),
            sources=[],
        )
    lines = [
        f"• {e.title} — {e.university}, {e.state} on {e.date} ({e.start_time}–{e.end_time})"
        for e in sources[:4]
    ]
    first = sources[0]
    return ChatAnswer(
        answer=(
            f"I found {len(sources)} event(s) that could match. Here are the top results:\n\n"
            + "\n".join(lines)
            + f'\n\nThe closest one is "{first.title}" at {first.location}.'
        ),
        sources=sources,
    )


def rag_chat(db: Session, question: str) -> ChatAnswer:
    """Retrieve matching events, then ask the LLM to answer from that context only."""
    sources = search_events(db, question, limit=8)
    if not sources:
        # Broaden: if keyword search is empty, still try a short LLM apology via heuristic.
        return _heuristic_rag(db, question)

    context_lines = []
    for e in sources:
        context_lines.append(
            f"- {e.title} | {e.company} at {e.university} ({e.state}) | "
            f"{e.date} {e.start_time}-{e.end_time} | {e.event_type} | {e.industry} | "
            f"status={e.status} | location={e.location}"
        )
    context = "\n".join(context_lines)

    user_prompt = (
        "Answer the user's question about career fairs / recruitment events in Malaysia.\n"
        "Use ONLY the events listed below as your source of truth. "
        "If the list does not contain a good match, say so clearly.\n"
        "Be concise (a short paragraph plus a few bullets if helpful). "
        "Mention title, university/company, date, and location when recommending.\n\n"
        f"Retrieved events:\n{context}\n\n"
        f"User question: {question}\n"
    )

    try:
        answer = llm.chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You are CareerFair's helpful assistant. Answer only from provided "
                        "event data. Do not invent events."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
        )
        return ChatAnswer(answer=answer, sources=sources)
    except LLMError:
        logger.info("LLM unavailable for chat; using heuristic")
        return _heuristic_rag(db, question)


def ai_analytics(db: Session) -> dict:
    events = [e for e in db.query(CareerEvent).all() if e.status != "deleted"]

    def group(key_fn):
        m: dict[str, dict] = {}
        for e in events:
            k = key_fn(e)
            cur = m.setdefault(k, {"count": 0, "registrations": 0})
            cur["count"] += 1
            cur["registrations"] += e.registered_count
        return m

    by_s = group(lambda e: e.state)
    by_c = group(lambda e: e.company)
    monthly = group(lambda e: e.date[:7])

    by_state = sorted(
        [{"state": k, **v} for k, v in by_s.items()],
        key=lambda x: x["registrations"],
        reverse=True,
    )
    by_company = sorted(
        [{"company": k, **v} for k, v in by_c.items()],
        key=lambda x: x["registrations"],
        reverse=True,
    )
    fill_rate = sorted(
        [
            {
                "title": e.title,
                "rate": round((e.registered_count / max(e.capacity, 1)) * 100),
            }
            for e in events
        ],
        key=lambda x: x["rate"],
        reverse=True,
    )[:8]
    monthly_arr = sorted(
        [{"month": k, "events": v["count"], "registrations": v["registrations"]} for k, v in monthly.items()],
        key=lambda x: x["month"],
    )

    recommendations = []
    if by_state:
        top = by_state[0]
        recommendations.append(
            f"Concentrate marketing spend on {top['state']}, which drives the highest "
            f"registrations ({top['registrations']})."
        )
    if fill_rate:
        worst = fill_rate[-1]
        recommendations.append(
            f'Consider promoting "{worst["title"]}" — lowest fill rate ({worst["rate"]}%).'
        )
    if by_company:
        recommendations.append(
            f"{by_company[0]['company']} events outperform on registrations — explore a partnership."
        )

    return {
        "by_state": by_state,
        "by_company": by_company,
        "fill_rate": fill_rate,
        "monthly": monthly_arr,
        "recommendations": recommendations,
    }

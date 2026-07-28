from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import CareerEvent
from app.schemas import (
    ChatAnswer,
    DescriptionRequest,
    NLAction,
    NLCommandPlan,
)
from app.services.events import search_events


def generate_description(payload: DescriptionRequest) -> str:
    kind = payload.event_type.replace("-", " ")
    return (
        f"Join {payload.company} at {payload.university} for an immersive {kind} "
        f"focused on {payload.industry.lower()} careers. Meet hiring managers, explore "
        "internship and graduate opportunities, and take part in on-the-spot interviews "
        "and portfolio reviews."
    )


def plan_nl_command(db: Session, command: str) -> NLCommandPlan:
    c = command.lower()
    events = [e for e in db.query(CareerEvent).all() if e.status not in ("cancelled", "deleted")]
    month_names = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
    ]
    states = ["kuala lumpur", "selangor", "penang", "johor", "sabah", "sarawak"]
    state_match = next((s for s in states if s in c), None)
    uni_match = next((e.university for e in events if e.university.lower() in c), None)
    company_match = next((e.company for e in events if e.company.lower() in c), None)

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


def rag_chat(db: Session, question: str) -> ChatAnswer:
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

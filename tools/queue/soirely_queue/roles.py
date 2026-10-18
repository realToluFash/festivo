"""Who each role is, what it watches, and how a comment says who it is for."""

import re

DEVELOPERS = {"dev": "dev1", "dev2": "dev2"}

TRANSLATION_QUEUE = ["To Do", "In Progress", "Failed QA"]


def developer_of(labels):
    names = set(labels or [])
    for role, label in DEVELOPERS.items():
        if label in names:
            return role
    return "dev"


def not_translation(labels, state):
    return "translation" not in labels


def translation(labels, state):
    return "translation" in labels


def dev1_filter(labels, state):
    return "translation" not in labels and "dev2" not in labels


def dev2_filter(labels, state):
    if state == "To Do":
        return "translation" not in labels and "dev1" not in labels
    return "dev2" in labels


def everything(labels, state):
    return True


def _linguist(locale, heartbeat, sweeps=False):
    return {
        "skill": "soirely-linguist",
        "invoke": f"/soirely-linguist {locale}",
        "queue": TRANSLATION_QUEUE,
        "filter": translation,
        "heartbeat": heartbeat,
        "sweeps": sweeps,
    }


ROLES = {
    "pm": {"skill": "soirely-product-manager", "queue": ["To Do", "Failed QA"],
           "filter": not_translation, "heartbeat": 120, "sweeps": True},
    "ux": {"skill": "soirely-designer", "queue": ["To Do", "Failed QA"],
           "filter": not_translation, "heartbeat": 120, "sweeps": True},
    "dev": {"skill": "soirely-developer", "queue": ["Failed QA", "In Progress", "To Do"],
            "filter": dev1_filter, "heartbeat": 30, "prs": True},
    "dev2": {"skill": "soirely-developer", "invoke": "/soirely-developer dev2",
             "queue": ["Failed QA", "In Progress", "To Do"], "filter": dev2_filter,
             "heartbeat": 30, "prs": True},
    "qa": {"skill": "soirely-qa-tester", "queue": ["Ready For QA"], "filter": everything,
           "heartbeat": 30},
    "qa2": {"skill": "soirely-qa-tester", "invoke": "/soirely-qa-tester qa2",
            "queue": ["Ready For QA"], "filter": everything, "heartbeat": 30},
    "qa3": {"skill": "soirely-qa-tester", "invoke": "/soirely-qa-tester qa3",
            "queue": ["Ready For QA"], "filter": everything, "heartbeat": 30},
    "lead": {"skill": "soirely-tech-lead", "queue": [], "filter": everything,
             "heartbeat": 30, "reviews": True},
    "bm": {"skill": "soirely-business-manager", "queue": ["Backlog", "To Do"],
           "filter": not_translation, "heartbeat": 720, "sweeps": True},
    "ops": {"skill": "soirely-ops", "queue": [], "filter": everything, "heartbeat": 360,
            "sweeps": True, "main": True},
    "en": _linguist("en", 120, True),
    "es": _linguist("es", 30),
    "fr": _linguist("fr", 30),
    "pt": _linguist("pt", 30),
    "cd": {"skill": "soirely-creative", "queue": [], "filter": everything, "heartbeat": 1440,
           "sweeps": True},
}

QUEUE_STATES = sorted({state for role in ROLES.values() for state in role["queue"]}
                      | {"In Review"})


def invoke(role):
    config = ROLES[role]
    return config.get("invoke", f"/{config['skill']}")


def pool(role, state, labels):
    """Roles that share a queue claim from one pool, so two never take the same story."""
    if role.startswith("qa"):
        return "qa"
    if role in DEVELOPERS and state == "To Do" and not {"dev1", "dev2"} & set(labels):
        return "dev"
    return role


HEADER = re.compile(r"^\s*((?:\[[a-z0-9]+\]\s*)+)\(from ([a-z0-9]+)\)")
AUTHOR = re.compile(r"\(from ([a-z0-9]+)\)")


def header(text):
    first = (text or "").split("\n", 1)[0]
    match = HEADER.match(first)
    if match:
        return {"to": re.findall(r"\[([a-z0-9]+)\]", match.group(1)), "from": match.group(2)}
    author = AUTHOR.search(first)
    return {"to": [], "from": author.group(1)} if author else None


def addressees(text, labels):
    """`[dev]` means whichever developer's label the story carries."""
    parsed = header(text)
    if not parsed:
        return []
    return [developer_of(labels) if tag == "dev" else tag for tag in parsed["to"]]


def author(text):
    parsed = header(text)
    return parsed["from"] if parsed else None

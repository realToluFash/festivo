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


ROLES = {
    "pm": {"skill": "soirely-product-manager", "queue": ["To Do", "Failed QA"],
           "filter": not_translation, "heartbeat": 120, "sweeps": True},
    "ux": {"skill": "soirely-designer", "queue": ["To Do", "Failed QA"],
           "filter": not_translation, "heartbeat": 120, "sweeps": True},
    "dev": {"skill": "soirely-developer", "queue": ["Failed QA", "In Progress", "To Do"],
            "filter": dev1_filter, "heartbeat": 30, "prs": True},
    "dev2": {"skill": "soirely-developer", "invoke": "/soirely-developer dev2",
             "queue": ["Failed QA", "In Progress", "To Do"], "filter": dev2_filter,
             "heartbeat": 30, "prs": True, "offset": 1},
    "qa": {"skill": "soirely-qa-tester", "queue": ["Ready For QA"], "filter": everything,
           "heartbeat": 30, "memoryMax": "8G"},
    "qa2": {"skill": "soirely-qa-tester", "invoke": "/soirely-qa-tester qa2",
            "queue": ["Ready For QA"], "filter": everything, "heartbeat": 30, "offset": 1,
            "memoryMax": "8G"},
    "qa3": {"skill": "soirely-qa-tester", "invoke": "/soirely-qa-tester qa3",
            "queue": ["Ready For QA"], "filter": everything, "heartbeat": 30, "offset": 2,
            "memoryMax": "8G"},
    "lead": {"skill": "soirely-tech-lead", "queue": [], "filter": everything,
             "heartbeat": 30, "reviews": True},
    "bm": {"skill": "soirely-business-manager", "queue": ["Backlog", "To Do"],
           "filter": not_translation, "heartbeat": 720, "sweeps": True},
    "ops": {"skill": "soirely-ops", "queue": [], "filter": everything, "heartbeat": 360,
            "sweeps": True, "main": True},
    "l10n": {"skill": "soirely-linguist", "queue": TRANSLATION_QUEUE, "filter": translation,
             "heartbeat": 120, "sweeps": True},
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


LOCALES = ("en", "es", "fr", "pt")
# The four linguists became one; their tags and signatures still mean it.
FORMER = {locale: "l10n" for locale in LOCALES}

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
    return [developer_of(labels) if tag == "dev" else FORMER.get(tag, tag)
            for tag in parsed["to"]]


def author(text):
    parsed = header(text)
    return FORMER.get(parsed["from"], parsed["from"]) if parsed else None


DEVS = ("dev", "dev2")
TESTERS = ("qa", "qa2", "qa3")
LINGUISTS = ("l10n",)
EVERYONE = tuple(ROLES)

# What each role may write, from the "must not" sections of the skills. A command not
# listed for a role is refused before anything is sent.
MAY = {
    "comment": EVERYONE,
    "note": EVERYONE,
    "claim": DEVS + TESTERS,
    "move": DEVS + TESTERS + LINGUISTS + ("lead", "pm"),
    "label": DEVS + TESTERS + LINGUISTS + ("pm", "cd"),
    "edit": LINGUISTS + ("pm", "ux", "cd", "bm"),
    "new-story": DEVS + LINGUISTS + ("pm", "cd"),
    "new-epic": ("pm",),
    "task": LINGUISTS + ("pm",),
    "relate": LINGUISTS + ("pm", "cd"),
    "archive": ("pm",),
    "report": TESTERS,
    "pr-create": DEVS + LINGUISTS + ("ops",),
    "review": ("lead",),
    "pr-reply": DEVS + LINGUISTS + ("lead", "ops"),
    "resolve": ("lead",),
    "merge": DEVS + LINGUISTS,
    "to-qa": DEVS,
    "rerun": DEVS + ("ops",),
}

# The states each role may move a story into, and from.
MOVES = {
    "dev": {"In Progress": ("To Do", "Failed QA", "In Review"), "In Review": ("In Progress",),
            "Ready For QA": ("In Review",)},
    "lead": {"In Progress": ("In Review",)},
    "pm": {"To Do": ("Backlog",), "Backlog": ("To Do",)},
    "qa": {"In QA": ("Ready For QA", "In QA"), "Passsed QA": ("In QA",),
           "Failed QA": ("In QA",)},
    "l10n": {"In Progress": ("To Do", "Failed QA"), "Ready For QA": ("In Progress",)},
}
# The product manager also takes back an In Progress story that nobody holds: no role moved
# it there, no developer label, no open pull request on its branch (`actions.holder`).
PM_RELEASES = ("Backlog", "To Do")
MOVES["dev2"] = MOVES["dev"]
for _tester in TESTERS:
    MOVES[_tester] = MOVES["qa"]

# A role that labels may only touch these labels; the product manager may touch any.
OWN_LABELS = {"dev": {"dev1"}, "dev2": {"dev2"}, "cd": {"idea"},
              **{t: {"qa passed", "qa failed", "needs qa"} for t in TESTERS},
              "l10n": {"translation"}}

CATALOGUES = [
    "apps/web/src/i18n/locales/{locale}.json",
    "apps/mobile/src/i18n/locales/{locale}.json",
    "services/api/translations/messages.{locale}.json",
    "services/api/translations/errors.{locale}.json",
    "services/api/translations/emails.{locale}.json",
    "services/api/translations/emails+intl-icu.{locale}.json",
    "docs/i18n/{locale}.md",
    "docs/i18n/same-as-english.json",
]


def locale_files(locale):
    return {path.replace("{locale}", locale) for path in CATALOGUES}


def linguist_files():
    return set().union(*(locale_files(locale) for locale in LOCALES))


def may(role, command):
    return role in MAY.get(command, ())


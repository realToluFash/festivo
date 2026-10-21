"""Who each role is, what it watches, and how a comment says who it is for."""

import re

DEVELOPERS = {"dev": "dev1", "dev2": "dev2"}

TRANSLATION_QUEUE = ["To Do", "Failed Code Review", "In Progress", "Failed QA"]
# A developer's queue, rework first: findings, then a failed test, then its own build, then
# a new story. Passed Code Review is not queued: the pull request's pass wakes the merge.
BUILD_QUEUE = ["Failed Code Review", "Failed QA", "In Progress", "Ready For Dev"]
# The roles that may run more than one worker (`workers` in agents.json): none keeps a
# stack, so a second worker needs only a checkout of its own.
PARALLEL = ("pm", "ux", "bm", "cd")
# Taken epic by epic: the build, and the stories the product manager grooms for it.
EPIC_ORDERED = (*BUILD_QUEUE, "To Do", "Backlog")
TESTERS_LABELS = {"qa": "qa1", "qa2": "qa2", "qa3": "qa3"}
# A story failed and sent back is offered first to the tester who failed it, for this long.
RETEST_MINUTES = 30


# A story labelled `ops` is infra work ops filed for itself: ops builds it, the lead reviews
# it, and no other role's queue lists it.
OPS_LABEL = "ops"


def developer_of(labels):
    names = set(labels or [])
    for role, label in DEVELOPERS.items():
        if label in names:
            return role
    return "dev"


def builder_of(labels):
    """Who opens and merges the story's pull request, and is woken by its checks."""
    return "ops" if OPS_LABEL in set(labels or []) else developer_of(labels)


def not_translation(labels, state):
    return "translation" not in labels and OPS_LABEL not in labels


def ops_story(labels, state):
    return OPS_LABEL in labels


def translation(labels, state):
    return "translation" in labels


def dev1_filter(labels, state):
    return "translation" not in labels and "dev2" not in labels and OPS_LABEL not in labels


def dev2_filter(labels, state):
    if state == "Ready For Dev":
        return "translation" not in labels and "dev1" not in labels and OPS_LABEL not in labels
    return "dev2" in labels


def everything(labels, state):
    return True


ROLES = {
    "pm": {"skill": "soirely-product-manager", "queue": ["To Do", "Backlog"],
           "filter": not_translation, "heartbeat": 120, "sweeps": True},
    "ux": {"skill": "soirely-designer", "queue": ["Needs Design"],
           "filter": not_translation, "heartbeat": 120, "sweeps": True},
    "dev": {"skill": "soirely-developer", "queue": BUILD_QUEUE,
            "filter": dev1_filter, "heartbeat": 30, "prs": True},
    "dev2": {"skill": "soirely-developer", "invoke": "/soirely-developer dev2",
             "queue": BUILD_QUEUE, "filter": dev2_filter,
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
    "bm": {"skill": "soirely-business-manager", "queue": ["Backlog"],
           "filter": not_translation, "heartbeat": 720, "sweeps": True},
    "ops": {"skill": "soirely-ops", "queue": BUILD_QUEUE + ["To Do"],
            "filter": ops_story, "heartbeat": 360, "sweeps": True, "main": True, "prs": True},
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
    if role in DEVELOPERS and state == "Ready For Dev" and not {"dev1", "dev2"} & set(labels):
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
# Every role that opens pull requests merges its own, once the lead has passed it.
BUILDERS = DEVS + ("l10n", "ops")
TESTERS = ("qa", "qa2", "qa3")
LINGUISTS = ("l10n",)
EVERYONE = tuple(ROLES)

# What each role may write, from the "must not" sections of the skills. A command not
# listed for a role is refused before anything is sent.
MAY = {
    "comment": EVERYONE,
    "note": EVERYONE,
    "permission-ask": EVERYONE,
    "claim": DEVS + TESTERS,
    "move": DEVS + TESTERS + LINGUISTS + ("lead", "pm", "ux", "ops"),
    "label": DEVS + TESTERS + LINGUISTS + ("pm", "cd", "ops"),
    "edit": LINGUISTS + ("pm", "ux", "cd", "bm"),
    "new-story": DEVS + LINGUISTS + ("pm", "cd", "ops"),
    # Whoever files a story makes the epic it needs; a new epic waits for the owner.
    "new-epic": DEVS + LINGUISTS + ("pm", "cd", "ops"),
    "task": LINGUISTS + ("pm",),
    "relate": LINGUISTS + ("pm", "cd"),
    "archive": ("pm",),
    "to-draw": ("ux",),
    "drawn": ("ux",),
    "report": TESTERS,
    "pr-create": BUILDERS,
    "review": ("lead",),
    "pr-reply": DEVS + LINGUISTS + ("lead", "ops"),
    "resolve": ("lead",),
    "merge": BUILDERS,
    "to-qa": DEVS + ("ops",),
    "rerun": DEVS + ("ops",),
}

# The states each role may move a story into, and from. The product manager moves any
# story anywhere.
WAITING = "Waiting On Owner"
# Where a story waits for its merge: In Review only for one passed before these states.
MERGING = ("Passed Code Review", "In Review")
MOVES = {
    "dev": {"In Progress": ("Ready For Dev", "Failed QA", "Failed Code Review", "In Review"),
            "In Review": ("In Progress", "Failed Code Review", "Passed Code Review"),
            "Ready For QA": ("In Review", "Passed Code Review"),
            WAITING: ("Ready For Dev", "In Progress", "Failed QA", "Failed Code Review")},
    # In Progress: a story handed over with no pull request or red checks is not ready.
    "lead": {"In Progress": ("In Review",), "Passed Code Review": ("In Review",),
             "Failed Code Review": ("In Review", "Passed Code Review")},
    "ux": {"Ready For Dev": ("Needs Design",), WAITING: ("Needs Design",)},
    "qa": {"In QA": ("Ready For QA", "In QA"), "Passsed QA": ("In QA",),
           "Failed QA": ("In QA",)},
    "l10n": {"In Progress": ("To Do", "Failed QA", "Failed Code Review"),
             "Ready For QA": ("In Progress",)},
    # Only on a story labelled ops. Ready For QA and Done come with the merge.
    "ops": {"In Progress": ("Backlog", "To Do", "Ready For Dev", "Failed QA",
                            "Failed Code Review", "In Review"),
            "In Review": ("In Progress", "Failed Code Review", "Passed Code Review"),
            WAITING: ("In Progress", "Ready For Dev")},
}
MOVES["dev2"] = MOVES["dev"]
for _tester in TESTERS:
    MOVES[_tester] = MOVES["qa"]

# A role that labels may only touch these labels; the product manager may touch any.
OWN_LABELS = {"dev": {"dev1"}, "dev2": {"dev2"}, "cd": {"idea"},
              **{t: {"qa passed", "qa failed", "needs qa", TESTERS_LABELS[t]} for t in TESTERS},
              "l10n": {"translation"}, "ops": {OPS_LABEL, "needs qa"}}

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


def last_tester(story):
    """The tester whose claim on the story came last, from its `QA claim:` comments."""
    for comment in reversed(story.get("comments") or []):
        if comment["text"].startswith("QA claim:"):
            who = comment["text"].split(":", 1)[1].split(",")[0].strip()
            return who if who in TESTERS else None
    return None


def may(role, command):
    return role in MAY.get(command, ())


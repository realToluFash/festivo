import unittest
from unittest import mock

from soirely_queue import payloads


class Lines:
    def __init__(self, role):
        self.role = role
        self.lines = []

    def add(self, *lines):
        self.lines.extend(lines)


def ticket(labels=("translation",)):
    return {"id": 9, "state": "In Progress", "labels": list(labels)}


def pr(branch):
    return {"number": 40, "branch": branch, "story_id": 9}


class Merge(unittest.TestCase):
    def render(self, role, story, pull, mergeable="MERGEABLE"):
        p = Lines(role)
        with mock.patch.object(payloads.github, "live", return_value={"mergeable": mergeable}), \
                mock.patch.object(payloads.V, "pr_status"):
            payloads.merge(p, pull, story, {"id": 5})
        return " ".join(p.lines)

    def test_the_linguist_merges_its_own_and_then_hands_the_ticket_to_qa(self):
        said = self.render("l10n", ticket(), pr("l10n/sc-9"))
        self.assertIn("merges it once it changes only locale files", said)
        self.assertNotIn("moves the story to Ready For QA", said)

    def test_a_developers_side_pr_on_a_ticket_is_the_developers_to_merge(self):
        said = self.render("dev", ticket(), pr("fix/sc-9/test-wording"))
        self.assertIn("so the merge is still yours", said)
        self.assertNotIn("moves the story to Ready For QA", said)

    def test_any_other_pr_merges_and_hands_its_story_to_qa(self):
        said = self.render("dev", ticket(labels=()), pr("feature/sc-9/x"))
        self.assertIn("moves the story to Ready For QA", said)

    def test_a_conflicting_linguist_pr_is_told_of_no_lead_review(self):
        said = self.render("l10n", ticket(), pr("l10n/sc-9"), mergeable="CONFLICTING")
        self.assertIn("Merge origin/main into the branch and push", said)
        self.assertNotIn("lead", said)
        self.assertIn("lead reviews the new head",
                      self.render("dev", ticket(labels=()), pr("feature/sc-9/x"), "CONFLICTING"))


if __name__ == "__main__":
    unittest.main()

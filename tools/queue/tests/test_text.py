import unittest

from soirely_queue import text as T

STORY = """Some preamble.

# Description
What it is.

```
# not a heading
```

# AC
- one
- two

## Detail
under AC

# Design
frames
"""


class Sections(unittest.TestCase):
    def test_headings_inside_code_fences_are_text(self):
        names = [h for h, _, _ in T.sections(STORY)]
        self.assertEqual(names, ["(top)", "Description", "AC", "Detail", "Design"])

    def test_find_takes_the_ac_alias_and_prefixes(self):
        self.assertEqual(T.find("# Acceptance criteria\n- a", "ac")[0], "Acceptance criteria")
        self.assertEqual(T.find(STORY, "desi")[0], "Design")

    def test_replace_leaves_the_other_sections(self):
        out = T.replace(STORY, "Description", "New text.")
        self.assertIn("New text.", out)
        self.assertNotIn("What it is.", out)
        self.assertIn("under AC", out)

    def test_replace_takes_only_what_find_reads_and_keeps_the_headings_under_it(self):
        out = T.replace(STORY, "AC", "- three")
        self.assertNotIn("- one", out)
        self.assertIn("## Detail\nunder AC", out)
        out = T.replace(STORY, "Design", "drawn")
        self.assertEqual(T.find(out, "Design")[2], "drawn")

    def test_replace_adds_a_missing_section_at_the_top_level(self):
        self.assertTrue(T.replace(STORY, "Risks", "none").rstrip().endswith("\n# Risks\n\nnone"))
        self.assertTrue(T.replace("text", "Risks", "none").rstrip().endswith("\n## Risks\n\nnone"))

    def test_a_section_added_after_the_last_one_survives_its_edit(self):
        story = T.append_dated(STORY, "Decided, 21 Oct (pm)", "kept")
        out = T.replace(story, "Design", "redrawn")
        self.assertEqual(T.find(out, "Decided, 21 Oct (pm)")[2], "kept")
        nested = STORY + "\n## English copy (l10n)\n\nwords\n"
        self.assertIn("words", T.replace(nested, "Design", "redrawn"))

    def test_swap_changes_one_section_and_every_other_byte_stays(self):
        body = ("Fixes it.\r\n\r\n## Description\r\n\r\nOld words.\r\nMore.\r\n\r\n"
                "## Risks\r\n- one  \r\n\r\n\r\n## References\r\n```\r\n## no\r\n```\r\n"
                "## Next Steps\r\nNone.")
        out = T.swap(body, "Risks", "- new\n- two")
        self.assertEqual(out, body.replace("- one  ", "- new\r\n- two"))
        out = T.swap(body, "Next Steps", "Merge it.")
        self.assertEqual(out, body.replace("None.", "Merge it."))
        self.assertEqual(T.swap("## A\n\n## B\nb\n", "A", "a"), "## A\n\na\n\n## B\nb\n")

    def test_matching_names_every_heading_a_name_could_mean(self):
        body = "## Risks\nr\n## Evidence of work\ne\n## Evidence, again\nx\n"
        self.assertEqual(T.matching(body, "risks"), ["Risks"])
        self.assertEqual(T.matching(body, "Evidence"), ["Evidence of work", "Evidence, again"])
        self.assertEqual(T.matching(body, "Evidence of work"), ["Evidence of work"])
        self.assertEqual(T.matching(body, "Design"), [])

    def test_outstanding_items(self):
        report = "Tested on main\n\nOutstanding items:\n- first\n- second\n\nAfter."
        self.assertEqual(T.outstanding_items(report), ["first", "second"])

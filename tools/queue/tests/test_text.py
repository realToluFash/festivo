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

    def test_replace_takes_a_sections_subsections_with_it(self):
        out = T.replace(STORY, "AC", "- three")
        self.assertNotIn("under AC", out)
        self.assertIn("frames", out)

    def test_replace_adds_a_missing_section_at_the_end(self):
        self.assertTrue(T.replace(STORY, "Risks", "none").rstrip().endswith("## Risks\n\nnone"))

    def test_outstanding_items(self):
        report = "Tested on main\n\nOutstanding items:\n- first\n- second\n\nAfter."
        self.assertEqual(T.outstanding_items(report), ["first", "second"])

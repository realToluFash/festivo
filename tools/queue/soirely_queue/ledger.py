"""What a role has already read, so `sq` prints each thing once.

Within a run, a second request for the same thing gets a reference. Across runs, a thing
the role read before and that has not changed gets a reference and the role's own note,
unless the work needs it in full every time: the AC a tester tests against, the comment
being answered.
"""

import os
import time

MANUAL_HOURS = 2


def run_key(db, role, now=None):
    from . import store
    held = store.held_by(db, role, now, os.environ.get("SOIRELY_WORKER"))
    return f"work:{held['id']}" if held else f"manual:{role}"


class Printer:
    def __init__(self, db, role, again=False, now=None):
        self.db, self.role, self.again = db, role, again
        self.now = now or time.time()
        self.run = run_key(db, role, self.now)
        self.lines = []
        self.printed = []

    def _shown(self, key, version):
        row = self.db.execute("select version, at from shown where run = ? and key = ?",
                              (self.run, key)).fetchone()
        if not row or row["version"] != version:
            return False
        return not self.run.startswith("manual:") or self.now - row["at"] < MANUAL_HOURS * 3600

    def _seen(self, key, version):
        row = self.db.execute("select version, at from seen where role = ? and key = ?",
                              (self.role, key)).fetchone()
        return row["at"] if row and row["version"] == version else None

    def add(self, *lines):
        self.lines.extend(lines)

    def block(self, key, version, full, ref, always=False):
        """Prints `full` unless this role already has it; then prints `ref` instead."""
        if (key, version) in self.printed or (not self.again and self._shown(key, version)):
            self.lines.append(f"{ref} (shown above)")
            return False
        seen = None if (always or self.again) else self._seen(key, version)
        if seen:
            day = time.strftime("%d %b", time.localtime(seen))
            self.lines.append(f"{ref} (unchanged since you read it on {day})")
            return False
        self.lines.extend(full if isinstance(full, list) else [full])
        self.printed.append((key, version))
        return True

    def save(self):
        for key, version in self.printed:
            self.db.execute("insert into shown (run, key, version, at) values (?, ?, ?, ?) "
                            "on conflict (run, key) do update set version = excluded.version, "
                            "at = excluded.at", (self.run, key, version, self.now))
            self.db.execute("insert into seen (role, key, version, at) values (?, ?, ?, ?) "
                            "on conflict (role, key) do update set version = excluded.version, "
                            "at = excluded.at", (self.role, key, version, self.now))

    def text(self):
        out, blank = [], False
        for line in self.lines:
            if line == "" and blank:
                continue
            blank = line == ""
            out.append(line)
        return "\n".join(out).strip("\n")

"""A stand-in for the shared references on GitHub, with the same refusals."""

import itertools

from soirely_queue import shared


class FakeRefs:
    def __init__(self):
        self.refs, self.messages, self.parents = {}, {}, {}
        self.ids = (f"{n:040x}" for n in itertools.count(1))
        self.calls = 0

    def list(self):
        self.calls += 1
        return dict(self.refs)

    def message(self, sha):
        self.calls += 1
        return self.messages[sha]

    def commit(self, message, parent=None):
        sha = next(self.ids)
        self.messages[sha], self.parents[sha] = message, parent
        return sha

    def create(self, ref, message):
        if ref in self.refs:
            raise shared.Taken(ref)
        self.refs[ref] = self.commit(message)
        return self.refs[ref]

    def advance(self, ref, old, message):
        if self.refs.get(ref) != old:
            raise shared.Taken(ref)
        self.refs[ref] = self.commit(message, old)
        return self.refs[ref]

    def put(self, ref, message, exists):
        self.refs[ref] = self.commit(message)
        return self.refs[ref]

    def delete(self, ref):
        self.refs.pop(ref, None)

    def data(self, ref):
        return shared.parse(self.messages[self.refs[ref]]) if ref in self.refs else None

    def beat(self, machine, at, started=(), listed=None, standby=()):
        """Another machine's heartbeat."""
        self.put(shared.machine_ref(machine), shared.record(
            "machine", machine=machine, at=at, started=sorted(started),
            listed=sorted(listed if listed is not None else started), standby=sorted(standby),
            paused=False), True)

"""Shortcut's REST API, with the token from SHORTCUT_API_TOKEN."""

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.app.shortcut.com"


class ShortcutError(RuntimeError):
    pass


class Shortcut:
    def __init__(self, token=None):
        self.token = token or os.environ.get("SHORTCUT_API_TOKEN")
        if not self.token:
            raise ShortcutError("SHORTCUT_API_TOKEN is not set")

    def call(self, method, path, body=None, attempts=3):
        """Retries what Shortcut fails now and then: a 5xx, a dropped connection."""
        url = path if path.startswith("http") else API + path
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url, data=data, method=method, headers={
            "Shortcut-Token": self.token, "Content-Type": "application/json"})
        for attempt in range(attempts):
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    return json.loads(response.read() or b"null")
            except urllib.error.HTTPError as error:
                failure = f"Shortcut {error.code} on {method} {path.split('?')[0]}"
                if error.code < 500 or method != "GET":
                    break
            except urllib.error.URLError as error:
                failure = f"Shortcut unreachable: {error.reason}"
                if method != "GET":
                    break
            time.sleep(2 ** attempt)
        raise ShortcutError(failure)

    def search(self, query, pages=20):
        found = []
        path = "/api/v3/search/stories?" + urllib.parse.urlencode(
            {"query": query, "page_size": 25, "detail": "slim"})
        for _ in range(pages):
            body = self.call("GET", path)
            found.extend(body["data"])
            if not body.get("next"):
                break
            path = body["next"]
        return found

    def story(self, story_id):
        return self.call("GET", f"/api/v3/stories/{story_id}")

    def workflows(self):
        return self.call("GET", "/api/v3/workflows")

    def epics(self):
        return self.call("GET", "/api/v3/epics")

    def comment(self, story_id, text, parent_id=None):
        body = {"text": text}
        if parent_id:
            body["parent_id"] = parent_id
        return self.call("POST", f"/api/v3/stories/{story_id}/comments", body)

    def move(self, story_id, state_id):
        return self.call("PUT", f"/api/v3/stories/{story_id}", {"workflow_state_id": state_id})


def slim(raw, states, epics):
    """The parts of a story the roles read, small enough to keep many of."""
    return {
        "id": raw["id"],
        "name": raw["name"],
        "url": raw.get("app_url"),
        "state": states.get(str(raw.get("workflow_state_id"))),
        "labels": sorted(label["name"] for label in raw.get("labels", [])),
        "epic": epics.get(str(raw.get("epic_id"))) if raw.get("epic_id") else None,
        "type": raw.get("story_type"),
        "position": raw.get("position"),
        "moved_at": raw.get("moved_at"),
        "updated_at": raw.get("updated_at"),
        "done": bool(raw.get("completed") or raw.get("archived")),
        "description": raw.get("description") or "",
        "comments": [
            {"id": c["id"], "parent": c.get("parent_id"), "at": c.get("created_at"),
             "text": c.get("text") or ""}
            for c in raw.get("comments", []) if not c.get("deleted")
        ],
    }

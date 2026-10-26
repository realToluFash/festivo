"""Shortcut's REST API, with the token from SHORTCUT_API_TOKEN."""

import json
import mimetypes
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

API = "https://api.app.shortcut.com"
TEAM = "6acb7a32-5acb-464f-b80d-b0994da161b4"
OWNER = "6acb7a32-5323-4319-be6c-6d43226fd986"
WORKFLOW = 500000005


class ShortcutError(RuntimeError):
    pass


class Shortcut:
    def __init__(self, token=None):
        self.token = token or os.environ.get("SHORTCUT_API_TOKEN")
        if not self.token:
            raise ShortcutError("SHORTCUT_API_TOKEN is not set")

    def call(self, method, path, body=None, attempts=3, raw=None, content_type=None):
        """Retries what Shortcut fails now and then: a 5xx, a dropped connection, and on a
        PUT the 409 a concurrent edit of the same story returns. Only GET and PUT, which
        are safe to repeat."""
        url = path if path.startswith("http") else API + path
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None
                                            else None)
        request = urllib.request.Request(url, data=data, method=method, headers={
            "Shortcut-Token": self.token,
            "Content-Type": content_type or "application/json"})
        failure = "Shortcut call failed"
        for attempt in range(attempts):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    return json.loads(response.read() or b"null")
            except urllib.error.HTTPError as error:
                detail = error.read().decode(errors="replace")[:200]
                failure = f"Shortcut {error.code} on {method} {path.split('?')[0]}: {detail}"
                transient = error.code >= 500 or (error.code == 409 and method == "PUT")
                if not transient or method not in ("GET", "PUT"):
                    break
            except urllib.error.URLError as error:
                failure = f"Shortcut unreachable: {error.reason}"
                if method not in ("GET", "PUT"):
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

    def update(self, story_id, **fields):
        return self.call("PUT", f"/api/v3/stories/{story_id}", fields)

    def history(self, story_id):
        return self.call("GET", f"/api/v3/stories/{story_id}/history")

    def workflows(self):
        return self.call("GET", "/api/v3/workflows")

    def epics(self):
        return self.call("GET", "/api/v3/epics")

    def epic_states(self):
        return self.call("GET", "/api/v3/epic-workflow")["epic_states"]

    def epic(self, epic_id):
        return self.call("GET", f"/api/v3/epics/{epic_id}")

    def update_epic(self, epic_id, **fields):
        return self.call("PUT", f"/api/v3/epics/{epic_id}", fields)

    def labels(self):
        return self.call("GET", "/api/v3/labels?slim=true")

    def comment(self, story_id, text, parent_id=None):
        body = {"text": text}
        if parent_id:
            body["parent_id"] = parent_id
        return self.call("POST", f"/api/v3/stories/{story_id}/comments", body)

    def create_story(self, **fields):
        return self.call("POST", "/api/v3/stories", {"group_id": TEAM, **fields})

    def create_epic(self, **fields):
        return self.call("POST", "/api/v3/epics",
                         {"group_ids": [TEAM], "owner_ids": [OWNER], **fields})

    def add_task(self, story_id, description):
        return self.call("POST", f"/api/v3/stories/{story_id}/tasks",
                         {"description": description})

    def complete_task(self, story_id, task_id, complete=True):
        return self.call("PUT", f"/api/v3/stories/{story_id}/tasks/{task_id}",
                         {"complete": complete})

    def relate(self, subject_id, object_id, verb="relates to"):
        return self.call("POST", "/api/v3/story-links",
                         {"subject_id": subject_id, "object_id": object_id, "verb": verb})

    def upload(self, story_id, paths):
        boundary = uuid.uuid4().hex
        parts = [f"--{boundary}\r\nContent-Disposition: form-data; name=\"story_id\"\r\n\r\n"
                 f"{story_id}\r\n".encode()]
        for index, path in enumerate(paths):
            path = pathlib.Path(path)
            kind = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
            parts.append(
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"file{index}\"; "
                f"filename=\"{path.name}\"\r\nContent-Type: {kind}\r\n\r\n".encode()
                + path.read_bytes() + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        return self.call("POST", "/api/v3/files", raw=b"".join(parts),
                         content_type=f"multipart/form-data; boundary={boundary}")


def slim(raw, states, epics):
    """The parts of a story the roles read, small enough to keep many of."""
    epic = epics.get(str(raw.get("epic_id"))) if raw.get("epic_id") else None
    return {
        "id": raw["id"],
        "name": raw["name"],
        "url": raw.get("app_url"),
        "state": states.get(str(raw.get("workflow_state_id"))),
        "labels": sorted(label["name"] for label in raw.get("labels", [])),
        "epic": epic["name"] if isinstance(epic, dict) else epic,
        "epic_id": raw.get("epic_id"),
        "type": raw.get("story_type"),
        "position": raw.get("position"),
        "moved_at": raw.get("moved_at"),
        "updated_at": raw.get("updated_at"),
        "done": bool(raw.get("completed") or raw.get("archived")),
        "archived": bool(raw.get("archived")),
        "description": raw.get("description") or "",
        "tasks": [{"id": t["id"], "text": t["description"], "done": t["complete"]}
                  for t in raw.get("tasks", [])],
        "links": [{"verb": link.get("verb"), "subject": link.get("subject_id"),
                   "object": link.get("object_id")} for link in raw.get("story_links", [])],
        "comments": [
            {"id": c["id"], "parent": c.get("parent_id"), "at": c.get("created_at"),
             "text": c.get("text") or ""}
            for c in raw.get("comments", []) if not c.get("deleted")
        ],
    }

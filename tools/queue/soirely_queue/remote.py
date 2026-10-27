"""`sq web` across the machines on one network: each serves its own page on its LAN address
behind a token every machine shares (`SQ_WEB_TOKEN` in the env file), and reads the
others' through its own server. Nothing here passes through GitHub, whose refs are public."""

import hmac
import http.cookies
import ipaddress
import json
import os
import urllib.error
import urllib.parse
import urllib.request

from . import machine

TOKEN = "SQ_WEB_TOKEN"
TOKEN_MIN = 32
COOKIE = "sq_token"
PEER_SECONDS = 5
DEFAULT_PORT = 8765
LOOPBACK = "127.0.0.1"


def token():
    return os.environ.get(TOKEN) or None


def usable(value):
    return bool(value) and len(value) >= TOKEN_MIN


def config(load=machine.load):
    """This machine's agents.json, or nothing: a file being edited never stops the page."""
    try:
        return load()
    except machine.ConfigError:
        return {}


def web(config):
    """`(address, port)` the always-on page listens on, or None when this machine has none."""
    found = (config or {}).get("web")
    if not isinstance(found, dict):
        return None
    return found.get("listen") or LOOPBACK, found.get("port") or DEFAULT_PORT


def peers(config):
    found = (config or {}).get("peers")
    return {name: url for name, url in found.items()} if isinstance(found, dict) else {}


def loopback(address):
    try:
        return ipaddress.ip_address(address).is_loopback
    except ValueError:
        return address == "localhost"


def problems(config, secret=None):
    """What stops the other machines reading this one, or this one reading them."""
    found = []
    secret = token() if secret is None else secret
    listening = web(config)
    if listening and not loopback(listening[0]) and not usable(secret):
        found.append(f"web listens on {listening[0]} but {TOKEN} is not set to at least "
                     f"{TOKEN_MIN} characters in the env file, so the page is not served")
    for name, url in peers(config).items():
        if urllib.parse.urlsplit(str(url)).scheme not in ("http", "https"):
            found.append(f"peer {name} is {url!r}: an http:// or https:// address")
    if peers(config) and not usable(secret):
        found.append(f"peers are listed but {TOKEN} is not set, so they cannot be read")
    return found


def allowed(client, headers, query, secret):
    """`(allowed, token to set as a cookie)`: loopback needs nothing, anyone else the token,
    as a bearer header, the cookie, or once in the address."""
    if loopback(client):
        return True, None
    if not usable(secret):
        return False, None
    given = []
    bearer = headers.get("Authorization") or ""
    if bearer.startswith("Bearer "):
        given.append(bearer[len("Bearer "):])
    jar = http.cookies.SimpleCookie(headers.get("Cookie") or "")
    if COOKIE in jar:
        given.append(jar[COOKIE].value)
    asked = (urllib.parse.parse_qs(query).get("token") or [None])[0]
    if asked and hmac.compare_digest(asked.encode(), secret.encode()):
        return True, asked
    return any(hmac.compare_digest(g.encode(), secret.encode()) for g in given), None


def fetch(base, path, secret, timeout=PEER_SECONDS):
    """A peer's JSON, as `(status, body)`. A peer that cannot be reached is a 502 whose body
    says why, so the page can name it."""
    request = urllib.request.Request(urllib.parse.urljoin(base.rstrip("/") + "/", path),
                                     headers={"Authorization": f"Bearer {secret or ''}"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as answer:
            return answer.status, answer.read()
    except urllib.error.HTTPError as error:
        if error.code == 401:
            return 502, json.dumps({"error": "it refused this machine's token"}).encode()
        return error.code, error.read()
    except (OSError, ValueError) as error:
        reason = getattr(error, "reason", None) or error
        return 502, json.dumps({"error": f"it did not answer ({reason})"}).encode()

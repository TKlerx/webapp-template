from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
GRAPH_SCOPE = "https://graph.microsoft.com/.default"

_TOKEN_CACHE: dict[str, Any] = {
    "access_token": None,
    "expires_at": 0.0,
}


def send_teams_channel_message(job_id: str) -> dict[str, Any]:
    app_url = _required_env("APP_INTERNAL_URL").rstrip("/")
    secret = _required_env("TEAMS_DELIVERY_SHARED_SECRET")
    parsed = urllib.parse.urlsplit(app_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise ValueError("APP_INTERNAL_URL must be an HTTP(S) app base URL.")
    if len(secret) < 32:
        raise ValueError("TEAMS_DELIVERY_SHARED_SECRET must contain at least 32 characters.")
    request = urllib.request.Request(
        f"{app_url}/api/internal/teams/deliver",
        data=json.dumps({"jobId": job_id}).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
    )
    try:
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode("utf-8"))
            if not isinstance(result, dict):
                raise ValueError("Invalid Teams delivery receipt.")
            return result
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Teams delegated delivery failed: HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise RuntimeError("Teams delegated delivery endpoint is unavailable") from error


def list_teams_channel_messages(payload: dict[str, Any]) -> dict[str, Any]:
    team_id = str(payload.get("teamId") or "").strip()
    channel_id = str(payload.get("channelId") or "").strip()
    top = int(payload.get("top") or 25)
    top = max(1, min(top, 50))

    if not team_id:
        raise ValueError("teams_intake_poll payload is missing teamId.")
    if not channel_id:
        raise ValueError("teams_intake_poll payload is missing channelId.")

    channel_path = f"/teams/{urllib.parse.quote(team_id, safe='')}/channels/{urllib.parse.quote(channel_id, safe='')}/messages"
    path = f"{channel_path}?$top={top}"
    access_token = _get_graph_access_token()
    messages: list[dict[str, Any]] = []
    visited: set[str] = set()
    # ponytail: rescan/deduplicate small-team channel history; use change notifications
    # when historical volume makes complete polling too costly.
    while True:
        response = _graph_request(access_token, path, error_prefix="Graph Teams list failed")
        messages.extend(response.get("value") or [])
        next_link = response.get("@odata.nextLink")
        if not next_link:
            return {"value": messages}
        if next_link in visited:
            raise ValueError("Teams paging link repeated.")
        visited.add(next_link)
        path = _normalize_page_path(str(next_link), channel_path)


def _normalize_page_path(next_link: str, channel_path: str) -> str:
    parsed = urllib.parse.urlsplit(next_link)
    if (
        parsed.scheme != "https" or parsed.netloc != "graph.microsoft.com" or parsed.fragment
        or urllib.parse.unquote(parsed.path) != urllib.parse.unquote("/v1.0" + channel_path)
    ):
        raise ValueError("Teams paging link must stay within the approved channel.")
    return channel_path + ("?" + parsed.query if parsed.query else "")


def _get_graph_access_token() -> str:
    client_id = _required_env("AZURE_AD_CLIENT_ID")
    client_secret = _required_env("AZURE_AD_CLIENT_SECRET")
    tenant_id = _required_env("AZURE_AD_TENANT_ID")
    return _get_access_token(client_id, client_secret, tenant_id)


def _required_env(name: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value or value == "replace-me":
        raise ValueError(f"{name} is required for Teams Graph jobs.")
    return value


def _get_access_token(client_id: str, client_secret: str, tenant_id: str) -> str:
    cached = _TOKEN_CACHE.get("access_token")
    expires_at = float(_TOKEN_CACHE.get("expires_at") or 0)
    if cached and expires_at > time.time() + 60:
        return str(cached)

    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    token_request = urllib.request.Request(
        token_url,
        data=urllib.parse.urlencode(
            {
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "client_credentials",
                "scope": GRAPH_SCOPE,
            }
        ).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )

    try:
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urllib.request.urlopen(token_request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Graph token request failed: HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Graph token request failed: {error.reason}") from error

    access_token = str(payload.get("access_token") or "").strip()
    if not access_token:
        raise RuntimeError("Graph token response did not include an access token.")

    expires_in = int(payload.get("expires_in") or 3600)
    _TOKEN_CACHE["access_token"] = access_token
    _TOKEN_CACHE["expires_at"] = time.time() + expires_in
    return access_token


def _graph_request(
    access_token: str,
    path: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    error_prefix: str,
) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{GRAPH_BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            **({"Content-Type": "application/json"} if payload is not None else {}),
        },
    )

    try:
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"{error_prefix}: HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"{error_prefix}: {error.reason}") from error

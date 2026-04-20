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


def send_graph_mail(payload: dict[str, Any]) -> None:
    mailbox = (os.environ.get("MAIL_DEFAULT_MAILBOX") or "").strip()
    if not mailbox:
        raise ValueError("MAIL_DEFAULT_MAILBOX is required for notification delivery jobs.")

    client_id = _required_env("GRAPH_CLIENT_ID")
    client_secret = _required_env("GRAPH_CLIENT_SECRET")
    tenant_id = _required_env("GRAPH_TENANT_ID")
    access_token = _get_access_token(client_id, client_secret, tenant_id)

    recipient_email = str(payload.get("recipientEmail") or "").strip().lower()
    if not recipient_email:
        raise ValueError("notification_delivery job payload is missing recipientEmail.")

    subject = str(payload.get("subject") or "").strip()
    if not subject:
        raise ValueError("notification_delivery job payload is missing subject.")

    body_html = str(payload.get("bodyHtml") or "").strip()
    body_text = str(payload.get("bodyText") or "").strip()
    if not body_html and not body_text:
        raise ValueError("notification_delivery job payload is missing bodyHtml/bodyText.")

    request_body = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML" if body_html else "Text",
                "content": body_html or body_text,
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": recipient_email,
                        **(
                            {"name": str(payload.get("recipientName")).strip()}
                            if str(payload.get("recipientName") or "").strip()
                            else {}
                        ),
                    }
                }
            ],
        },
        "saveToSentItems": True,
    }

    url = f"{GRAPH_BASE_URL}/users/{urllib.parse.quote(mailbox)}/sendMail"
    request = urllib.request.Request(
        url,
        data=json.dumps(request_body).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )

    try:
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urllib.request.urlopen(request, timeout=30) as response:
            status = response.getcode()
            if status not in {202, 204}:
                raise RuntimeError(f"Graph sendMail returned unexpected status {status}")
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Graph sendMail failed: {error.code} {details}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Graph sendMail request failed: {error.reason}") from error


def _required_env(name: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value or value == "replace-me":
        raise ValueError(f"{name} is required for notification delivery jobs.")
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
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Graph token request failed: {error.code} {details}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Graph token request failed: {error.reason}") from error

    access_token = str(payload.get("access_token") or "").strip()
    if not access_token:
        raise RuntimeError("Graph token response did not include an access token.")

    expires_in = int(payload.get("expires_in") or 3600)
    _TOKEN_CACHE["access_token"] = access_token
    _TOKEN_CACHE["expires_at"] = time.time() + expires_in
    return access_token

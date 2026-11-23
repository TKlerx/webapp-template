from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterator
from typing import Any


GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
GRAPH_SCOPE = "https://graph.microsoft.com/.default"

_TOKEN_CACHE: dict[str, Any] = {}


def send_graph_mail(payload: dict[str, Any]) -> str:
    mailbox = _resolve_mailbox()
    access_token = _get_graph_access_token()

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

    mailbox_path = f"/users/{urllib.parse.quote(mailbox, safe='')}"
    draft = _graph_request(
        access_token,
        f"{mailbox_path}/messages",
        method="POST",
        payload={
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
        error_prefix="Graph create notification draft failed",
    )

    draft_id = draft.get("id")
    if not isinstance(draft_id, str) or not draft_id:
        raise RuntimeError("Graph did not return a draft ID.")
    draft_path = f"{mailbox_path}/messages/{urllib.parse.quote(draft_id, safe='')}"
    internet_message_id = draft.get("internetMessageId")
    if not internet_message_id:
        metadata = _graph_request(
            access_token,
            f"{draft_path}?$select=internetMessageId",
            error_prefix="Graph read notification draft reference failed",
        )
        internet_message_id = metadata.get("internetMessageId")
    if not isinstance(internet_message_id, str) or not internet_message_id:
        raise RuntimeError("Graph did not assign an Internet Message-ID to the draft.")

    _graph_request(
        access_token,
        f"{draft_path}/send",
        method="POST",
        allow_empty=True,
        error_prefix="Graph send notification draft failed",
    )
    return internet_message_id


def list_graph_mail_messages(payload: dict[str, Any]) -> Iterator[dict[str, Any]]:
    mailbox = str(payload.get("mailbox") or "").strip() or _resolve_mailbox()
    folder = str(payload.get("folder") or "inbox").strip() or "inbox"
    top = int(payload.get("top") or 25)
    top = max(1, min(top, 100))
    unread_only = bool(payload.get("unreadOnly"))
    query = {
        "$top": str(top),
        "$orderby": "receivedDateTime DESC",
        "$select": "id,subject,from,receivedDateTime,isRead,bodyPreview,conversationId,internetMessageId",
    }
    if unread_only:
        query["$filter"] = "isRead eq false"
        query.pop("$orderby")

    mailbox_path = f"/users/{urllib.parse.quote(mailbox, safe='')}/mailFolders/{urllib.parse.quote(folder, safe='')}/messages"
    path = f"{mailbox_path}?{urllib.parse.urlencode(query)}"
    token = _get_graph_access_token()
    visited = {path}
    while True:
        response = _graph_request(token, path, error_prefix="Graph list messages failed")
        value = response.get("value")
        if isinstance(value, list):
            yield from value
        link = response.get("@odata.nextLink")
        if not link:
            return
        parsed = urllib.parse.urlsplit(str(link))
        if (
            parsed.scheme != "https" or parsed.netloc != "graph.microsoft.com" or parsed.fragment
            or urllib.parse.unquote(parsed.path) != urllib.parse.unquote("/v1.0" + mailbox_path)
        ):
            raise ValueError("Mail paging link must stay within the requested mailbox folder.")
        path = f"{mailbox_path}?{parsed.query}"
        if path in visited:
            raise ValueError("Mail paging link repeated.")
        visited.add(path)


def get_graph_mail_message(mailbox: str, message_id: str) -> dict[str, Any]:
    query = urllib.parse.urlencode(
        {
            "$select": "id,subject,from,receivedDateTime,isRead,bodyPreview,conversationId,internetMessageId,toRecipients,ccRecipients,replyTo,body,internetMessageHeaders",
        }
    )
    response = _graph_request(
        _get_graph_access_token(),
        f"/users/{urllib.parse.quote(mailbox)}/messages/{urllib.parse.quote(message_id)}?{query}",
        error_prefix="Graph get message failed",
    )
    return response if isinstance(response, dict) else {}


def _resolve_mailbox() -> str:
    mailbox = (os.environ.get("MAIL_DEFAULT_MAILBOX") or "").strip()
    if not mailbox:
        raise ValueError("MAIL_DEFAULT_MAILBOX is required for Graph mail jobs.")
    return mailbox


def _get_graph_access_token() -> str:
    client_id = _required_env("GRAPH_CLIENT_ID")
    client_secret = _required_env("GRAPH_CLIENT_SECRET")
    tenant_id = _required_env("GRAPH_TENANT_ID")
    return _get_access_token(client_id, client_secret, tenant_id)


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
        with urllib.request.urlopen(token_request, timeout=30) as response:  # noqa: S310 - Fixed Microsoft HTTPS origin.  # nosec B310
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
    allow_empty: bool = False,
    error_prefix: str,
) -> dict[str, Any]:
    request = urllib.request.Request(  # noqa: S310 - Fixed Microsoft Graph HTTPS base; callers supply paths.
        f"{GRAPH_BASE_URL}{path}",
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Prefer": 'IdType="ImmutableId"',
            **({"Content-Type": "application/json"} if payload is not None else {}),
        },
    )

    try:
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 - Fixed Microsoft Graph HTTPS base.  # nosec B310
            status = response.getcode()
            if allow_empty and status in {202, 204}:
                return {}

            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"{error_prefix}: HTTP {error.code}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"{error_prefix}: {error.reason}") from error

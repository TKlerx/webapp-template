import io
import json
import unittest
import urllib.error
from email.message import Message
from unittest.mock import patch

import pytest

from starter_worker.graph_teams import send_teams_channel_message, list_teams_channel_messages


@pytest.mark.parametrize(
    ("url", "secret", "error"),
    [
        pytest.param("", "x" * 32, "APP_INTERNAL_URL is required", id="missing-url"),
        pytest.param("ftp://app", "x" * 32, r"HTTP\(S\)", id="unsupported-scheme"),
        pytest.param("http://app", "x" * 31, "at least 32 characters", id="short-secret"),
    ],
)
def test_delivery_rejects_invalid_settings_before_sending(
    url: str, secret: str, error: str
) -> None:
    with (
        patch.dict("os.environ", {"APP_INTERNAL_URL": url, "TEAMS_DELIVERY_SHARED_SECRET": secret}),
        patch("urllib.request.urlopen") as request,
    ):
        with pytest.raises(ValueError, match=error):
            send_teams_channel_message("job-1")
        request.assert_not_called()


@pytest.mark.parametrize(
    ("cached_token", "remaining_seconds", "token_body", "expected_expiry"),
    [
        pytest.param(None, 61, b'{"access_token": "new-token"}', 4600, id="missing-token"),
        pytest.param("cached-token", None, b'{"access_token": "new-token"}', 4600, id="missing-expiry"),
        pytest.param("cached-token", 60, b'{"access_token": "new-token", "expires_in": 120}', 1120, id="refresh-at-boundary"),
        pytest.param("cached-token", 61, None, 1061, id="reuse-above-boundary"),
    ],
)
def test_intake_uses_a_fresh_graph_token(
    cached_token: str | None,
    remaining_seconds: int | None,
    token_body: bytes | None,
    expected_expiry: int,
) -> None:
    now = 1000
    cache: dict[str, str | int | None] = {"access_token": cached_token}
    if remaining_seconds is not None:
        cache["expires_at"] = now + remaining_seconds
    graph_response = io.BytesIO(b'{"value": [{"id": "message-1"}]}')
    responses = [graph_response] if token_body is None else [io.BytesIO(token_body), graph_response]
    expected_token = "cached-token" if token_body is None else "new-token"
    with (
        patch("starter_worker.graph_teams._TOKEN_CACHE", cache),
        patch("starter_worker.graph_teams.time.time", return_value=now),
        patch.dict(
            "os.environ",
            {"AZURE_AD_CLIENT_ID": "client", "AZURE_AD_CLIENT_SECRET": "fake", "AZURE_AD_TENANT_ID": "tenant"},
        ),
        patch("urllib.request.urlopen", side_effect=responses) as request,
    ):
        assert list_teams_channel_messages({"teamId": "t", "channelId": "c"}) == {
            "value": [{"id": "message-1"}]
        }
        assert request.call_count == len(responses)
        assert request.call_args.args[0].get_header("Authorization") == f"Bearer {expected_token}"
        assert cache == {"access_token": expected_token, "expires_at": expected_expiry}


@pytest.mark.parametrize("token_body", [b"{}", b'{"access_token": " "}'], ids=["missing", "blank"])
def test_intake_rejects_an_unusable_graph_token(token_body: bytes) -> None:
    with (
        patch("starter_worker.graph_teams._TOKEN_CACHE", {}),
        patch.dict(
            "os.environ",
            {"AZURE_AD_CLIENT_ID": "client", "AZURE_AD_CLIENT_SECRET": "fake", "AZURE_AD_TENANT_ID": "tenant"},
        ),
        patch("urllib.request.urlopen", return_value=io.BytesIO(token_body)) as request,
    ):
        with pytest.raises(RuntimeError, match="did not include an access token"):
            list_teams_channel_messages({"teamId": "t", "channelId": "c"})
        request.assert_called_once()


class TeamsDeliveryTests(unittest.TestCase):
    def test_intake_follows_only_same_channel_graph_pages(self) -> None:
        next_link = "https://graph.microsoft.com/v1.0/teams/t/channels/c/messages?$skiptoken=next"
        with patch("starter_worker.graph_teams._get_graph_access_token", return_value="app-token"):
            with patch("starter_worker.graph_teams._graph_request", side_effect=[{"value": [{"id": "one"}], "@odata.nextLink": next_link}, {"value": [{"id": "two"}]}]) as graph:
                result = list_teams_channel_messages({"teamId": "t", "channelId": "c", "deltaToken": "/old/delta"})
                self.assertEqual(result, {"value": [{"id": "one"}, {"id": "two"}]})
                self.assertEqual(graph.call_args_list[0].args[1], "/teams/t/channels/c/messages?$top=25")
                self.assertEqual(graph.call_args_list[1].args[1], "/teams/t/channels/c/messages?$skiptoken=next")
            for unsafe in [next_link.replace("graph.microsoft.com", "evil.example"), next_link.replace("/channels/c/", "/channels/other/")]:
                with patch("starter_worker.graph_teams._graph_request", return_value={"value": [], "@odata.nextLink": unsafe}) as graph:
                    with self.assertRaisesRegex(ValueError, "approved channel"):
                        list_teams_channel_messages({"teamId": "t", "channelId": "c"})
                    graph.assert_called_once()

    def test_only_claimed_job_id_crosses_the_delivery_boundary(self) -> None:
        secret = "x" * 32
        with patch.dict("os.environ", {"APP_INTERNAL_URL": "http://app:3270/base", "TEAMS_DELIVERY_SHARED_SECRET": secret}):
            with patch("urllib.request.urlopen", return_value=io.BytesIO(b'{"id":"graph-1"}')) as request:
                self.assertEqual(send_teams_channel_message("job-1"), {"id": "graph-1"})
                sent = request.call_args.args[0]
                self.assertEqual(sent.full_url, "http://app:3270/base/api/internal/teams/deliver")
                self.assertEqual(json.loads(sent.data), {"jobId": "job-1"})
                self.assertEqual(sent.get_header("Authorization"), "Bearer " + secret)
            with patch("urllib.request.urlopen", side_effect=urllib.error.HTTPError("http://app", 502, "private provider body", Message(), None)):
                with self.assertRaisesRegex(RuntimeError, "HTTP 502") as failure:
                    send_teams_channel_message("job-1")
                self.assertNotIn("private provider body", str(failure.exception))

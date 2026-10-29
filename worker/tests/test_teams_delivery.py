import io
import json
import unittest
import urllib.error
from email.message import Message
from unittest.mock import patch

from starter_worker.graph_teams import send_teams_channel_message, list_teams_channel_messages


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
        secret = "test-delivery-key-32-characters-long"
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

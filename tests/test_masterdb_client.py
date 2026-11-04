import os
import unittest
from unittest.mock import Mock, patch

from services.masterdb import masterdb_client


class MasterdbClientAuthTests(unittest.TestCase):
    def setUp(self):
        masterdb_client._ACCESS_TOKEN = None

    def tearDown(self):
        masterdb_client._ACCESS_TOKEN = None

    @patch.dict(os.environ, {
        "MASTERDB_AUTH_ACTOR": "TANTRA_TEST_ACTOR",
        "MASTERDB_AUTH_PASSWORD": "test-password",
    }, clear=False)
    @patch("services.masterdb.masterdb_client.requests.post")
    def test_token_request_sends_configured_actor(self, post):
        response = Mock()
        response.json.return_value = {"access_token": "test-token"}
        post.return_value = response

        self.assertEqual(masterdb_client.get_masterdb_token(), "test-token")
        self.assertEqual(
            post.call_args.kwargs["json"],
            {"actor": "TANTRA_TEST_ACTOR", "password": "test-password"},
        )


if __name__ == "__main__":
    unittest.main()

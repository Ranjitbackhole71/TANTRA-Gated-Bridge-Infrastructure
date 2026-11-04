
import os
import requests
from urllib.parse import quote

MASTERDB_BASE_URL = os.getenv(
    "MASTERDB_BASE_URL",
    "http://127.0.0.1:8000/docs",
).rstrip("/")
if MASTERDB_BASE_URL.endswith("/docs"):
    MASTERDB_BASE_URL = MASTERDB_BASE_URL[:-5].rstrip("/")

TIMEOUT_SECONDS = 15

_ACCESS_TOKEN = None


def get_masterdb_token():
    global _ACCESS_TOKEN

    if _ACCESS_TOKEN:
        return _ACCESS_TOKEN

    actor = os.getenv("MASTERDB_AUTH_ACTOR")
    if not actor:
        raise RuntimeError(
            "MASTERDB_AUTH_ACTOR is missing in TANTRA."
        )

    password = (
        os.getenv("MASTERDB_AUTH_PASSWORD")
        or os.getenv("AUTH_PASSWORD")
    )

    if not password:
        raise RuntimeError(
            "MASTERDB_AUTH_PASSWORD is missing in TANTRA."
        )

    response = requests.post(
        f"{MASTERDB_BASE_URL}/auth/token",
        json={
            "actor": actor,
            "password": password,
        },
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()

    token_data = response.json()
    _ACCESS_TOKEN = token_data.get("access_token")

    if not _ACCESS_TOKEN:
        raise RuntimeError(
            "MASTERDB did not return an access token."
        )

    return _ACCESS_TOKEN


def masterdb_request(method, path, **kwargs):
    headers = dict(kwargs.pop("headers", {}) or {})
    headers["Authorization"] = (
        f"Bearer {get_masterdb_token()}"
    )

    response = requests.request(
        method,
        f"{MASTERDB_BASE_URL}{path}",
        headers=headers,
        timeout=TIMEOUT_SECONDS,
        **kwargs,
    )

    response.raise_for_status()
    return response.json()


def discover_packages(board=None, medium=None, status=None):
    params = {
        key: value
        for key, value in {
            "board": board,
            "medium": medium,
            "status": status,
        }.items()
        if value
    }

    return masterdb_request(
        "GET", "/discovery/packages", params=params
    )


def get_package_runtime(package_id):
    return masterdb_request(
        "GET",
        f"/tantra/packages/{quote(package_id, safe='')}/runtime",
    )


def register_capability(payload):
    return masterdb_request(
        "POST", "/capabilities/register", json=payload
    )


def get_dataset_status(dataset_id):
    return masterdb_request(
        "GET", f"/status/{quote(dataset_id, safe='')}"
    )


def get_dataset_report(dataset_id):
    return masterdb_request(
        "GET", f"/report/{quote(dataset_id, safe='')}"
    )


def discover_capabilities(domain=None, status=None, search=None):
    params = {
        key: value
        for key, value in {
            "domain": domain,
            "status": status,
            "search": search,
        }.items()
        if value
    }

    return masterdb_request(
        "GET", "/tantra/capabilities", params=params
    )


def get_capability(capability_id):
    capability_id = quote(capability_id, safe="")
    return masterdb_request(
        "GET", f"/tantra/capabilities/{capability_id}"
    )


def get_capability_contract(capability_id):
    capability_id = quote(capability_id, safe="")
    return masterdb_request(
        "GET",
        f"/tantra/capabilities/{capability_id}/contract",
    )


def request_capability_access(payload):
    return masterdb_request(
        "POST", "/tantra/access/request", json=payload
    )


def get_access_request(request_id):
    request_id = quote(request_id, safe="")
    return masterdb_request(
        "GET", f"/access/{request_id}"
    )


def retrieve_capability_data(capability_id, payload):
    capability_id = quote(capability_id, safe="")
    return masterdb_request(
        "POST",
        f"/tantra/capabilities/{capability_id}/retrieve",
        json=payload,
    )

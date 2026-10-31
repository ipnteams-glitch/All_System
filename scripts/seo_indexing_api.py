#!/usr/bin/env python3
"""Notify the Google Indexing API that URLs were updated.

Auth: a Google Cloud service account whose JSON key is in GCP_SA_KEY.
The service account email must be added as an **Owner** of the Search
Console property for the Indexing API to accept the URLs.

Caveat: Google officially supports the Indexing API only for pages with
JobPosting or BroadcastEvent structured data. Other URLs are often still
accepted but are not guaranteed to be crawled faster. The sitemap in
Search Console remains the primary discovery path for this site.

Usage: pass URLs as command-line arguments.
  python seo_indexing_api.py https://www.forexcool.com/ ...
With no arguments it reads one URL per line from stdin.
"""

import json
import os
import sys

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SCOPE = "https://www.googleapis.com/auth/indexing"
ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish"


def access_token(sa_info: dict) -> str:
    creds = service_account.Credentials.from_service_account_info(
        sa_info, scopes=[SCOPE]
    )
    creds.refresh(Request())
    return creds.token


def publish(token: str, url: str) -> int:
    resp = requests.post(
        ENDPOINT,
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"},
        data=json.dumps({"url": url, "type": "URL_UPDATED"}),
        timeout=30,
    )
    return resp.status_code, resp.text


def main() -> int:
    raw = os.environ.get("GCP_SA_KEY", "").strip()
    if not raw:
        print("GCP_SA_KEY is empty — skipping (add the secret to enable).")
        return 0

    urls = [a for a in sys.argv[1:] if a.strip()]
    if not urls:
        urls = [ln.strip() for ln in sys.stdin if ln.strip()]
    if not urls:
        print("No URLs to submit.")
        return 0

    token = access_token(json.loads(raw))
    failed = 0
    for u in urls:
        code, text = publish(token, u)
        ok = code == 200
        print(f"{code} {'OK ' if ok else 'ERR'} {u}")
        if not ok:
            print(f"    {text}", file=sys.stderr)
            failed += 1
    if failed:
        print(f"{failed}/{len(urls)} failed.", file=sys.stderr)
        return 1
    print(f"All {len(urls)} URL(s) accepted.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Pull Google Search Console Search Analytics and render a rank dashboard.

Auth: a Google Cloud service account whose JSON key is passed in the
GCP_SA_KEY environment variable. The service account email must be added
as a user on the Search Console property (SITE_URL).

Outputs:
  - A Markdown summary appended to the file named by GITHUB_STEP_SUMMARY
    (renders as tables on the GitHub Actions run page).
  - A standalone HTML report written to the path in OUT_HTML (default
    seo-rank-dashboard.html), uploaded by the workflow as an artifact.

Nothing is written into the published site, so keyword data stays private
to repo collaborators.
"""

import datetime as dt
import json
import os
import sys
import urllib.parse

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
API = "https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query"
ROW_LIMIT = 25
WINDOW_DAYS = 28
# Search Console data lags ~2 days; end the window there to avoid empty tails.
DATA_LAG_DAYS = 2


def access_token(sa_info: dict) -> str:
    creds = service_account.Credentials.from_service_account_info(
        sa_info, scopes=[SCOPE]
    )
    creds.refresh(Request())
    return creds.token


def query(token: str, site: str, start: str, end: str, dimension: str) -> list:
    url = API.format(site=urllib.parse.quote(site, safe=""))
    body = {
        "startDate": start,
        "endDate": end,
        "dimensions": [dimension],
        "rowLimit": ROW_LIMIT,
    }
    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"API error {resp.status_code} for dimension '{dimension}': "
              f"{resp.text}", file=sys.stderr)
        resp.raise_for_status()
    return resp.json().get("rows", [])


def md_table(title: str, rows: list, label: str) -> str:
    out = [f"### {title}", "",
           f"| {label} | Clicks | Impr. | CTR | Pos. |",
           "|---|---:|---:|---:|---:|"]
    if not rows:
        out.append("| _(no data yet)_ |  |  |  |  |")
    for r in rows:
        key = r["keys"][0]
        out.append(
            f"| {key} | {int(r['clicks'])} | {int(r['impressions'])} | "
            f"{r['ctr'] * 100:.1f}% | {r['position']:.1f} |"
        )
    out.append("")
    return "\n".join(out)


def html_table(title: str, rows: list, label: str) -> str:
    cells = "".join(
        f"<tr><td>{r['keys'][0]}</td><td>{int(r['clicks'])}</td>"
        f"<td>{int(r['impressions'])}</td><td>{r['ctr']*100:.1f}%</td>"
        f"<td>{r['position']:.1f}</td></tr>"
        for r in rows
    ) or "<tr><td colspan='5'>no data yet</td></tr>"
    return (f"<h2>{title}</h2><table><thead><tr><th>{label}</th><th>Clicks</th>"
            f"<th>Impr.</th><th>CTR</th><th>Pos.</th></tr></thead>"
            f"<tbody>{cells}</tbody></table>")


def main() -> int:
    raw = os.environ.get("GCP_SA_KEY", "").strip()
    site = os.environ.get("SITE_URL", "").strip()
    if not raw:
        print("GCP_SA_KEY is empty — skipping (add the secret to enable).")
        return 0
    if not site:
        print("SITE_URL is empty.", file=sys.stderr)
        return 1

    sa_info = json.loads(raw)
    token = access_token(sa_info)

    end = dt.date.today() - dt.timedelta(days=DATA_LAG_DAYS)
    start = end - dt.timedelta(days=WINDOW_DAYS)
    s, e = start.isoformat(), end.isoformat()

    queries = query(token, site, s, e, "query")
    pages = query(token, site, s, e, "page")

    header = f"# SEO rank dashboard\n\n`{site}` · {s} → {e} (last {WINDOW_DAYS} days)\n"
    md = "\n".join([
        header,
        md_table("Top queries", queries, "Query"),
        md_table("Top pages", pages, "Page"),
    ])

    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(md + "\n")
    print(md)

    out_html = os.environ.get("OUT_HTML", "seo-rank-dashboard.html")
    html = (
        "<!doctype html><meta charset='utf-8'>"
        "<title>SEO rank dashboard</title>"
        "<style>body{font-family:system-ui,Arial,sans-serif;margin:2rem;}"
        "table{border-collapse:collapse;margin:1rem 0;width:100%;}"
        "th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;}"
        "td:nth-child(n+2),th:nth-child(n+2){text-align:right;}</style>"
        f"<h1>SEO rank dashboard</h1><p>{site} · {s} → {e}</p>"
        + html_table("Top queries", queries, "Query")
        + html_table("Top pages", pages, "Page")
    )
    with open(out_html, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"\nWrote {out_html}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

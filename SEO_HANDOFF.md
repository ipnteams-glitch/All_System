# SEO Project Handoff — forexcool.com

Owner going forward: **คุณแสนเก่ง** (SEO / marketing).
Website code & deploy stays with **Mo**.

Last updated: 2026-10-31

---

## Deploy note for Mo (changed 2026-10-31)

GitHub Pages source was switched from "Deploy from branch" to **GitHub Actions**
(`build_type: workflow`). The live site is now built by `.github/workflows/deploy-pages.yml`,
which includes a step that strips internal files (`marketing/`, `scripts/`, the SEO
handoff/setup docs, stale `index.html` backups) before publishing, so they are no longer
reachable at the public domain. The legacy `pages-build-deployment` builder no longer runs.
If you add new internal-only files, add them to that strip step too.

---

## Done (Layer A — on-page + technical SEO)

Shipped to `main` and live on https://www.forexcool.com/:

- `index.html` / `index_en.html`: descriptive `<title>`, meta description, keywords,
  canonical, hreflang (th / en / x-default), Open Graph, Twitter card,
  JSON-LD (Organization + SoftwareApplication). Fixed `index_en.html` lang `th` → `en`.
- `robots.txt`: allow all + sitemap reference.
- `sitemap.xml`: 4 URLs (/, /index_en.html, /portfolio/, /privacy.html) with hreflang.
- Preview image for OG/Twitter: `sysall16.jpg`.

## Done (Google Search Console)

- Property added: `https://www.forexcool.com/` (URL-prefix type).
- Ownership verified via HTML file `google685571857f1e0422.html` (committed to repo).
- `sitemap.xml` submitted. Status right after submit = "ดึงข้อมูลไม่ได้" (not yet crawled);
  file is live (HTTP 200, valid XML) so it resolves to Success automatically within hours–days.

**Do NOT delete** `google685571857f1e0422.html` from the repo — GSC re-checks it; removing it drops verification.

---

## Backlog (คุณแสนเก่ง to continue)

### Immediate
- [x] GSC sitemap status = Success (read 2026-10-31). Resolved on its own as expected.
- [x] GSC URL Inspection: `/` and `/index_en.html` both already indexed; Request Indexing submitted for both to push latest meta.
      Note: `/` shows an HTTPS warning in the inspection panel; `/index_en.html` reports HTTPS valid, so the `/` flag is a transient www cert quirk — re-check if `/` ever drops from the index.
- [x] Bing Webmaster Tools: signed in with the same Google account, imported both sites from GSC in one click
      (`www.forexcool.com` + `harvestfarmea.blogspot.com`, 1 sitemap). Bing data processing up to 48h.

### Layer B — promotion channels
- [~] Google Business Profile (if eligible). Guide: `marketing/google-business-profile.md`
      (eligibility check first — online-only may not qualify — plus setup steps and alternatives).
- [~] Telegram channel as main funnel — reuse existing SMC image-posting system as content.
      Funnel kit ready: `marketing/telegram-funnel.md` (pinned intro, daily/promo caption templates,
      UTM links to the trial, content rules). Remaining: create the channel, post the pinned message,
      and append the CTA block to the SMC image captions.
- [ ] YouTube / TikTok short clips (EA run results, backtest how-to) → link to site.
- [ ] Facebook group / X / Reddit r/Forex — value posts, no spam.
- [~] Backlinks: Medium / Blogger articles pointing to forexcool.com.
      Note: `harvestfarmea.blogspot.com` already exists in this Google account — candidate backlink source.
      Kit ready: `marketing/backlink-playbook.md` (anchor-text plan, UTM targets, cadence, nofollow caveat)
      + 2 ready-to-post Thai drafts in `marketing/articles/`. Remaining: publish the drafts, add UTM links,
      share the posted URLs. Keep ≤1–2 links per article and write naturally (avoid PBN footprint).

### Layer C — automation
- [x] IndexNow (Bing / Yandex instant indexing): `.github/workflows/indexnow.yml`
      + site-root key file. Fires on every push that changes HTML. No credentials needed.
      Verified working (HTTP 202) on 2026-10-31.
- [~] Google Indexing API — `.github/workflows/indexing-api.yml` + `scripts/seo_indexing_api.py`.
      Built; waiting on the `GCP_SA_KEY` secret (see `SEO_SETUP_GCP.md`). Skips cleanly until then.
- [~] GSC API weekly keyword rank dashboard — `.github/workflows/seo-rank-dashboard.yml`
      + `scripts/seo_rank_dashboard.py`. Built; same `GCP_SA_KEY` secret. Output = Actions run
      summary + private HTML artifact (not published to the site).
- [ ] n8n / Make.com central hub: new run result → auto-post to Telegram + X + FB.
- [ ] Scheduled daily SMC content (build on existing `smcgold` skill).
- [ ] Auto-generate SEO articles from real trade results → auto-post to blog.
- [ ] "Free 14-day trial" signup form → auto-collect email + welcome mail.

See `SEO_SETUP_GCP.md` for the one-time Google Cloud setup that enables the two `[~]` items.

---

## Constraints (legal / platform)

- Forex/trading = restricted ad category on Google Ads & Meta Ads (ID verification, possible account bans).
  Prefer organic SEO + content over paid ads.
- Never advertise guaranteed profit — violates platform policy and legal risk (per ทนายสมชาย review).
- Keep risk disclaimers intact on all pages.

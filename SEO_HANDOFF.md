# SEO Project Handoff — forexcool.com

Owner going forward: **คุณแสนเก่ง** (SEO / marketing).
Website code & deploy stays with **Mo**.

Last updated: 2026-10-31

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
- [ ] Re-check GSC sitemap status → should turn "Success"; if still failing after 48h, inspect fetch.
- [ ] GSC → URL Inspection → Request Indexing for `/` and `/index_en.html`.
- [ ] Bing Webmaster Tools (bing.com/webmasters): import from GSC in one click. Covers Bing + ChatGPT search.

### Layer B — promotion channels
- [ ] Google Business Profile (if eligible).
- [ ] Telegram channel as main funnel — reuse existing SMC image-posting system as content.
- [ ] YouTube / TikTok short clips (EA run results, backtest how-to) → link to site.
- [ ] Facebook group / X / Reddit r/Forex — value posts, no spam.
- [ ] Backlinks: Medium / Blogger articles pointing to forexcool.com.
      Note: `harvestfarmea.blogspot.com` already exists in this Google account — candidate backlink source.

### Layer C — automation
- [ ] n8n / Make.com central hub: new run result → auto-post to Telegram + X + FB.
- [ ] Scheduled daily SMC content (build on existing `smcgold` skill).
- [ ] Google Indexing API — auto-ping new URLs.
- [ ] GSC API — weekly keyword rank dashboard.
- [ ] Auto-generate SEO articles from real trade results → auto-post to blog.
- [ ] "Free 14-day trial" signup form → auto-collect email + welcome mail.

---

## Constraints (legal / platform)

- Forex/trading = restricted ad category on Google Ads & Meta Ads (ID verification, possible account bans).
  Prefer organic SEO + content over paid ads.
- Never advertise guaranteed profit — violates platform policy and legal risk (per ทนายสมชาย review).
- Keep risk disclaimers intact on all pages.

# SEO audit (current state) and full ranking roadmap

**Current focus:** **WordPress only** ([inthecircle.co](https://inthecircle.co))—content, plugins, GSC, and publishing. The **app** domain is out of scope for this phase (left in Part A as background only).

Living roadmap for organic growth with **inthecircle.co** as the primary SEO surface. **Part B1** explains why this is a high-confidence strategy—not a ranking guarantee.

## Part A — Audit: what we have today

### A1. Properties and roles

| Surface | Role | In-repo signal |
| -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **inthecircle.co** | Marketing + blog; primary organic content and backlinks | [wordpress-seo/inthecircle-seo-enhancements.php](../../wordpress-seo/inthecircle-seo-enhancements.php), [wordpress-seo/README.md](../../wordpress-seo/README.md) |
| **app.inthecircle.co** | Product (not prioritized for SEO work this phase) | [src/app/sitemap.ts](../../src/app/sitemap.ts), [src/app/robots.ts](../../src/app/robots.ts) |

**Fit:** All editorial and ranking effort targets **WordPress**. The app stays lean by design; no need to tune app GSC/sitemaps while this focus is in effect.

### A2. WordPress plugin and automation (strengths)

- **Per-page SEO:** Titles, descriptions, keywords meta, canonical, OG/Twitter; overrides AIOSEO filters ([wordpress-seo/README.md](../../wordpress-seo/README.md)).
- **Schema:** Organization, WebSite, SoftwareApplication/WebApplication, FAQ on FAQ page; App Store in structured data.
- **UX/SEO glue:** Internal links from homepage, branded 404, image alt helper, security headers.
- **Analytics:** GA4 hooks for `sign_up` / `download_app` (mark conversions in GA4).
- **Content pipeline:** [wordpress-seo/blog-posts/](../../wordpress-seo/blog-posts/) — **9** articles **+ 3 pillar hubs** (12 Markdown sources); publish via REST (`publish-posts-to-wordpress.js`) or WXR import; [wordpress-seo/INDEXING_CHECKLIST.md](../../wordpress-seo/INDEXING_CHECKLIST.md) + ping script pattern in README.

### A3. Repo scripts (operational)

- **WordPress:** `set-aioseo-meta.js`, `upload-seo-plugin.mjs` / `upload-seo-plugin-sftp.mjs`, generate WXR, publish posts (paths under [wordpress-seo/scripts/](../../wordpress-seo/scripts/) and README).
- **Scores / bulk:** [scripts/audit-seo-scores.js](../../scripts/audit-seo-scores.js) (AIOSEO analyze API), [scripts/improve-all-posts-seo.js](../../scripts/improve-all-posts-seo.js), [scripts/apply-seo-all-posts.js](../../scripts/apply-seo-all-posts.js), [scripts/force-seo-100.js](../../scripts/force-seo-100.js).

### A4. App domain (reference only — not in scope now)

- **Sitemap / robots:** [src/app/sitemap.ts](../../src/app/sitemap.ts), [src/app/robots.ts](../../src/app/robots.ts). No action required while WordPress is the SEO priority.

### A5. Gaps (why “rank for many keywords” needs more than plugin + 9 posts)

1. **Topic breadth:** Nine posts cannot cover the full “creators + tools + workflows” universe; need a **keyword matrix → content calendar** and sustained publishing.
2. **Intent coverage:** Need **commercial** (best apps, comparisons), **informational** (how to collaborate, grow), **navigational** (brand), and **geo** (GCC/MENA creators) in a deliberate mix—not only blog posts (landing hub pages, tools directories, glossaries).
3. **Authority:** On-page + schema alone rarely win competitive head terms; **digital PR, partnerships, guest posts, communities, and linkable assets** must be planned and resourced.
4. **TruSEO `linksRatio`:** Known ceiling (~96); treat as **non-blocking** for go-live decisions—focus on **search demand + quality + internal linking**, not chasing 100 on every URL.
5. **Measurement:** **GSC** on the **inthecircle.co** domain property as the main report; **GA4** on the marketing site as needed; optional rank tracker; define **review cadence** and **success metrics** per cluster.

---

## Part B — Objective (definition of success)

**Rank broadly** for terms around: creators, creator economy, content creation, discovery/collaboration, and **apps/tools creators use** (editing, scheduling, analytics, monetization, etc.)—with **Inthecircle** positioned as the **networking/collaboration layer**, not as “another CapCut tutorial site.”

**Success signals (6–12 months):**

- Growing **non-brand impressions/clicks** in GSC for target clusters.
- **Featured snippets / FAQ** where schema and content support it (FAQ page already; extend where appropriate).
- **Top 10** for a defined set of **mid-tail** collaboration/network/geo terms; **page 1–2** for selective **head** terms where authority allows.
- **Conversion:** installs/signups attributed to organic (GA4 + UTM discipline on campaign links).

---

## Part B1 — Strategy rationale: why this approach is promising (not a guarantee)

**No strategy can promise rankings on every keyword.** This roadmap is **promising** because it stacks tactics that historically **raise the probability and speed** of earning traffic for “content / creator / tools” topics, while keeping decisions **measurable** so you invest in what works.

**1. You already own the hard technical baseline on the marketing site.** Crawlable WordPress, meta/schema/canonical discipline, FAQ and app-aligned structured data, and an automation path for publishing reduce the risk that good content fails for **fixable technical reasons**. The remaining lift is **coverage + quality + authority**—which this plan addresses directly.

**2. Pillar + cluster architecture matches how search systems surface topical depth.** Hubs (collaboration, geo, “how we work together”) plus many internally linked supporting pages signal **coherent expertise** around creator networking rather than one-off posts competing in isolation. That pattern tends to perform **more reliably** than random long-tail articles with no internal link graph.

**3. Intent is explicitly split so pages do not cannibalize each other.** Brand and product queries lean toward **app/marketing** surfaces; broad “tools” and “how to grow” queries lean toward **editorial** with a consistent CTA story (“find collaborators”), so you can win informational demand **without** pretending the product is a generic editing tutorial.

**4. Authority work is in the plan, not an afterthought.** Competitive “content” keywords are often **link- and brand-sensitive**. Baking in digital PR, partnerships, and **one linkable asset per quarter** addresses the usual reason on-page-only strategies stall.

**5. Phasing de-risks wasted effort.** Baseline GSC + keyword sheet → pillars → steady publishing → outreach means you **validate demand** before scaling volume, and you can **refresh or cut** underperformers using data (Part F).

**6. Quality guardrails reduce penalty/reputation risk.** The plan avoids thin templates and reckless comparisons (Part G), which protects **long-term** trust—important for a consumer app brand.

**Plain expectation:** execute consistently for **6–12 months**; expect **meaningful growth in non-brand visibility and mid-tail rankings** if publishing quality and outreach meet the bar. **Head-term dominance** may lag until backlinks and brand mentions compound—still worth pursuing, but not overnight.

---

## Part B2 — Keyword universe (seed list to expand in a spreadsheet)

Organize in a sheet with columns: `cluster`, `keyword`, `intent`, `locale`, `priority`, `page type`, `target URL (new/existing)`, `month`.

**Brand / product**

- inthecircle, inthe circle app, inthecircle app, inthecircle creators, networking app for creators, creator networking app, find collaborators app

**Collaboration / network (core differentiator)**

- find collaborators, find creators to collab, youtube collaboration, twitch collaboration, creator collab, co-create content, cross-promotion creators, creator introductions, local creators network, creator community app, meet other creators, networking for youtubers/streamers/tiktokers

**Geo (GCC / MENA — keep authentic; avoid spammy city lists)**

- creators in UAE, Saudi creators, Egypt creators community, Jordan creators, Lebanon creators, Dubai creators network, MENA creator community, GCC content creators (and Arabic equivalents if you localize)

**Creator economy / career (supporting)**

- become full-time creator, creator income streams, brand deals creators, sponsorship rates, creator portfolio, media kit creator, how to pitch brands

**Tools & workflow (high volume; editorial angle = “creators use X; Inthecircle helps you find people to use it with”)**

- *Editing / production:* capcut, premiere pro, davinci resolve, canva for creators
- *Short-form:* tiktok algorithm tips, youtube shorts vs tiktok, repurpose content
- *Audio/podcast:* audacity, descript, podcast guests
- *Scheduling / ops:* buffer, later, metricool (generic “best scheduling tools for creators”)
- *Analytics:* youtube analytics, instagram insights, channel audit
- *Community / membership:* discord for creators, patreon alternatives, community platforms
- *Monetization:* creator funds, affiliate marketing creators, merch

**Competitive / comparison (later phase; needs strong E‑E‑A‑T)**

- inthecircle vs linkedin for creators, creator platforms comparison, networking apps for influencers (only if legally/brand-safe and honest)

---

## Part C — Topic clusters and page types

- **Pillar 1 — “Creator networking & collaboration”** (hub + many internal links): defines problems (isolation, fake followers, hard collabs), how Inthe fits; links to geo and tool posts.
- **Pillar 2 — “How creators work together”** (process content): briefs, rights, cross-promo, remote collab, “first call” templates (PDF/linkable asset for backlinks).
- **Pillar 3 — Geo hubs** (one strong hub per priority market or one “MENA creators” hub + ethical subpages if depth exists): events, norms, Arabic/English mix if bilingual.
- **Supporting clusters — Tools:** “Best X for creators in 20XX” with honest pros/cons; CTA to “find people to create with.”
- **Supporting clusters — Platform tips:** Shorts, TikTok, streaming—tie each article to **collaboration** (duets, guests, shoutouts).

**Internal linking rules**

- Every new post: **2+ links** to pillars or high-value money adjacent pages; **1 link** to `/download` or home CTA where natural.
- Hub pages: update quarterly with **3 new links** to fresh posts.

---

## Part D — Content calendar and operations (90-day spine)

| Week band | Output | Focus |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1–2 | Keyword sheet v1 + GSC baseline export | Topics from Part B2; prioritize by impression opportunity |
| 3–4 | 2 pillars live or upgraded + refresh 2 existing posts | Internal links, FAQ blocks where appropriate |
| 5–8 | 2 posts/week (or 1 long + 1 short) | 50% collaboration/geo, 50% tools/workflows |
| 9–12 | First linkable asset + outreach | Template pack, “state of MENA creators” mini-report, or tool comparison with original screenshots |

**Governance**

- **Owner:** one editor + technical reviewer for schema/canonical.
- **Checklist per publish:** title/meta, canonical, internal links, featured image + alt, GSC URL inspect after major launches.

---

## Part E — Authority and off-site (cannot skip for competitive terms)

- **Digital PR:** founder story, launch milestones, “creators in [region]” story pitched to tech/lifestyle press.
- **Partnerships:** creator programs, coworking spaces, universities, podcasts (guest spots).
- **Communities:** Authentic participation (Reddit rules, Discord, local groups)—value first, link second.
- **HARO / expert quotes:** Position brand as expert on creator collaboration.

Set **monthly link/contact targets** (e.g., 10 meaningful outreach touches) and track placements in a simple log.

---

## Part F — Measurement and tooling

- **Google Search Console:** **Domain property for inthecircle.co** — coverage, queries, pages, sitemaps (`sitemap_index.xml`). Skip app-only reporting unless you revisit app scope later.
- **GA4:** Conversions for `download_app` / `sign_up`; optional organic landing page exploration report.
- **Rank tracker (optional):** 30–50 tracked keywords across clusters; refresh weekly.
- **Monthly review:** top movers/losers, content refreshes, new cluster bets.

---

## Part G — Risk and quality bar

- **Avoid thin affiliate spam:** Tool posts must add original research, screenshots, or local angle.
- **YMYL:** Be careful with income/legal claims; prefer “overview + verify with a professional” where needed.
- **Brand safety:** Comparisons must be factual; no trademark misuse in titles.

---

## Part H — Repo and routing conventions

1. **Marketing content** stays on WordPress (inthecircle.co); do not replace the Next.js app with static HTML rewrites on Vercel (see `.cursor/rules/vercel-next-routing.mdc` and [docs/VERCEL_JSON.md](../VERCEL_JSON.md)).
2. **Indexing checklist:** [wordpress-seo/INDEXING_CHECKLIST.md](../../wordpress-seo/INDEXING_CHECKLIST.md).
3. **TruSEO audits:** see Appendix A for `audit-seo-scores.js` and credential files.

---

## Summary

**Audit:** Strong on-site **WordPress** SEO (plugin + AIOSEO + schema + blog pipeline); **weak** relative to goal on **topic breadth, authority building, and repeatable content ops**. **Parts B–G** are the actionable roadmap; **Part B1** states why the approach is **high-confidence and promising** without claiming guaranteed rankings.

---

## Appendix A — AIOSEO score audit script

From the repo root:

```bash
node scripts/audit-seo-scores.js
```

**Credentials:** The script loads the first file that exists, in order:

1. [scripts/.env.wp](../../scripts/.env.wp) — `WP_SITE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`
2. `../../Inthecircle/scripts/.env.wp` (relative to repo root: sibling `Inthecircle` folder next to this repo), same keys

Lines using `WORDPRESS_URL`, `WORDPRESS_USER`, `WORDPRESS_APP_PASSWORD` are also recognized.

---

## Operational artifacts

Living files for the team (copy templates each quarter; keep CSV in Git or export to Sheets).

- [seo-keyword-seed.csv](./seo-keyword-seed.csv) — seed keywords from Part B2 with `cluster`, `intent`, `priority`, placeholders for URL/month.
- [content-calendar-90d-template.md](./content-calendar-90d-template.md) — 90-day spine from Part D with checklists and weekly slots.
- [outreach-log-template.md](./outreach-log-template.md) — backlinks / PR touch log from Part E.

---

## Changelog

| Date | Change |
| ---- | ------ |
| 2026-03-24 | Initial roadmap in `docs/plans/`; `audit-seo-scores.js` resolves `scripts/.env.wp` or legacy Inthecircle path. |
| 2026-03-24 | Keyword seed CSV, 90-day calendar template, outreach log template; linked from this doc and `README.md`. |
| 2026-03-24 | Three pillar drafts in `wordpress-seo/blog-posts/` (10–12); publish script + AIOSEO focus map updated. |
| 2026-03-24 | Scope: **WordPress-only** focus for execution; app domain deprioritized in this doc. |

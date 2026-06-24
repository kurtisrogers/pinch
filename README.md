# Pinch

**Pinch** is a client-side site audit toolkit for GitHub Pages. Crush images, scan page weight, crawl sites, run developer audits, and analyze HAR exports — all in your browser.

Live demo: [https://kurtisrogers.github.io/pinch/](https://kurtisrogers.github.io/pinch/)

## Features

### 🍹 Crush — image optimizer
Drop an image to compress it TinyPNG-style. Export as **PNG, JPEG, WebP, or GIF**, generate a **responsive image set** with custom mobile/tablet/desktop widths, or produce a **favicon + OG asset pack** (16–512px + 1200×630). Download individual files or a ZIP with `srcset.html` and `<picture>` snippets. Everything runs locally — files never leave your device.

### 🌴 Image scanner
Enter any URL and get an estimate of how much image bandwidth you could save on mobile, tablet, and desktop by serving properly sized images.

### 🌅 Dev Audit
Full developer audit in one pass:

- **HTML, UX & accessibility** — validation, UX signals, WCAG scan via [axe-core](https://github.com/dequelabs/axe-core)
- **Performance** — Core Web Vitals heuristics, font loading, third-party script map
- **SEO & security** — JSON-LD schema, security headers, robots.txt, cookie/consent hints, CSS hints
- **Social preview** — live OG/Twitter card preview

Export results as **JSON** or **Markdown**, or **save a baseline** to compare future scans.

### 🕷️ Crawl
Breadth-first site crawl with dead link checking, plus:

- **Redirect chain** analysis
- **Mixed content** detection on HTTPS pages
- **Sitemap** validation

Links are tagged by zone (content, navigation, footer). Download a **PDF report** of dead links.

### 🛠️ Tools
- **HAR analyzer** — import a Chrome DevTools HAR export for domain breakdown, slow requests, and failure summary
- **Baseline diff** — compare against your last saved Dev Audit baseline (stored in browser localStorage)

## Billing (optional)

Pinch can enforce **monthly credits** via Supabase Auth + Edge Functions. Without env vars, everything stays free and open.

| Tool | Credits |
|------|---------|
| Scan | 1 |
| Dev Audit | 2 |
| Crawl | 4 |
| Crush / Tools | Free |

Free tier: **10 credits/month**. Pro/Team tiers via Stripe.

Setup guide: [docs/BILLING.md](docs/BILLING.md)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173/pinch/](http://localhost:5173/pinch/) (note the base path).

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deploy

Pushes to `main` automatically deploy to GitHub Pages via `.github/workflows/deploy.yml`.

After the first deploy, enable GitHub Pages in repo settings: **Settings → Pages → Source: GitHub Actions**.

## Limitations

- Requires CORS proxies to fetch page HTML and check links (`corsproxy.io`, `images.weserv.nl`)
- Client-side only — large crawls are limited by max pages (default 25) and proxy rate limits
- Security header checks depend on what the CORS proxy exposes
- HAR and baseline features use browser storage; baselines are per-browser
- Performance metrics are heuristic HTML-based signals, not lab Lighthouse scores

## License

MIT

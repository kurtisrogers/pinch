# Pinch

**Pinch** is a site audit toolkit for GitHub Pages. Scan image efficiency across viewports, crawl a site with a spider, and check content links for dead anchors — then download a PDF report.

Live demo: [https://kurtisrogers.github.io/pinch/](https://kurtisrogers.github.io/pinch/)

## Features

### Image scanner
Enter any URL and get an estimate of how much image bandwidth you could save on mobile, tablet, and desktop by serving properly sized images.

### Site spider & link checker
Crawl internal pages (configurable depth and page limit), check every anchor link, and highlight dead links (HTTP 4xx/5xx). Links are tagged by zone — **content**, navigation, footer — so you can prioritise fixes in body copy. Download a **PDF report** summarising dead links.

### UX, HTML & accessibility audit
Single-page audit with three scored categories:

- **HTML validation** — doctype, lang, duplicate IDs, deprecated tags, heading structure, table headers, landmark elements
- **UX signals** — title/description length, viewport meta, favicon, Open Graph, generic link text, form labels, content depth
- **Accessibility** — automated WCAG 2.1 scan via [axe-core](https://github.com/dequelabs/axe-core) with selector-level violations

## What the image scanner does

1. Fetches the page HTML via a CORS proxy (`corsproxy.io`, with fallback)
2. Finds all `<img>` and `<picture>` elements
3. Loads each image directly for dimensions and via `images.weserv.nl` for byte size
4. Estimates rendered size at three viewports:
   - **Mobile** — 390px @ 2× DPR
   - **Tablet** — 768px @ 2× DPR
   - **Desktop** — 1280px @ 1.5× DPR
5. Compares bytes served vs bytes needed, accounting for `srcset`, `sizes`, and `<picture>` sources

## What the spider does

1. Breadth-first crawl from your start URL (same domain by default)
2. Extracts all `<a href>` links and classifies them by page zone
3. Checks each HTTP(S) link via CORS proxy for 4xx/5xx responses
4. Renders an in-app report and generates a downloadable PDF of dead links

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

## How estimates work

Waste is calculated as the difference between the image bytes a browser would download and the bytes needed for the display slot at each viewport. When `srcset` w-descriptors are present, the scanner simulates browser selection. File size for non-default srcset variants is estimated proportionally to pixel area.

These are estimates — actual savings depend on compression, CDN transforms, art direction, and CSS layout. The goal is to highlight obvious over-serving, not replace a full performance audit.

## Limitations

- Requires CORS proxies to fetch page HTML and check links (`corsproxy.io`, `images.weserv.nl`)
- Only analyzes `<img>` and `<picture>` tags, not CSS `background-image`
- Spider crawl is client-side — large sites are limited by max pages (default 25) and proxy rate limits
- Link checks reflect what the proxy can reach; some sites block proxy requests
- PDF report covers dead links found during the crawl, not a full sitemap audit

## License

MIT

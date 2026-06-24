# Pinch

**Pinch** is a responsive image scanner. Enter any URL and get an estimate of how much image bandwidth you could save on mobile, tablet, and desktop by serving properly sized images.

Live demo: [https://kurtisrogers.github.io/pinch/](https://kurtisrogers.github.io/pinch/)

## What it does

1. Fetches the page HTML via a CORS proxy (`corsproxy.io`, with fallback)
2. Finds all `<img>` and `<picture>` elements
3. Loads each image directly for dimensions and via `images.weserv.nl` for byte size
4. Estimates rendered size at three viewports:
   - **Mobile** — 390px @ 2× DPR
   - **Tablet** — 768px @ 2× DPR
   - **Desktop** — 1280px @ 1.5× DPR
5. Compares bytes served vs bytes needed, accounting for `srcset`, `sizes`, and `<picture>` sources
6. Surfaces per-image recommendations (srcset widths, WebP/AVIF, lazy loading)

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

- Requires CORS proxies to fetch page HTML and image bytes (`corsproxy.io`, `images.weserv.nl`)
- Only analyzes `<img>` and `<picture>` tags, not CSS `background-image`
- Cannot scan pages that block proxy requests
- SVG images are treated as resolution-independent (zero waste)

## License

MIT

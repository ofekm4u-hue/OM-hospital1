# Solace Aura Estate

A single-page, warm ultra-luxury website for **Solace Aura Estate (SAE)** — a
bespoke builder of private sanctuaries. Built as a self-contained
`index.html` with Tailwind (via the Play CDN), Google Fonts, and a touch of
vanilla JavaScript.

## Viewing the site

The site is a single file with no build step.

```bash
# Easiest — just open it
open index.html        # macOS
xdg-open index.html    # Linux

# Or serve locally if you prefer real URLs
python3 -m http.server 8000
# then visit http://localhost:8000
```

The site uses external resources (Tailwind CDN, Google Fonts, Unsplash imagery).
If those services are blocked, every visual has a warm fallback so the layout
still holds.

## Structure

- `index.html` — the entire site: nav, hero, concierge stewardship, nine
  "Worlds of Creation" service pillars, a consultation-style VIP inquiry form,
  and footer. Brand tokens (Sanctuary palette + typography) are configured
  inline via Tailwind's `theme.extend`.
- `README.md` — this file.

## Swapping in client photography

Each `<img>` carrying an Unsplash URL is preceded by a short
`IMAGE PROMPT:` comment describing the intended subject. Replace the `src`
with client-supplied art and remove the comment when finished. The hero image
and all pillar cards already have warm CSS fallbacks if a swap is delayed.

## Design tokens

- **Palette** — Chocolate `#2C1B10`, Coffee `#4A3528`, Walnut `#6B4A30`,
  Bronze `#8C6E4A`, Gold `#B8935B`, Sand `#D8C9B1`, Ivory `#F4EDE0`.
- **Type** — Cormorant Garamond (display serif) + Inter (body sans).
- **Motion** — smooth anchor scroll, IntersectionObserver scroll-reveal,
  subtle hero parallax, shimmer-on-hover CTAs. All disabled gracefully under
  `prefers-reduced-motion`.

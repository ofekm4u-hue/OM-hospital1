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

---

## דף מוצר — VERTEX מבית Solace (`product.html`)

קובץ `product.html` הוא דף נחיתה עברי מלא (RTL) עבור **VERTEX מבית Solace** —
סילונית דנטלית מקצועית במחיר השקה **249 ₪ במקום 599 ₪**. הדף עצמאי לחלוטין
(Tailwind מה-CDN + פונטים Heebo/Assistant מ-Google Fonts) וכולל אינטגרציה עם
**PayPal Smart Buttons** לרכישה מאובטחת במטבע שקלים (ILS).

### צפייה מקומית

```bash
python3 -m http.server 8000
# פתחו: http://localhost:8000/product.html
```

### הפעלת התשלום בייצור (Going Live with PayPal)

עד שתספקו Client ID אמיתי של PayPal, הדף מציג כפתור "תשלום (מצב דמו)"
מושבת ובאנר צהוב מעל הטופס — שאר הדף פעיל לחלוטין כדי לאפשר תצוגה ועיצוב.

להפעלת תשלום אמיתי:

1. צרו חשבון מוכר ב-[developer.paypal.com/dashboard](https://developer.paypal.com/dashboard)
   ושלפו את ה-**Client ID** של אפליקציה ב-Live mode (לבדיקות אפשר להשתמש ב-Sandbox).
2. בקובץ `product.html` החליפו את שני המופעים של המחרוזת
   `REPLACE_WITH_PAYPAL_CLIENT_ID` ב-Client ID האמיתי שלכם —
   אחד בתוך תגית `<script>` שמגדירה את `window.PAYPAL_CLIENT_ID`,
   והשני בכתובת ה-`src` של PayPal SDK באותה כותרת.
3. לעדכון מחיר, ערכו את `window.PRODUCT_PRICE_ILS` (וגם `window.PRODUCT_ORIGINAL`
   למחיר החצוי) בראש הקובץ — המחיר מוצג אוטומטית בכל המקומות.

### תכונות עיקריות של הדף

- **100% עברית, RTL מלא** — כולל הודעות שגיאה ושפת PayPal (`locale=he_IL`).
- **שו"ת אינטראקטיבי** — אקורדיון מבוסס `<details>` עם פתיחה אחת בכל פעם.
- **בליעת איקונים לתכונות טכניות** — 6 כרטיסי תכונות עם אייקונים גרפיים.
- **טופס רכישה חכם** — ולידציה בעברית, חישוב סה״כ לפי כמות,
  כפתור התשלום מופעל רק כשכל השדות תקינים.
- **פלטת מים-כחול נקייה** — `--aqua-deep`, `--aqua-brand`, `--aqua-mist`.

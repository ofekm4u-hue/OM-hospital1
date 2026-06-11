# Ultimate Mixology Hub — מערכת מיקסולוגיה מתקדמת

אפליקציית מיקסולוגיה יוקרתית בעברית מלאה (RTL), בנויה כ-**React 18 + Vite +
Tailwind**. עיצוב "בר לאונג' אפלולי" (Modern Dark Luxury) בפלטת שחור-פחם, זהב
מוברש ואמבר חם. כל הלוגיקה רצה בצד הלקוח — ללא שרת וללא קריאות API.

## שתי קטגוריות ראשיות

### 1. אנציקלופדיית הקלאסיקות (Classic Bible)
בסיס נתונים של **24 קוקטיילים קלאסיים** (4 לכל בסיס אלכוהולי), עם סינון מהיר
לפי בסיס (Filter Pills) וחיפוש חופשי. כל כרטיס מציג מתכון מלא: רכיבים בדיוק של
מיליליטרים, המלצת מותג ספציפית (Brand Spec), סוג כוס, תוכנית קרח, שיטת הכנה,
עיטור, וגרף רדאר של פרופיל הטעם.

### 2. מעבדת האלכימיה (Mixology Lab)
מנוע רקיחה דטרמיניסטי שמרכיב קוקטייל מאפס לפי **המלאי הקיים** של המשתמש:

- **שלב א'** — סימון מלאי הבר (נשמר ב-`localStorage` בין ביקורים).
- **שלב ב'** — כיוונון חוויה: בורר פרופיל (רענן / אלכוהולי / מעושן / עשבוני),
  בורר מרקם (קציפתי / צלול), ומתגים לסירופים ואינפוזיות ביתיות ולטכניקות
  מתקדמות (Fat Washing / Milk Clarification).
- **שלב ג'** — פלט "יצירת מופת": שם בר-קראפט מקורי, גרף רדאר, הסבר האלכימיה
  (ה-"Why"), והערות ברמן מקצועיות.

אם חסר רכיב אחד למתכון נהדר — המערכת מציעה מה כדאי לקנות.

## פתיחה מהירה (ללא התקנה)

הקובץ [`standalone.html`](standalone.html) הוא **גרסה סגורה ועצמאית** של כל
האפליקציה בקובץ HTML יחיד — פשוט פותחים אותו בדפדפן (דאבל-קליק). דורש חיבור
אינטרנט בלבד ל-Tailwind ולפונטים, כמו שאר האפליקציות בפורטפוליו.

> ⚠️ אי אפשר לפתוח את `index.html` ישירות — זהו קובץ המקור של Vite שמצביע על
> `src/main.jsx` (JSX שדורש טרנספילציה). לפתיחה ישירה השתמשו ב-`standalone.html`.

## הרצה מקומית (מצב פיתוח)

```bash
cd mixology
npm install
npm run dev        # שרת פיתוח על http://localhost:5174
```

## בנייה לייצור

```bash
npm run build      # מטמיע הכל לקובץ יחיד ב-dist/index.html
npm run preview    # תצוגה מקדימה של ה-build
```

הבילד משתמש ב-[`vite-plugin-singlefile`](https://github.com/richardtallent/vite-plugin-singlefile)
כדי להטמיע את כל ה-JS וה-CSS לתוך `dist/index.html` יחיד. כדי לרענן את
`standalone.html` אחרי שינויים: `npm run build && cp dist/index.html standalone.html`.

## מבנה הקוד

```
mixology/
├── index.html              # RTL + Tailwind (Play CDN) + תצורת פלטה inline
└── src/
    ├── main.jsx            # נקודת כניסה
    ├── MixologyHub.jsx     # שורש: Header + ניווט בין שתי הקטגוריות
    ├── styles.css          # רקע הלאונג', אנימציות, prefers-reduced-motion
    ├── data/
    │   ├── cocktails.js    # מאגר 24 הקלאסיקות
    │   ├── inventory.js    # קבוצות המלאי, בוררי Vibe/Texture
    │   └── labEngine.js    # מנוע הרקיחה הדטרמיניסטי (~19 תבניות)
    └── components/
        ├── ClassicBible.jsx · CocktailCard.jsx · CocktailModal.jsx
        ├── MixologyLab.jsx · RecipeOutput.jsx
        └── RadarChart.jsx · Glassware.jsx     # ויזואליזציות SVG טהורות
```

## הערות עיצוב

- **פלטה** — Charcoal `#121212`, Graphite `#1E1E1E`, Gold `#D4AF37`,
  Amber `#FFBF00`, נגיעות Mint (מרענן) ו-Ruby (מריר/ורמוט).
- **טיפוגרפיה** — Heebo לגוף, Frank Ruhl Libre לכותרות יוקרתיות.
- **ויזואליזציות** — גרף הרדאר ואייקוני הכוסות משורטטים ב-SVG טהור, ללא ספריות.
- **נגישות** — כיבוד `prefers-reduced-motion`, סגירת מודאל ב-Escape, RTL מלא.

לסימולציה, השראה ולמידה. רקחו ושתו באחריות ובמתינות.

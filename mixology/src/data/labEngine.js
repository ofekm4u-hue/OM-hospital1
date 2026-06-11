// ─────────────────────────────────────────────────────────────────────────────
// מנוע הרקיחה (The Alchemy Engine) — אלגוריתם דטרמיניסטי קליינט-סייד.
// מקבל את המלאי הקיים + הגדרות, ומחזיר את ה"יצירת מופת" המתאימה ביותר.
// ללא קריאות רשת / API — הכל רץ בדפדפן.
//
// כל תבנית (template) מגדירה:
//   requires      — מערך של id-ים מהמלאי שחייבים להיות קיימים.
//   optional      — id-ים שמשפרים את ההתאמה אם קיימים (לא חובה).
//   vibes         — אילו פרופילי חוויה התבנית מתאימה להם (להעדפת ניקוד).
//   texture       — 'silky' | 'clean' | 'any'.
//   infusion      — true אם דורשת מתג "סירופים ואינפוזיות ביתיות".
//   advanced      — true אם דורשת מתג "טכניקות מתקדמות" (Fat Wash / Clarification).
//   recipe        — הפלט המוצג: שם קראפט, רכיבים במ"ל, כוס, קרח, שיטה, עיטור,
//                   פרופיל טעם (רדאר), הסבר אלכימיה, והערות ברמן.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATES = [
  // ── רענן / סיטרוסי ───────────────────────────────────────────────────────
  {
    id: "gin-citrus-cooler",
    requires: ["gin", "lemon", "simple_syrup"],
    optional: ["cucumber", "elderflower"],
    vibes: ["fresh", "herbal"],
    texture: "clean",
    recipe: {
      name: "לחישת הבוטניקה",
      glass: "highball",
      glassName: "כוס הייבול",
      ice: "cube",
      iceName: "קרח קוביות",
      method: "shaken",
      methodName: "שקשוק ארוך",
      ingredients: [
        { name: "ג'ין", ml: 50 },
        { name: "מיץ לימון טרי", ml: 25 },
        { name: "סירופ סוכר (1:1)", ml: 20 },
        { name: "סודה לפיזור", ml: 60 },
      ],
      garnish: "פרוסות מלפפון או קליפת לימון ארוכה",
      profile: { sour: 4, sweet: 3, boozy: 3, bitter: 0, aromatic: 3 },
      why: "החומציות החדה של הלימון מאזנת את המתיקות, בעוד הבוטניקה של הג'ין נשארת רעננה והסודה פותחת את הקוקטייל לשתייה קלילה וקיצית.",
      notes: "סננו לכוס מלאת קרח טרי והשלימו בסודה ממש בסוף כדי לשמר את הבועות.",
    },
  },
  {
    id: "vodka-cranberry-sour",
    requires: ["vodka", "lime", "cranberry"],
    optional: ["triple_sec", "simple_syrup"],
    vibes: ["fresh"],
    texture: "clean",
    recipe: {
      name: "רובי על קרח",
      glass: "coupe",
      glassName: "כוס קופה",
      ice: "none",
      iceName: "ללא קרח (Up)",
      method: "shaken",
      methodName: "שקשוק",
      ingredients: [
        { name: "וודקה", ml: 45 },
        { name: "מיץ ליים טרי", ml: 15 },
        { name: "מיץ חמוציות", ml: 30 },
        { name: "טריפל סק (אם יש)", ml: 15 },
      ],
      garnish: "קליפת ליים מסולסלת",
      profile: { sour: 3, sweet: 3, boozy: 3, bitter: 1, aromatic: 1 },
      why: "החמוציות נותנות חמיצות פירותית וצבע אדום שקוף, הליים מחדד, והטריפל סק מוסיף עומק תפוז שמחבר הכל יחד.",
      notes: "שקשוק קצר ועז וסינון כפול — מעט חמוציות מספיק לצבע, אל תהפכו אותו לאטום.",
    },
  },
  {
    id: "tequila-paloma-style",
    requires: ["tequila_blanco", "lime"],
    optional: ["agave", "lemon"],
    vibes: ["fresh"],
    texture: "clean",
    recipe: {
      name: "שמש בלנקו",
      glass: "highball",
      glassName: "כוס הייבול",
      ice: "cube",
      iceName: "קרח קוביות",
      method: "built",
      methodName: "בנייה ישירה בכוס",
      ingredients: [
        { name: "טקילה בלנקו", ml: 50 },
        { name: "מיץ ליים טרי", ml: 20 },
        { name: "סירופ אגבה", ml: 10 },
        { name: "סודה לפיזור", ml: 90 },
        { name: "קורט מלח", ml: 1 },
      ],
      garnish: "פלח ליים + קורט מלח על השפה",
      profile: { sour: 3, sweet: 2, boozy: 2, bitter: 1, aromatic: 2 },
      why: "האגבה מהדהדת את מקור הטקילה ומוסיפה מתיקות עגולה, הליים מרענן, וקורט המלח מרים את כל הטעמים ומדגיש את הפלפליות.",
      notes: "בנו ישירות על קרח. קורט המלח אינו אופציונלי — הוא מה שהופך מיץ לקוקטייל.",
    },
  },

  // ── עשבוני / בוטני ────────────────────────────────────────────────────────
  {
    id: "gin-basil-smash",
    requires: ["gin", "basil", "lemon", "simple_syrup"],
    optional: [],
    vibes: ["herbal", "fresh"],
    texture: "any",
    infusion: true,
    recipe: {
      name: "ריסוק בזיליקום אזמרגד",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "cube",
      iceName: "קרח קוביות",
      method: "shaken",
      methodName: "שקשוק (אחרי כתישה)",
      ingredients: [
        { name: "ג'ין", ml: 60 },
        { name: "מיץ לימון טרי", ml: 25 },
        { name: "סירופ סוכר (1:1)", ml: 20 },
        { name: "חופן עלי בזיליקום", ml: 10 },
      ],
      garnish: "ענף בזיליקום טפוח בכף היד",
      profile: { sour: 4, sweet: 3, boozy: 3, bitter: 0, aromatic: 5 },
      why: "השמנים האתריים של הבזיליקום, שנפתחים בכתישה עדינה, חותכים את החמיצות והמתיקות ויוצרים ארומה ירוקה ומרעננת שעוטפת את הג'ין.",
      notes: "שדרוג ביתי: כתשו (Muddle) את הבזיליקום עם הסירופ לפני השקשוק — בעדינות, רק כדי להוציא שמנים ולא למרר. סינון כפול חובה.",
    },
  },
  {
    id: "cucumber-gin-fizz",
    requires: ["gin", "cucumber", "lime", "simple_syrup"],
    optional: ["elderflower", "mint"],
    vibes: ["herbal", "fresh"],
    texture: "any",
    infusion: true,
    recipe: {
      name: "גן המלפפון",
      glass: "highball",
      glassName: "כוס הייבול",
      ice: "cube",
      iceName: "קרח קוביות",
      method: "shaken",
      methodName: "שקשוק (אחרי כתישה)",
      ingredients: [
        { name: "ג'ין", ml: 50 },
        { name: "מיץ ליים טרי", ml: 20 },
        { name: "סירופ סוכר (1:1)", ml: 18 },
        { name: "פרוסות מלפפון", ml: 4 },
        { name: "סודה לפיזור", ml: 60 },
      ],
      garnish: "סרט מלפפון ארוך לאורך הכוס",
      profile: { sour: 3, sweet: 2, boozy: 3, bitter: 0, aromatic: 3 },
      why: "המלפפון מוסיף רעננות מימית-ירוקה שמרככת את הג'ין, והבועות מקלילות את הכל למשקה קיצי ושקוף.",
      notes: "כתשו 3–4 פרוסות מלפפון בקלילות, שקשקו, סננו סינון כפול והשלימו בסודה.",
    },
  },

  // ── אלכוהולי / Spirit-Forward ─────────────────────────────────────────────
  {
    id: "negroni-classic",
    requires: ["gin", "campari", "sweet_vermouth"],
    optional: [],
    vibes: ["boozy", "smoky"],
    texture: "clean",
    recipe: {
      name: "טריפלט המרירות",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "cube",
      iceName: "קוביה אחת גדולה",
      method: "stirred",
      methodName: "ערבוב בכפית בר",
      ingredients: [
        { name: "ג'ין", ml: 30 },
        { name: "קמפרי", ml: 30 },
        { name: "ורמוט מתוק", ml: 30 },
      ],
      garnish: "קליפת תפוז סחוטה מעל הכוס",
      profile: { sour: 0, sweet: 2, boozy: 4, bitter: 5, aromatic: 4 },
      why: "היחס המושלם 1:1:1 — הג'ין היבש נותן עמוד שדרה, הקמפרי מביא מרירות אדומה, והורמוט המתוק מעגל את הקצוות לאפריטיף קלאסי.",
      notes: "ערבבו על קוביה גדולה אחת לדילול איטי ושליטה במזיגה. הבעירו את קליפת התפוז לארומה.",
    },
  },
  {
    id: "old-fashioned-build",
    requires: ["bourbon", "angostura"],
    optional: ["simple_syrup", "agave", "orange_bitters"],
    vibes: ["boozy"],
    texture: "clean",
    recipe: {
      name: "המסורת העצית",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "cube",
      iceName: "קוביה אחת גדולה",
      method: "stirred",
      methodName: "ערבוב בכפית בר",
      ingredients: [
        { name: "בורבון", ml: 60 },
        { name: "סירופ סוכר (1:1)", ml: 10 },
        { name: "אנגוסטורה ביטרס", ml: 2 },
      ],
      garnish: "קליפת תפוז סחוטה מעל הכוס",
      profile: { sour: 0, sweet: 3, boozy: 5, bitter: 2, aromatic: 4 },
      why: "הביטרס והסוכר ממסגרים את הבורבון בלי להסתיר אותו — קוקטייל מינימליסטי שמדגיש את עומק הוויסקי העצי.",
      notes: "ערבבו חצי מהוויסקי עם הסוכר והביטרס עד שמתקרר, ואז הוסיפו את השאר על קוביה גדולה — דילול הדרגתי לאיזון.",
    },
  },
  {
    id: "manhattan-build",
    requires: ["bourbon", "sweet_vermouth", "angostura"],
    optional: ["amaro"],
    vibes: ["boozy"],
    texture: "clean",
    recipe: {
      name: "אורות העיר",
      glass: "coupe",
      glassName: "כוס קופה",
      ice: "none",
      iceName: "ללא קרח (Up)",
      method: "stirred",
      methodName: "ערבוב בכפית בר",
      ingredients: [
        { name: "בורבון / שיפון", ml: 60 },
        { name: "ורמוט מתוק", ml: 30 },
        { name: "אנגוסטורה ביטרס", ml: 2 },
      ],
      garnish: "קליפת לימון או דובדבן אמרנה",
      profile: { sour: 0, sweet: 3, boozy: 5, bitter: 2, aromatic: 4 },
      why: "הורמוט המתוק עוטף את הוויסקי בעומק תבלינִי, והביטרס מחבר את שני העולמות לקוקטייל אלגנטי ועירוני.",
      notes: "ערבבו על קרח עד שצלול וקר, סננו לכוס מצוננת מראש. ככל שתערבבו יותר — חלק יותר.",
    },
  },

  // ── מעושן / אפל ──────────────────────────────────────────────────────────
  {
    id: "mezcal-sour",
    requires: ["mezcal", "lime", "agave"],
    optional: ["egg_white", "angostura"],
    vibes: ["smoky"],
    texture: "any",
    recipe: {
      name: "הערפל של ואחאקה",
      glass: "coupe",
      glassName: "כוס קופה",
      ice: "none",
      iceName: "ללא קרח (Up)",
      method: "shaken",
      methodName: "שקשוק (Dry Shake)",
      ingredients: [
        { name: "מזקאל", ml: 50 },
        { name: "מיץ ליים טרי", ml: 22 },
        { name: "סירופ אגבה", ml: 18 },
        { name: "חלבון ביצה (אם יש)", ml: 15 },
      ],
      garnish: "טיפות אנגוסטורה על הקצף + קורט מלח עשן",
      profile: { sour: 4, sweet: 3, boozy: 4, bitter: 1, aromatic: 5 },
      why: "העשן של המזקאל פוגש את חומציות הליים ואת המתיקות הקרקעית של האגבה — שילוב עמוק שהחלבון עוטף בקצף משיי.",
      notes: "שקשוק יבש (Dry Shake) ללא קרח בהתחלה כדי לפתוח את החלבון, ורק אז שקשוק עם קרח. ציירו על הקצף בטיפות אנגוסטורה.",
    },
  },
  {
    id: "smoky-penicillin",
    requires: ["scotch", "lemon", "honey_syrup", "ginger"],
    optional: [],
    vibes: ["smoky"],
    texture: "any",
    infusion: true,
    recipe: {
      name: "מרפא העשן",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "cube",
      iceName: "קוביה אחת גדולה",
      method: "shaken",
      methodName: "שקשוק",
      ingredients: [
        { name: "וויסקי סקוץ' מעושן", ml: 50 },
        { name: "מיץ לימון טרי", ml: 22 },
        { name: "סירופ דבש", ml: 22 },
        { name: "פרוסות ג'ינג'ר טרי", ml: 6 },
      ],
      garnish: "פרוסת ג'ינג'ר מסוכר",
      profile: { sour: 3, sweet: 3, boozy: 4, bitter: 1, aromatic: 5 },
      why: "הדבש מרכך את חדות הסקוץ' המעושן, הג'ינג'ר מוסיף חום חריף, והלימון חותך הכל לאיזון מושלם בין עשן למתיקות.",
      notes: "שדרוג ביתי: כתשו ג'ינג'ר טרי עם הדבש לקבלת סירופ דבש-ג'ינג'ר ביתי לפני השקשוק — הרבה יותר חי מסירופ מוכן.",
    },
  },

  // ── מתוק / קינוחי ────────────────────────────────────────────────────────
  {
    id: "espresso-martini-build",
    requires: ["vodka", "coffee_liqueur"],
    optional: ["simple_syrup"],
    vibes: ["boozy"],
    texture: "silky",
    recipe: {
      name: "חצות בעיר",
      glass: "coupe",
      glassName: "כוס קופה",
      ice: "none",
      iceName: "ללא קרח (Up)",
      method: "shaken",
      methodName: "שקשוק עז",
      ingredients: [
        { name: "וודקה", ml: 50 },
        { name: "ליקר קפה", ml: 20 },
        { name: "אספרסו טרי", ml: 30 },
        { name: "סירופ סוכר", ml: 5 },
      ],
      garnish: "שלושה גרגרי קפה",
      profile: { sour: 0, sweet: 3, boozy: 3, bitter: 3, aromatic: 4 },
      why: "מרירות הקפה הטרי מאזנת את מתיקות הליקר, והשקשוק העז יוצר שכבת קצף (crema) שהופכת אותו לקטיפתי וערני.",
      notes: "אם יש אספרסו טרי — צקו אותו חם לתוך השייקר; זה הסוד לקצף יציב. שקשוק חזק ככל האפשר.",
    },
  },
  {
    id: "amaro-sipper",
    requires: ["amaro", "bourbon"],
    optional: ["angostura", "orange_bitters"],
    vibes: ["boozy", "smoky"],
    texture: "clean",
    recipe: {
      name: "שעת הדמדומים",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "cube",
      iceName: "קוביה אחת גדולה",
      method: "stirred",
      methodName: "ערבוב בכפית בר",
      ingredients: [
        { name: "בורבון", ml: 45 },
        { name: "אמארו", ml: 25 },
        { name: "אנגוסטורה ביטרס", ml: 2 },
      ],
      garnish: "קליפת תפוז סחוטה",
      profile: { sour: 0, sweet: 2, boozy: 4, bitter: 4, aromatic: 4 },
      why: "האמארו מביא מרירות עשבונית-מתוקה שמתחתנת עם החמימות העצית של הבורבון — קוקטייל איטי ללגימה ארוכה.",
      notes: "ערבוב על קוביה גדולה לדילול עדין. נסו אמארו עשיר (כמו Averna) לעומק מקסימלי.",
    },
  },

  // ── טכניקות מתקדמות (דורש מתג Advanced) ──────────────────────────────────
  {
    id: "fat-washed-old-fashioned",
    requires: ["bourbon", "angostura"],
    optional: ["simple_syrup", "orange_bitters"],
    vibes: ["boozy", "smoky"],
    texture: "clean",
    advanced: true,
    recipe: {
      name: "אולד פאשנד שטוף-שומן",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "cube",
      iceName: "קוביה אחת גדולה",
      method: "stirred",
      methodName: "ערבוב בכפית בר",
      ingredients: [
        { name: "בורבון שטוף בחמאת בוטנים", ml: 60 },
        { name: "סירופ סוכר (1:1)", ml: 10 },
        { name: "אנגוסטורה ביטרס", ml: 2 },
      ],
      garnish: "קליפת תפוז סחוטה",
      profile: { sour: 0, sweet: 3, boozy: 5, bitter: 2, aromatic: 5 },
      why: "שטיפת השומן (Fat Washing) מעבירה לבורבון מרקם עגול וטעם אגוזי-קלוי בלי להוסיף שומן נוזלי — עומק שאי אפשר להשיג אחרת.",
      notes: "טכניקה מתקדמת: ערבבו 30 גרם חמאת בוטנים מומסת לכל 200 מ\"ל בורבון, הניחו שעתיים, הקפיאו לילה וסננו את שכבת השומן הקפואה. התוצאה: בורבון משיי בטעם בוטנים.",
    },
  },
  {
    id: "milk-clarified-punch",
    requires: ["white_rum", "lemon"],
    optional: ["pineapple", "simple_syrup", "cinnamon"],
    vibes: ["fresh", "boozy"],
    texture: "clean",
    advanced: true,
    recipe: {
      name: "פאנץ' צלול בחלב",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "cube",
      iceName: "קוביה גדולה",
      method: "built",
      methodName: "מוכן מראש (Batched)",
      ingredients: [
        { name: "רום לבן", ml: 50 },
        { name: "מיץ לימון טרי", ml: 25 },
        { name: "סירופ סוכר (1:1)", ml: 20 },
        { name: "חלב מלא (לקלריפיקציה)", ml: 60 },
      ],
      garnish: "קליפת לימון או מקל קינמון",
      profile: { sour: 3, sweet: 3, boozy: 4, bitter: 0, aromatic: 3 },
      why: "הבהרה בחלב (Milk Clarification) מסירה את החומציות החדה והעכירות, ומשאירה קוקטייל צלול לחלוטין עם מרקם קטיפתי ועדין במיוחד.",
      notes: "טכניקה מתקדמת: צקו את תערובת הקוקטייל החמוצה לתוך החלב (לא הפוך!) — החלב יקריש. סננו דרך מסננת בד (Coffee Filter) פעם-פעמיים עד שהנוזל צלול לגמרי. נשמר שבועות במקרר.",
    },
  },

  // ── מרענן עם חומרי גלם ────────────────────────────────────────────────────
  {
    id: "rum-mojito-build",
    requires: ["white_rum", "lime", "mint", "simple_syrup"],
    optional: [],
    vibes: ["fresh", "herbal"],
    texture: "any",
    infusion: true,
    recipe: {
      name: "מטע הנענע",
      glass: "highball",
      glassName: "כוס הייבול",
      ice: "crushed",
      iceName: "קרח כתוש",
      method: "built",
      methodName: "בנייה ישירה בכוס",
      ingredients: [
        { name: "רום לבן", ml: 50 },
        { name: "מיץ ליים טרי", ml: 25 },
        { name: "סירופ סוכר (1:1)", ml: 20 },
        { name: "צרור עלי נענע", ml: 10 },
        { name: "סודה לפיזור", ml: 60 },
      ],
      garnish: "צרור נענע גדול + גלגל ליים",
      profile: { sour: 3, sweet: 3, boozy: 2, bitter: 0, aromatic: 4 },
      why: "הנענע הטרייה משחררת ארומה קרירה שמתחברת לליים ולרום הקליל — אחד הקוקטיילים המרעננים בעולם.",
      notes: "שדרוג ביתי: טפחו (אל תכתשו!) את הנענע בכף היד לשחרור שמנים בלי מרירות. בנו על קרח כתוש והשלימו בסודה.",
    },
  },
  {
    id: "strawberry-caipi",
    requires: ["white_rum", "lime", "strawberry"],
    optional: ["simple_syrup", "basil", "black_pepper"],
    vibes: ["fresh"],
    texture: "any",
    infusion: true,
    recipe: {
      name: "שדה התות",
      glass: "rocks",
      glassName: "כוס לואובול / רוקס",
      ice: "crushed",
      iceName: "קרח כתוש",
      method: "built",
      methodName: "כתישה ובנייה בכוס",
      ingredients: [
        { name: "רום לבן", ml: 50 },
        { name: "מיץ ליים טרי", ml: 20 },
        { name: "סירופ סוכר (1:1)", ml: 18 },
        { name: "תותים טריים", ml: 3 },
      ],
      garnish: "חצי תות + עלה בזיליקום",
      profile: { sour: 3, sweet: 4, boozy: 3, bitter: 0, aromatic: 3 },
      why: "מתיקות התות הטרי מתחברת לחמיצות הליים ולרום, ונגיעת פלפל שחור (אם יש) מוסיפה עומק מפתיע ופיקנטי.",
      notes: "שדרוג ביתי: כתשו 2–3 תותים עם הסירופ בתחתית הכוס, מלאו בקרח כתוש ובנו מעל. גרגר פלפל שחור מרים את הפרי.",
    },
  },
  {
    id: "cognac-sidecar",
    requires: ["cognac", "triple_sec", "lemon"],
    optional: [],
    vibes: ["boozy"],
    texture: "clean",
    recipe: {
      name: "המרכבה הצרפתית",
      glass: "coupe",
      glassName: "כוס קופה",
      ice: "none",
      iceName: "ללא קרח (Up)",
      method: "shaken",
      methodName: "שקשוק",
      ingredients: [
        { name: "קוניאק", ml: 50 },
        { name: "טריפל סק / קואנטרו", ml: 20 },
        { name: "מיץ לימון טרי", ml: 20 },
      ],
      garnish: "שפת סוכר + קליפת תפוז",
      profile: { sour: 3, sweet: 3, boozy: 4, bitter: 0, aromatic: 3 },
      why: "הקוניאק העשיר פוגש את מתיקות התפוז של הטריפל סק ואת חדות הלימון — שילוש קלאסי שמאזן עוצמה ורעננות.",
      notes: "שפת סוכר חצי בלבד. שקשוק קצר ועז וסינון כפול לכוס קופה מצוננת.",
    },
  },
  {
    id: "aperol-spritz-build",
    requires: ["aperol"],
    optional: ["orange_juice", "lemon"],
    vibes: ["fresh"],
    texture: "clean",
    recipe: {
      name: "ספריץ הזריחה",
      glass: "wine",
      glassName: "כוס יין",
      ice: "cube",
      iceName: "קרח קוביות",
      method: "built",
      methodName: "בנייה ישירה בכוס",
      ingredients: [
        { name: "אפרול", ml: 60 },
        { name: "יין מבעבע / פרוסקו", ml: 90 },
        { name: "סודה", ml: 30 },
      ],
      garnish: "פלח תפוז",
      profile: { sour: 1, sweet: 3, boozy: 1, bitter: 3, aromatic: 2 },
      why: "המרירות הקלילה של האפרול מתאזנת מול הבועות והמתיקות של הפרוסקו — אפריטיף קיצי ומרענן בעוצמה נמוכה.",
      notes: "בנו בכוס יין מלאה קרח, הוסיפו את הפרוסקו לפני האפרול לשמירת הבועות, וסיימו בנגיעת סודה.",
    },
  },
];

// ─── עזרי ניקוד ──────────────────────────────────────────────────────────────

// בודק אם כל הרכיבים הנדרשים קיימים במלאי (set של id-ים מסומנים).
function hasAllRequired(template, inventorySet) {
  return template.requires.every((id) => inventorySet.has(id));
}

// מנקד התאמה: בסיס לפי כמות רכיבים אופציונליים שקיימים + בונוסים ל-vibe/texture.
function scoreTemplate(template, inventorySet, { vibe, texture }) {
  let score = 10; // בסיס לכל תבנית זמינה
  const optHits = (template.optional || []).filter((id) => inventorySet.has(id)).length;
  score += optHits * 3;

  if (vibe && template.vibes?.includes(vibe)) score += 12;
  if (texture && texture !== "any") {
    if (template.texture === texture) score += 8;
    else if (template.texture === "any") score += 2;
  }
  // העדפה קלה לתבניות עם יותר רכיבים נדרשים (מתכון "שלם" יותר)
  score += template.requires.length;
  return score;
}

/**
 * craftCocktail — הפונקציה הראשית של המנוע.
 * @param {string[]} inventory - מערך id-ים שהמשתמש סימן כזמינים.
 * @param {object} opts - { vibe, texture, allowInfusions, allowAdvanced }
 * @returns {object} אחד מ:
 *   { status: 'ok', recipe }                          — נמצא מתכון
 *   { status: 'almost', recipe, missing: [labels] }   — חסר רכיב אחד למתכון נהדר
 *   { status: 'empty' }                               — לא נבחר כלום
 *   { status: 'none' }                                — אין שום התאמה אפשרית
 */
export function craftCocktail(inventory, opts = {}) {
  const { vibe = null, texture = "any", allowInfusions = false, allowAdvanced = false } = opts;
  const inventorySet = new Set(inventory);

  if (inventorySet.size === 0) return { status: "empty" };

  // סינון לפי מתגים: תבניות אינפוזיה/מתקדמות נחשפות רק אם המתג הרלוונטי דלוק.
  const eligible = TEMPLATES.filter((t) => {
    if (t.infusion && !allowInfusions) return false;
    if (t.advanced && !allowAdvanced) return false;
    return true;
  });

  // 1) תבניות שכל הרכיבים שלהן קיימים — בחירת המנצחת לפי ניקוד.
  const fullMatches = eligible.filter((t) => hasAllRequired(t, inventorySet));

  if (fullMatches.length > 0) {
    const ranked = fullMatches
      .map((t) => ({ t, score: scoreTemplate(t, inventorySet, { vibe, texture }) }))
      .sort((a, b) => b.score - a.score);

    // רנדומיזציה עדינה לגיוון: בוחרים מבין המובילים בעלי ניקוד דומה לראש.
    const top = ranked[0].score;
    const contenders = ranked.filter((r) => r.score >= top - 4);
    const chosen = contenders[Math.floor(Math.random() * contenders.length)].t;
    return { status: "ok", recipe: chosen.recipe, templateId: chosen.id };
  }

  // 2) אין התאמה מלאה — מחפשים תבנית שחסר לה בדיוק רכיב אחד ("כמעט").
  const almost = eligible
    .map((t) => {
      const missing = t.requires.filter((id) => !inventorySet.has(id));
      return { t, missing };
    })
    .filter((x) => x.missing.length === 1)
    // מעדיפים תבנית שמתאימה ל-vibe המבוקש, ושיש לה הכי הרבה רכיבים שכבר קיימים.
    .sort((a, b) => {
      const va = a.t.vibes?.includes(vibe) ? 1 : 0;
      const vb = b.t.vibes?.includes(vibe) ? 1 : 0;
      if (vb !== va) return vb - va;
      return b.t.requires.length - a.t.requires.length;
    });

  if (almost.length > 0) {
    const pick = almost[0];
    return {
      status: "almost",
      recipe: pick.t.recipe,
      missingIds: pick.missing,
      templateId: pick.t.id,
    };
  }

  return { status: "none" };
}

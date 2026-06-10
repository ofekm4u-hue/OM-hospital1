// ─────────────────────────────────────────────────────────────────────────────
// מעבדת האלכימיה — שלב א': מלאי הבר הקיים (Back-Bar Inventory).
// המשתמש מסמן ב-V מה שיש לו. ה-id משמש את מנוע הרקיחה (labEngine.js).
// ─────────────────────────────────────────────────────────────────────────────

export const INVENTORY_GROUPS = [
  {
    id: "spirits",
    title: "אלכוהול בסיס",
    icon: "bottle",
    items: [
      { id: "vodka", label: "וודקה" },
      { id: "gin", label: "ג'ין" },
      { id: "bourbon", label: "בורבון" },
      { id: "scotch", label: "סקוץ' מעושן" },
      { id: "tequila_blanco", label: "טקילה בלנקו" },
      { id: "tequila_reposado", label: "טקילה רפוסאדו" },
      { id: "mezcal", label: "מזקאל" },
      { id: "white_rum", label: "רום לבן" },
      { id: "dark_rum", label: "רום כהה" },
      { id: "cognac", label: "קוניאק" },
    ],
  },
  {
    id: "modifiers",
    title: "ליקרים ומשדרגים (Modifiers)",
    icon: "drop",
    items: [
      { id: "campari", label: "קמפרי" },
      { id: "sweet_vermouth", label: "ורמוט מתוק" },
      { id: "dry_vermouth", label: "ורמוט יבש" },
      { id: "triple_sec", label: "טריפל סק / קואנטרו" },
      { id: "aperol", label: "אפרול" },
      { id: "coffee_liqueur", label: "ליקר קפה (קאהלואה)" },
      { id: "amaro", label: "אמארו" },
      { id: "elderflower", label: "סן ז'רמן (אלדרפלאוור)" },
    ],
  },
  {
    id: "juices",
    title: "מיצים וסאוור",
    icon: "citrus",
    items: [
      { id: "lemon", label: "מיץ לימון טרי" },
      { id: "lime", label: "מיץ ליים טרי" },
      { id: "orange_juice", label: "מיץ תפוזים" },
      { id: "pineapple", label: "מיץ אננס" },
      { id: "cranberry", label: "מיץ חמוציות" },
    ],
  },
  {
    id: "syrups",
    title: "סירופים וביטרס",
    icon: "flask",
    items: [
      { id: "simple_syrup", label: "סירופ סוכר (1:1)" },
      { id: "honey_syrup", label: "סירופ דבש" },
      { id: "agave", label: "סירופ אגבה" },
      { id: "angostura", label: "אנגוסטורה ביטרס" },
      { id: "peychauds", label: "פיישאדס ביטרס" },
      { id: "orange_bitters", label: "ביטרס תפוז" },
    ],
  },
  {
    id: "raw",
    title: "חומרי גלם וסופרמרקט",
    icon: "leaf",
    items: [
      { id: "mint", label: "נענע" },
      { id: "basil", label: "בזיליקום" },
      { id: "ginger", label: "ג'ינג'ר טרי" },
      { id: "cucumber", label: "מלפפון" },
      { id: "strawberry", label: "תותים" },
      { id: "black_pepper", label: "פלפל שחור" },
      { id: "cinnamon", label: "מקלות קינמון" },
      { id: "egg_white", label: "חלבון ביצה / אקווה פאבה" },
    ],
  },
];

// מילון תוויות שטוח (id → שם עברי) לשימוש מנוע הרקיחה ורשימת הקניות.
export const ITEM_LABELS = INVENTORY_GROUPS.reduce((acc, group) => {
  group.items.forEach((item) => {
    acc[item.id] = item.label;
  });
  return acc;
}, {});

// ─── הגדרות הטוגלים המתקדמים (שלב ב') ───────────────────────────────────────

export const VIBES = [
  {
    id: "fresh",
    label: "רענן וקיצי",
    sub: "Highball / Citrusy / Crushable",
    accent: "mint",
  },
  {
    id: "boozy",
    label: "אלכוהולי וכבד",
    sub: "Spirit-Forward / Sipper",
    accent: "amber",
  },
  {
    id: "smoky",
    label: "מעושן ואפל",
    sub: "Smoky / Complex",
    accent: "ruby",
  },
  {
    id: "herbal",
    label: "עשבוני ומרענן",
    sub: "Herbal / Botanical",
    accent: "mint",
  },
];

export const TEXTURES = [
  { id: "any", label: "ללא העדפה", sub: "המנוע יבחר" },
  { id: "silky", label: "קציפתי / עשיר", sub: "חלבון ביצה / אקווה פאבה" },
  { id: "clean", label: "צלול ונקי", sub: "Stirred & Neat" },
];

# מדריך פרסום ל-App Store + Google Play

המערכת בנויה כ-**PWA** (Progressive Web App) — אפליקציית רשת מתקדמת שניתנת להתקנה ישירות מהדפדפן במובייל. כדי לפרסם בחנויות הרשמיות (Apple App Store + Google Play), נעטוף את ה-PWA ב-**Capacitor** (העטיפה של Ionic).

## תוכן עניינים

1. [שלב 0 — מה כבר עובד עכשיו (PWA, חינם)](#שלב-0--מה-כבר-עובד-עכשיו)
2. [שלב 1 — מה אתה צריך לקנות](#שלב-1--מה-אתה-צריך-לקנות)
3. [שלב 2 — סביבת פיתוח (חד-פעמי)](#שלב-2--סביבת-פיתוח)
4. [שלב 3 — בילד iOS לחנות](#שלב-3--בילד-ios-לחנות)
5. [שלב 4 — בילד Android לחנות](#שלב-4--בילד-android-לחנות)
6. [נכסים נדרשים לחנויות](#נכסים-נדרשים-לחנויות)
7. [שאלות נפוצות](#שאלות-נפוצות)

---

## שלב 0 — מה כבר עובד עכשיו

**ה-PWA כבר חי באוויר** ברגע ש-PR ימוזג. המשתמשים יכולים להתקין מיידית בלי App Store:

### iPhone
1. פתח את https://ofekm4u-hue.github.io/-/scout/ ב-**Safari** (חייב להיות Safari, לא Chrome)
2. לחץ על כפתור **Share** (🔼)
3. גלול ובחר **"Add to Home Screen"** ("הוסף למסך הבית")
4. האייקון מופיע במסך הבית, פותח את האפליקציה במצב fullscreen — בלי כתובת URL, בלי כפתורי דפדפן

### Android
1. פתח את הלינק ב-**Chrome**
2. תופיע באנר אוטומטי "Install app" — לחץ
3. אם הבאנר לא הופיע: תפריט (⋮) → "Install app"

✅ עובד אופליין (Service Worker מטמן את הכל)
✅ אייקון על מסך הבית
✅ Splash screen בכניסה
✅ Fullscreen
✅ קיצורי דרך מהירים (HQ, ש"ג, מרפאה, שבט) — לחיצה ארוכה על האייקון

**מתי PWA לבד מספיק?** אם הצוות שלך מוכן להתקין מהלינק. אם אתה רוצה אייקון בחנות הרשמית עם חיפוש, ביקורות והפצה — תמשיך לשלב 1.

---

## שלב 1 — מה אתה צריך לקנות

| מוצר | מחיר | למה |
|------|------|-----|
| **Apple Developer Program** | $99/שנה | חובה לפרסם ב-App Store |
| **Google Play Console** | $25 חד-פעמי | חובה לפרסם ב-Play Store |
| **Mac (פיזי או ענן)** | משתנה | חובה ל-iOS — Xcode רץ רק על macOS |

### אפשרויות למי שאין לו Mac
- **MacInCloud** — $30-50/חודש, Mac בענן
- **AWS EC2 Mac** — תשלום לפי שעה
- **GitHub Actions (macos-latest)** — חינם לפרויקטים פתוחים, בנאי-בילד אוטומטי. עובד מצוין למי שכבר מכיר CI
- **Codemagic** — בענן, יש תוכנית חינמית עם מגבלות, ידידותי למתחילים
- **שאל חבר עם Mac** — לבילד הראשון בלבד; אחר כך אפשר באמצעות העלאות OTA

### לאנדרואיד — לא צריך Mac
- מספיק Linux/Windows/Mac עם **Android Studio**
- חינמי לחלוטין

---

## שלב 2 — סביבת פיתוח

### בכל מערכת
```bash
# 1. Clone את הריפו
git clone https://github.com/ofekm4u-hue/-.git
cd -

# 2. התקן Node.js 20+ (אם אין)
#    https://nodejs.org/

# 3. התקן Capacitor + תלויות
npm install
```

### למפתחי iOS (חובה Mac)
```bash
# 4a. התקן Xcode מ-App Store (חינמי, ~10GB)
# 4b. התקן CocoaPods
sudo gem install cocoapods

# 5. צור פרויקט iOS native
npm run add:ios
```

### למפתחי Android
```bash
# 4a. התקן Android Studio
#     https://developer.android.com/studio
# 4b. דרך Android Studio: SDK Manager → התקן Android API 34+

# 5. צור פרויקט Android native
npm run add:android
```

---

## שלב 3 — בילד iOS לחנות

### 3.1. סנכרון הקוד אל הפרויקט הנייטיב
```bash
npm run sync       # מעדכן את scout/ אל ios/App/App/public/
```

### 3.2. פתח את הפרויקט ב-Xcode
```bash
npm run open:ios
```

### 3.3. הגדרות חובה ב-Xcode
1. **Signing & Capabilities** → בחר את ה-Team שלך (חשבון ה-Developer שלך, $99/שנה)
2. **Bundle Identifier** → ודא שזה `org.tzofim.shob` (או שנה לפי הצורך — חייב להיות ייחודי)
3. **General → Display Name** → "שו״ב צופים"
4. **General → App Icons** → גרור את האייקון 1024×1024 (ראה [נכסים נדרשים](#נכסים-נדרשים-לחנויות))
5. **General → Minimum Deployment** → iOS 13.0 (תומך 95% מהמכשירים)

### 3.4. צור Archive ושלח לחנות
1. ב-Xcode: **Product → Destination → Any iOS Device (arm64)**
2. **Product → Archive** (לוקח ~3-5 דקות)
3. ב-Organizer שנפתח: **Distribute App → App Store Connect → Upload**

### 3.5. ב-App Store Connect (https://appstoreconnect.apple.com)
1. צור App חדש (Bundle ID = זה שהגדרת)
2. מלא: שם, תיאור, מילות מפתח, קטגוריה (Productivity / Utilities)
3. העלה צילומי מסך (ראה [נכסים נדרשים](#נכסים-נדרשים-לחנויות))
4. **Privacy Policy URL** — חובה. אם אין לך, צור בעמוד פשוט וסוויאר GitHub Pages
5. שלח לסקירה (Review). 24-48h בדרך כלל

⚠ **אזהרה חשובה לגבי PWA-wrapped:** אפל לפעמים דוחה אפליקציות שהן "רק wrapper של אתר" (Guideline 4.2 — Design / Minimum Functionality). כדי להגדיל סיכוי לאישור:
- ודא שיש פונקציונליות שעובדת אופליין (Service Worker שלנו עושה את זה)
- הוסף לפחות feature אחד native (Push notifications, GPS, מצלמה) — Capacitor תומך בכל אלה
- בתיאור: הדגש את היכולות הניהוליות, ולא רק "אתר במובייל"

---

## שלב 4 — בילד Android לחנות

### 4.1. סנכרון + פתיחה
```bash
npm run sync
npm run open:android   # פותח Android Studio
```

### 4.2. הגדרות ב-Android Studio
1. ערוך `android/app/build.gradle`:
   - `applicationId "org.tzofim.shob"`
   - `versionCode 1`
   - `versionName "1.0.0"`
   - `minSdkVersion 22` (Android 5.1+)
   - `targetSdkVersion 34`
2. **Build → Generate Signed Bundle / APK → Android App Bundle (AAB)**
3. אם זו הפעם הראשונה: צור Keystore חדש (שמור גיבוי!) — אם תאבד אותו, לא תוכל לעדכן את האפליקציה לעולם
4. בחר build variant: **release**
5. הבילד נוצר ב-`android/app/release/app-release.aab`

### 4.3. ב-Google Play Console (https://play.google.com/console)
1. צור Application חדשה (App name = "שו״ב צופים")
2. מלא: store listing, צילומי מסך, אייקון 512×512
3. **App Content** → privacy policy, target audience, data safety form (חובה!)
4. **Production → Create new release** → העלה את ה-AAB
5. שלח לסקירה. Google בדרך כלל מהיר יותר מאפל (כמה שעות עד יום)

---

## נכסים נדרשים לחנויות

### אייקונים
| יעד | מידות | פורמט | מקור |
|-----|-------|-------|------|
| iOS App Icon (App Store) | 1024×1024 | PNG (לא שקוף) | יש להמיר מ-`scout/icons/icon.svg` |
| iOS App Icon (במכשיר) | 180×180, 167×167, 152×152 ועוד | PNG | Xcode מייצר אוטומטית מ-1024 |
| Android (Play Store) | 512×512 | PNG | להמיר מה-SVG |
| Android (במכשיר) | 192×192, 144, 96, 72, 48 | PNG | Capacitor + Android Studio מייצרים אוטומטית |

**איך להמיר את ה-SVG ל-PNG?**
- כלי חינמי: https://cloudconvert.com/svg-to-png — העלה את `scout/icons/icon.svg`, בחר 1024×1024
- או דרך Inkscape / Figma
- או דרך CLI: `npm i -g sharp-cli && sharp -i scout/icons/icon.svg -o icon-1024.png resize 1024 1024`

### צילומי מסך
**iOS — חובה לכל גודל שהאפליקציה תומכת בו:**
- iPhone 6.7" (1290×2796) — ל-iPhone 15 Pro Max וכו'
- iPhone 6.5" (1242×2688) — לפחות 3 צילומים
- iPad 12.9" (2048×2732) — אם תומך iPad

**Android — לפחות 2 צילומים:**
- Phone (1080×1920 או גבוה יותר)
- Tablet 7" + 10" (אופציונלי, אבל מומלץ)

**איך לצלם?** פתח את ה-PWA בדפדפן, לחץ F12 → Toggle Device Toolbar → בחר מכשיר → Screenshot

### Privacy Policy
חייב להיות URL פומבי. דוגמה מינימלית: צור `privacy.html` בריפו ופרסם דרך GitHub Pages:

```
המערכת אוגרת את כל הנתונים מקומית במכשירך (localStorage).
המערכת לא שולחת מידע לשרתים חיצוניים.
המערכת לא משתמשת ב-cookies של צד שלישי ולא ב-analytics.
המידע נשאר על המכשיר שלך עד שתבחר למחוק אותו.
```

---

## שאלות נפוצות

**ש: ה-PWA כבר עובד. למה לבזבז זמן וכסף על חנויות?**
ת: רק אם אתה רוצה:
- נראות בחיפוש חנויות
- אמינות (יוזר רגיל סומך על אפליקציה מהחנות יותר מאשר על "Add to Home Screen")
- Push notifications native (PWA-iOS מוגבל ב-iOS)
- אינטגרציה עמוקה עם המערכת (Siri Shortcuts, Widgets וכו')

**ש: כמה זמן ייקח לפרסם?**
ת: סביבה ראשונה: שבוע-שבועיים (כולל למידת Xcode). פרסום ראשון: עוד שבוע (סקירת חנות). לאחר מכן עדכונים: שעה לבילד + 24-48 שעות סקירה.

**ש: האם המערכת תעבוד אופליין באפליקציה?**
ת: כן. Service Worker שכבר הטמענו מטמן את כל הקבצים. רק זריקת SOS לחמ"ל בין מכשירים שונים דורשת חיבור (כי זה דורש backend אמיתי).

**ש: יש לי רעיון להוסיף Push Notifications אמיתיות (לא in-app toasts). אפשר?**
ת: כן, אבל זה דורש backend אמיתי (Firebase Cloud Messaging או Apple Push Notification Service). הקוד הקיים מסומן `mock` בכל מקום שצריך push native — נוסיף את זה בסבב נפרד אם תרצה.

**ש: יש לי משתמש שרוצה להתקין על מכשיר ישן (iPhone 6 / Android 4)?**
ת: PWA דורש Safari 11.1+ (iOS 11+) ו-Chrome 70+ (Android 6+). אפליקציה native עם Capacitor 6 דורשת iOS 13+ ו-Android 5.1+. מתחת לזה — צריך לבנות גרסה ייעודית.

---

## תרשים זרימה מהיר

```
PWA (זמין עכשיו!)
  ↓
1. הוסף PWA למסך הבית (חינם, מיידי, עובד) ←——— אופציה ראשונה מומלצת
  ↓
[אם רוצים חנות:]
  ↓
2. קנה Apple Developer ($99/שנה) + Google Play ($25 חד-פעמי)
  ↓
3. השג Mac (Apple) או השתמש ב-Linux/Win לאנדרואיד
  ↓
4. npm install → npm run add:ios → npm run add:android
  ↓
5. פתח ב-Xcode / Android Studio, חתום ובנה
  ↓
6. העלה ל-App Store Connect / Play Console
  ↓
7. צילומי מסך + תיאור + Privacy Policy
  ↓
8. שלח לסקירה
  ↓
9. App live! 🎉
```

---

יש שאלה ספציפית על אחד השלבים? תכתוב לי ואנחה אותך צעד-צעד.

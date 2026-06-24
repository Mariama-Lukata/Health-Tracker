# 🌿 Health Tracker — Calorie Cycling App

A personal fat-loss companion built with React + Vite, deployed via GitHub Pages. Tracks daily calorie intake using a cycling method (Low / Medium / High days), auto-adjusts targets as you lose weight, carries over surplus or deficit to the next day, and includes a full weekly workout + yoga plan.

---

## Features

- **Calorie cycling** — Low, Medium, and High calorie days mapped to your weekly workout schedule
- **Auto-adjusting targets** — Every time you log a new weight, your TDEE, daily calorie targets, and macros recalculate automatically using the Mifflin-St Jeor formula
- **Next-day carry-over** — Ate over or under? The next day's target adjusts by the difference (capped at ±300 kcal) to keep your weekly average on track
- **Macro breakdown** — Protein, carbs, and fat targets per day type, scaled to your current weight (protein at 0.75g/lb)
- **Weekly workout plan** — 3 strength days, 1 HIIT, 1 Zone 2 cardio, 1 dedicated yoga & recovery session, 1 rest day
- **Yoga integration** — Full pose sequence on Thursdays + targeted yoga cooldowns after every strength session
- **Progress tracking** — Visual progress bar from start weight (196 lbs) to goal (167 lbs)
- **Persistent storage** — Log and weight saved to `localStorage` so your data survives page refreshes

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React 18 |
| Build tool | Vite |
| Styling | Inline styles (no CSS framework) |
| Storage | localStorage |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |

---

## Getting Started

### Prerequisites

- Node.js v20+ (use `nvm install --lts` if needed)
- Git

### Local development

```bash
# Clone the repo
git clone git@github.com:Mariama-Lukata/Health-Tracker.git
cd Health-Tracker

# Install dependencies
npm install

# Start dev server
npm run dev
```

App runs at `http://localhost:5173`

### Build for production

```bash
npm run build
```

Output goes to `./dist`.

---

## Deployment

The app auto-deploys to GitHub Pages on every push to `main` via GitHub Actions.

**Live URL:**
```
https://mariama-lukata.github.io/Health-Tracker/
```

To deploy manually or trigger a redeploy, just push any change to `main`:

```bash
git add .
git commit -m "your message"
git push origin main
```

GitHub Actions will build and publish to the `gh-pages` branch automatically. Allow ~2 minutes for changes to go live.

---

## How the Calorie Plan Works

### TDEE Calculation

Uses the **Mifflin-St Jeor formula** for females:

```
BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
TDEE = BMR × 1.375  (light-moderate activity)
Target avg = TDEE − 600 kcal  (~1.2 lbs/week loss)
```

Stats: 25F · 5'8" · starting at 196 lbs · goal 167 lbs

### Weekly Cycling Pattern

| Day | Type | Approx. Calories |
|---|---|---|
| Sunday | 🔴 Low | ~1,350 |
| Monday | 🔵 High | ~2,050 |
| Tuesday | 🟢 Medium | ~1,650 |
| Wednesday | 🔵 High | ~2,050 |
| Thursday | 🟢 Medium | ~1,650 |
| Friday | 🔵 High | ~2,050 |
| Saturday | 🔴 Low | ~1,350 |

> Exact targets shift down automatically as weight decreases.

### Next-Day Carry-Over Logic

```
carry_over = -(calories_eaten - day_target)
carry_over = clamp(carry_over, -300, +300)
tomorrow_target = base_target + carry_over
```

Ate 200 under → tomorrow gets +200. Ate 350 over → tomorrow gets −300 (capped).

### Macro Split

Protein is set at **0.75g per lb of body weight** and recalculates with every weight update. Carbs and fat absorb the cuts as weight drops.

---

## Workout Plan

| Day | Session | Calorie Day |
|---|---|---|
| Monday | Strength — Lower Body + yoga cooldown | High |
| Tuesday | Zone 2 Cardio (35–45 min walk/bike) | Medium |
| Wednesday | Strength — Upper Body + yoga cooldown | High |
| Thursday | Full Yoga Session (45–55 min) | Medium |
| Friday | Full Body HIIT | High |
| Saturday | Rest + gentle yoga flow | Low |
| Sunday | Full Rest | Low |

---

## Project Structure

```
Health-Tracker/
├── .github/
│   └── workflows/
│       └── deploy.yml        # GitHub Actions CI/CD
├── public/
├── src/
│   ├── App.jsx               # Main app (all logic + UI)
│   └── main.jsx              # React entry point
├── vite.config.js
├── package.json
└── README.md
```

---

## Roadmap

- [ ] Firebase Firestore sync (cross-device data persistence)
- [ ] Weekly weigh-in reminders
- [ ] Monthly progress summary view
- [ ] Meal ideas per day type

---

*Built for a 4-month fat loss journey. Personal use.*
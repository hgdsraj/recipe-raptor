# 🦖 RecipeRaptor

> **Lightning-fast, static culinary web application & macro engine.**  
> Built from 213 real-world recipes with interactive search, ingredient & protein pickers, micronutrient & macronutrient breakdowns, dynamic portion scaling, and full-screen distraction-free cooking mode.

---

## 🌟 Key Features

- **🦖 Raptor Roulette (Random Chooser)**: Can't decide what to eat? Spin the interactive slot machine with custom filters (High-Protein, Quick Dinner, Low-Calorie, or specific proteins) to pick your next meal.
- **🥩 Protein Picker**: Instant 1-click filter across 9 protein categories:
  - 🍗 Chicken (60 recipes)
  - 🐟 Fish & Seafood (21 recipes)
  - 🥓 Pork (16 recipes)
  - 🦃 Turkey (14 recipes)
  - 🍳 Eggs (14 recipes)
  - 🌱 Tofu & Plant-Based (11 recipes)
  - 🥩 Beef (5 recipes)
  - 🐑 Lamb (2 recipes)
  - 🥗 Vegetarian (70 recipes)
- **🥕 "What's in My Kitchen?" (Ingredient Picker)**: Multi-select tags or type custom ingredients to find every recipe you can make with what's in your fridge. Supports **ANY** (match at least one) and **ALL** (exact match) modes.
- **⚡ Instant JavaScript Search**: Sub-millisecond client-side keyword search across titles, ingredients, cooking steps, tags, and notes. Press `/` anywhere to focus search.
- **📊 Micronutrient & Macronutrient Breakdowns**: Every single recipe features:
  - Exact calorie count
  - Visual macro bar (% Protein, % Carbs, % Fat)
  - Gram breakdowns: Protein, Net Carbs, Fat
  - Protein efficiency (% calories derived from protein)
  - Micronutrient profile: Dietary Fiber, Sodium, Iron, Potassium, Vitamin C, Calcium
- **⚡ Succinct Recipe Protection**: Preserves authentic, direct, punchy recipe notes without artificial fluff. Marked with a distinct `⚡ Quick Note` badge.
- **🔢 Dynamic Serving Scaler**: Scale any recipe (1x, 2x, 3x, 4x, or custom). Ingredients quantities and nutritional values dynamically recalculate in real-time.
- **👨‍🍳 Interactive Cook Mode**: Fullscreen, distraction-free cooking assistant with large counter-friendly typography, step checkboxes, built-in audio timers (presets for 3m, 5m, 10m, 15m, 25m, 35m), and Screen Wake-Lock support to keep your screen awake while cooking.
- **🛒 Smart Grocery List**: Add ingredients from any recipe modal into a consolidated checklist. Check off items in the supermarket, or copy the entire list to clipboard.
- **❤️ Favorites**: Bookmark your go-to dishes locally via persistent `localStorage`.
- **➕ Local Recipe Builder & Exporter**: In-app form generates matching recipe JSON. Drop it into `recipes/` and re-run `python3 build.py`.
- **🖨️ Clean Print View**: Dedicated print stylesheet formatted for recipe cards.
- **🌙 Dark & Light Mode**: Seamless theme switching with persistent memory.

---

## 📁 Recipe File Architecture

RecipeRaptor uses a modular, human-readable file structure designed for easy editing and git tracking:

```
recipes/
├── index.html               # Main static application
├── css/
│   ├── style.css            # Responsive design system & themes
│   └── print.css            # Print stylesheet
├── js/
│   ├── app.js               # Interactive application logic
│   └── recipes-data.js      # Statically compiled recipe dataset
├── data/
│   └── recipes.json         # Master compiled JSON database
├── recipes/                 # 213 modular recipe files (1 file per recipe)
│   ├── pasta-with-zuchini-noodles.json
│   ├── tori-paitan.json
│   ├── chef-tini-s-viral-mac-cheese.json
│   └── ...
├── build.py                 # Schema validator & static compiler
├── raw_recipes.txt          # Source recipe notes archive
└── README.md
```

### Recipe JSON Schema (`recipes/*.json`):

```json
{
  "id": "lemon-herb-chicken",
  "title": "Lemon Herb Roasted Chicken Thighs",
  "category": "Mains & Grills",
  "protein": "Chicken",
  "servings": 4,
  "prepTime": "10 mins",
  "cookTime": "25 mins",
  "totalTime": "35 mins",
  "calories": 420,
  "macros": {
    "protein_g": 38,
    "carbs_g": 12,
    "fat_g": 24
  },
  "micros": {
    "fiber_g": 2.5,
    "sodium_mg": 520,
    "iron_mg": 2.1,
    "potassium_mg": 540,
    "vitamin_c_mg": 18,
    "calcium_mg": 60
  },
  "ingredients": [
    "4 chicken thighs, bone-in skin-on",
    "2 tbsp olive oil",
    "1 lemon, juiced and zested",
    "3 cloves garlic, minced",
    "1 tbsp fresh rosemary, chopped"
  ],
  "instructions": [
    "Preheat oven to 400°F (200°C).",
    "Pat chicken thighs dry with a paper towel and season generously with salt and pepper.",
    "Whisk together olive oil, lemon juice, lemon zest, garlic, and rosemary.",
    "Toss chicken in marinade and arrange on a baking sheet skin-side up.",
    "Roast for 25-30 minutes until skin is crispy and internal temperature reaches 165°F (74°C)."
  ],
  "notes": "Pairs exceptionally well with roasted asparagus or Greek lemon potatoes.",
  "sourceUrl": "https://youtube.com/...",
  "succinct": false,
  "tags": ["High-Protein", "Quick (<25m)", "Chicken", "Mains & Grills"]
}
```

---

## 🛠️ Adding New Recipes & Rebuilding

1. **Option A (In-App)**:
   - Click the **➕ Add Recipe** button in the header.
   - Fill out the form and click **📋 Copy JSON**.
   - Create a new file in `recipes/your-recipe-name.json` and paste the content.
   - Run:
     ```bash
     python3 build.py
     ```

2. **Option B (Direct File Creation)**:
   - Duplicate any file in `recipes/` or create `recipes/my-dish.json`.
   - Run the compiler:
     ```bash
     python3 build.py
     ```
   The compiler will automatically validate all fields, detect duplicates, and recompile `data/recipes.json` and `js/recipes-data.js`.

---

## 🚀 Hosting Instructions

### 1. static.app (Drag & Drop)
1. Zip the repository folder (or files: `index.html`, `css/`, `js/`, `data/`).
2. Go to [static.app](https://static.app).
3. Drag & drop the `.zip` file.
4. Your website is instantly live with custom URL and SSL!

### 2. GitHub Pages (Free Automatic Hosting)
1. Push this repository to GitHub:
   ```bash
   git remote add origin git@github.com:hgdsraj/recipe-raptor.git
   git branch -M main
   git push -u origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, choose `Deploy from a branch`.
   - Select Branch: `main` / Folder: `/ (root)`.
   - Click **Save**. Your site will be live at:
     `https://hgdsraj.github.io/recipe-raptor/`

### 3. Vercel / Netlify / Cloudflare Pages
- Connect your GitHub repository `hgdsraj/recipe-raptor`.
- Framework preset: `Other` / Static HTML.
- Build command: `python3 build.py` (optional, since files are pre-compiled).
- Output directory: `.` (root).

---

## 💻 Local Usage

Because RecipeRaptor is completely static with embedded datasets, you can run it without any web server:
- Double-click `index.html` to open directly in Google Chrome, Safari, or Firefox!
- Or run a lightweight local server:
  ```bash
  python3 -m http.server 8000
  ```
  and visit `http://localhost:8000`.

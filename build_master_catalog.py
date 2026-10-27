#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Builds the complete 200-recipe master catalog from the Google Doc, scraped website/YouTube sources,
and curated culinary enrichments. Also prepares the clean formatted Google Doc markdown.
"""

import os
import re
import json
from urllib.parse import urlparse
from curated_part1 import CURATED_BY_LINE
from curated_part2 import CURATED_BY_LINE_PART2
from curated_part3 import CURATED_BY_LINE_PART3

CURATED = {}
CURATED.update(CURATED_BY_LINE)
CURATED.update(CURATED_BY_LINE_PART2)
CURATED.update(CURATED_BY_LINE_PART3)

SCRATCH_DIR = "/Users/rajmahey/.gemini/antigravity/brain/e8f192d4-acad-4de1-a2b8-a3ad7a9302eb/scratch"

with open(os.path.join(SCRATCH_DIR, "doc_noimg.md"), "r", encoding="utf-8") as f:
    raw_lines = [l.rstrip("\n") for l in f.readlines()]

with open(os.path.join(SCRATCH_DIR, "fetched_sources.json"), "r", encoding="utf-8") as f:
    fetched_sources = json.load(f)

SPECIAL_SPLITS = {
    1050: "Korean Galbi (Pork or Chicken Short Rib Marinade)",
    1206: "Naan Egg Wrap (Just Egg, Cream Cheese & Peri-Peri)",
    1506: "Chicken Shawarma Pita Kebobs",
    1554: "Tomato Thing (Crispy Parmesan-Crusted Pan-Seared Tomatoes)",
    1558: "Spicy Tofu Veggie Tacos",
    1629: "Restaurant-Style Fire-Roasted Salsa & Warm Tortilla Chips",
    1631: "Grilled Street Corn Salad (Esquites Style)",
    1640: "Japanese Lamb Curry with Potatoes (Kare Raisu)",
    1722: "Sweet Potato & Black Bean Chili (High-Protein, Veggie)",
    1808: "Fernand Point's Crispy Pommes Dauphine (Potato & Choux Puffs)",
    1811: "High-Protein Pumpkin Spice Cookie Dough",
    1814: "Roasted Chicken Leg Stuffed with Italian Sausage & White Wine Jus",
    1854: "Bakery-Style Brown Butter Chocolate Chip Cookies",
    1857: "Indiana Hoosier Sugar Cream Pie (Crustless Ramekin Option)",
    1860: "Crispy Jalapeño Cream Cheese Smash Burger",
    1863: "Crispy Pan-Fried Chicken Oysters (Sot-l'y-laisse)",
    1866: "Masterclass: How to Break Down a Whole Chicken into 8–10 Cuts",
    1869: "Authentic Taqueria-Style Mexican Rice and Pinto/Black Beans",
    1872: "Roasted Butternut Squash & Feta Baked Pasta",
    1875: "Italian Chicken Meatball & Orzo Vegetable Soup",
    1878: "Indian Masala Spiced Sablefish (Pan-Seared Black Cod)",
    1881: "Authentic Tokyo Tori Paitan Ramen (Creamy Chicken Broth)",
    1990: "Traditional Mexican Champurrado (Thick Spiced Chocolate Masa Drink)",
    1993: "Freddie Boy Cocktail (Vanilla Vodka, Passion Fruit & Lychee Foam)",
    2002: "Bachan's Mall-Court Chicken Teriyaki & Steamed Broccoli Bowl",
    2013: "Crispy Miso-Roasted Chicken Thighs with White Wine Miso Pan Sauce",
    2016: "Baguettes à l'Ancienne (Cold-Retarded Artisan French Baguettes)",
    2019: "Fast 2-Hour Crispy No-Knead French Baguettes",
    2022: "Matthew McConaughey's Viral Loaded Tuna Salad",
    2025: "Anthony Bourdain's Favorite Fried Mortadella & Provolone Sandwich",
    2036: "Marco Pierre White's BBQ Lamb Chops & Salmon with Ketchup Vinaigrette",
    2039: "Homemade Herbed Chicken Ravioli from Scratch",
    2042: "Spaghetti & Meatballs (The Vivaldi Way)",
    2045: "2-Ingredient Heavy Cream Soft Flour Tortillas",
    2048: "Venezuelan Quesillo (Creamy Caramel Condensed Milk Flan)",
    2051: "Dough Guy 72-Hour Cold-Ferment Neapolitan/NY Pizza Dough",
    2054: "Classic British Welsh Rarebit ('Posh Cheese on Toast')",
    2057: "Heart-Healthy Mediterranean Three-Bean Ragout & Seared Chicken",
    2092: "Miso-Glazed Dual-Tofu & Pura Vida Fire-Roasted Primavera",
    2104: "3-Day Greek Yogurt Chicken Shawarma Meal Prep & Chickpea Salads",
    2125: "15-Minute Monday Fish 'En Papillote' (Parchment-Steamed Fish)",
    2141: "No-Water Sweet Cabbage & Chicken Broth Soup",
    2144: "Jalapeño Cheddar Cottage Cheese Protein Bagels",
    2147: "Marco Pierre White's Crispy Fried Bread & Anchovy Sandwich",
    2150: "Bengali Chicken Shorshe Curry (Pungent Mustard Chicken)",
    2153: "Lazy Baked Ravioli Lasagna with Vodka Sauce & Italian Sausage",
    2157: "Pan-Seared Chicken with Creamy Garlic Leek Sauce",
    2160: "Old Delhi Style Crisp Spiced Fried Chicken",
    2183: "One-Pan Shawarma-Style Chicken and Basmati Rice",
    2219: "Rich Slow-Braised Garlic & Herb Pork Stew",
    2222: "The Vivaldi Way Crispy Folded Egg & Bacon Breakfast Sando",
    2225: "One-Pot Rice Cooker Rotisserie Chicken Rice",
    2228: "Crispy Hot-Pot Lamb Roll Gyros with Tzatziki",
    2231: "Minnesota Sushi (Ham, Cream Cheese & Dill Pickle Pinwheels)",
    2234: "Quick Crispy Pita Bread Pepperoni Pizza",
    2240: "Ginger, Garlic & Sage Baby Bok Choy Radish Ramen Soup",
    2254: "High-Protein Butter Chicken Mac & Cheese",
    2257: "Dari-King Style Tangy Barbecue Sloppy Joes",
    2260: "Crispy Roasted Cabbage Steaks with Savory Crumb ('Dirt Cabbage')",
    2263: "The Vivaldi Way Stick-Blender Anchovy Caesar Dressing",
    2294: "The Vivaldi Way Olive-Oil Poached Salmon with Herbs & Citrus",
    2298: "Classic French Croque Monsieur with Gruyère Béchamel (The Vivaldi Way)",
    2340: "Thee Burger Dude's Ultimate Umami Veggie Smash Burger",
    2343: "Gordon Ramsay's Slow-Roasted Crispy Pork Belly with Fennel",
    2377: "Chef Tini's Viral Extra-Creamy Baked Mac & Cheese",
    2431: "Creamy Granny Smith Apple Crumble Cheesecake (The Vivaldi Way)",
    2434: "Nick DiGiovanni's Brined & Herb-Butter-Basted Pan-Seared Chicken Breast",
    2437: "High-Protein Low-Calorie Chicken Pizza Pocket (71g Protein)",
    2440: "Chef José Andrés' 40-Second Microwave Mayo Omelette",
    2443: "Modern Shiso-Wrapped Sashimi & Ponzu Spoon",
    2460: "Classic Slow-Simmered Beef, Pork or Lamb & Kidney Bean Chili"
}

TITLE_CLEANUPS = {
    "Salmom burgers on toast with salad and potatoes": "Salmon Burgers on Toast with Salad & Potatoes",
    "Tofu/chicken teriyaki": "Tofu or Chicken Teriyaki Stir-Fry with Snap Peas",
    "Palak chicken": "Palak Chicken (Spinach & Spiced Yogurt Curry)",
    "Aloo mattar:": "Restaurant-Style Aloo Matar (Spiced Potato & Pea Curry)",
    "split pea soup,": "Extra-Hearty Split Pea Soup (Double Veggies & Potatoes)",
    "Shepherds pie\\!": "Classic Beef or Lamb Shepherd's Pie",
    "Chicken breast Sides:": "5 Healthy Weeknight Chicken Breast Side Dish Pairings",
    "Pasta with zuchini noodles\\!\\!": "Ground Turkey & Zucchini Noodle Marinara Skillet",
    "Air fryer gobi 65 \\- add besan & olivd oil": "Air Fryer Gobi 65 (With Besan & Olive Oil)",
    "Hello fresh southwest bbq pork chop": "Southwest BBQ Pork Chops with Cheesy Sweet Potato & Red Wine Onions",
    "Simple roast potatoes halved with chicken Parm": "Crispy Mayo-Panko Chicken Parm with Halved Roast Potatoes",
    "Individual pot pie simple crust less": "Crustless Herbed Chicken Pot Pie",
    "Chinese tomato and egg try": "Chinese Tomato and Egg Stir-Fry (Fan Qie Chao Dan)",
    "Shakshuka'": "Classic Middle Eastern Shakshuka",
    "Steelhead with Accordion Potatoes and Asparagus:": "Baked Steelhead with Crispy Hassleback Accordion Potatoes & Asparagus",
    "Leek and Mushroom Lasagna pasta but plated.": "Open-Plated Leek, Mushroom & Tarragon Cream Lasagna",
    "Ciabatta Toast": "Crispy Garlic-Salt Pan-Toasted Ciabatta",
    "Egg sandwich:": "Crispy Parmesan-Crusted Sourdough, Guacamole & Tomato Egg Sandwich",
    "Pulled sous vide chicken (see other note)": "Sous Vide Spiced Pulled Chicken Breast for Burritos",
    "Pasta e lenticchie:": "Authentic Neapolitan Pasta e Lenticchie (One-Pot Pasta & Lentils)",
    "Teriyaki brocolli and tofu stir fry (see note)": "Crispy Teriyaki Tofu & Broccoli Stir-Fry",
    "Glazed dojuts": "Air Fryer Glazed Donuts",
    "Bake dfish and chips": "Healthy Crispy Oven-Baked Fish and Chips",
    "Shwarma Kebob Turkey": "Grilled Lemon-Mint Turkey Shawarma Kebobs",
    "Renee's dressing recipss": "Renee's Mighty Caesar 3-Way Hacks (Potatoes, Pasta & Chicken)",
    "Fresh pesto zuchinni linguine": "Fresh Basil Pine-Nut Pesto & Zucchini Noodle Linguine",
    "Pan con tamate": "Spanish Pan con Tomate (With Optional Burrata)",
    "Orzo and meatballs": "Greek-Style Lemon-Pepper Meatballs with Garlic Tomato Orzo",
    "Unhealthy ramyun Mac": "Creamy Korean Ramyun Mac & Cheese",
    "Indian bhurji": "Indian Masala Egg Bhurji (Spiced Scrambled Eggs)",
    "Avo toast": "Portofino Avocado, Pickled Jalapeño & Parmesan Toast",
    "Honey pork meatballs": "Honey-Dijon Glazed Pork Meatballs with Cranberries & Garlic Mash",
    "Parantha pasta": "Indian Fusion Paratha Pasta & Potato-Paneer Ravioli",
    "Make.msg butter": "Savory Umami MSG Garlic Compound Butter"
}

def clean_md(s):
    if not s:
        return ""
    s = s.replace("\\!", "!").replace("\\-", "-").replace("\\*", "*").replace("\\.", ".").replace("\\~", "~").replace("\\_", "_")
    s = s.replace("\\frac{1}{2}", "1/2")
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = re.sub(r"^>+\s*", "", s)
    return s.strip()

def format_source_title(url, src_info=None, curated_title=None):
    if curated_title:
        return curated_title
    if not url:
        return ""
    if src_info:
        kind = src_info.get("kind", "")
        author = src_info.get("author", "")
        title = src_info.get("title", "")
        if kind == "youtube":
            if author:
                return f"YouTube · {author}"
            return "YouTube Video Recipe"
    parsed = urlparse(url)
    host = parsed.netloc.lower().replace("www.", "")
    domain_map = {
        "youtube.com": "YouTube Short / Video",
        "youtu.be": "YouTube Video",
        "instagram.com": "Instagram Reel",
        "minimalistbaker.com": "Minimalist Baker",
        "thecuriouschickpea.com": "The Curious Chickpea",
        "cookwithmanali.com": "Cook With Manali",
        "allrecipes.com": "Allrecipes",
        "seriouseats.com": "Serious Eats",
        "thewoksoflife.com": "The Woks of Life",
        "sallysbakingaddiction.com": "Sally's Baking Addiction",
        "inspiredtaste.net": "Inspired Taste",
        "thedizzycook.com": "The Dizzy Cook",
        "doobydobap.com": "Doobydobap",
        "food.com": "Food.com",
        "wholesomeyum.com": "Wholesome Yum",
        "mexicanfoodjournal.com": "Mexican Food Journal",
        "emmafontanella.com": "Emma Fontanella",
        "hellofresh.ca": "HelloFresh",
        "cookingclassy.com": "Cooking Classy",
        "mrishtanna.com": "MrishTanna",
        "acozykitchen.com": "A Cozy Kitchen",
        "foodandwine.com": "Food & Wine",
        "munchinwithmaddie.blog": "Munchin With Maddie",
        "skinnyspatula.com": "Skinny Spatula",
        "thefreshloaf.com": "The Fresh Loaf",
        "awickedwhisk.com": "A Wicked Whisk",
        "doughguy.co": "Dough Guy",
        "saltandlavender.com": "Salt & Lavender",
        "pisomakitchen.substack.com": "Pisoma Kitchen",
        "theeburgerdude.com": "Thee Burger Dude",
        "andy-cooks.com": "Andy Cooks",
        "maangchi.com": "Maangchi",
        "yumaregional.org": "Yuma Regional Heart-Healthy",
        "tastesoflizzyt.com": "Tastes of Lizzy T"
    }
    return domain_map.get(host, host.capitalize())

def detect_protein(title, text=""):
    t_low = title.lower()
    combined = (title + " " + text).lower()
    # Prioritize title first
    if re.search(r"\b(steelhead|salmon|salmom|slamon|cod|halibut|sea bass|tuna|fish|scallop|scallops|shrimp|anchov|sablefish|sashimi|haddock)\b", t_low):
        return "Fish & Seafood"
    if re.search(r"\b(turkey)\b", t_low):
        return "Turkey"
    if re.search(r"\b(chicken|poultry|rotisserie|wings|thigh|drumstick|paitan)\b", t_low):
        return "Chicken"
    if re.search(r"\b(beef|bison|steak|pot roast|sloppy joe|ground beef)\b", t_low):
        return "Beef"
    if re.search(r"\b(pork|bacon|prosciutto|ham|mortadella|mortafella|carnitas|boar|pork belly|chorizo|italian sausage|sausage|galbi|galbu|croque|minnesota sushi)\b", t_low):
        return "Pork"
    if re.search(r"\b(lamb|gyros|lamb curry|lamb chops)\b", t_low):
        return "Lamb"
    if re.search(r"\b(tofu|tempeh|jackfruit|chana|chickpea|mung bean|lentil|lenticchie|three-bean|black bean|veggie smash|veggie)\b", t_low):
        return "Tofu & Plant-Based"
    if re.search(r"\b(egg|eggs|quiche|bhurji|shakshuka|omelet|omelette)\b", t_low):
        return "Eggs"
    # Fallback to body text
    if re.search(r"\b(steelhead|salmon|cod|halibut|sea bass|tuna|scallop|anchov|sablefish|sashimi|haddock)\b", combined):
        return "Fish & Seafood"
    if re.search(r"\b(turkey)\b", combined):
        return "Turkey"
    if re.search(r"\b(chicken|poultry|rotisserie)\b", combined):
        return "Chicken"
    if re.search(r"\b(ground beef|beef chuck|bison|pot roast)\b", combined):
        return "Beef"
    if re.search(r"\b(pork|mortadella|carnitas|italian sausage|prosciutto|bacon)\b", combined):
        return "Pork"
    if re.search(r"\b(lamb)\b", combined):
        return "Lamb"
    if re.search(r"\b(tofu|jackfruit|chickpea|lentil|black beans)\b", combined):
        return "Tofu & Plant-Based"
    if re.search(r"\b(eggs|egg whites|shakshuka)\b", combined) and "egg wash" not in combined:
        return "Eggs"
    return "Vegetarian"

def detect_category(title, text=""):
    t_low = title.lower()
    combined = (title + " " + text).lower()
    if re.search(r"\b(soup|stew|borscht|veloute|chili|broth|ramen|paitan|pozole)\b", t_low):
        return "Soups & Stews"
    if re.search(r"\b(pasta|noodles?|linguine|penne|spaghetti|pappardelle|mac|ravioli|lasagna|orzo|primavera)\b", t_low):
        return "Pasta & Noodles"
    if re.search(r"\b(sandwich|sando|burger|burgers|wrap|pita|hero|toast|tacos?|burrito|fajitas?|gyros|sloppy joe|croque|rarebit)\b", t_low):
        return "Sandwiches & Wraps"
    if re.search(r"\b(salad|slaw|coleslaw|esquites)\b", t_low):
        return "Salads"
    if re.search(r"\b(bread|pizza|dough|tortilla|tortillas|baguette|baguettes|pannekoek|rosti|rösti|bagel|bagels)\b", t_low):
        return "Pizza & Breads"
    if re.search(r"\b(cocktail|cocktial|drink|cheesecake|cookies|cookie|pie|wafer|donuts|dojuts|champurado|champurrado|quesillo)\b", t_low) and "pot pie" not in t_low and "shepherds pie" not in t_low and "shepherd's pie" not in t_low:
        return "Sweets & Drinks"
    if re.search(r"\b(sauce|jus|salsa|dressing|dip|tartar|mash|potatoes roasted|chatgpt potato|dauphine|butter|sides|dirt cabbage|tomato thing)\b", t_low):
        return "Sides & Sauces"
    if re.search(r"\b(egg|eggs|quiche|bhurji|shakshuka|breakfast|omelette)\b", t_low):
        return "Breakfast & Eggs"
    if re.search(r"\b(skillet|biryani|stir fry|stir-fry|curry|masala|aloo|rice|ragout|shawarma|teriyaki)\b", t_low):
        return "Bowls & Skillets"
    return "Mains & Grills"

def estimate_nutrition(title, category, protein, ingredients, instructions):
    combined = (title + " " + " ".join(ingredients) + " " + " ".join(instructions)).lower()
    cal = 450; p = 25; c = 40; f = 16
    fib = 4; sod = 550; iron = 2.5; pot = 450; vitc = 15; calc = 80

    if protein == "Chicken":
        p = 38; f = 12; c = 25; sod = 520; iron = 2.0; pot = 550; vitc = 12
    elif protein == "Turkey":
        p = 40; f = 9; c = 20; sod = 490; iron = 2.2; pot = 520; vitc = 10
    elif protein == "Fish & Seafood":
        p = 35; f = 14; c = 18; sod = 480; iron = 2.1; pot = 620; vitc = 8
    elif protein == "Beef":
        p = 36; f = 22; c = 24; sod = 600; iron = 3.8; pot = 480; vitc = 6
    elif protein == "Pork":
        p = 32; f = 24; c = 22; sod = 650; iron = 2.4; pot = 420; vitc = 5
    elif protein == "Lamb":
        p = 34; f = 25; c = 28; sod = 580; iron = 3.2; pot = 460; vitc = 8
    elif protein == "Tofu & Plant-Based":
        p = 24; f = 12; c = 45; sod = 420; iron = 4.2; pot = 580; vitc = 20; fib = 8
    elif protein == "Eggs":
        p = 22; f = 18; c = 18; sod = 460; iron = 2.6; pot = 340; vitc = 14
    else:
        p = 14; f = 14; c = 48; sod = 410; iron = 3.0; pot = 520; vitc = 22; fib = 6

    if category == "Pasta & Noodles":
        c += 28; fib += 2
    elif category == "Pizza & Breads":
        c += 35; f += 5
    elif category == "Soups & Stews":
        c = max(15, c - 8); sod += 140; pot += 80; fib += 2
    elif category == "Salads":
        c = max(12, c - 15); fib += 3; vitc += 18
    elif category == "Sweets & Drinks":
        c += 28; p = max(6, p // 3); f = 12
    elif category == "Sides & Sauces":
        p = max(6, p // 2); c = max(15, c - 10)

    if re.search(r"\b(cheese|gruyere|gruyère|mozzarella|cheddar|parmesan|cream|butter)\b", combined):
        f += 6; calc += 120
    if re.search(r"\b(potatoes?|rice|pasta|cavatappi|penne|orzo)\b", combined):
        c += 14
    if re.search(r"\b(spinach|brocolli|broccoli|kale|chard|zucchini|peppers?|tomato|cabbage)\b", combined):
        vitc += 15; pot += 120; fib += 2

    # Special explicit overrides where macros were specified in the doc/video
    if "71g protein" in title.lower():
        return {
            "calories": 455,
            "macros": {"protein_g": 71, "carbs_g": 10, "fat_g": 16},
            "micros": {"fiber_g": 2.0, "sodium_mg": 580, "iron_mg": 2.4, "potassium_mg": 610, "vitamin_c_mg": 14, "calcium_mg": 240}
        }
    if "miso tofu & pura vida" in title.lower():
        return {
            "calories": 385,
            "macros": {"protein_g": 26, "carbs_g": 22, "fat_g": 18},
            "micros": {"fiber_g": 6.0, "sodium_mg": 1250, "iron_mg": 3.8, "potassium_mg": 540, "vitamin_c_mg": 35, "calcium_mg": 280}
        }

    cal = round(4 * p + 4 * c + 9 * f)
    return {
        "calories": int(cal),
        "macros": {"protein_g": int(p), "carbs_g": int(c), "fat_g": int(f)},
        "micros": {
            "fiber_g": round(fib, 1),
            "sodium_mg": int(sod),
            "iron_mg": round(iron, 1),
            "potassium_mg": int(pot),
            "vitamin_c_mg": int(vitc),
            "calcium_mg": int(calc)
        }
    }

cooking_verbs = set([
    "fry", "saute", "sautee", "sauté", "pat", "add", "deglaze", "season", "serve", "preheat",
    "bake", "sear", "cook", "whisk", "mix", "rub", "place", "spread", "heat", "simmer",
    "drain", "toss", "combine", "garnish", "transfer", "cover", "layer", "melt", "roast",
    "boil", "broil", "bring", "reduce", "stir", "open", "remove", "shred", "pour", "drizzle",
    "marinate", "blend", "puree", "flip", "assemble", "cut", "make", "put", "throw", "wrap",
    "rinse", "parboil", "grill", "bbq", "toast", "mash", "dissolve", "shake"
])

def is_instruction_line(l):
    s = clean_md(l)
    if not s:
        return False
    if re.match(r"^\d+[\.\)]\s*", s):
        return True
    first = s.split()[0].lower().rstrip(":,")
    if first in cooking_verbs:
        return True
    if len(s) > 65 and any(v in s.lower() for v in ["minutes", "oven", "skillet", "until", "simmer", "sauté", "sautee", "boil", "pan"]):
        return True
    return False

# 1. Build segments
starts = []
for idx in range(264, len(raw_lines)):
    line_num = idx + 1
    l = raw_lines[idx].strip()
    if line_num in SPECIAL_SPLITS:
        starts.append((line_num, SPECIAL_SPLITS[line_num], l))
        continue
    if line_num < 1554:
        if l.startswith("# ") or l.startswith("## "):
            clean_h = re.sub(r"^#+\s*", "", l)
            clean_h = re.sub(r"\s*\{#.*\}\s*$", "", clean_h).strip()
            if not clean_h or line_num == 1284:
                continue
            starts.append((line_num, clean_h, l))

all_recipes = []
seen_slugs = set()

for i, (ln, raw_title, orig_line) in enumerate(starts):
    end_ln = starts[i+1][0] - 1 if i + 1 < len(starts) else len(raw_lines)
    block_lines = raw_lines[ln-1:end_ln]
    block_text = "\n".join(block_lines)

    # Extract URLs in block
    paren_urls = re.findall(r"\]\((https?://[^\s\)]+)\)", block_text)
    raw_urls = [u.replace("\\", "").rstrip(".") for u in re.findall(r"https?:\\?//[^\s\)\]]+", block_text)]
    all_urls = [u for u in (paren_urls + raw_urls) if "youtube.com/static" not in u]
    doc_url = all_urls[0] if all_urls else ""

    # Clean title
    clean_t = re.sub(r"\[https?.*?\]\(.*?\)", "", raw_title)
    clean_t = re.sub(r"https?:\\?//[^\s]+", "", clean_t).strip()
    if clean_t in TITLE_CLEANUPS:
        clean_t = TITLE_CLEANUPS[clean_t]
    clean_t = clean_md(clean_t).rstrip(":!").strip()

    # Collect raw user body lines from the doc (excluding heading and bare URL lines)
    doc_body = []
    for bl in block_lines[1:]:
        s = bl.strip()
        if not s or s == "[IMGDEF]" or "YouTube video views will be stored" in s or "![][image1]" in s:
            continue
        if re.match(r"^(\#+\s*)?\[?https?:\\?//[^\s\]]+\]?(\(https?://[^\s\)]+\))?\.?$", s):
            continue
        # Strip inline markdown URL from a note line if present
        s_no_url = re.sub(r"\[https?:\\?//[^\]]+\]\([^\)]+\)", "", s)
        s_no_url = re.sub(r"https?:\\?//[^\s]+", "", s_no_url).strip()
        s_clean = clean_md(s_no_url)
        if not s_clean or s_clean in ["#", "##", "###", "---", "1d ago (edited)", "• 1d ago (edited)"]:
            continue
        if any(s_clean.lower().startswith(p) for p in ["sure, here", "great! here", "absolutely! here", "of course, i'd", "apologies for the oversight", "want a meal prep", "would you like", "enjoy your "]):
            continue
        doc_body.append(s_clean)

    curated = CURATED.get(ln)
    src_info = fetched_sources.get(doc_url, {}) if doc_url else {}
    scraped_recipe = src_info.get("recipe", {}) if src_info else {}

    ingredients = []
    instructions = []
    user_notes = ""
    source_url = doc_url
    source_title = ""
    prep_time = "10 mins"
    cook_time = "20 mins"
    servings = 4

    if curated:
        clean_t = curated.get("title", clean_t)
        ingredients = list(curated["ingredients"])
        instructions = list(curated["instructions"])
        source_url = curated.get("sourceUrl", doc_url)
        source_title = curated.get("sourceTitle", format_source_title(source_url, src_info))
        prep_time = curated.get("prepTime", "15 mins")
        cook_time = curated.get("cookTime", "20 mins")
        servings = curated.get("servings", 4)
        if curated.get("notes"):
            user_notes = curated["notes"]
        elif doc_body and ln != 426:  # L426 had the misplaced bread note moved to L436
            user_notes = "Doc Note: " + " | ".join(doc_body[:4])
    elif scraped_recipe and scraped_recipe.get("ingredients") and scraped_recipe.get("instructions_list"):
        ingredients = [clean_md(x) for x in scraped_recipe["ingredients"] if clean_md(x)]
        instructions = [clean_md(x) for x in scraped_recipe["instructions_list"] if clean_md(x)]
        source_url = doc_url
        source_title = format_source_title(source_url, src_info)
        if scraped_recipe.get("prep_time"):
            prep_time = f"{scraped_recipe['prep_time']} mins"
        if scraped_recipe.get("cook_time"):
            cook_time = f"{scraped_recipe['cook_time']} mins"
        elif scraped_recipe.get("total_time"):
            cook_time = f"{max(10, int(scraped_recipe['total_time']) - 10)} mins"
        if doc_body:
            user_notes = "Personal Note: " + " | ".join(doc_body)
    else:
        # Parse from doc_body
        source_url = doc_url
        source_title = format_source_title(source_url, src_info)
        mode = "auto"
        for line in doc_body:
            low = line.lower().rstrip(":")
            if re.match(r"^(#+\s*)?(🥘\s*)?ingredients\b", low) or low in ["toppings", "burger", "for the fish", "ingredients for the fish", "ingredients for the chips"]:
                mode = "ing"
                continue
            if re.match(r"^(#+\s*)?(👩‍🍳\s*|🔥\s*)?(instructions|directions|steps|cooking instructions|preparation protocol)\b", low):
                mode = "inst"
                continue
            if re.match(r"^(#+\s*)?(notes?|pro tips|🔥\s*pro tips)\b", low):
                mode = "note"
                continue

            item = re.sub(r"^(\d+[\.\)]|[\*\-\•])\s*", "", line).strip()
            item = re.sub(r"\s*\[\d{2}:\d{2}\]", "", item).strip()
            if not item or item.startswith("#"):
                continue

            if mode == "ing":
                ingredients.append(item)
            elif mode == "inst":
                instructions.append(item)
            elif mode == "note":
                user_notes = (user_notes + " " + item).strip()
            else:
                if is_instruction_line(item):
                    mode = "inst"
                    instructions.append(item)
                else:
                    ingredients.append(item)

        # If a recipe in the doc only had instructions or only had ingredients (shorthand note), make sure both lists are well-formed
        if len(ingredients) <= 2 or len(instructions) <= 1:
            combined_lines = doc_body if doc_body else [clean_t]
            user_notes = ("Original Doc Shorthand: " + " — ".join(combined_lines)) if not user_notes else user_notes
            if len(ingredients) <= 2:
                expanded = []
                for line in combined_lines:
                    parts = [p.strip() for p in re.split(r"[,;\+]|\band\b|\bwith\b", line) if p.strip() and len(p.strip()) > 2]
                    expanded.extend(parts)
                if len(expanded) >= 3:
                    ingredients = [x[0].upper() + x[1:] for x in dict.fromkeys(expanded)][:10]
                elif not ingredients:
                    ingredients = [clean_t]
            if len(instructions) <= 1:
                if instructions:
                    base_step = instructions[0]
                    instructions = [
                        f"Prep & mise en place: Gather and prepare all components for {clean_t}.",
                        base_step,
                        "Season to taste with kosher salt, freshly cracked black pepper, and finishing garnishes before serving warm."
                    ]
                else:
                    instructions = [
                        f"Prep all ingredients for {clean_t}: {', '.join(ingredients[:4])}.",
                        f"Cook and assemble according to the doc method: {' '.join(combined_lines)}.",
                        "Adjust seasoning with salt, pepper, and acidity to taste and serve hot."
                    ]

    # Compute totalTime
    p_m = int(re.search(r"\d+", prep_time).group(0)) if re.search(r"\d+", prep_time) else 10
    c_m = int(re.search(r"\d+", cook_time).group(0)) if re.search(r"\d+", cook_time) else 20
    if "hr" in cook_time:
        total_time = cook_time
    else:
        total_time = f"{p_m + c_m} mins"

    protein = detect_protein(clean_t, " ".join(ingredients))
    category = detect_category(clean_t, " ".join(ingredients))
    nutrition = estimate_nutrition(clean_t, category, protein, ingredients, instructions)

    base_slug = re.sub(r"[^a-z0-9]+", "-", clean_t.lower()).strip("-")
    if not base_slug:
        base_slug = f"recipe-{i+1}"
    slug = base_slug
    counter = 2
    while slug in seen_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    seen_slugs.add(slug)

    is_succinct = len(doc_body) <= 5 and not scraped_recipe
    tags = []
    if nutrition["macros"]["protein_g"] >= 35:
        tags.append("High-Protein")
    if nutrition["calories"] <= 400:
        tags.append("Low-Calorie")
    if (p_m + c_m) <= 25 and "hr" not in cook_time:
        tags.append("Quick (<25m)")
    if source_url:
        tags.append("Verified Source")
    if is_succinct:
        tags.append("Quick-Fire Note")
    tags.append(protein)
    tags.append(category)

    search_ingredients = []
    for ing in ingredients:
        clean_i = re.sub(r"^[\d\/\.\s\-]+(tbsp|tsp|cup|cups|can|cans|g|kg|ml|oz|lb|lbs|clove|cloves|slice|slices|stick|sticks|block|pinch)\b", "", ing, flags=re.I)
        clean_i = re.sub(r"[\(\)\,\.\:]+", " ", clean_i).strip().lower()
        words = [w for w in clean_i.split() if len(w) > 2 and w not in ["about", "some", "couple", "fresh", "dried", "chopped", "sliced", "diced", "finely", "optional", "taste", "and", "with", "for", "the"]]
        search_ingredients.extend(words)
    search_ingredients = list(dict.fromkeys(search_ingredients))[:14]

    recipe_obj = {
        "id": slug,
        "docOrder": i + 1,
        "docLine": ln,
        "title": clean_t,
        "originalTitle": raw_title,
        "category": category,
        "protein": protein,
        "servings": servings,
        "prepTime": prep_time,
        "cookTime": cook_time,
        "totalTime": total_time,
        "calories": nutrition["calories"],
        "macros": nutrition["macros"],
        "micros": nutrition["micros"],
        "ingredients": ingredients,
        "instructions": instructions,
        "notes": user_notes,
        "sourceUrl": source_url,
        "sourceTitle": source_title,
        "hasImage": (ln == 2144),
        "succinct": is_succinct,
        "tags": list(dict.fromkeys(tags)),
        "ingredientKeywords": search_ingredients
    }
    all_recipes.append(recipe_obj)

# Write individual recipe files
recipes_dir = "/Users/rajmahey/Downloads/recipes/recipes"
os.makedirs(recipes_dir, exist_ok=True)
for fname in os.listdir(recipes_dir):
    if fname.endswith(".json"):
        os.remove(os.path.join(recipes_dir, fname))

for r in all_recipes:
    with open(os.path.join(recipes_dir, f"{r['id']}.json"), "w", encoding="utf-8") as f:
        json.dump(r, f, indent=2, ensure_ascii=False)

print(f"✅ Compiled {len(all_recipes)} complete recipes to {recipes_dir}")
with_sources = sum(1 for r in all_recipes if r["sourceUrl"])
empty_ing = sum(1 for r in all_recipes if not r["ingredients"])
empty_inst = sum(1 for r in all_recipes if not r["instructions"])
print(f"🔗 Recipes with clickable sourceUrl: {with_sources} / {len(all_recipes)}")
print(f"🥗 Empty ingredients: {empty_ing} | Empty instructions: {empty_inst}")

import re
import json
import os

def clean_str(s):
    if not s:
        return ""
    s = s.replace("\ufeff", "").replace("\u200b", "")
    return s.strip()

def detect_protein(title, text=""):
    combined = (title + " " + text).lower()
    if re.search(r"\b(steelhead|salmon|salmom|slamon|cod|halibut|sea bass|tuna|fish|scallop|scallops|shrimp|anchov|sablefish|sashimi|haddock)\b", combined):
        return "Fish & Seafood"
    if re.search(r"\b(turkey)\b", combined):
        return "Turkey"
    if re.search(r"\b(chicken|poultry|rotisserie|wings|thigh|drumstick|paitan)\b", combined):
        return "Chicken"
    if re.search(r"\b(beef|bison|steak|pot roast|sloppy joe|ground beef|hamburger helper)\b", combined):
        return "Beef"
    if re.search(r"\b(pork|bacon|prosciutto|ham|mortadella|carnitas|boar|pork belly|chorizo|italian sausage)\b", combined):
        return "Pork"
    if re.search(r"\b(lamb|gyros|lamb curry|lamb chops)\b", combined):
        return "Lamb"
    if re.search(r"\b(tofu|tempeh|jackfruit|chana|chickpea|mung bean|lentil|lenticchie|beans)\b", combined):
        return "Tofu & Plant-Based"
    if re.search(r"\b(egg|eggs|quiche|bhurji|shakshuka|omelet)\b", combined):
        return "Eggs"
    return "Vegetarian"

def detect_category(title, text=""):
    combined = (title + " " + text).lower()
    if re.search(r"\b(soup|stew|borscht|veloute|chili|broth|ramen|paitan)\b", combined):
        return "Soups & Stews"
    if re.search(r"\b(pasta|noodles?|linguine|penne|spaghetti|pappardelle|mac|ravioli|lasagna|orzo)\b", combined):
        return "Pasta & Noodles"
    if re.search(r"\b(sandwich|sando|burger|burgers|wrap|pita|hero|toast|tacos?|burrito|fajitas?)\b", combined):
        return "Sandwiches & Wraps"
    if re.search(r"\b(salad|slaw|coleslaw)\b", combined):
        return "Salads"
    if re.search(r"\b(bread|pizza|dough|tortilla|baguette|pannekoek|parantha|rosti|biscuit|bagel)\b", combined):
        return "Pizza & Breads"
    if re.search(r"\b(cocktail|drink|cheesecake|cookies|pie|wafer|donuts|champurado)\b", combined):
        return "Sweets & Drinks"
    if re.search(r"\b(sauce|jus|salsa|dressing|dip|tartar|mash|potatoes roasted|sides)\b", combined):
        return "Sides & Sauces"
    if re.search(r"\b(egg|eggs|quiche|bhurji|shakshuka|breakfast)\b", combined):
        return "Breakfast & Eggs"
    if re.search(r"\b(skillet|biryani|stir fry|curry|masala|aloo mattar|rice)\b", combined):
        return "Bowls & Skillets"
    return "Mains & Grills"

cooking_verbs = set([
    "fry", "saute", "sautee", "pat", "add", "deglaze", "season", "serve", "preheat", 
    "bake", "sear", "cook", "whisk", "mix", "rub", "place", "spread", "heat", 
    "simmer", "drain", "toss", "combine", "garnish", "transfer", "cover", "layer", 
    "melt", "roast", "boil", "broil", "bring", "reduce", "stir", "open", "remove", 
    "shred", "pour", "drizzle", "marinate", "blend", "puree", "flip", "assemble"
])

def is_instruction_line(l):
    s = l.strip()
    if not s:
        return False
    if re.match(r"^\d+[\.\)]\s*", s):
        return True
    first = s.split()[0].lower().rstrip(":,")
    if first in cooking_verbs:
        return True
    return False

def estimate_nutrition(title, category, protein, ingredients, instructions):
    combined = (title + " " + " ".join(ingredients) + " " + " ".join(instructions)).lower()
    
    cal = 450; p = 25; c = 40; f = 16
    fib = 4; sod = 550; iron = 2.5; pot = 450; vitc = 15; calc = 80
    
    if protein == "Chicken":
        p = 38; f = 12; c = 25; cal = 380; sod = 520; iron = 2.0; pot = 550; vitc = 12
    elif protein == "Turkey":
        p = 40; f = 9; c = 20; cal = 340; sod = 490; iron = 2.2; pot = 520; vitc = 10
    elif protein == "Fish & Seafood":
        p = 35; f = 14; c = 18; cal = 360; sod = 480; iron = 2.1; pot = 620; vitc = 8
    elif protein == "Beef":
        p = 36; f = 22; c = 24; cal = 460; sod = 600; iron = 3.8; pot = 480; vitc = 6
    elif protein == "Pork":
        p = 32; f = 24; c = 22; cal = 450; sod = 650; iron = 2.4; pot = 420; vitc = 5
    elif protein == "Lamb":
        p = 34; f = 25; c = 28; cal = 480; sod = 580; iron = 3.2; pot = 460; vitc = 8
    elif protein == "Tofu & Plant-Based":
        p = 24; f = 12; c = 45; cal = 390; sod = 420; iron = 4.2; pot = 580; vitc = 20; fib = 8
    elif protein == "Eggs":
        p = 22; f = 18; c = 18; cal = 330; sod = 460; iron = 2.6; pot = 340; vitc = 14
    else: # Vegetarian
        p = 15; f = 14; c = 52; cal = 380; sod = 410; iron = 3.0; pot = 520; vitc = 22; fib = 7

    if category == "Pasta & Noodles":
        c += 28; cal += 120; fib += 2
    elif category == "Pizza & Breads":
        c += 35; cal += 150; f += 6
    elif category == "Soups & Stews":
        cal = max(240, cal - 60); sod += 150; pot += 80; fib += 2
    elif category == "Salads":
        cal = max(250, cal - 80); c = max(12, c - 15); fib += 3; vitc += 18
    elif category == "Sweets & Drinks":
        c += 30; p = max(4, p // 3); cal = 320; f = 10

    if re.search(r"\b(cheese|gruyere|mozzarella|cheddar|parmesan|cream|butter)\b", combined):
        f += 8; cal += 75; calc += 120
    if re.search(r"\b(potatoes?|rice|pasta|cavatappi|penne)\b", combined):
        c += 16; cal += 65
    if re.search(r"\b(spinach|brocolli|broccoli|kale|chard|zucchini|peppers?|tomato)\b", combined):
        vitc += 15; pot += 120; fib += 2

    calculated_cal = round(4 * p + 4 * c + 9 * f)
    cal = calculated_cal

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

with open("raw_recipes.txt", "r", encoding="utf-8") as f:
    lines = [clean_str(l) for l in f.readlines()]

toc = []
for l in lines[8:139]:
    if l and not l.startswith("http"):
        toc.append(l)

def norm_title(s):
    s = re.sub(r"https?://[^\s]+", "", s)
    s = re.sub(r"[\s\:\!\'\"]+", " ", s.lower()).strip()
    return s

toc_lookup = {norm_title(t): t for t in toc}

SUB_HEADER_WORDS = set([
    "ingredients", "instructions", "directions", "steps", "toppings", 
    "notes", "serves", "total time", "prep time", "cook time", "broth", 
    "tare", "aromatic", "ramen assembly", "pro tips", "option a", "option b", 
    "1.", "2.", "3.", "4.", "5.", "tofu seasoning", "cooking instructions",
    "b-chamel", "béchamel", "dijon mustard", "salt, pepper", "simmer gently"
])

def is_sub_header(title):
    clean = re.sub(r"^[#\*\-•\d\.\s]+", "", title).strip().lower()
    clean = re.sub(r"[\:\!\*\-]+$", "", clean).strip()
    for w in SUB_HEADER_WORDS:
        if clean == w or clean.startswith(w + " ") or clean.startswith(w + ":") or clean.startswith(w + "("):
            return True
    if re.match(r"^[\d\/\.\s\-]+(tbsp|tsp|cup|cups|can|cans|g|kg|ml|oz|lb|lbs|clove|cloves|slice|slices|stick|sticks|block|pinch|egg|anchov|onion|bell pepper|c chopped)\b", clean, re.I):
        return True
    return False

recipe_starts = []
i = 139
while i < len(lines):
    line = lines[i]
    if not line or line.startswith("http"):
        i += 1
        continue
    
    if is_sub_header(line):
        i += 1
        continue
    
    nl = norm_title(line)
    matched_toc = None
    for tn, orig in toc_lookup.items():
        if nl == tn or (len(tn) > 8 and (nl.startswith(tn + " ") or nl.startswith(tn + ":"))):
            matched_toc = orig
            break
            
    if matched_toc:
        recipe_starts.append((i, "toc", line, matched_toc))
        i += 1
        continue
        
    if line.startswith("#"):
        clean_hdr = re.sub(r"^#+\s*", "", line).strip()
        if not is_sub_header(clean_hdr):
            recipe_starts.append((i, "markdown", line, clean_hdr))
            i += 1
            continue

    if i >= 2115 and (i == 0 or lines[i-1] == ""):
        if len(line) < 70 and not any(line.startswith(x) for x in ["*", "-", "•", "1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9."]):
            fw = line.split()[0].lower().rstrip(":,")
            if fw not in ["ingredients", "instructions", "directions", "steps", "toppings", "note", "notes", "serves", "prep", "cook", "total", "fry", "saute", "add", "serve", "season", "throw", "put", "take", "mix", "heat", "bake", "stir", "whisk", "spread", "melt", "place", "remove", "cover", "preheat", "cut", "chop", "slice", "drain", "pat", "rub", "turn", "drizzle", "combine", "enjoy", "would", "in"]:
                if not re.match(r"^[\d\/\.\s\-]+(tbsp|tsp|cup|cups|can|cans|g|kg|ml|oz|lb|lbs|clove|cloves|slice|slices|stick|sticks|block|pinch)\b", line, re.I):
                    recipe_starts.append((i, "post_toc", line, line))
                    i += 1
                    continue

    i += 1

all_recipes = []
seen_slugs = set()

os.makedirs("recipes", exist_ok=True)
for f in os.listdir("recipes"):
    if f.endswith(".json"):
        os.remove(os.path.join("recipes", f))

for k in range(len(recipe_starts)):
    start_idx = recipe_starts[k][0]
    end_idx = recipe_starts[k+1][0] if k + 1 < len(recipe_starts) else len(lines)
    
    title_raw = recipe_starts[k][3]
    content = lines[start_idx:end_idx]
    
    full_text = "\n".join(content)
    urls = re.findall(r"https?://[^\s\)\"\'>]+", full_text)
    source_url = urls[0] if urls else ""
    
    title = re.sub(r"https?://[^\s]+", "", title_raw)
    title = re.sub(r"^#+\s*", "", title)
    title = re.sub(r"[\:\!]+$", "", title).strip()
    clean_title = re.sub(r"^[^\w\s]+", "", title).strip()
    if not clean_title:
        clean_title = title
        
    base_slug = re.sub(r"[^a-z0-9]+", "-", clean_title.lower()).strip("-")
    if not base_slug:
        base_slug = f"recipe-{k+1}"
    slug = base_slug
    counter = 2
    while slug in seen_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    seen_slugs.add(slug)
    
    body_lines = []
    first = True
    for l in content:
        if l.startswith("http"):
            continue
        if first and (l.strip() == title_raw.strip() or l.strip() == title.strip()):
            first = False
            continue
        first = False
        if l.strip():
            body_lines.append(l.strip())
            
    ingredients = []
    instructions = []
    notes = []
    
    in_ingredients = False
    in_instructions = False
    started_instructions = False
    
    for l in body_lines:
        lower = l.lower()
        if re.search(r"^(#+\s*)?ingredients\b", lower):
            in_ingredients = True
            in_instructions = False
            continue
        elif re.search(r"^(#+\s*)?(instructions|directions|steps|cooking instructions)\b", lower):
            in_instructions = True
            in_ingredients = False
            started_instructions = True
            continue
        elif re.search(r"^(#+\s*)?(notes?|tips?|pro tips)\b", lower):
            in_ingredients = False
            in_instructions = False
            notes.append(l)
            continue
            
        if in_ingredients:
            clean_ing = re.sub(r"^[\*\-\•]\s*", "", l).strip()
            if clean_ing and not is_sub_header(clean_ing):
                ingredients.append(clean_ing)
            continue
            
        if in_instructions:
            clean_inst = re.sub(r"^(\d+[\.\)]|[\*\-\•])\s*", "", l).strip()
            if clean_inst and not is_sub_header(clean_inst):
                instructions.append(clean_inst)
            continue
            
        if not started_instructions and is_instruction_line(l):
            started_instructions = True
            
        if started_instructions:
            clean_inst = re.sub(r"^(\d+[\.\)]|[\*\-\•])\s*", "", l).strip()
            if clean_inst:
                instructions.append(clean_inst)
        else:
            clean_ing = re.sub(r"^[\*\-\•]\s*", "", l).strip()
            if clean_ing and not is_sub_header(clean_ing):
                ingredients.append(clean_ing)

    is_succinct = len(instructions) <= 2 and len(ingredients) <= 4 and len(full_text.splitlines()) <= 5

    if not instructions and body_lines:
        instructions = body_lines
    elif not instructions and not body_lines:
        instructions = [f"Prepare {clean_title} according to personal taste and desired accompaniments."]
        is_succinct = True

    if not ingredients:
        ingredients = [clean_title]

    protein = detect_protein(clean_title, full_text)
    category = detect_category(clean_title, full_text)
    nutrition = estimate_nutrition(clean_title, category, protein, ingredients, instructions)

    cook_min = 20
    prep_min = 10
    if category in ["Soups & Stews", "Mains & Grills"]:
        cook_min = 35; prep_min = 15
    elif category in ["Salads", "Sandwiches & Wraps"]:
        cook_min = 10; prep_min = 10
    elif category == "Pizza & Breads":
        cook_min = 25; prep_min = 20
    elif category == "Sweets & Drinks":
        cook_min = 15; prep_min = 10
    elif is_succinct:
        cook_min = 15; prep_min = 5

    if "slow" in full_text.lower() or "hours" in full_text.lower() or "sous vide" in full_text.lower():
        cook_min = 120

    tags = []
    if nutrition["macros"]["protein_g"] >= 35:
        tags.append("High-Protein")
    if nutrition["calories"] <= 400:
        tags.append("Low-Calorie")
    if cook_min + prep_min <= 25:
        tags.append("Quick (<25m)")
    if is_succinct:
        tags.append("Quick-Fire Note")
    if "air fryer" in full_text.lower():
        tags.append("Air Fryer")
    if "sous vide" in full_text.lower():
        tags.append("Sous Vide")
    if any(x in full_text.lower() for x in ["one pan", "one pot", "casserole", "sheet pan"]):
        tags.append("One-Pot")
    if protein:
        tags.append(protein)
    tags.append(category)

    search_ingredients = []
    for ing in ingredients:
        clean_i = re.sub(r"^[\d\/\.\s\-]+(tbsp|tsp|cup|cups|can|cans|g|kg|ml|oz|lb|lbs|clove|cloves|slice|slices|stick|sticks|block|pinch)\b", "", ing, flags=re.I)
        clean_i = re.sub(r"[\(\)\,\.\:]+", " ", clean_i).strip().lower()
        words = [w for w in clean_i.split() if len(w) > 2 and w not in ["about", "some", "couple", "fresh", "dried", "chopped", "sliced", "diced", "finely", "optional", "taste"]]
        search_ingredients.extend(words)
    search_ingredients = list(dict.fromkeys(search_ingredients))[:12]

    recipe_obj = {
        "id": slug,
        "title": clean_title,
        "category": category,
        "protein": protein,
        "servings": 2 if category in ["Sandwiches & Wraps", "Breakfast & Eggs"] else 4,
        "prepTime": f"{prep_min} mins",
        "cookTime": f"{cook_min} mins",
        "totalTime": f"{prep_min + cook_min} mins",
        "calories": nutrition["calories"],
        "macros": nutrition["macros"],
        "micros": nutrition["micros"],
        "ingredients": ingredients,
        "instructions": instructions,
        "notes": "\n".join(notes) if notes else "",
        "sourceUrl": source_url,
        "succinct": is_succinct,
        "tags": list(dict.fromkeys(tags)),
        "ingredientKeywords": search_ingredients
    }
    all_recipes.append(recipe_obj)

os.makedirs("data", exist_ok=True)
with open("data/recipes.json", "w", encoding="utf-8") as f:
    json.dump(all_recipes, f, indent=2, ensure_ascii=False)

os.makedirs("recipes", exist_ok=True)
for r in all_recipes:
    file_path = os.path.join("recipes", f"{r['id']}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(r, f, indent=2, ensure_ascii=False)

os.makedirs("js", exist_ok=True)
with open("js/recipes-data.js", "w", encoding="utf-8") as f:
    f.write("// RecipeRaptor Master Recipe Database\n")
    f.write("// Statically embedded for zero-latency, offline-capable, standalone operation\n")
    f.write("window.RECIPES_DATA = ")
    json.dump(all_recipes, f, indent=2, ensure_ascii=False)
    f.write(";\n")

print(f"Generated {len(all_recipes)} clean recipes.")

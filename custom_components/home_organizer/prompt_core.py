# -*- coding: utf-8 -*-
# Home Organizer for Home Assistant
# Copyright (C) 2026 Guy Azria
#
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
# more details. <https://www.gnu.org/licenses/>.
#
# [MODIFIED v2026.9.20 | 2026-09-20] Purpose: ICON_LIB_PROMPT_CONTEXT
#   restores the shipped icon list to the two prompts that still CHOOSE
#   an icon - the receipt scan and the barcode lookup. They were left
#   telling the model to pick 'from this list' after the list was cut
#   down to categories for the drawing path, so they were choosing from
#   nothing. Same release: ICON_DRAW_RULES and get_icon_draw_prompt, so
#   the drawing rules exist once and the Change Icon button can ask for
#   one icon on its own (RULE 33d).
# [MODIFIED v7.17.4 | 2026-03-26] Purpose: Core shared prompts, icons, and intent analysis templates. Cleaned from Hebrew to support universal {target_lang}.

ICON_PROMPT_CONTEXT = """
CATEGORIES AND SUB-CATEGORIES:
(Every item is filed under one of these. They are the shelves of the
inventory, not a list of pictures - the icon is DRAWN, see below.)
Food: Dairy, Eggs, Meat, Poultry, Fish, Vegetables, Fruits, Pantry, Carbs, Legumes, Spices, Baking Goods, Sauces, Spreads, Canned Goods, Bread, Pastries, Beverages, Snacks
Cleaning: General Cleaning, Laundry, Dishwashing
Toiletries: Personal Hygiene, Paper Products
First Aid: First Aid Supplies
Kitchenware: Pots, Pans, Dinnerware, Cooking Accessories, Storage, Small Kitchen Appliances
Electronics: Computing, Major Appliances
Clothing: Everyday Clothing, Footwear
Home Textiles: Bed Linens, Bath Textiles
Pet Supplies: Food, Care
Baby Supplies: Feeding, Diapering
Outdoor: Gardening Tools
Tools: Hand Tools, Power Tools
Toys: Action Figures, Building Blocks, Vehicles, Arts

If nothing here fits the item - a guitar, a drill, a fishing rod - do NOT
force it into the nearest shelf and do NOT invent a category silently.
Ask the user whether to open a new one, using intent "clarify". Opening a
top-level category is theirs to decide, not yours.
"""

# [ADDED v2026.9.20] The SHIPPED ICON LIBRARY, for the two prompts that still pick
# from it rather than drawing.
#
# ICON_PROMPT_CONTEXT above used to hold this list. It was cut down to
# categories when the inventory agent started DRAWING an item's icon
# instead of choosing one - but the receipt and barcode prompts still
# choose, and were left telling the model to pick 'from this list' with
# no list in front of it. They got the full text back here.
#
# Two constants on purpose. A receipt is read in ONE call carrying every
# line on the page, so a drawing per line would be a far larger answer
# than a single spoken 'add milk' - and a scan that truncates loses the
# whole receipt, not just its pictures. The receipt keeps the library;
# individual icons are redrawn on request from the item card.
ICON_LIB_PROMPT_CONTEXT = """
Available Icon Paths (Format: ICON_LIB_ITEM|MainCategory|SubCategory|ExactItemName):
ICON_LIB_ITEM|Food|Dairy|Milk, Yellow cheese, White cheese, Cottage cheese, Butter, Yogurts, Sour cream, Sweet cream, Plant-based milk
ICON_LIB_ITEM|Food|Eggs|Eggs
ICON_LIB_ITEM|Food|Meat|Minced beef, Beef steaks, Sausages, Pastrami, Tofu
ICON_LIB_ITEM|Food|Poultry|Chicken breast, Schnitzels
ICON_LIB_ITEM|Food|Fish|Salmon, Tuna, Tilapia
ICON_LIB_ITEM|Food|Vegetables|Tomatoes, Cucumbers, Peppers, Dry onion, Garlic, Potatoes, Carrots, Zucchini, Eggplants, Lettuce, Mushrooms
ICON_LIB_ITEM|Food|Fruits|Apples, Bananas, Oranges, Lemons, Watermelon, Grapes, Peaches, Strawberries, Berries
ICON_LIB_ITEM|Food|Pantry|Flour, White sugar, Brown sugar, Canola oil, Olive oil
ICON_LIB_ITEM|Food|Carbs|Rice, Pasta, Quinoa, Oats, Tortillas
ICON_LIB_ITEM|Food|Legumes|Lentils, Chickpeas, Beans
ICON_LIB_ITEM|Food|Spices|Salt, Black pepper, Paprika, Cumin, Turmeric, Cinnamon
ICON_LIB_ITEM|Food|Baking Goods|Baking powder, Cocoa powder, Chocolate chips
ICON_LIB_ITEM|Food|Sauces|Ketchup, Mayonnaise, Mustard, Soy sauce, Hot sauce
ICON_LIB_ITEM|Food|Spreads|Chocolate spread, Peanut butter, Honey
ICON_LIB_ITEM|Food|Canned Goods|Tuna, Corn, Peas, Baked beans, Olives, Pickles, Crushed tomatoes
ICON_LIB_ITEM|Food|Bread|Bread, Sliced bread, Rolls, Pita bread, Bagels
ICON_LIB_ITEM|Food|Pastries|Croissants, Rice cakes
ICON_LIB_ITEM|Food|Beverages|Black coffee, Instant coffee, Tea, Mineral water, Juices, Carbonated drinks
ICON_LIB_ITEM|Food|Snacks|Bamba, Bisli, Chips, Pretzels, Popcorn, Nuts
ICON_LIB_ITEM|Cleaning|General Cleaning|Floor cleaner, Bleach, Window cleaner, Toilet cleaner, Insect repellent
ICON_LIB_ITEM|Cleaning|Laundry|Laundry detergent, Fabric softener, Stain remover
ICON_LIB_ITEM|Cleaning|Dishwashing|Dish soap, Dishwasher tablets, Rinse aid
ICON_LIB_ITEM|Toiletries|Personal Hygiene|Shampoo, Body wash, Deodorant, Toothpaste, Toothbrushes, Razors, Feminine hygiene
ICON_LIB_ITEM|Toiletries|Paper Products|Toilet paper, Paper towels, Wet wipes, Tissues
ICON_LIB_ITEM|First Aid|First Aid Supplies|Pain relievers, Band-aids, Polydine, Thermometer
ICON_LIB_ITEM|Kitchenware|Pots|Saucepan, Medium pot, Large pot
ICON_LIB_ITEM|Kitchenware|Pans|Frying pan, Wok
ICON_LIB_ITEM|Kitchenware|Dinnerware|Dinner plates, Bowls, Glasses, Mugs
ICON_LIB_ITEM|Kitchenware|Cooking Accessories|Chef's knife, Cutting board, Spatula, Measuring cup
ICON_LIB_ITEM|Kitchenware|Storage|Plastic food container, Glass jar
ICON_LIB_ITEM|Kitchenware|Small Kitchen Appliances|Electric kettle, Pop-up toaster, Coffee maker
ICON_LIB_ITEM|Electronics|Computing|Laptop, Keyboard, Mouse, Printer
ICON_LIB_ITEM|Electronics|Major Appliances|Refrigerator, Freezer, Oven, Stove
ICON_LIB_ITEM|Clothing|Everyday Clothing|Short sleeve shirt, Pants, Jeans, Dresses, Sportswear, Suits
ICON_LIB_ITEM|Clothing|Footwear|Sneakers, Sandals, Boots
ICON_LIB_ITEM|Home Textiles|Bed Linens|Bed sheets, Duvets, Blankets
ICON_LIB_ITEM|Home Textiles|Bath Textiles|Bath towels, Hand towels
ICON_LIB_ITEM|Pet Supplies|Food|Dry pet food, Wet pet food
ICON_LIB_ITEM|Pet Supplies|Care|Leash, Collar, Litter box, Pet beds
ICON_LIB_ITEM|Baby Supplies|Feeding|Baby bottles, Baby purees
ICON_LIB_ITEM|Baby Supplies|Diapering|Disposable diapers, Cloth diapers
ICON_LIB_ITEM|Outdoor|Gardening Tools|Shovel, Pruning shears, Watering can, Garden hose
ICON_LIB_ITEM|Tools|Hand Tools|Hammer, Screwdriver, Pliers, Measuring tape, Utility knife
ICON_LIB_ITEM|Tools|Power Tools|Cordless drill, Electric sander
ICON_LIB_ITEM|Toys|Action Figures|Action figures, Dinosaurs
ICON_LIB_ITEM|Toys|Building Blocks|LEGO, Wooden blocks
ICON_LIB_ITEM|Toys|Vehicles|Toy cars, Remote control cars, Toy trains
ICON_LIB_ITEM|Toys|Arts|Play-Doh, Coloring books, Paint sets
"""

# [ADDED v2026.9.20] HOW TO DRAW AN ICON - written once, used twice.
#
# The inventory agent draws an icon while it is adding an item. The item
# card can also ask for one to be redrawn on its own, from a description the
# user typed. Two prompts, one set of drawing rules: a change to the grid or
# the shape list has to reach both, and two copies would not (RULE 33d).
#
# NO BRACES IN THIS TEXT. It is interpolated into an f-string that doubles
# its own literal braces, and inserted text is NOT re-processed - a brace
# here would arrive at the model as a brace and break the JSON example
# around it. The tool-shaped example stays with each caller for that reason.
ICON_DRAW_RULES = '   THE FIELD IS DRAWN ON A 0-120 GRID. 0,0 is the top left, 120,120 the\n   bottom right. Keep the drawing inside roughly 8..112 so nothing is clipped.\n\n   Shapes: circle (cx, cy, r) - ellipse (cx, cy, rx, ry) - rect (x, y, width,\n   height, rx) - line (x1, y1, x2, y2) - path (d) - polyline (points) -\n   polygon (points). "w" is the line thickness, 0.5 to 6; 2.5 to 3.5 reads\n   well. "fill" defaults to none, which is what you want for nearly\n   everything: these are OUTLINE drawings.\n\n   RULES THAT MAKE AN ICON WORK:\n   - DRAW THE THING ITSELF. A guitar is a body, a neck, a headstock and a\n     sound hole. Not a music note, not a box.\n   - AT MOST 28 SHAPES. Anything past that is dropped. An icon is read at\n     40px in a list and enlarged to 140px when the user taps it, so it needs\n     enough shapes to be recognisable and few enough not to turn into mud.\n   - OUTLINES, NOT BLOCKS. No background, no frame, no border, no plate. The\n     item floats on nothing.\n   - ONE COLOUR. The drawing takes the colour of the text beside it, so it\n     reads on a light theme and a dark one. Do not try to colour it.\n'


# [ADDED v2026.9.20] The one-item drawing prompt, for the AI button on the
# Change Icon window.
#
# This asks for a DRAWING and nothing else. It carries no tools, no
# locations, no categories and no ability to act: the only thing the model
# can return is a list of shapes, and ai_core.draw_spec rebuilds even that
# field by field before anything is stored (RULE 7, RULE 11).
#
# The description is the user's own words about their own item. It is still
# untrusted text going into a prompt, which is exactly why the ANSWER is
# constrained rather than the question: whatever the description talks the
# model into saying, the only thing that survives validation is numbers.
def get_icon_draw_prompt(item_name, description):
    return f"""You draw ONE icon for ONE household item. Nothing else.

THE ITEM: {item_name}
WHAT THE USER SAYS IT LOOKS LIKE: {description}

Draw the item the user described. If the description and the name disagree,
the description wins - it is the user correcting the name.

{ICON_DRAW_RULES}
   - Draw SOMETHING. This was asked for deliberately, so an empty list is
     not a useful answer. Draw the closest real object you can picture.

Return ONLY this JSON object and no other text, no markdown, no fence:
{{"shapes": [{{"t": "rect", "x": 40, "y": 30, "width": 40, "height": 60,
  "rx": 6, "w": 3}}, {{"t": "circle", "cx": 60, "cy": 44, "r": 4,
  "w": 2.5}}]}}
"""

def get_intent_resolve_prompt(hint_text, existing_locs_str, target_lang):
    return f"""{hint_text}

EXISTING LOCATIONS:
{existing_locs_str}

CRITICAL INSTRUCTIONS:
1. You MUST return ONLY a raw JSON object. NO markdown formatting, NO conversational text.
2. LANGUAGE RULE: The 'name' value inside the JSON MUST be written strictly in {target_lang}. NEVER translate the product name to English unless {target_lang} is English.
3. LOCATION MAPPING: You MUST assign the item to a logical physical location strictly by outputting the 'location_id' chosen from the EXISTING LOCATIONS above. Do NOT put categories like 'Food' or 'Dairy' into the location!

Output exactly this structure:
{{"intent": "add", "items": [{{"name": "<PRODUCT NAME>", "qty": 1, "location_id": "A1.1", "category": "<MainCat>", "sub_category": "<SubCat>", "icon_key": "<ICON_LIB_ITEM...>"}}]}}

Choose the most logical category, sub_category, and icon_key from this list:
{ICON_LIB_PROMPT_CONTEXT}"""

def get_intent_add_prompt(user_message, existing_locs_str, target_lang):
    return f"""User says: '{user_message}'
Determine if the user wants to ADD items, SEARCH for items, or COOK/prepare a recipe.

1. IF ADDING:
   Context for icons: {ICON_LIB_PROMPT_CONTEXT}
   EXISTING LOCATIONS:
{existing_locs_str}
   
   CRITICAL RULE: If the user asks to add an item to a broad location (e.g., "Fridge") BUT you see specific sub-locations/drawers in EXISTING LOCATIONS (like "Vegetable Drawer"), DO NOT add it yet!
   Instead, Return JSON: {{"intent": "clarify", "question": "I see several sub-locations. Where exactly should I place it? (Translate this question naturally to {target_lang})" }}
   
   Otherwise, Return JSON: {{"intent": "add", "items": [{{"name": "Item Name", "qty": 1, "location_id": "A1.1", "category": "MainCat", "sub_category": "SubCat", "icon_key": "ICON_LIB_ITEM|MainCat|SubCat|ExactItemName"}}]}}
   - LANGUAGE RULE: The 'name' value inside the JSON MUST be written strictly in {target_lang}.
   - LOCATION MAPPING CRITICAL: Assign the item to a physical location by selecting the exact ID from EXISTING LOCATIONS. Output the ID in 'location_id'.
   - Choose the closest icon_key. 'category' and 'sub_category' MUST exactly match the chosen icon_key.

2. IF SEARCHING (Where is my X?): 
   Return JSON: {{"intent": "search", "locations": ["loc1"], "keywords": ["item1"], "category_filter": ""}}
   - CRITICAL: Only extract physical item names as 'keywords'. 
   - IF no location is specified, set 'category_filter' to the best matching main category.

3. IF COOKING/RECIPE (How to make X? Guide me to cook Y? Continue cooking):
   Return JSON: {{"intent": "cook", "recipe_name": "Name of dish"}}

Return JSON ONLY. No markdown."""
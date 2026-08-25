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
# [MODIFIED v7.17.4 | 2026-03-26] Purpose: Core shared prompts, icons, and intent analysis templates. Cleaned from Hebrew to support universal {target_lang}.

ICON_PROMPT_CONTEXT = """
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
{ICON_PROMPT_CONTEXT}"""

def get_intent_add_prompt(user_message, existing_locs_str, target_lang):
    return f"""User says: '{user_message}'
Determine if the user wants to ADD items, SEARCH for items, or COOK/prepare a recipe.

1. IF ADDING:
   Context for icons: {ICON_PROMPT_CONTEXT}
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
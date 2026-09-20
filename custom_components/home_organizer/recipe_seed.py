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
# [ADDED v2026.9.17 | 2026-09-17] Two recipes per chapter, for a new install.
#
# WRITTEN ONCE, ON A BRAND NEW INSTALL, AND NEVER AGAIN.
#
# The caller checks that the recipes database FILE did not exist before it
# opened it. That is a stronger test than "the table is empty": someone who
# deletes every recipe they have must not find them all back after a restart,
# and someone who removes and reinstalls the integration keeps the database
# they had. Seeding is a first-run event, not a repair (RULE 5).
#
# ON THE CONTENT.
#
# These are standard formulations written for this project - the proportions
# and methods that a cook would recognise as the usual way to make each dish.
# They are not transcribed from any website, book or publication, because
# shipping somebody else's text inside a GPLv3 integration is a licensing
# problem regardless of how good the recipe is.
#
# The two pizzas follow the published Associazione Verace Pizza Napoletana
# specification for the Neapolitan (hydration, no oil in the dough, a very hot
# oven and a short bake) and normal American practice for the other (oil and
# sugar in the dough, a tin, a longer bake at a lower temperature). They are
# deliberately the first pair here: they are the clearest example of two
# dishes with the same name that are not the same dish at all.
#
# [FIXED v2026.9.17] ONE DELIBERATE DEPARTURE FROM THE AVPN TEXT: THE SALT.
#
# The specification dissolves the salt in the water first, then adds 10% of
# the flour, then the yeast. That works at its own scale - the salt is spread
# through a litre of water before the yeast ever meets it. In a home batch
# mixed in a bowl it is a trap: the salt reaches the yeast concentrated and
# slows it, and the long cold prove these doughs depend on never arrives.
#
# So the salt goes in last here, which is what every baker actually does. The
# result is the same dough; the order is the one that survives a kitchen.
#
# Quantities are written the way a person writes them - "2 tbsp", "about 45
# minutes" - because prep_time is TEXT for exactly that reason and a recipe
# that says "1.75 units of flour" helps nobody.

# [FIXED v2026.9.17] Chapter KEYS, not names.
#
# These were the English chapter names. A category is stored as written, and
# the panel built its own chapter list from the TRANSLATED names - so a
# Hebrew panel showed ten empty Hebrew chapters beside the English ones that
# actually held these recipes. The same shelf twice, in two languages.
#
# A "cat_" key is a built-in chapter and is translated when it is drawn, so a
# seeded recipe lands on the SAME shelf in every language. Only "Pizza" is a
# plain name, because there is no built-in pizza chapter - it is a chapter
# these recipes create, and it reads the same in any language anyway.
CAT_PIZZA = "Pizza"
CAT_MEAT = "cat_meat"
CAT_POULTRY = "cat_poultry"
CAT_FISH = "cat_fish"
CAT_SOUPS = "cat_soups"
CAT_SALADS = "cat_salads"
CAT_PASTA = "cat_pasta"
CAT_VEG = "cat_vegetarian"
CAT_BAKING = "cat_baking"
CAT_DESSERTS = "cat_desserts"
CAT_DRINKS = "cat_drinks"

SEED_CATEGORIES = [
    CAT_PIZZA, CAT_MEAT, CAT_POULTRY, CAT_FISH, CAT_SOUPS, CAT_SALADS,
    CAT_PASTA, CAT_VEG, CAT_BAKING, CAT_DESSERTS, CAT_DRINKS,
]

# name, category, prep_time, [(ingredient, quantity)], [steps]
DEFAULT_RECIPES = [

    # ---------------------------------------------------------------- pizza
    ("Neapolitan Pizza", CAT_PIZZA, "24 hours rising, 90 seconds baking", [
        ("Type 00 flour", "1 kg"), ("Water", "600 ml"), ("Fine sea salt", "25 g"),
        ("Fresh yeast", "2 g"), ("San Marzano tomatoes", "400 g"),
        ("Fresh mozzarella (fior di latte)", "400 g"),
        ("Fresh basil", "a few leaves"),
        ("Extra virgin olive oil", "to finish"),
    ], [
        "Use water at 18C to 20C. Warm water makes the dough run away from you over a long prove.",
        "Crumble the yeast into the water and stir until it disappears.",
        "Add the flour a third at a time, mixing until there is no dry flour left. The dough will look rough.",
        "Rest it 20 minutes, covered. The flour hydrates on its own and saves you several minutes of kneading.",
        "NOW add the salt, sprinkled over the surface, and knead it in. Salt goes in last: on top of the yeast it slows it down, and in a home-sized batch there is no large volume of water to dilute it first.",
        "Knead 10 to 15 minutes until smooth. It is ready when a piece stretched between your fingers goes thin enough to see light through before it tears.",
        "Cover and rest 2 hours at room temperature.",
        "Divide into 6 balls of about 270 g. Keep them covered and let them prove 8 to 24 hours - longer is better.",
        "Heat the oven as hot as it goes with a stone or steel inside, at least 250C, for a full hour.",
        "Crush the tomatoes by hand, season with a pinch of salt. Do not cook them.",
        "Tear the mozzarella and let it drain for 20 minutes, or the pizza will flood.",
        "Open a ball by hand from the centre outwards, leaving a 2 cm rim untouched. Never use a rolling pin - it crushes the gas out of the rim.",
        "Spread a thin layer of tomato, add mozzarella and a few basil leaves.",
        "Bake 60 to 90 seconds in a wood oven, or 5 to 7 minutes at 250C to 300C at home.",
        "Finish with a thread of olive oil and eat it immediately.",
    ]),

    ("American Pan Pizza", CAT_PIZZA, "2 hours plus 20 minutes baking", [
        ("Bread flour", "500 g"), ("Warm water", "325 ml"),
        ("Olive oil", "3 tbsp"), ("Sugar", "1 tsp"), ("Salt", "10 g"),
        ("Instant yeast", "7 g"), ("Tomato passata", "300 g"),
        ("Dried oregano", "1 tsp"), ("Low moisture mozzarella", "350 g"),
        ("Pepperoni or toppings", "to taste"),
    ], [
        "Whisk the yeast and sugar into the warm water (about 35C) and leave 5 minutes until it foams. If it does not foam, the yeast is dead - start again rather than waste the flour.",
        "Add the flour and 2 tbsp of the oil and mix to a shaggy dough.",
        "Add the salt now, not with the yeast, and knead it in.",
        "Knead 8 minutes until smooth. It should be soft and just tacky, not sticky.",
        "Cover and rise 1 hour, until doubled.",
        "Oil a deep pan generously with the rest of the oil - this is what fries the base crisp.",
        "Press the dough to the edges of the pan, cover and rest another 45 minutes.",
        "Heat the oven to 220C.",
        "Simmer the passata with the oregano and a pinch of salt for 10 minutes, then cool.",
        "Spread the sauce, then the cheese, then the toppings.",
        "Bake 18 to 22 minutes, until the cheese is bubbling and the edges are deep brown.",
        "Let it stand 5 minutes before cutting, or the cheese slides off.",
    ]),

    # ----------------------------------------------------------------- meat
    ("Slow Braised Beef Stew", CAT_MEAT, "about 3 hours", [
        ("Beef chuck, in 4 cm cubes", "1.2 kg"), ("Onions, sliced", "2 large"),
        ("Carrots, in chunks", "3"), ("Garlic cloves", "4"),
        ("Tomato paste", "2 tbsp"), ("Red wine", "250 ml"),
        ("Beef stock", "750 ml"), ("Bay leaves", "2"),
        ("Thyme", "a few sprigs"), ("Flour", "2 tbsp"),
        ("Oil, salt and pepper", "to taste"),
    ], [
        "Pat the beef dry and season it well. Dry meat browns; wet meat steams.",
        "Brown the cubes in batches in a hot heavy pot. Crowding the pan is the usual mistake.",
        "Set the meat aside. Soften the onions in the same pot for 8 minutes.",
        "Add the garlic and tomato paste and cook 2 minutes until it darkens.",
        "Stir in the flour, then pour in the wine and scrape the base clean.",
        "Return the meat, add the stock, bay and thyme. It should be barely covered.",
        "Bring to a bare simmer, cover, and cook 2.5 hours at low heat or at 160C in the oven.",
        "Add the carrots for the last 45 minutes.",
        "Check the seasoning. The sauce should coat a spoon; if it is thin, reduce it uncovered.",
    ]),

    ("Classic Meatballs in Tomato Sauce", CAT_MEAT, "about 1 hour", [
        ("Ground beef", "500 g"), ("Ground pork or veal", "250 g"),
        ("Breadcrumbs", "60 g"), ("Milk", "80 ml"), ("Egg", "1"),
        ("Grated parmesan", "40 g"), ("Garlic, minced", "2 cloves"),
        ("Parsley, chopped", "3 tbsp"), ("Crushed tomatoes", "800 g"),
        ("Onion, diced", "1"), ("Olive oil, salt and pepper", "to taste"),
    ], [
        "Soak the breadcrumbs in the milk for 5 minutes. This is what keeps the meatballs tender.",
        "Mix the meats, soaked crumbs, egg, parmesan, garlic, parsley, salt and pepper with your hands until just combined. Overworking makes them tough.",
        "Roll into balls of about 40 g and chill 15 minutes so they hold together.",
        "Brown them in olive oil on all sides, then lift them out. They do not need to be cooked through yet.",
        "Soften the onion in the same pan, add the tomatoes and a pinch of salt.",
        "Return the meatballs, cover, and simmer gently 25 to 30 minutes.",
        "Taste for salt and finish with more parsley.",
    ]),

    # -------------------------------------------------------------- poultry
    ("Roast Chicken with Lemon and Herbs", CAT_POULTRY, "about 1 hour 40 minutes", [
        ("Whole chicken", "1.6 kg"), ("Lemon", "1"), ("Garlic head", "1"),
        ("Butter, softened", "50 g"), ("Thyme and rosemary", "a few sprigs"),
        ("Olive oil", "2 tbsp"), ("Salt and pepper", "to taste"),
    ], [
        "Salt the chicken all over and leave it uncovered in the fridge for a few hours if you can - dry skin is crisp skin.",
        "Take it out 45 minutes before cooking so it is not fridge cold.",
        "Heat the oven to 200C.",
        "Work the butter under the breast skin along with a little thyme.",
        "Halve the lemon and the garlic head and put them inside the cavity with the rest of the herbs.",
        "Rub the outside with oil, season, and tie the legs together.",
        "Roast 70 to 80 minutes, until the juices from the thigh run clear and the thickest part reads 74C.",
        "Rest 15 minutes before carving. Skipping the rest is how the juice ends up on the board instead of in the meat.",
    ]),

    ("Chicken Schnitzel", CAT_POULTRY, "about 30 minutes", [
        ("Chicken breasts", "4"), ("Flour", "100 g"), ("Eggs", "2"),
        ("Breadcrumbs", "150 g"), ("Paprika", "1 tsp"),
        ("Oil for frying", "enough for 1 cm depth"),
        ("Lemon wedges", "to serve"), ("Salt and pepper", "to taste"),
    ], [
        "Butterfly each breast and pound it to an even 1 cm. Even thickness matters more than thinness.",
        "Season the flour with salt, pepper and the paprika.",
        "Set out three plates: flour, beaten egg, breadcrumbs.",
        "Coat each piece in flour, then egg, then crumbs. Press the crumbs on firmly.",
        "Rest the coated pieces 10 minutes so the coating sets and does not slide off in the pan.",
        "Heat the oil to about 170C - a crumb should sizzle briskly, not violently.",
        "Fry 3 to 4 minutes a side until deep golden. Do not crowd the pan.",
        "Drain on a rack, not on paper, so the underside stays crisp. Serve with lemon.",
    ]),

    # ----------------------------------------------------------------- fish
    ("Oven Baked Salmon with Herbs", CAT_FISH, "about 25 minutes", [
        ("Salmon fillets, skin on", "4 x 180 g"), ("Lemon", "1"),
        ("Olive oil", "2 tbsp"), ("Garlic, minced", "2 cloves"),
        ("Dill, chopped", "2 tbsp"), ("Salt and pepper", "to taste"),
    ], [
        "Heat the oven to 200C and take the fish out of the fridge 15 minutes ahead.",
        "Pat the fillets very dry and season both sides.",
        "Mix the oil, garlic, dill and the zest of the lemon, and spread it over the flesh.",
        "Bake 12 to 15 minutes, skin down. It is done when the thickest part flakes but is still coral in the middle - 50C to 52C.",
        "Squeeze over the lemon and serve. Salmon carries on cooking off the heat, so pull it early rather than late.",
    ]),

    ("Mediterranean Fish Soup", CAT_FISH, "about 50 minutes", [
        ("White fish fillets, in chunks", "700 g"), ("Shrimp, peeled", "200 g"),
        ("Onion, diced", "1"), ("Fennel bulb, sliced", "1"),
        ("Garlic cloves", "3"), ("Chopped tomatoes", "400 g"),
        ("Fish stock", "1 litre"), ("Dry white wine", "150 ml"),
        ("Saffron", "a pinch"), ("Olive oil, salt and pepper", "to taste"),
    ], [
        "Soften the onion and fennel in olive oil for 10 minutes without colouring them.",
        "Add the garlic and cook 1 minute more.",
        "Pour in the wine and let it reduce by half.",
        "Add the tomatoes, stock and saffron. Simmer 20 minutes so the base has flavour of its own.",
        "Season the broth properly now - you cannot fix it once the fish is in.",
        "Add the fish and simmer 4 minutes, then the shrimp for 2 minutes more.",
        "Take it off the heat as soon as the shrimp turn pink. Fish soup is ruined by boiling.",
    ]),

    # ---------------------------------------------------------------- soups
    ("Chicken Soup with Vegetables", CAT_SOUPS, "about 2 hours", [
        ("Chicken, whole or pieces", "1.5 kg"), ("Onion, halved", "1"),
        ("Carrots", "3"), ("Celery stalks", "3"), ("Parsnip", "1"),
        ("Bay leaves", "2"), ("Black peppercorns", "8"),
        ("Dill and parsley", "a small bunch"), ("Salt", "to taste"),
    ], [
        "Put the chicken in a large pot and cover with cold water by 5 cm. Starting cold draws out more flavour.",
        "Bring slowly to a simmer and skim the grey foam off for the first 10 minutes.",
        "Add the vegetables whole or in large pieces, the bay and the peppercorns.",
        "Simmer very gently, uncovered, for 90 minutes. It should barely move - a rolling boil makes the broth cloudy.",
        "Lift out the chicken, pull the meat from the bones and return it to the pot.",
        "Salt at the end, once the broth has reduced to its final strength.",
        "Add the herbs off the heat.",
    ]),

    ("Roasted Tomato Soup", CAT_SOUPS, "about 1 hour", [
        ("Ripe tomatoes, halved", "1.5 kg"), ("Onion, quartered", "1"),
        ("Garlic cloves", "6"), ("Olive oil", "3 tbsp"),
        ("Vegetable stock", "500 ml"), ("Basil leaves", "a handful"),
        ("Cream", "100 ml, optional"), ("Salt, pepper and sugar", "to taste"),
    ], [
        "Heat the oven to 200C.",
        "Toss the tomatoes, onion and unpeeled garlic with the oil and plenty of salt.",
        "Roast 35 to 40 minutes, until the edges char. The colour is the flavour - do not pull them early.",
        "Squeeze the garlic out of its skins and put everything in a pot with the stock.",
        "Simmer 10 minutes, then blend until smooth.",
        "Add the basil, and cream if you want it round rather than sharp.",
        "Taste. A pinch of sugar balances tomatoes that were not quite ripe.",
    ]),

    # --------------------------------------------------------------- salads
    ("Greek Salad", CAT_SALADS, "about 15 minutes", [
        ("Ripe tomatoes, in wedges", "4"), ("Cucumber, thickly sliced", "1"),
        ("Red onion, thinly sliced", "1/2"), ("Green pepper, sliced", "1"),
        ("Kalamata olives", "100 g"), ("Feta, in a slab", "200 g"),
        ("Extra virgin olive oil", "4 tbsp"), ("Dried oregano", "1 tsp"),
        ("Red wine vinegar", "1 tbsp"), ("Salt", "to taste"),
    ], [
        "Cut the vegetables in large, confident pieces. A Greek salad is not a fine dice.",
        "Salt the tomatoes and leave them 5 minutes - the juice they release is part of the dressing.",
        "Combine the vegetables and olives in a wide bowl.",
        "Lay the feta on top in one piece, the way it is served in Greece.",
        "Pour over the oil and vinegar, scatter the oregano over the cheese.",
        "Do not toss. Serve with bread for the juices.",
    ]),

    ("Tabbouleh", CAT_SALADS, "about 30 minutes", [
        ("Fine bulgur", "60 g"), ("Flat leaf parsley", "3 large bunches"),
        ("Mint leaves", "1 small bunch"), ("Tomatoes, finely diced", "4"),
        ("Spring onions, sliced", "4"), ("Lemon juice", "80 ml"),
        ("Extra virgin olive oil", "80 ml"), ("Salt and pepper", "to taste"),
    ], [
        "Rinse the bulgur and soak it in the lemon juice for 15 minutes. It does not need hot water.",
        "Wash and dry the parsley completely. Wet herbs make a wet salad.",
        "Chop the parsley and mint finely with a sharp knife - a blunt one bruises them black.",
        "This is a herb salad with grain in it, not the other way round. The parsley should dominate.",
        "Combine everything, season, and dress with the oil.",
        "Let it sit 10 minutes before serving so the bulgur softens fully.",
    ]),

    # ------------------------------------------------------------ pasta and rice
    ("Spaghetti Aglio e Olio", CAT_PASTA, "about 20 minutes", [
        ("Spaghetti", "400 g"), ("Garlic, thinly sliced", "6 cloves"),
        ("Extra virgin olive oil", "120 ml"),
        ("Dried chilli flakes", "1 tsp"), ("Parsley, chopped", "4 tbsp"),
        ("Salt", "to taste"),
    ], [
        "Boil the pasta in well salted water - it should taste of the sea.",
        "While it cooks, warm the oil with the garlic over LOW heat. It must turn pale gold, never brown; burnt garlic is bitter and cannot be saved.",
        "Add the chilli in the last 30 seconds.",
        "Reserve a cup of the pasta water before draining.",
        "Drain the pasta 2 minutes early and finish it in the pan with a splash of the water.",
        "Toss hard for a minute - the starch and oil emulsify into a sauce. That tossing is the whole dish.",
        "Off the heat, add the parsley and serve at once.",
    ]),

    ("Mushroom Risotto", CAT_PASTA, "about 40 minutes", [
        ("Arborio or carnaroli rice", "320 g"),
        ("Mixed mushrooms, sliced", "400 g"), ("Onion, finely diced", "1"),
        ("Dry white wine", "120 ml"), ("Hot vegetable stock", "1.2 litres"),
        ("Butter", "60 g"), ("Grated parmesan", "60 g"),
        ("Olive oil, salt and pepper", "to taste"),
    ], [
        "Keep the stock at a bare simmer in a separate pan. Cold stock stops the cooking every time you add it.",
        "Fry the mushrooms hard in olive oil until browned, season, and set aside.",
        "Soften the onion in half the butter without colouring it.",
        "Add the rice and toast it 2 minutes until the grains look glassy at the edges.",
        "Pour in the wine and stir until it has gone.",
        "Add stock a ladle at a time, stirring, waiting until each is absorbed. This takes about 18 minutes.",
        "Stop when the rice is tender with a little resistance in the centre.",
        "Off the heat, beat in the rest of the butter, the parmesan and the mushrooms. Cover 2 minutes, then serve loose, not stiff.",
    ]),

    # ------------------------------------------------------------ vegetarian
    ("Shakshuka", CAT_VEG, "about 35 minutes", [
        ("Eggs", "6"), ("Chopped tomatoes", "800 g"),
        ("Red peppers, sliced", "2"), ("Onion, sliced", "1"),
        ("Garlic cloves", "4"), ("Sweet paprika", "1 tsp"),
        ("Ground cumin", "1 tsp"), ("Chilli flakes", "1/2 tsp"),
        ("Olive oil, salt and pepper", "to taste"),
        ("Parsley or coriander", "to finish"),
    ], [
        "Soften the onion and peppers in olive oil for 10 minutes until sweet.",
        "Add the garlic and spices and fry 1 minute until fragrant.",
        "Add the tomatoes and simmer 15 minutes, until thick enough to hold a spoon trail.",
        "Season the sauce fully now.",
        "Make wells with the back of a spoon and crack an egg into each.",
        "Cover and cook 6 to 8 minutes on low, until the whites are set and the yolks still soft.",
        "Scatter the herbs over and bring the pan to the table.",
    ]),

    ("Lentil and Vegetable Curry", CAT_VEG, "about 45 minutes", [
        ("Red lentils, rinsed", "300 g"), ("Onion, diced", "1"),
        ("Garlic cloves", "3"), ("Ginger, grated", "1 tbsp"),
        ("Curry powder", "2 tbsp"), ("Turmeric", "1 tsp"),
        ("Chopped tomatoes", "400 g"), ("Coconut milk", "400 ml"),
        ("Vegetable stock", "500 ml"), ("Spinach", "150 g"),
        ("Oil, salt and lemon", "to taste"),
    ], [
        "Fry the onion in oil until golden, about 8 minutes.",
        "Add the garlic, ginger and the dry spices. Fry 1 minute - the spices need oil and heat to open up.",
        "Add the tomatoes and cook 5 minutes until they darken.",
        "Add the lentils, stock and coconut milk.",
        "Simmer 25 minutes, stirring now and then so the lentils do not catch on the base.",
        "Stir the spinach through at the end until it wilts.",
        "Season, and finish with lemon juice. Lentils are flat without acid.",
    ]),

    # ----------------------------------------------------------- baking
    ("Classic Chocolate Cake", CAT_BAKING, "about 1 hour 15 minutes", [
        ("Flour", "260 g"), ("Cocoa powder", "75 g"), ("Sugar", "400 g"),
        ("Baking soda", "1.5 tsp"), ("Baking powder", "1.5 tsp"),
        ("Salt", "1 tsp"), ("Eggs", "2"), ("Milk", "240 ml"),
        ("Vegetable oil", "120 ml"), ("Vanilla extract", "2 tsp"),
        ("Boiling water or hot coffee", "240 ml"),
    ], [
        "Heat the oven to 175C and line two 20 cm tins.",
        "Whisk all the dry ingredients together thoroughly.",
        "Add the eggs, milk, oil and vanilla and beat 2 minutes.",
        "Stir in the boiling water last. The batter will be very thin - that is correct, and it is what makes the crumb moist.",
        "Divide between the tins and bake 30 to 35 minutes, until a skewer comes out with a few damp crumbs.",
        "Cool 10 minutes in the tins, then turn out onto a rack. Turning out too early breaks the cake.",
    ]),

    ("Country Sourdough Bread", CAT_BAKING, "about 24 hours", [
        ("Bread flour", "450 g"), ("Whole wheat flour", "50 g"),
        ("Water", "350 ml"), ("Active sourdough starter", "100 g"),
        ("Salt", "10 g"),
    ], [
        "Mix the flours with 325 ml of the water and rest 45 minutes. This autolyse makes the dough easier to handle later.",
        "Add the starter and work it in, then the salt with the last 25 ml of water.",
        "Over the next 3 hours, do a set of stretch and folds every 30 minutes - lift one side, fold it over, turn the bowl.",
        "Let the dough rise until it is about 50% bigger and shows bubbles at the edges. Watch the dough, not the clock.",
        "Shape it into a tight round and place it seam up in a floured banneton.",
        "Cold prove in the fridge 12 to 16 hours.",
        "Heat a covered pot at 250C for 45 minutes.",
        "Score the loaf and bake 20 minutes covered, then 20 to 25 minutes uncovered, until deep brown.",
        "Cool completely before cutting. Cutting a hot loaf gums the crumb.",
    ]),

    # -------------------------------------------------------------- desserts
    ("No Churn Vanilla Ice Cream", CAT_DESSERTS, "20 minutes plus 6 hours freezing", [
        ("Heavy cream, cold", "500 ml"),
        ("Sweetened condensed milk", "400 g"),
        ("Vanilla extract", "2 tsp"), ("Salt", "a pinch"),
    ], [
        "Whip the cream to firm peaks. Cold cream and a cold bowl whip faster and hold better.",
        "Mix the condensed milk, vanilla and salt in a separate bowl.",
        "Fold a third of the cream in to loosen the mixture, then fold in the rest gently.",
        "Stop as soon as it is combined - beating out the air is what makes it icy.",
        "Freeze in a covered container at least 6 hours.",
        "Move it to the fridge 10 minutes before scooping.",
    ]),

    ("Baked Cheesecake", CAT_DESSERTS, "about 1 hour 30 minutes plus chilling", [
        ("Digestive biscuits, crushed", "250 g"), ("Butter, melted", "100 g"),
        ("Cream cheese, room temperature", "900 g"), ("Sugar", "200 g"),
        ("Eggs", "4"), ("Sour cream", "200 g"),
        ("Vanilla extract", "2 tsp"), ("Lemon juice", "1 tbsp"),
    ], [
        "Heat the oven to 160C.",
        "Mix the crushed biscuits with the butter, press into a 23 cm springform tin and chill.",
        "Beat the cream cheese and sugar until smooth. Lumps now will still be lumps later, and cold cheese will not smooth out.",
        "Add the eggs one at a time on low speed. Beating air in here is what cracks the top.",
        "Stir in the sour cream, vanilla and lemon juice.",
        "Pour over the base and bake 55 to 65 minutes. The edge should be set and the centre should still wobble.",
        "Turn the oven off, open the door a crack and leave it an hour. Sudden cooling cracks it.",
        "Chill at least 6 hours, ideally overnight.",
    ]),

    # ---------------------------------------------------------------- drinks
    ("Fresh Lemonade", CAT_DRINKS, "about 15 minutes", [
        ("Lemons", "6"), ("Sugar", "150 g"), ("Water", "1 litre"),
        ("Mint", "a few sprigs"), ("Ice", "to serve"),
    ], [
        "Heat 200 ml of the water with the sugar until it dissolves, then cool it. Sugar will not dissolve properly in cold liquid.",
        "Juice the lemons - you want about 250 ml.",
        "Combine the syrup, juice and the rest of the water.",
        "Taste and adjust. Lemons vary far more than recipes admit.",
        "Chill thoroughly, and add the mint and ice only when serving.",
    ]),

    ("Mint Iced Tea", CAT_DRINKS, "15 minutes plus chilling", [
        ("Black tea bags", "4"), ("Boiling water", "1 litre"),
        ("Fresh mint", "a large handful"), ("Honey or sugar", "to taste"),
        ("Lemon slices", "to serve"),
    ], [
        "Steep the tea in the boiling water for 4 minutes and no longer. Over-steeped tea turns bitter once it is cold.",
        "Take the bags out without squeezing them.",
        "Add the mint to the hot tea and let it infuse as everything cools.",
        "Sweeten while it is still warm, so it dissolves.",
        "Chill at least 2 hours and serve over ice with lemon.",
    ]),
]

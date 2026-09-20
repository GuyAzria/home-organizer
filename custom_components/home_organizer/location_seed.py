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
# [ADDED v2026.9.17 | 2026-09-17] A place to put things, on a new install.
#
# WRITTEN ONCE, ON A BRAND NEW INSTALL, AND NEVER AGAIN.
#
# The caller checks that the database FILE did not exist before it opened it.
# That is deliberately stricter than "the items table is empty": someone who
# has cleared their inventory must not find these folders back after a
# restart, and someone who removes and reinstalls the integration keeps the
# database they had (RULE 5).
#
# WHY AN EMPTY PANEL IS A PROBLEM WORTH SOLVING.
#
# On a fresh install there is nowhere to put anything, and the first thing a
# new user meets is a screen with no structure and no clue what the levels
# are for. One worked example - a floor, a room, an appliance, and the
# shelves inside it - shows the shape of the thing in a way no help text
# does. It is also the arrangement most people actually need first, because
# the fridge is where stock changes fastest.
#
# HOW A FOLDER IS STORED.
#
# There is no folders table. A folder is a row in `items` with
# type='folder_marker', whose level_1..level_N columns spell out its path and
# whose level_(N+1) holds its own name. This mirrors exactly what services.py
# writes when the user creates a folder in the panel, so a seeded folder is
# indistinguishable from one made by hand - it can be renamed, moved, given
# an image or deleted like any other.
#
# English on purpose: the panel's own language can change at any time, while
# these names are stored data and do not follow it.

# (path to the parent, folder name)
DEFAULT_LOCATIONS = [
    ([], "Floor A"),
    (["Floor A"], "Kitchen"),
    (["Floor A", "Kitchen"], "Fridge"),
    (["Floor A", "Kitchen", "Fridge"], "Top Shelf"),
    (["Floor A", "Kitchen", "Fridge"], "Middle Shelf"),
    (["Floor A", "Kitchen", "Fridge"], "Bottom Shelf"),
    (["Floor A", "Kitchen", "Fridge"], "Door"),
    (["Floor A", "Kitchen", "Fridge"], "Freezer"),
]


def build_folder_row(parent_path, name):
    """Return (columns, values) for one folder row.

    Kept here rather than written inline by the caller so the shape stays in
    one place. It matches the INSERT in services.py handle_add_item for
    item_type='folder': the "[Folder] " prefix on the name, the
    'folder_marker' type, and the path spread across level_1.. onwards.
    """
    columns = ["name", "type", "quantity"]
    values = [f"[Folder] {name}", "folder_marker", 0]
    for index, part in enumerate(parent_path):
        columns.append(f"level_{index + 1}")
        values.append(part)
    columns.append(f"level_{len(parent_path) + 1}")
    values.append(name)
    return columns, values

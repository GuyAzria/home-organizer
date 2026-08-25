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
# // [v9.0.0 | 2026-04-13] Purpose: Backward compatibility shim for __init__.py
# // which imports get_barcode_prompt and get_invoice_prompt from this module
# // for the barcode-scan and invoice-OCR flows. The real implementations now
# // live inside agents/inventory_agent.py to keep "all inventory prompts in
# // one place". Do NOT add new logic here.

from .agents.inventory_agent import (
    get_barcode_prompt,
    get_invoice_prompt,
    get_agent_prompt,
    get_search_prompt,
)

__all__ = [
    "get_barcode_prompt",
    "get_invoice_prompt",
    "get_agent_prompt",
    "get_search_prompt",
]

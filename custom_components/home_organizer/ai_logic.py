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
# // [v9.0.0 | 2026-04-13] Purpose: Backward compatibility shim. The real
# // implementation now lives in ai_core/ and agents/. This file exists only
# // so that existing imports in __init__.py and conversation.py keep working
# // with zero changes. Do NOT add new logic here.

from .ai_core.router import async_smart_router, safe_smart_router
from .ai_core.dispatcher import (
    async_universal_agent_loop,
    safe_universal_agent_loop,
    determine_explicit_domain,
)

__all__ = [
    "async_smart_router",
    "safe_smart_router",
    "async_universal_agent_loop",
    "safe_universal_agent_loop",
    "determine_explicit_domain",
]

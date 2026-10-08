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
# //
# // [MODIFIED v2026.10.6 | 2026-10-06] Purpose: FallbackMockEntry joins the
# // re-exports. The barcode AI source needs to force LOCAL routing for
# // hybrid's second attempt, and that class is how the router already does it
# // after a cloud failure. A re-export is not new logic, and one import path
# // means the test harness replaces this module and gets everything
# // (RULE 33d).

# FallbackMockEntry is re-exported, not reimplemented: it is how the router
# itself forces LOCAL routing after a cloud failure, and the barcode AI source
# needs the same thing to try both routes in hybrid mode. A re-export is not
# new logic, and keeping one import path means the test harness replaces this
# module and gets everything.
from .ai_core.router import (
    async_smart_router,
    safe_smart_router,
    FallbackMockEntry,
)
from .ai_core.dispatcher import (
    async_universal_agent_loop,
    safe_universal_agent_loop,
    determine_explicit_domain,
)

__all__ = [
    "async_smart_router",
    "safe_smart_router",
    "FallbackMockEntry",
    "async_universal_agent_loop",
    "safe_universal_agent_loop",
    "determine_explicit_domain",
]

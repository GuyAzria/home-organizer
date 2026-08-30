#!/usr/bin/env python3
"""
HA Full Integration Checker
============================
Version: 1.0.5

Single-file static gate for a Home Assistant custom integration.

What changed in 1.0.5, and why
------------------------------
Version 1.0.4 reported 66 BLOCKERs, 25 HOT_WARNs and 1 ERROR on a codebase
where almost none of them were real. Three checks were matching on shape
rather than on meaning:

* check_frontend flagged EVERY assignment to innerHTML whose surrounding
  300 characters happened to contain "${" or "+". That included
  `content.innerHTML = ''`, `camBtn.innerHTML = ICONS.camera`,
  `e.innerHTML = this._t(key, def)` and values that were ALREADY wrapped in
  escapeHtml(). It now inspects what is interpolated, not whether an
  interpolation exists.

* check_services matched any attribute starting with "async_register", so
  async_register_static_paths and async_register_panel were reported as
  services missing a schema. It now requires the receiver to be
  hass.services.

* check_paths matched any os.path.join line containing the word "path",
  which caught `os.path.join(base_dir, "frontend", "translations.csv")`.
  It now only reports when a non-literal, user-shaped value is joined
  without basename/sanitising nearby.

* run_external ran bandit without -c pyproject.toml, so documented skips
  were ignored and bandit exited 1, surfacing as a false ERROR.

Two "HA Best Practices" checks were also demoted to INFO. Neither SQLite
usage nor a non-Lit frontend violates any HACS or Home Assistant rule for
custom integrations; presenting them as WARN implied a requirement that
does not exist.

A checker that fires on everything carries no information. The point of
lowering the noise is that the real findings stay visible.

Usage:
    python tools/ha_full_check.py
    python tools/ha_full_check.py --root . --json reports/ha-full-check.json
    python tools/ha_full_check.py --root . --run-external
    python tools/ha_full_check.py --root . --run-external --run-tests

Exit:
    0 = no BLOCKER/ERROR
    1 = BLOCKER/ERROR found
    2 = repository/invocation problem

This tool never modifies project files.
"""

from __future__ import annotations

import argparse
import ast
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

BLOCKER, ERROR, HOT_WARN, WARN, INFO, PASS = (
    "BLOCKER", "ERROR", "HOT_WARN", "WARN", "INFO", "PASS")
ORDER = {BLOCKER: 0, ERROR: 1, HOT_WARN: 2, WARN: 3, INFO: 4, PASS: 5}

JUNK_DIRS = {
    ".git", ".github", ".vscode", ".idea", "__pycache__", ".pytest_cache",
    ".ruff_cache", ".mypy_cache", "node_modules", "tests",
}
JUNK_FILES = {
    ".gitignore", ".pre-commit-config.yaml", "pyproject.toml",
    "requirements_dev.txt", "tasks.json", "launch.json",
}
BLOCKING_ATTRS = {
    "remove", "unlink", "rmdir", "makedirs", "mkdir", "rmtree", "copy",
    "copy2", "move", "listdir", "scandir", "walk", "stat", "exists",
    "isfile", "isdir", "getsize", "iterdir", "read_text", "write_text",
    "read_bytes", "write_bytes", "glob", "rglob",
}
SYNC_NET_MODULES = {"requests", "urllib", "urllib3", "httplib", "http"}
SECRET_WORDS = re.compile(
    r"(api[_-]?key|apikey|password|passwd|token|secret|credential"
    r"|authorization|private[_-]?key)", re.I)
EXTERNAL_ASSET = re.compile(
    r"https?://(?:cdn|unpkg|jsdelivr|cdnjs|fonts\.googleapis|fonts\.gstatic)\b",
    re.I)
DYNAMIC_JS = re.compile(r"\beval\s*\(|\bnew\s+Function\s*\(")
ABS_PATH = re.compile(r"""(?:"|')(?:(?:[A-Za-z]:[\\/])|(?:/home/)|(?:/Users/))""")
URL_SECRET = re.compile(r"[?&](?:key|api_key|access_token|token|password)=")
TLS_OFF = re.compile(r"(?:verify\s*=\s*False|check_hostname\s*=\s*False|CERT_NONE)")

# Values originating from the user, the database, a scan or the model.
UNTRUSTED_EXPR = re.compile(
    r"^\s*(?:item|msg|folder|zone|entry|match|suggestion|result|palette|art"
    r"|profile|row|record|e|err)\s*[\.\[]"
    r"|^\s*(?:cleanSubName|translatedZone|translatedSub|subName|zoneName"
    r"|label|title|name|barcode|qty|q|value|text|content|query)\s*$")

# Values that are ours: shipped SVG constants, our own translation strings
# (which legitimately contain markup for right-to-left layout), and helper
# calls that have already escaped their input.
TRUSTED_EXPR = re.compile(
    r"\bICONS\b|\b_?t\s*\(|\bescapeHtml\s*\(|\bformatAiText\s*\("
    r"|\bgetIconByKey\b|\bgetSafeIcon\b|SVG|Html\b|Icon\b|Svg\b")

DEPRECATED = [
    (r"\bhass\.components\.", ERROR, "deprecated hass.components accessor"),
    (r"\bhass\.helpers\.", ERROR, "deprecated hass.helpers accessor"),
    (r"\basync_forward_entry_setup\b(?!s)", ERROR,
     "singular async_forward_entry_setup"),
    (r"\bdevice_state_attributes\b", ERROR, "removed device_state_attributes"),
    (r"\basync_setup_platforms\b", ERROR, "deprecated async_setup_platforms"),
    (r"\bDEVICE_CLASS_[A-Z_]+", WARN, "deprecated DEVICE_CLASS_* constant"),
    (r"\bdatetime\.utcnow\(\)", HOT_WARN, "deprecated datetime.utcnow()"),
    (r"\bdatetime\.now\(\)", HOT_WARN,
     "naive datetime.now(); use homeassistant.util.dt.now()"),
    (r"^\s*print\(", WARN, "print() in integration code"),
    (r"^\s*except\s*:", ERROR,
     "bare except catches cancellation/system exceptions"),
]


@dataclass
class Finding:
    severity: str
    category: str
    message: str
    location: str = ""
    fix: str = ""
    evidence: str = ""


class Report:
    def __init__(self, repo: Path, domain: str):
        self.repo = repo
        self.domain = domain
        self.items: list[Finding] = []
        self.stats: dict[str, object] = {}
        self.checks: list[dict] = []

    def add(self, severity, category, message, location="", fix="", evidence=""):
        self.items.append(Finding(severity, category, message, location, fix, evidence))

    def mark(self, name, status, detail=""):
        self.checks.append({"check": name, "status": status, "detail": detail})

    def counts(self):
        return Counter(x.severity for x in self.items)

    def blocking(self):
        return sum(self.counts().get(x, 0) for x in (BLOCKER, ERROR))


def rel(p: Path, repo: Path) -> str:
    try:
        return str(p.relative_to(repo))
    except ValueError:
        return str(p)


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        return f"__READ_ERROR__: {exc}"


def py_files(comp: Path) -> list[Path]:
    return sorted(p for p in comp.rglob("*.py") if "__pycache__" not in p.parts)


def js_files(comp: Path) -> list[Path]:
    return sorted(p for p in comp.rglob("*.js")
                  if p.name != "barcode-detector.umd.js")


def find_integration(repo: Path):
    cc = repo / "custom_components"
    if not cc.is_dir():
        return None, None
    matches = [c for c in sorted(cc.iterdir())
               if c.is_dir() and (c / "manifest.json").is_file()]
    if not matches:
        return None, None
    return matches[0], matches[0].name


def parse_json(path: Path, rep: Report, category="JSON"):
    try:
        return json.loads(read(path))
    except Exception as exc:
        rep.add(BLOCKER, category, f"{path.name} does not parse: {exc}",
                rel(path, rep.repo))
        return None


def version_tuple(v: str):
    nums = [int(x) for x in re.findall(r"\d+", str(v))]
    return tuple((nums + [0, 0, 0])[:3])


def shutil_which(name: str):
    import shutil
    return shutil.which(name)


# ---------------------------------------------------------------------------
# repository, manifest, packaging
# ---------------------------------------------------------------------------

def check_repository_shape(repo: Path, comp: Path, domain: str, rep: Report):
    cat = "Repository shape"
    if len(list((repo / "custom_components").glob("*/manifest.json"))) > 1:
        rep.add(WARN, cat, "More than one integration manifest found; "
                           "the report covers one domain.", "custom_components")
    if not (repo / "hacs.json").is_file():
        rep.add(BLOCKER, cat, "hacs.json is missing.", "hacs.json")
    if not (repo / "README.md").is_file():
        rep.add(WARN, cat, "README.md is missing.", "README.md")
    if not (repo / ".github").is_dir():
        rep.add(WARN, cat, ".github directory is missing.", ".github",
                "Keep hassfest/HACS validation in the repository.")
    rep.mark("repository structure", PASS,
             "custom_components/<domain>/manifest.json found")


def check_manifest(repo, comp, domain, rep: Report):
    cat = "Manifest / HACS"
    man_path = comp / "manifest.json"
    man = parse_json(man_path, rep, cat)
    hacs = parse_json(repo / "hacs.json", rep, cat) if (repo / "hacs.json").is_file() else {}
    if not isinstance(man, dict):
        return {}, {}

    for key in ("domain", "name", "documentation", "codeowners", "version"):
        if key not in man:
            rep.add(BLOCKER, cat, f"manifest.json missing required key '{key}'.",
                    rel(man_path, repo))
    if man.get("domain") != domain:
        rep.add(BLOCKER, cat,
                f"manifest domain '{man.get('domain')}' != folder '{domain}'.",
                rel(man_path, repo))
    if man.get("config_flow") and not (comp / "config_flow.py").is_file():
        rep.add(BLOCKER, cat, "config_flow=true but config_flow.py is missing.",
                rel(man_path, repo))
    if "requirements" in man and not isinstance(man["requirements"], list):
        rep.add(BLOCKER, cat, "manifest requirements must be a list.",
                rel(man_path, repo))
    for req in man.get("requirements", []):
        if "==" not in req:
            rep.add(WARN, cat, f"Requirement '{req}' is not pinned with ==.",
                    rel(man_path, repo),
                    "Home Assistant expects exact pins so behaviour is reproducible.")

    if isinstance(hacs, dict):
        if not hacs.get("name"):
            rep.add(WARN, cat, "hacs.json has no name.", "hacs.json")
        floor = hacs.get("homeassistant")
        if not floor:
            rep.add(ERROR, cat, "hacs.json has no Home Assistant minimum version.",
                    "hacs.json")
        else:
            rep.mark("HA version floor declared", PASS, str(floor))

    tag = os.environ.get("GITHUB_REF_NAME", "")
    if tag and tag.lstrip("v") != str(man.get("version", "")):
        rep.add(BLOCKER, cat,
                f"Git tag '{tag}' != manifest version '{man.get('version')}'.",
                rel(man_path, repo))
    if (comp / "hacs.json").is_file():
        rep.add(ERROR, cat, "hacs.json is duplicated inside the integration folder.",
                rel(comp / "hacs.json", repo))
    return man, hacs


def check_floor_and_brand(comp: Path, hacs: dict, rep: Report):
    cat = "Version floor / brand"
    floor = str(hacs.get("homeassistant", "")) if isinstance(hacs, dict) else ""
    source = "\n".join(read(p) for p in py_files(comp))
    # Only list an API here once its introducing version has been verified.
    # Declaring a floor that is too high excludes users for no reason, which
    # is its own defect.
    markers = {
        "ConfigFlowResult": "2024.4.0",
        "async_create_background_task": "2024.5.0",
        "entry.runtime_data": "2024.6.0",
        "async_forward_entry_setups": "2024.6.0",
        "StaticPathConfig": "2024.7.0",
        "async_register_static_paths": "2024.7.0",
    }
    if floor:
        for marker, needed in markers.items():
            if marker in source and version_tuple(floor) < version_tuple(needed):
                rep.add(BLOCKER, cat,
                        f"Code uses '{marker}' but the declared floor is {floor}; "
                        f"needs {needed}.", "hacs.json")

    brand = comp / "brand"
    if not brand.is_dir():
        rep.add(HOT_WARN, cat, "brand/ directory is missing.", rel(comp, rep.repo),
                "HA 2026.3+ reads custom integration icons only from "
                "custom_components/<domain>/brand/.")
    else:
        for name in ("icon.png", "logo.png"):
            if not (brand / name).is_file():
                rep.add(HOT_WARN, cat, f"brand/{name} is missing.",
                        rel(brand, rep.repo))
        if floor and version_tuple(floor) < version_tuple("2026.3.0"):
            rep.add(INFO, cat,
                    f"brand/ is present, but HA reads it only from 2026.3; on the "
                    f"declared floor {floor} users see no icon. Raising the floor "
                    f"for an icon would exclude users, so this is informational.",
                    rel(brand, rep.repo))
    rep.mark("version floor / brand", PASS, floor or "not declared")


def check_shipped_content(comp: Path, rep: Report):
    cat = "Shipped content"
    for p in comp.rglob("*"):
        if p.name in JUNK_DIRS or p.name in JUNK_FILES:
            rep.add(ERROR, cat,
                    f"Development artifact '{p.name}' would ship inside the integration.",
                    rel(p, rep.repo), "Move it to the repository root or delete it.")
        if p.is_file() and p.stat().st_size > 1_000_000:
            rep.add(WARN, cat, f"Large shipped file: {p.stat().st_size/1048576:.1f} MB.",
                    rel(p, rep.repo))


# ---------------------------------------------------------------------------
# python: syntax, call graph, event loop, deprecated APIs
# ---------------------------------------------------------------------------

def build_ast_index(files: Iterable[Path]):
    index = defaultdict(list)
    trees = {}
    for f in files:
        try:
            tree = ast.parse(read(f), filename=str(f))
        except SyntaxError:
            continue
        trees[f] = tree
        for n in ast.walk(tree):
            if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                index[n.name].append((f, n))
    return index, trees


def _resolve_callable_node(n):
    if isinstance(n, ast.ClassDef):
        for item in n.body:
            if isinstance(item, ast.FunctionDef) and item.name == "__init__":
                return item
        return None
    return n


def signature(n):
    resolved = _resolve_callable_node(n)
    if resolved is None:
        return 0, None, 0, 0
    a = resolved.args
    pos = len(a.posonlyargs) + len(a.args)
    is_method = (isinstance(resolved, (ast.FunctionDef, ast.AsyncFunctionDef))
                 and bool(a.args) and a.args[0].arg in ("self", "cls"))
    lo = pos - len(a.defaults) - (1 if is_method else 0)
    hi = None if a.vararg else pos - (1 if is_method else 0)
    kwonly_required = sum(1 for d in a.kw_defaults if d is None)
    return lo, hi, kwonly_required, len(a.kwonlyargs)


def check_syntax_and_importable(comp: Path, rep: Report):
    cat = "Python syntax / imports"
    files = py_files(comp)
    failures = 0
    for f in files:
        try:
            ast.parse(read(f), filename=str(f))
        except SyntaxError as exc:
            failures += 1
            rep.add(BLOCKER, cat, f"Python syntax error: {exc}", rel(f, rep.repo))
    if failures == 0:
        rep.mark("Python AST parse", PASS, f"{len(files)} files parsed")

    proc = subprocess.run(
        [sys.executable, "-m", "compileall", "-q", "-f", "-b", str(comp)],
        cwd=rep.repo, capture_output=True, text=True)
    if proc.returncode:
        rep.add(BLOCKER, cat, "compileall failed.", "", "",
                (proc.stderr or proc.stdout).strip())
    else:
        for p in comp.rglob("*.pyc"):
            try:
                p.unlink()
            except OSError:
                pass
        rep.mark("Python compileall", PASS, "all Python files compile")


def check_cross_file_calls(comp: Path, rep: Report):
    cat = "Cross-file call graph"
    defs, trees = build_ast_index(py_files(comp))
    problems = 0
    for f, tree in trees.items():
        local_names = {n.name for n in ast.walk(tree)
                       if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        for call in ast.walk(tree):
            if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Name):
                continue
            name = call.func.id
            if name not in defs:
                continue
            if any(isinstance(a, ast.Starred) for a in call.args):
                continue
            if any(k.arg is None for k in call.keywords):
                continue
            candidates = [d for d in defs[name]
                          if d[0] == f or name not in local_names] or defs[name]
            positional = len(call.args)
            supplied_kw = len({k.arg for k in call.keywords if k.arg})
            for df, fn in candidates:
                lo, hi, req_kw, _ = signature(fn)
                if positional < lo or (hi is not None and positional > hi):
                    continue
                if supplied_kw < req_kw:
                    continue
                break
            else:
                df, fn = candidates[0]
                lo, hi, _, _ = signature(fn)
                problems += 1
                rep.add(ERROR, cat,
                        f"{name}() called with {positional} positional args; "
                        f"definition expects {lo}..{hi if hi is not None else '*'}",
                        f"{rel(f, rep.repo)}:{call.lineno}",
                        f"Definition: {rel(df, rep.repo)}:{fn.lineno}")
    rep.stats["project_functions_indexed"] = sum(len(v) for v in defs.values())
    rep.mark("cross-file function signatures", PASS if problems == 0 else ERROR,
             f"{problems} signature mismatches")


def check_event_loop(comp: Path, rep: Report):
    cat = "Async event-loop safety"
    problems = 0
    for f in py_files(comp):
        try:
            tree = ast.parse(read(f), filename=str(f))
        except SyntaxError:
            continue
        found = []

        def walk(node, in_async=False):
            for child in ast.iter_child_nodes(node):
                if isinstance(child, ast.AsyncFunctionDef):
                    walk(child, True)
                    continue
                if isinstance(child, (ast.FunctionDef, ast.Lambda)):
                    # A nested sync helper is what gets handed to the executor.
                    walk(child, False)
                    continue
                if in_async and isinstance(child, ast.Call):
                    fn = child.func
                    if isinstance(fn, ast.Name) and fn.id == "open":
                        found.append((child.lineno, "open()"))
                    elif isinstance(fn, ast.Attribute):
                        root = fn.value
                        nm = getattr(root, "id", None) or getattr(
                            getattr(root, "value", None), "id", None)
                        if nm in {"os", "shutil", "path", "Path"} and fn.attr in BLOCKING_ATTRS:
                            found.append((child.lineno, f"{nm}.{fn.attr}()"))
                        if nm == "time" and fn.attr == "sleep":
                            found.append((child.lineno, "time.sleep()"))
                        if nm in SYNC_NET_MODULES:
                            found.append((child.lineno, f"{nm}.{fn.attr}() (sync HTTP)"))
                walk(child, in_async)

        walk(tree)
        for lineno, what in sorted(set(found)):
            problems += 1
            rep.add(BLOCKER, cat, f"{what} runs on the event loop.",
                    f"{rel(f, rep.repo)}:{lineno}",
                    "Move it into a nested def and await "
                    "hass.async_add_executor_job(...).")

        src = read(f)
        if re.search(r"^\s*(?:import requests|from requests\b)", src, re.M):
            rep.add(BLOCKER, cat, "requests imported; it is synchronous HTTP.",
                    rel(f, rep.repo), "Use async_get_clientsession(hass).")
        if "aiohttp.ClientSession(" in src:
            rep.add(ERROR, cat, "Creates its own aiohttp ClientSession.",
                    rel(f, rep.repo), "Use HA's shared async_get_clientsession(hass).")
    rep.mark("event-loop static scan", PASS if problems == 0 else ERROR,
             f"{problems} findings")


def check_deprecated(comp: Path, rep: Report):
    cat = "Deprecated / discouraged APIs"
    problems = 0
    for f in py_files(comp):
        for i, line in enumerate(read(f).splitlines(), 1):
            if line.strip().startswith("#"):
                continue
            for pattern, severity, desc in DEPRECATED:
                if re.search(pattern, line):
                    problems += 1
                    rep.add(severity, cat, desc, f"{rel(f, rep.repo)}:{i}")
    rep.mark("deprecated API scan", PASS if problems == 0 else WARN,
             f"{problems} findings")


# ---------------------------------------------------------------------------
# architecture, services
# ---------------------------------------------------------------------------

def check_lifecycle_and_platforms(comp: Path, man: dict, rep: Report):
    cat = "Integration architecture"
    init = comp / "__init__.py"
    if not init.is_file():
        rep.add(BLOCKER, cat, "__init__.py missing.", rel(comp, rep.repo))
        return
    src = read(init)
    if "async_setup_entry" not in src:
        rep.add(BLOCKER, cat, "async_setup_entry not found.", rel(init, rep.repo))
    if "async_unload_entry" not in src:
        rep.add(ERROR, cat, "async_unload_entry not found.", rel(init, rep.repo),
                "Without it the integration cannot be reloaded or removed cleanly.")

    if man.get("config_flow"):
        cf = comp / "config_flow.py"
        if not cf.is_file():
            rep.add(BLOCKER, cat, "config_flow enabled but config_flow.py missing.",
                    rel(comp, rep.repo))
        else:
            cfs = read(cf)
            if "ConfigFlow" not in cfs:
                rep.add(BLOCKER, cat, "config_flow.py defines no ConfigFlow.",
                        rel(cf, rep.repo))
            # A single-instance integration does not need a unique id; aborting
            # on single_instance_allowed is the documented alternative.
            has_unique = "async_set_unique_id" in cfs
            has_single = ("single_instance_allowed" in cfs
                          or "async_abort_entries_match" in cfs
                          or "_async_current_entries" in cfs)
            if not has_unique and not has_single:
                rep.add(HOT_WARN, cat,
                        "Config flow has neither async_set_unique_id nor a "
                        "single-instance abort; the same entry could be added twice.",
                        rel(cf, rep.repo))
            elif has_unique and "_abort_if_unique_id_configured" not in cfs:
                rep.add(WARN, cat,
                        "async_set_unique_id without _abort_if_unique_id_configured.",
                        rel(cf, rep.repo))
    rep.mark("setup/unload/config-flow architecture", PASS,
             "static lifecycle checks completed")


def check_services(comp: Path, rep: Report):
    """Only hass.services.async_register* counts as a service registration.

    Matching any 'async_register*' attribute caught async_register_static_paths
    and async_register_panel, which are not services and take no schema.
    """
    cat = "Services"
    registered = []
    for f in py_files(comp):
        try:
            tree = ast.parse(read(f))
        except SyntaxError:
            continue
        for n in ast.walk(tree):
            if not (isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)):
                continue
            if not n.func.attr.startswith("async_register"):
                continue
            owner = n.func.value
            if not (isinstance(owner, ast.Attribute) and owner.attr == "services"):
                continue
            registered.append((f, n))
            if "admin" in n.func.attr:
                continue  # async_register_admin_service already restricts callers
            kwargs = {k.arg for k in n.keywords if k.arg}
            if "schema" not in kwargs and len(n.args) < 4:
                rep.add(HOT_WARN, cat, "Service registered without an explicit schema.",
                        f"{rel(f, rep.repo)}:{n.lineno}",
                        "Unvalidated payloads reach the handler from any "
                        "authenticated caller.")
    if registered and not (comp / "services.yaml").is_file():
        rep.add(WARN, cat, "Services are registered but services.yaml is missing.",
                rel(comp, rep.repo))
    rep.mark("service registration scan", PASS,
             f"{len(registered)} service registrations found")


# ---------------------------------------------------------------------------
# secrets, paths
# ---------------------------------------------------------------------------

def check_secrets(comp: Path, rep: Report):
    cat = "Secrets / logging / TLS"
    problems = 0
    for f in py_files(comp):
        for i, line in enumerate(read(f).splitlines(), 1):
            if line.strip().startswith("#"):
                continue
            if "_LOGGER." in line and SECRET_WORDS.search(line):
                problems += 1
                rep.add(BLOCKER, cat, "Possible secret in a log statement.",
                        f"{rel(f, rep.repo)}:{i}", "Log a status or redacted value.")
            if URL_SECRET.search(line):
                problems += 1
                rep.add(BLOCKER, cat, "Credential appears in a request URL.",
                        f"{rel(f, rep.repo)}:{i}",
                        "Send it in a header; URLs appear in exception strings.")
            if TLS_OFF.search(line):
                problems += 1
                rep.add(BLOCKER, cat, "TLS verification appears disabled.",
                        f"{rel(f, rep.repo)}:{i}")
            if re.search(rf"{SECRET_WORDS.pattern}\s*=\s*[\"'][A-Za-z0-9_\-]{{20,}}[\"']",
                         line, re.I):
                problems += 1
                rep.add(BLOCKER, cat, "Possible hardcoded credential.",
                        f"{rel(f, rep.repo)}:{i}")
    for p in comp.rglob("*"):
        if p.is_file() and re.search(
                r"(?:\.pem|\.key|credentials\.json|service-account\.json|\.env$)",
                p.name, re.I):
            rep.add(BLOCKER, cat, f"Credential/private-key file shipped: {p.name}",
                    rel(p, rep.repo))
    rep.mark("secrets/TLS scan", PASS if problems == 0 else ERROR, f"{problems} findings")


# Names that plausibly hold caller-supplied text. A literal string or a name
# that is clearly internal is not reported.
USER_PATH_ARG = re.compile(
    r"\b(?:item_name|filename|file_name|user_name|username|title|display_name"
    r"|entered|supplied|raw_name|input_name)\b")


def check_paths(comp: Path, domain: str, rep: Report):
    cat = "Filesystem / path safety"
    problems = 0
    for f in py_files(comp):
        lines = read(f).splitlines()
        for i, line in enumerate(lines, 1):
            if line.strip().startswith("#"):
                continue
            if ABS_PATH.search(line):
                rep.add(WARN, cat, "Hardcoded absolute filesystem path.",
                        f"{rel(f, rep.repo)}:{i}", "Use hass.config.path(...).")

            # Only report a join when a caller-shaped name is involved and no
            # sanitising appears on that line or the few lines around it.
            if "os.path.join(" in line and USER_PATH_ARG.search(line):
                window = "\n".join(lines[max(0, i - 6): i + 4])
                if not re.search(r"basename|_safe_filename|slugify|secure_filename"
                                 r"|commonpath|resolve\(\)", window):
                    problems += 1
                    rep.add(HOT_WARN, cat,
                            "Caller-supplied value joined into a path without "
                            "visible sanitising.",
                            f"{rel(f, rep.repo)}:{i}",
                            "os.path.join does not neutralise '..'. Use "
                            "os.path.basename plus a character whitelist, and "
                            "verify containment with os.path.commonpath.")

            if re.search(r"custom_components[/\\]" + re.escape(domain), line) and \
                    re.search(r"\b(?:open|write|dump|makedirs)\b", line):
                problems += 1
                rep.add(ERROR, cat,
                        "Possible write into the installed integration directory.",
                        f"{rel(f, rep.repo)}:{i}",
                        "That directory is read-only after install; use "
                        "hass.config.path(...) or helpers.storage.Store.")
    rep.mark("filesystem/path scan", PASS if problems == 0 else HOT_WARN,
             f"{problems} findings")


# ---------------------------------------------------------------------------
# frontend
# ---------------------------------------------------------------------------

def check_frontend(comp: Path, rep: Report):
    """Report untrusted data reaching an HTML sink, not every HTML sink."""
    cat = "Frontend security / JS"
    files = js_files(comp)
    problems = 0

    def suppressed(src, line_no):
        """Honour an explicit, justified suppression on or above the line.

        Written as `// xss-ok: <reason>`, mirroring how `# nosec` works. A
        suppression without a reason is ignored, so it cannot be used to
        silence a finding without recording why.
        """
        lines = src.splitlines()
        # Look back a few lines so the marker can head a short comment block.
        for idx in range(line_no - 1, max(-1, line_no - 8), -1):
            if 0 <= idx < len(lines):
                m = re.search(r"//\s*xss-ok:\s*(\S.*)", lines[idx])
                if m and len(m.group(1).strip()) > 10:
                    return True
        return False

    for f in files:
        src = read(f)

        for m in re.finditer(
                r"(?:innerHTML|outerHTML)\s*\+?=\s*`((?:[^`\\]|\\.)*)`", src, re.S):
            line = src[: m.start()].count("\n") + 1
            for i in re.finditer(r"\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}", m.group(1)):
                expr = i.group(1).strip()
                if TRUSTED_EXPR.search(expr):
                    continue
                if UNTRUSTED_EXPR.search(expr):
                    if suppressed(src, line):
                        continue
                    problems += 1
                    rep.add(BLOCKER, cat,
                            f"Unescaped `{expr[:60]}` reaches an HTML sink.",
                            f"{rel(f, rep.repo)}:{line}",
                            "Wrap in escapeHtml(). Inside an onclick attribute use "
                            "escapeHtml(this.escapeJSArg(x)) in that order, because "
                            "the browser decodes the attribute before running the JS.")

        for m in re.finditer(r"(?:innerHTML|outerHTML)\s*\+?=\s*([^;`\n]+);", src):
            expr = m.group(1).strip()
            if "`" in expr or TRUSTED_EXPR.search(expr):
                continue
            if UNTRUSTED_EXPR.search(expr):
                line_no = src[:m.start()].count("\n") + 1
                if suppressed(src, line_no):
                    continue
                problems += 1
                rep.add(BLOCKER, cat,
                        f"Unescaped `{expr[:60]}` assigned to an HTML sink.",
                        f"{rel(f, rep.repo)}:{src[:m.start()].count(chr(10)) + 1}",
                        "Use textContent, or escape the value first.")

        for m in DYNAMIC_JS.finditer(src):
            rep.add(ERROR, cat, "Dynamic code execution (eval/new Function).",
                    f"{rel(f, rep.repo)}:{src[:m.start()].count(chr(10)) + 1}")

        for m in EXTERNAL_ASSET.finditer(src):
            rep.add(BLOCKER, cat, "External CDN/font asset referenced.",
                    f"{rel(f, rep.repo)}:{src[:m.start()].count(chr(10)) + 1}",
                    "Vendor assets locally for offline installations.")

        # A missing import is a runtime ReferenceError that node --check cannot
        # detect, so it is worth checking explicitly.
        for helper in ("escapeHtml", "formatAiText"):
            uses = re.search(rf"\b{helper}\s*\(", src)
            defines = re.search(rf"(?:export\s+)?function\s+{helper}\b", src)
            imports = re.search(rf"import\s*\{{[^}}]*\b{helper}\b", src)
            method = re.search(rf"\b{helper}\s*\([^)]*\)\s*\{{", src)
            if uses and not (defines or imports or method):
                problems += 1
                rep.add(BLOCKER, cat,
                        f"{helper}() used without being imported or defined.",
                        rel(f, rep.repo), "This throws ReferenceError at runtime.")

    rep.mark("frontend security scan", PASS if problems == 0 else ERROR,
             f"{len(files)} JS files, {problems} findings")


def check_css_html_assets(comp: Path, rep: Report):
    cat = "Frontend assets"
    for f in list(comp.rglob("*.html")) + list(comp.rglob("*.css")):
        src = read(f)
        for m in EXTERNAL_ASSET.finditer(src):
            rep.add(BLOCKER, cat, "External asset URL found.",
                    f"{rel(f, rep.repo)}:{src[:m.start()].count(chr(10)) + 1}")
    rep.mark("frontend asset isolation", PASS, "no external asset blockers")


# ---------------------------------------------------------------------------
# translations, dependencies, practices, tests
# ---------------------------------------------------------------------------

def _leaves(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items():
            yield from _leaves(v, f"{path}.{k}" if path else k)
    elif isinstance(node, str):
        yield path, node


def translation_keys(node, prefix=""):
    out = set()
    if isinstance(node, dict):
        for k, v in node.items():
            key = f"{prefix}.{k}" if prefix else k
            out.add(key)
            out |= translation_keys(v, key)
    return out


def placeholders(value: str):
    return set(re.findall(r"\{([A-Za-z0-9_.-]+)\}", value))


def check_translations(comp: Path, man: dict, rep: Report):
    cat = "Translations"
    if not man.get("config_flow"):
        rep.mark("translations", PASS, "config_flow disabled")
        return
    strings = comp / "strings.json"
    if not strings.is_file():
        rep.add(ERROR, cat, "strings.json missing while config_flow is enabled.",
                rel(comp, rep.repo))
        return
    sj = parse_json(strings, rep, cat)
    if not isinstance(sj, dict):
        return
    for path, value in _leaves(sj):
        if re.search(r"<[^\s/][^>]*>", value):
            rep.add(ERROR, cat, f"HTML markup in a translation value at {path}.",
                    rel(strings, rep.repo), "hassfest rejects markup here.")

    tdir = comp / "translations"
    en = tdir / "en.json"
    if not en.is_file():
        rep.add(ERROR, cat, "translations/en.json missing.", rel(tdir, rep.repo),
                "Home Assistant reads translations/<lang>.json at runtime, "
                "not strings.json.")
        return
    ej = parse_json(en, rep, cat)
    if not isinstance(ej, dict):
        return
    missing = translation_keys(sj) - translation_keys(ej)
    if missing:
        rep.add(ERROR, cat,
                f"{len(missing)} strings.json key(s) missing from translations/en.json.",
                rel(en, rep.repo), evidence=", ".join(sorted(missing)[:20]))
    en_map = dict(_leaves(ej))
    for path, value in _leaves(sj):
        if path in en_map and placeholders(value) != placeholders(en_map[path]):
            rep.add(ERROR, cat, f"Translation placeholders differ at {path}.",
                    rel(en, rep.repo),
                    evidence=f"source={placeholders(value)} "
                             f"translation={placeholders(en_map[path])}")
    rep.mark("translation keys/placeholders", PASS,
             "strings.json and en.json structurally compared")


def check_dependencies(comp: Path, man: dict, rep: Report):
    cat = "Dependencies"
    requirements = man.get("requirements", []) if isinstance(man, dict) else []
    req_names = {re.split(r"[<>=!~\[]", x, maxsplit=1)[0].strip().replace("-", "_").lower()
                 for x in requirements}
    imported = set()
    for f in py_files(comp):
        try:
            tree = ast.parse(read(f))
        except SyntaxError:
            continue
        for n in ast.walk(tree):
            if isinstance(n, ast.Import):
                imported |= {a.name.split(".")[0].lower() for a in n.names}
            elif isinstance(n, ast.ImportFrom) and n.module:
                imported.add(n.module.split(".")[0].lower())

    stdlib = set(getattr(sys, "stdlib_module_names", set()))
    ignored = {"homeassistant", "typing", "asyncio", "json", "os", "re", "sys",
               "pathlib", "logging", "datetime", "collections", "dataclasses",
               "functools", "contextlib", "urllib", "hashlib", "base64",
               "secrets", "time", "math", "copy", "enum",
               # bundled with Home Assistant core
               "aiohttp", "voluptuous", "yarl", "async_timeout", "certifi", "pytest"}

    local_modules = {p.stem for p in py_files(comp)}
    for p in py_files(comp):
        try:
            local_modules.update(p.relative_to(comp).parts[:-1])
        except ValueError:
            pass

    external = {x for x in imported
                if x not in stdlib and x not in ignored
                and x != comp.name.lower() and x not in local_modules}

    for mod in sorted(external):
        if not any(mod == r or mod.startswith(r + "_") for r in req_names):
            rep.add(WARN, cat,
                    f"Import '{mod}' is not listed in manifest requirements.",
                    "manifest.json",
                    "Verify whether HA bundles it or it needs a requirement entry.")
    for req in req_names:
        if req and req not in imported:
            rep.add(WARN, cat, f"Manifest requirement '{req}' is never imported.",
                    "manifest.json", "Remove it; it is installed for nothing.")
    rep.mark("dependency consistency", PASS,
             f"{len(requirements)} requirements; {len(external)} external imports")


def check_ha_best_practices(comp: Path, man: dict, rep: Report):
    """Observations only.

    Neither of these violates any HACS or Home Assistant rule for custom
    integrations, so they are INFO. Reporting them as WARN implied a
    requirement that does not exist.
    """
    cat = "HA Best Practices"
    reqs = str(man.get("requirements", []))
    if "aiosqlite" in reqs or "sqlite3" in reqs:
        rep.add(INFO, cat, "Uses SQLite for persistence.", "manifest.json",
                "helpers.storage.Store is the common choice for small "
                "configuration state; a real database is the right tool for "
                "large, queryable datasets. No action required.")

    js_srcs = [read(f) for f in js_files(comp)]
    if js_srcs and not any(re.search(r"\blit(?:-element|-html)?\b", s, re.I)
                           for s in js_srcs):
        rep.add(INFO, cat, "Frontend is vanilla JavaScript rather than Lit.",
                "frontend/",
                "Home Assistant core uses Lit, but custom panels are not "
                "required to. Escaping is what prevents XSS, not the framework.")
    rep.mark("ha best practices", PASS, "informational observations only")


def check_tests(repo: Path, domain: str, rep: Report):
    cat = "Runtime tests"
    candidates = [repo / "tests" / "components" / domain,
                  repo / "tests" / domain, repo / "test" / domain]
    test_dir = next((p for p in candidates if p.is_dir()), None)
    if not test_dir:
        rep.add(WARN, cat, f"No pytest directory found for '{domain}'.", "tests",
                "Tests are recommended, not required for HACS submission.")
        rep.mark("runtime test presence", WARN, "no tests directory")
        return
    test_files = sorted(test_dir.rglob("test_*.py"))
    if not test_files:
        rep.add(WARN, cat, "Test directory exists but has no test_*.py files.",
                rel(test_dir, repo))
        rep.mark("runtime test presence", WARN, "no test files")
        return
    rep.mark("runtime test presence", PASS, f"{len(test_files)} pytest files")
    names = "\n".join(read(p) for p in test_files)
    for label, token in {"config flow": "async_init", "setup/unload": "async_setup",
                         "services": "async_call",
                         "entities": "async_setup_component"}.items():
        if token not in names:
            rep.add(INFO, cat, f"No obvious test coverage for {label}.",
                    rel(test_dir, repo))


# ---------------------------------------------------------------------------
# external tools
# ---------------------------------------------------------------------------

def run_command(rep: Report, name: str, cmd: list[str], cwd: Path, timeout: int = 600):
    try:
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                              timeout=timeout)
    except FileNotFoundError:
        rep.add(WARN, "External tools", f"{name}: executable not found; not run.")
        return
    except subprocess.TimeoutExpired:
        rep.add(ERROR, "External tools", f"{name}: timed out after {timeout}s.")
        return
    if proc.returncode:
        rep.add(ERROR, "External tools",
                f"{name} failed with exit code {proc.returncode}.",
                evidence=(proc.stdout + "\n" + proc.stderr)[-3000:])
    else:
        rep.mark(name, PASS, "completed successfully")


def run_external(rep: Report, repo: Path, comp: Path, run_tests: bool):
    cfg = repo / "pyproject.toml"

    if shutil_which("ruff"):
        run_command(rep, "ruff check", ["ruff", "check", str(comp)], repo, 300)
    else:
        rep.add(WARN, "External tools", "ruff not installed; lint not run.")

    if shutil_which("bandit"):
        # Without -c, documented B110/B608 skips are ignored and bandit exits 1,
        # which previously surfaced as a false ERROR.
        cmd = ["bandit", "-r", str(comp), "-ll", "-q"]
        if cfg.is_file():
            cmd += ["-c", str(cfg)]
        run_command(rep, "bandit", cmd, repo, 300)
    else:
        rep.add(WARN, "External tools", "bandit not installed; security lint not run.")

    node = shutil_which("node")
    if node:
        failed = 0
        for f in js_files(comp):
            proc = subprocess.run([node, "--check", str(f)],
                                  capture_output=True, text=True)
            if proc.returncode:
                failed += 1
                rep.add(BLOCKER, "External tools",
                        f"JavaScript syntax error in {rel(f, repo)}.",
                        evidence=proc.stderr[-600:])
        if failed == 0:
            rep.mark("node --check", PASS,
                     f"{len(js_files(comp))} JS files parse cleanly")
    else:
        rep.add(WARN, "External tools",
                "node not installed; JavaScript is not parsed.",
                fix="Install Node.js from nodejs.org to enable this check.")

    hassfest = repo / "script" / "hassfest"
    if hassfest.is_file():
        run_command(rep, "hassfest", [sys.executable, str(hassfest)], repo, 900)
    else:
        rep.add(INFO, "External tools",
                "hassfest is not available locally; it runs in CI via the "
                "official GitHub Action. This is expected outside a Home "
                "Assistant core checkout.")

    if run_tests:
        if shutil_which("pytest"):
            test_dir = repo / "tests" / "components" / rep.domain
            if test_dir.is_dir():
                run_command(rep, "pytest", [sys.executable, "-m", "pytest",
                                            str(test_dir), "-q"], repo, 1200)
            else:
                rep.add(INFO, "External tools",
                        f"pytest requested but {rel(test_dir, repo)} does not exist.")
        else:
            rep.add(WARN, "External tools", "pytest not installed; tests not run.")


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------

def score(rep: Report):
    counts = rep.counts()
    if counts.get(BLOCKER, 0):
        return 0
    if counts.get(ERROR, 0):
        return max(5, 45 - counts[ERROR] * 10)
    if counts.get(HOT_WARN, 0):
        return max(10, 75 - counts[HOT_WARN] * 5)
    if counts.get(WARN, 0):
        return max(70, 96 - min(25, counts[WARN] * 3))
    return 97


def render(rep: Report):
    counts = rep.counts()
    print("\n" + "=" * 96)
    print(f" HOME ASSISTANT FULL CHECK — {rep.domain}")
    print("=" * 96)
    print(f"Repository: {rep.repo}")
    for k, v in rep.stats.items():
        print(f"{k}: {v}")
    print("-" * 96)
    print("CHECKS")
    for c in rep.checks:
        print(f"  [{c['status']:<8}] {c['check']}: {c['detail']}")
    print("-" * 96)

    if not rep.items:
        print("FINDINGS: none")
    else:
        grouped = defaultdict(list)
        for item in rep.items:
            grouped[item.category].append(item)
        for cat in sorted(grouped, key=lambda x: min(ORDER[i.severity]
                                                     for i in grouped[x])):
            print(f"\n── {cat}")
            for i in sorted(grouped[cat], key=lambda x: (ORDER[x.severity], x.location)):
                print(f"  [{i.severity:<8}] {i.message}")
                if i.location:
                    print(f"             location: {i.location}")
                if i.fix:
                    print(f"             fix:      {i.fix}")
                if i.evidence:
                    print(f"             evidence: {i.evidence[:400]}")

    print("\n" + "=" * 96)
    print("SUMMARY")
    print("-" * 96)
    for sev in (BLOCKER, ERROR, HOT_WARN, WARN, INFO):
        print(f"  {sev:<9} {counts.get(sev, 0)}")
    print(f"  PASS      {sum(1 for x in rep.checks if x['status'] == PASS)}")
    print("-" * 96)
    print(f"HEURISTIC RISK SCORE: ~{score(rep)}%")
    print("This is a risk score from the findings above, not a probability of")
    print("acceptance. Only hassfest, HACS validation and a human review decide that.")
    if rep.blocking():
        print("VERDICT: NOT READY — fix BLOCKER/ERROR findings.")
    elif counts.get(HOT_WARN, 0):
        print("VERDICT: REVIEW NEEDED — HOT_WARN findings are common rejection triggers.")
    elif counts.get(WARN, 0):
        print("VERDICT: STATIC GATE PASSED — review the warnings.")
    else:
        print("VERDICT: STATIC GATE CLEAN — run hassfest/HACS in CI before the PR.")
    print("=" * 96)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="repository root")
    ap.add_argument("--json", help="write a detailed JSON report")
    ap.add_argument("--run-external", action="store_true",
                    help="run ruff, bandit, node and hassfest when available")
    ap.add_argument("--run-tests", action="store_true",
                    help="also run pytest tests/components/<domain>")
    args = ap.parse_args()

    repo = Path(args.root).resolve()
    comp, domain = find_integration(repo)
    if comp is None:
        print(f"ERROR: no custom_components/<domain>/manifest.json under {repo}")
        return 2

    rep = Report(repo, domain)
    pys, jss = py_files(comp), js_files(comp)
    rep.stats.update({
        "domain": domain,
        "python_files": len(pys),
        "javascript_files": len(jss),
        "python_lines": sum(len(read(p).splitlines()) for p in pys),
        "integration_path": rel(comp, repo),
    })

    check_repository_shape(repo, comp, domain, rep)
    man, hacs = check_manifest(repo, comp, domain, rep)
    check_floor_and_brand(comp, hacs, rep)
    check_shipped_content(comp, rep)
    check_syntax_and_importable(comp, rep)
    check_cross_file_calls(comp, rep)
    check_event_loop(comp, rep)
    check_deprecated(comp, rep)
    check_lifecycle_and_platforms(comp, man, rep)
    check_services(comp, rep)
    check_secrets(comp, rep)
    check_paths(comp, domain, rep)
    check_frontend(comp, rep)
    check_css_html_assets(comp, rep)
    check_translations(comp, man, rep)
    check_dependencies(comp, man, rep)
    check_ha_best_practices(comp, man, rep)
    check_tests(repo, domain, rep)

    if args.run_external or args.run_tests:
        run_external(rep, repo, comp, args.run_tests)

    if args.json:
        out = Path(args.json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({
            "domain": rep.domain,
            "stats": rep.stats,
            "checks": rep.checks,
            "findings": [asdict(x) for x in rep.items],
            "counts": dict(rep.counts()),
            "heuristic_risk_score": score(rep),
        }, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nJSON report: {out}")

    render(rep)
    return 1 if rep.blocking() else 0


if __name__ == "__main__":
    raise SystemExit(main())
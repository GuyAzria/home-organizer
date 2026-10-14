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
# [ADDED v2026.10.13 | 2026-10-13] Purpose: ONE place that decides where
#   every piece of user data lives, for the storage the user chose.
#
#   The setup flow offers "www" or "media". Before this module, only the main
#   database and the item images followed that choice. The recipe database
#   always went to /config, receipt images and PDFs always went to
#   /config/www (the setting was READ by the writer and never SET by setup),
#   and the Stylist's personal photo and try-on images always went to
#   /config/www with their addresses hard-coded. A user who chose /media saw
#   their items start from nothing while their old recipes carried on, read
#   from a file in the other place.
#
#   The path decisions were also written out twice - in setup and again in
#   the uninstall cleanup - which is how the two could disagree (RULE 33d).
#   Everything now comes from storage_paths(), which does no I/O of its own,
#   so it can be tested without Home Assistant.
#
#   WWW MODE IS UNCHANGED, path for path. Only media mode moves anything,
#   and then only what was in the wrong place.
#
#   NOTHING IS MOVED OR DELETED. A FRESH media installation copies nothing:
#   its recipes start from nothing like its items, and whatever an earlier
#   www installation left in /config stays there untouched - that case is
#   the user's report. Only a media installation that ALREADY existed gets
#   the two things older versions put in /config on its behalf COPIED
#   across - the recipe database (with the dish photos its recipes name)
#   and the Stylist photos - so an upgrade does not hide recipes made in
#   that very installation (RULE 5, RULE 25). That happens once, recorded in
#   app_settings, so removing the /media copy later to start the recipes
#   afresh is not undone on the next restart (RULE 6). The originals are
#   left exactly where they were. Receipts need no copy: each receipt row
#   stores the absolute path of its file, and the old /config/www files go
#   on being served from there.
#
#   avatar_path() is the one definition of a Stylist photo's file, used by
#   the upload and by the Stylist alike: a plain user id or none, and the
#   result checked to stay inside the images folder.
#
#   IMAGES AND RECEIPTS ON NETWORK STORAGE. An installation - www or media
#   alike - may keep its files - the images, and the scanned receipts,
#   images and PDF: what grows with thousands of items - in a
#   network-storage folder Home Assistant mounts under /media, inside one
#   folder of its own there (home_organizer/images, home_organizer/receipts)
#   rather than loose among the user's things, while the databases stay on
#   the Home Assistant disk: a SQLite database on a network share is exposed to that
#   share's file locking, which is how databases get corrupted.
#   ready_dir_sync is the one place such a folder is created, and it will
#   not create one in place of a network folder that is not connected - that
#   folder is still there, empty, on the local disk, and whatever is written
#   into it lands on the very disk the files were moved off, hidden as soon
#   as the share comes back. copy_images_sync brings the images across when
#   the folder changes, and database.async_move_receipt_files the receipts,
#   re-pointing each receipt's row too, since a receipt stores the full path
#   of its file. Neither ever deletes.

import os
import re
import shutil
import sqlite3

DB_FILE = "home_organizer.db"
RECIPES_DB_FILE = "home_organizer_recipes.db"
IMG_DIR = "home_organizer_images"
RECEIPTS_DIR = "home_organizer_receipts"

MEDIA_ROOT = "/media"
# The URLs the two media folders are served under. The images one predates
# this module and is unchanged; the receipts one is new.
MEDIA_IMG_URL = "/home_organizer_media"
MEDIA_RECEIPTS_URL = "/home_organizer_media_receipts"

METHOD_WWW = "www"
METHOD_MEDIA = "media"

# The app_settings row that records the one-time step in prepare_media_sync
# has run. It lives IN the database in /media, so it travels with the data
# it describes: a database made by an older version has no such row, and
# neither has a fresh one.
UPGRADE_SETTING = "storage_media_upgrade"
UPGRADE_VERSION = "2026.10.13"

# What prepare_media_sync found. Setup records the step as done after the
# first two and after neither of the others.
STATE_FRESH = "fresh"
STATE_UPGRADED = "upgraded"
STATE_ALREADY = "already"
STATE_FAILED = "failed"

# Where an installation keeps its images and receipts: IMAGES_LOCAL, its
# own folders on the Home Assistant disk - www's or media's - or the name of
# a network-storage folder under /media. The options form offers the default as IMAGES_LOCAL_CHOICE,
# a value no folder can have - valid_folder_name refuses this integration's
# own names - because a select needs a value and "" is none.
IMAGES_LOCAL = ""
IMAGES_LOCAL_CHOICE = "home_organizer_local"

# Which folder HOLDS the images, in app_settings. It moves only once a copy
# into a newly chosen folder has finished - see copy_images_sync.
IMAGES_SETTING = "images_location_active"

# A network folder's images are served under their own URL, one per folder:
# /home_organizer_images/<name>. Not a path below /home_organizer_media -
# aiohttp matches a static route by its prefix, so a sub-path of that route
# would be captured by it and answer 404. And a NEW url when the folder
# changes, because a static route cannot be re-pointed while Home Assistant
# runs: the reload that follows a change of options registers the new one,
# and nothing has to wait for a restart.
NET_IMG_URL = "/home_organizer_images"

# The receipts of a network folder, likewise: /home_organizer_receipts/<name>.
NET_RECEIPTS_URL = "/home_organizer_receipts"

# On a network folder the files go into ONE folder of this integration's
# own, with a sub-folder each - <share>/home_organizer/images and
# <share>/home_organizer/receipts. The share is the user's, usually full of
# their own things; two loose folders at its root would sit among them.
NET_DIR = "home_organizer"
NET_IMG_SUB = "images"
NET_RECEIPTS_SUB = "receipts"

# Which folder HOLDS the receipts, in app_settings - moved only once their
# files have been copied and their rows re-pointed. A record of its own, so
# images that were moved and receipts that were not are never confused.
RECEIPTS_SETTING = "receipts_location_active"

# The name of a network-storage folder, as Home Assistant creates it under
# /media. It becomes part of a path AND of a URL: letters, digits, _ and -
# only, and never one of this integration's own folders (RULE 31).
_FOLDER_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


class ImageFolderUnavailable(OSError):
    """The network folder chosen for the images is not connected."""

# A recipe photo is stored as a bare filename the integration generated:
# "rp_" + ten hex characters + an extension. Anything else in that column is
# not copied - a name with a slash in it is not a name this code wrote, and
# copying it would be copying from wherever it pointed (RULE 31).
_PHOTO_NAME = re.compile(r"^rp_[0-9a-f]{10}\.(?:jpg|jpeg|png|webp)$")

# A Stylist photo is named after the Home Assistant user it belongs to, and
# those ids are 32 hex characters. Anything outside this set is not a user
# id, and is never put into a file name.
_USER_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def valid_folder_name(name):
    """Is this a network-storage folder name the images may use?"""
    return (isinstance(name, str) and bool(_FOLDER_NAME.match(name))
            and not name.lower().startswith("home_organizer"))


def net_folders(location):
    """(images folder, receipts folder, mount) on a network folder.

    None for a name that is not valid - never a path built from it
    (RULE 31). The mount is the network-storage folder itself.
    """
    if not (location and valid_folder_name(location)):
        return None
    mount = os.path.join(MEDIA_ROOT, location)
    base = os.path.join(mount, NET_DIR)
    return (os.path.join(base, NET_IMG_SUB),
            os.path.join(base, NET_RECEIPTS_SUB), mount)


def files_folder(paths, location, kind):
    """(folder, mount) holding the "images" or the "receipts" for one
    location value: IMAGES_LOCAL is the installation's own folder on the
    Home Assistant disk - www's or media's, whichever paths describes - and
    anything else a network folder. An invalid name is the local folder."""
    net = net_folders(location)
    if net:
        return (net[0] if kind == "images" else net[1]), net[2]
    return (paths["local_img_path"] if kind == "images"
            else paths["local_receipt_path"]), None


def images_choice(choice, offered):
    """The option value for what was picked in the options form, or None.

    IMAGES_LOCAL_CHOICE is the default. Anything else must be a valid folder
    name AND one of the folders the form offered: the form's answer is
    checked here, not trusted (RULE 31).
    """
    if choice == IMAGES_LOCAL_CHOICE:
        return IMAGES_LOCAL
    if valid_folder_name(choice) and choice in offered:
        return choice
    return None


def storage_paths(config_dir, method, media_available, images_location=None):
    """Every data location for one storage choice. No I/O.

    config_dir is Home Assistant's config directory. media_available says
    whether /media exists; the caller checks it in the executor, because a
    filesystem call does not belong on the event loop (RULE 13). If media was
    chosen and is not there, the answer is the www layout - the long-standing
    fallback - and `fell_back` says so, so the caller can warn.

    images_location moves the IMAGES and the RECEIPTS onto a
    network-storage folder, for www and media alike; the databases stay
    where they are. A name that is not valid is reported in
    `images_location_invalid` and the files stay on the local disk.
    """
    www = os.path.join(config_dir, "www")
    paths = {
        "method": METHOD_WWW,
        "fell_back": False,
        "db_path": os.path.join(config_dir, DB_FILE),
        "recipes_db_path": os.path.join(config_dir, RECIPES_DB_FILE),
        "img_path": os.path.join(www, IMG_DIR),
        "receipt_path": os.path.join(www, RECEIPTS_DIR),
        "url_prefix": "/local/" + IMG_DIR,
        "receipt_url_prefix": "/local/" + RECEIPTS_DIR,
        # Where www-layout files live, whatever was chosen. Kept so that a
        # file written there before the user moved to media - a receipt row
        # that stores an absolute www path - can still be found and served.
        "www_root": www,
        "legacy_recipes_db_path": os.path.join(config_dir, RECIPES_DB_FILE),
        "legacy_img_path": os.path.join(www, IMG_DIR),
        "images_mount": None,
        "receipts_mount": None,
        # The installation's own folders on the Home Assistant disk - www's
        # here, media's below - which the files use unless a network folder
        # is chosen, and are moved from when one is.
        "local_img_path": os.path.join(www, IMG_DIR),
        "local_receipt_path": os.path.join(www, RECEIPTS_DIR),
        "images_location": IMAGES_LOCAL,
        "images_location_invalid": None,
    }
    if method == METHOD_MEDIA:
        if not media_available:
            # The long-standing fallback, network folder included: those
            # live under /media too, which is not there.
            paths["fell_back"] = True
            return paths
        paths.update({
            "method": METHOD_MEDIA,
            "db_path": os.path.join(MEDIA_ROOT, DB_FILE),
            "recipes_db_path": os.path.join(MEDIA_ROOT, RECIPES_DB_FILE),
            "img_path": os.path.join(MEDIA_ROOT, IMG_DIR),
            "receipt_path": os.path.join(MEDIA_ROOT, RECEIPTS_DIR),
            "url_prefix": MEDIA_IMG_URL,
            "receipt_url_prefix": MEDIA_RECEIPTS_URL,
            "local_img_path": os.path.join(MEDIA_ROOT, IMG_DIR),
            "local_receipt_path": os.path.join(MEDIA_ROOT, RECEIPTS_DIR),
        })
    # The files may go onto a network folder whichever method keeps the
    # databases; the databases never do.
    net = net_folders(images_location)
    if net:
        paths.update({
            "img_path": net[0],
            "url_prefix": NET_IMG_URL + "/" + images_location,
            "images_mount": net[2],
            "images_location": images_location,
            # The receipts go with the images; the databases do not.
            "receipt_path": net[1],
            "receipt_url_prefix": NET_RECEIPTS_URL + "/" + images_location,
            "receipts_mount": net[2],
        })
    elif images_location:
        paths["images_location_invalid"] = images_location
    return paths


def served_roots(paths):
    """(folder, url) pairs that may be turned into a browser URL.

    Used to map a stored file path to an address. The www root is always
    included, because files written before a move to media keep their www
    paths in the database and must stay viewable.
    """
    roots = [(paths["www_root"], "/local")]
    if paths.get("method") == METHOD_MEDIA or paths.get("images_mount"):
        roots.append((paths["img_path"], paths["url_prefix"]))
        roots.append((paths["receipt_path"], paths["receipt_url_prefix"]))
    # Receipts moved off media's own folder onto a network folder go on being
    # found there until their rows have been re-pointed - see
    # database.async_move_receipt_files. www's own folder needs no entry: it
    # is under the www root, served at /local whatever happens.
    if paths.get("method") == METHOD_MEDIA and paths.get("receipts_mount"):
        roots.append((paths["local_receipt_path"], MEDIA_RECEIPTS_URL))
    return roots


def copy_recipes_db_once_sync(src, dst):
    """Copy the recipe database to its media home, once. Never deletes.

    Only when the destination does not exist and the source does. Uses
    SQLite's own backup API rather than a file copy: a byte copy of a
    database that has a write-ahead log can miss pages still in the log,
    and the backup API copies a consistent database whatever its journal
    mode. The source is opened read-only, so nothing about it can change.

    Returns True if a copy was made. Runs in the executor.
    """
    if os.path.exists(dst) or not os.path.exists(src):
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    tmp = dst + ".copying"
    if os.path.exists(tmp):
        os.remove(tmp)
    s = sqlite3.connect("file:%s?mode=ro" % src.replace("\\", "/"), uri=True)
    try:
        d = sqlite3.connect(tmp)
        try:
            s.backup(d)
        finally:
            d.close()
    except BaseException:
        # Nothing half-made is left behind. The next start would remove it
        # anyway, but a failed copy should not leave a file in /media that
        # looks like a database.
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    finally:
        s.close()
    # Renamed into place only once complete, so a copy interrupted half way
    # leaves no half-database where the real one belongs - the next start
    # simply tries again.
    os.replace(tmp, dst)
    return True


def recipe_photo_names_sync(db_path):
    """The dish-photo filenames a recipe database refers to. Read-only."""
    if not os.path.exists(db_path):
        return []
    c = sqlite3.connect("file:%s?mode=ro" % db_path.replace("\\", "/"),
                        uri=True)
    try:
        cols = {r[1] for r in c.execute("PRAGMA table_info(recipes)")}
        if "image_path" not in cols:
            return []
        names = [r[0] for r in c.execute(
            "SELECT image_path FROM recipes WHERE image_path IS NOT NULL")]
    finally:
        c.close()
    return sorted({n for n in names if n and _PHOTO_NAME.match(n)})


def avatar_path(img_dir, user_id):
    """The Stylist photo of one user, inside img_dir - or None.

    No user means the shared photo, user_avatar.jpg. A user id that is not
    a plain id is REFUSED rather than cleaned up - a cleaned-up id would be
    somebody else's name - and the result is checked to be inside img_dir
    all the same, because text joined into a path is how '..' gets out
    (RULE 31). Upload and Stylist both call this, so the photo written and
    the photo read can never be two different files.
    """
    if not user_id:
        name = "user_avatar.jpg"
    elif _USER_ID.match(str(user_id)):
        name = "user_avatar_%s.jpg" % user_id
    else:
        return None
    base = os.path.abspath(img_dir)
    path = os.path.abspath(os.path.join(base, name))
    if os.path.commonpath([base, path]) != base:
        return None
    return path


def _device(path):
    """The device a path is on. Its own function so a test can stand in."""
    return os.stat(path).st_dev


def is_connected_sync(mount):
    """Is this network-storage folder actually connected?

    Home Assistant mounts a network share ONTO a folder under /media. When
    the share is not connected the folder is still there, empty, on the
    Home Assistant disk. Connected means: on a different device from the
    folder it sits in.
    """
    try:
        if not os.path.isdir(mount):
            return False
        parent = os.path.dirname(os.path.normpath(mount))
        return _device(mount) != _device(parent)
    except OSError:
        return False


def ready_dir_sync(path, mount=None):
    """Create a folder to write into - but never in place of a network
    folder that is not connected.

    The one place an images folder is created. With mount given, the folder
    belongs on that network folder, and while it is not connected this
    raises instead of creating anything: whatever were written there would
    land on the very disk the images were moved off, and be hidden as soon
    as the share came back.
    """
    if mount and not is_connected_sync(mount):
        raise ImageFolderUnavailable(
            "the network folder %s is not connected; nothing was written to "
            "the Home Assistant disk in its place" % mount)
    os.makedirs(path, exist_ok=True)
    return path


def prepare_folders_sync(paths):
    """Create the images and receipts folders for setup.

    {"images": bool, "receipts": bool, "local_receipts": bool}. A folder
    that belongs on a network folder that is not connected is False, and
    then nothing is created for it. local_receipts says whether the receipts
    folder on the Home Assistant disk is there to serve receipts that have
    not been moved off it yet.
    """
    ready = {}
    for key, folder, mount in (
            ("images", paths["img_path"], paths.get("images_mount")),
            ("receipts", paths["receipt_path"], paths.get("receipts_mount"))):
        try:
            ready_dir_sync(folder, mount)
            ready[key] = True
        except ImageFolderUnavailable:
            ready[key] = False
    local = paths.get("local_receipt_path")
    ready["local_receipts"] = bool(
        paths.get("method") == METHOD_MEDIA and paths.get("receipts_mount")
        and local and os.path.isdir(local))
    return ready


def network_folders_sync(media_root=None):
    """The connected network-storage folders under /media, by name."""
    root = media_root or MEDIA_ROOT
    try:
        names = os.listdir(root)
    except OSError:
        return []
    return sorted(n for n in names if valid_folder_name(n)
                  and is_connected_sync(os.path.join(root, n)))


def copy_images_sync(src_dir, src_mount, dst_dir, dst_mount):
    """Copy every image from the folder that held them into the one now
    chosen. Never overwrites and never deletes: the old folder is left for
    the user to remove once everything shows. Returns how many were copied.

    Raises ImageFolderUnavailable when either side is a network folder that
    is not connected, so the caller records nothing and tries again.
    """
    if src_mount and not is_connected_sync(src_mount):
        raise ImageFolderUnavailable(
            "the network folder %s, which holds the images, is not "
            "connected" % src_mount)
    ready_dir_sync(dst_dir, dst_mount)
    if os.path.abspath(src_dir) == os.path.abspath(dst_dir):
        return 0
    try:
        names = [n for n in os.listdir(src_dir)
                 if os.path.isfile(os.path.join(src_dir, n))]
    except FileNotFoundError:
        return 0
    return copy_missing_files_sync(src_dir, dst_dir, names)


def _avatar_names(folder):
    """The Stylist photos in a folder: user_avatar.jpg, user_avatar_<id>.jpg."""
    try:
        return sorted(n for n in os.listdir(folder)
                      if n.startswith("user_avatar") and n.endswith(".jpg"))
    except OSError:
        return []


def media_upgrade_done_sync(db_path):
    """Has the one-time step already run for this database? Read-only."""
    try:
        c = sqlite3.connect("file:%s?mode=ro" % db_path.replace("\\", "/"),
                            uri=True)
        try:
            row = c.execute("SELECT value FROM app_settings WHERE key = ?",
                            (UPGRADE_SETTING,)).fetchone()
        finally:
            c.close()
    except sqlite3.Error:
        # No app_settings table - a database from before it existed - or a
        # database that cannot be read: not recorded. The step only ever adds
        # a file that is missing, so running it cannot overwrite or remove
        # anything.
        return False
    return bool(row and row[0])


def prepare_media_sync(paths):
    """Bring across what older versions left in /config, once.

    Runs in the executor, BEFORE either database is opened: the main
    database not existing yet is how a fresh installation is told apart from
    an existing one, and recipes_db.async_init would otherwise create an
    empty recipe database exactly where the copy belongs.

    FRESH - no main database in /media before this start. Nothing is copied.
    This is the user's report: a new media installation whose items started
    from nothing while the recipes of an earlier www installation appeared
    anyway. That data stays where it was, untouched, and the recipes start
    from nothing like everything else.

    UPGRADED - a media installation that already existed. Older versions
    kept its recipe database in /config and its Stylist photos in
    /config/www whatever was chosen, so those are copied across, with the
    dish photos the recipes name. Without this an upgrade would hide recipes
    made in this very installation (RULE 25).

    ALREADY - the step ran on an earlier start; setup recorded it. It does
    not run twice: a user who removes the recipe database in /media to
    start the recipes afresh gets exactly that, and not the old copy back on
    the next restart.

    FAILED - something could not be done. Nothing is recorded, so the next
    start tries again - every copy skips a file that is already there - and
    if the recipe database did not reach /media the recipes go on being read
    from where they are, as before this version, rather than silently
    starting empty (RULE 31).

    Never moves, deletes or overwrites the user's data: the only file it
    ever removes is its own unfinished temporary copy (RULE 5).
    """
    report = {"state": STATE_FAILED, "error": "", "recipes_db": False,
              "photos": 0, "avatars": 0,
              "recipes_db_path": paths["recipes_db_path"]}
    try:
        # No folder is made here. Setup makes the images and receipts
        # folders through prepare_folders_sync, which will not make one in
        # place of a network folder that is not connected - and neither may
        # this step.
        if not os.path.exists(paths["db_path"]):
            report["state"] = STATE_FRESH
            return report
        if media_upgrade_done_sync(paths["db_path"]):
            report["state"] = STATE_ALREADY
            return report
        report["recipes_db"] = copy_recipes_db_once_sync(
            paths["legacy_recipes_db_path"], paths["recipes_db_path"])
        # Into the images folder, wherever it is. On a network folder
        # that is not connected this raises, the step is FAILED, nothing is
        # recorded, and the next start copies them.
        ready_dir_sync(paths["img_path"], paths.get("images_mount"))
        report["photos"] = copy_missing_files_sync(
            paths["legacy_img_path"], paths["img_path"],
            recipe_photo_names_sync(paths["recipes_db_path"]))
        report["avatars"] = copy_missing_files_sync(
            paths["legacy_img_path"], paths["img_path"],
            _avatar_names(paths["legacy_img_path"]))
        report["state"] = STATE_UPGRADED
    except Exception as err:
        # Reported to setup, which logs it and carries on.
        report["error"] = "%s: %s" % (type(err).__name__, err)
        if (not os.path.exists(paths["recipes_db_path"])
                and os.path.exists(paths["legacy_recipes_db_path"])):
            report["recipes_db_path"] = paths["legacy_recipes_db_path"]
    return report


def copy_missing_files_sync(src_dir, dst_dir, names):
    """Copy each named file that is in src_dir and not yet in dst_dir.

    Never overwrites and never deletes. Returns how many were copied.
    dst_dir must exist: ready_dir_sync makes it, and is the only thing that
    may - this does not create folders.
    """
    if not names or os.path.abspath(src_dir) == os.path.abspath(dst_dir):
        return 0
    copied = 0
    for name in names:
        if os.path.basename(name) != name:
            continue
        src = os.path.join(src_dir, name)
        dst = os.path.join(dst_dir, name)
        if os.path.isfile(src) and not os.path.exists(dst):
            shutil.copy2(src, dst)
            copied += 1
    return copied

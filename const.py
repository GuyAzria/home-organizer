"""Constants for the Home Organizer integration."""

DOMAIN = "home_organizer"
VERSION = "2.0.2"

# Configuration Keys
CONF_API_KEY = "api_key"
CONF_DEBUG = "debug_mode"
CONF_USE_AI = "use_ai" 
# [ADDED v7.7.1 | 2026-02-19] Purpose: New options for storage location and deletion
CONF_STORAGE_METHOD = "storage_method"
CONF_DELETE_ON_REMOVE = "delete_on_remove"
STORAGE_METHOD_WWW = "www"
STORAGE_METHOD_MEDIA = "media"

# Storage
DB_FILE = "home_organizer.db"
IMG_DIR = "home_organizer_images"
# ... (Imports same as before) ...
# Home Organizer Ultimate - ver 3.12.0 (Reliable Updates)

# ... (Previous code remains the same until register_services) ...

async def register_services(hass, entry):
    # ...
    
    def broadcast_update():
        # Fire event to tell all clients to refresh
        hass.bus.async_fire("home_organizer_db_update")

    # ... (Other handlers) ...

    async def handle_update_image(call):
        name = call.data.get("item_name")
        img_b64 = call.data.get("image_data")
        # Extract base64
        if "," in img_b64: img_b64 = img_b64.split(",")[1]
        
        # Unique filename with timestamp to force cache bust on all clients
        fname = f"{name}_{int(time.time())}.jpg"
        
        def save_and_update_db():
            # 1. Save File
            file_path = hass.config.path("www", IMG_DIR, fname)
            with open(file_path, "wb") as f:
                f.write(base64.b64decode(img_b64))
            
            # 2. Update DB
            conn = get_db_connection(hass); c = conn.cursor()
            c.execute(f"UPDATE items SET image_path = ? WHERE name = ?", (fname, name))
            conn.commit(); conn.close()
            
        await hass.async_add_executor_job(save_and_update_db)
        
        # 3. Broadcast to all clients
        broadcast_update()

    # ... (Rest of file same as 3.10.0) ...

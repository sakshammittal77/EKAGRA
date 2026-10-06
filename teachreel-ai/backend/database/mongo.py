import os
import json
from datetime import datetime

# A simple mock database using a JSON file so you don't need MongoDB installed to test!
DB_FILE = os.path.join(os.path.dirname(__file__), "mock_db.json")

# Initialize file if it doesn't exist
if not os.path.exists(DB_FILE):
    with open(DB_FILE, "w") as f:
        json.dump({}, f)

def read_db():
    with open(DB_FILE, "r") as f:
        return json.load(f)

def write_db(data):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=4, default=str)

async def get_db():
    return read_db()

async def save_generation_status(generation_id: str, data: dict):
    db_data = read_db()
    if generation_id not in db_data:
        db_data[generation_id] = {}
    
    # Update dictionary
    for k, v in data.items():
        db_data[generation_id][k] = v
        
    write_db(db_data)

async def get_generation_status(generation_id: str):
    db_data = read_db()
    return db_data.get(generation_id)

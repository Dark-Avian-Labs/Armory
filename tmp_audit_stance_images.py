import json
import sqlite3

DB_PATH = r"d:/Development/Dark Avian Labs/Armory/data/armory.db"

SPECIAL_STANCES = [
    "Whipclaw",
    "Garuda Talons",
    "Razorwing",
    "Shattered Lash",
    "Shadow Clones",
    "Hysteria",
    "Serene Storm",
    "Exalted Blade",
    "Ravenous Wraith",
    "Primal Fury",
]

db = sqlite3.connect(DB_PATH)
cur = db.cursor()

cur.execute(
    """
    SELECT name, compat_name, unique_name, image_path, type
    FROM mods
    WHERE upper(type) = 'STANCE'
      AND image_path IS NOT NULL
      AND (
        lower(image_path) LIKE '%/abilities/%'
        OR lower(image_path) LIKE '%/powersuits/%'
      )
    ORDER BY name
    """
)
ability_like = [dict(zip([c[0] for c in cur.description], r)) for r in cur.fetchall()]

placeholders = ",".join("?" for _ in SPECIAL_STANCES)
cur.execute(
    f"""
    SELECT name, compat_name, image_path, base_drain, fusion_limit, unique_name
    FROM mods
    WHERE upper(type) = 'STANCE'
      AND name IN ({placeholders})
    ORDER BY name
    """,
    SPECIAL_STANCES,
)
special_rows = [dict(zip([c[0] for c in cur.description], r)) for r in cur.fetchall()]

print("ABILITY_LIKE_STANCE_IMAGES")
print(json.dumps(ability_like, indent=2))
print(f"ABILITY_LIKE_COUNT={len(ability_like)}")
print()
print("SPECIAL_EXALTED_STANCE_ROWS")
print(json.dumps(special_rows, indent=2))
print(f"SPECIAL_FOUND_COUNT={len(special_rows)}")

db.close()

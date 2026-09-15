import json
import os
import random

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, "games.json")

def load_games():
    if not os.path.exists(JSON_PATH): return []
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

GAMES_DB = load_games()

def get_game_by_id(app_id: int):
    for game in GAMES_DB:
        if game.get("app_id") == app_id: return game
    return None

def get_random_game():
    if not GAMES_DB: return None
    return random.choice(GAMES_DB)

def get_stats(limit: int = 10):
    genre_counts = {}
    dev_counts = {}
    
    for g in GAMES_DB:
        # Genre stats
        for genre in str(g.get("genres", "")).split(","):
            genre = genre.strip()
            if genre and genre != "nan":
                genre_counts[genre] = genre_counts.get(genre, 0) + 1
        
        # Dev stats
        dev = str(g.get("developer", "")).strip()
        if dev and dev != "nan" and dev != "Unknown":
            dev_counts[dev] = dev_counts.get(dev, 0) + 1
            
    top_genres = dict(sorted(genre_counts.items(), key=lambda item: item[1], reverse=True)[:limit])
    top_devs = dict(sorted(dev_counts.items(), key=lambda item: item[1], reverse=True)[:limit])
    
    return {"genres": top_genres, "developers": top_devs}

def search_games(query: str = "", skip: int = 0, limit: int = 50, sort_by: str = "", free_only: str = "false", developer: str = "", ids: str = ""):
    results = GAMES_DB
    
    if ids:
        id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
        results = [g for g in results if g.get("app_id") in id_list]
        
    if query:
        terms = [t.strip().lower() for t in query.split(",") if t.strip()]
        results = [
            g for g in results 
            if all(term in str(g.get("name", "")).lower() or term in str(g.get("genres", "")).lower() for term in terms)
        ]
        
    if developer:
        d = developer.lower()
        results = [g for g in results if d == str(g.get("developer", "")).lower()]
        
    if free_only.lower() == "true":
        results = [g for g in results if g.get("price", 0.0) == 0.0]
        
    if sort_by == "price_asc":
        results = sorted(results, key=lambda x: float(x.get("price", 0.0)))
    elif sort_by == "price_desc":
        results = sorted(results, key=lambda x: float(x.get("price", 0.0)), reverse=True)
    elif sort_by == "hidden_gem":
        def gem_score(g):
            pos = int(g.get("positive_ratings", 0))
            total = pos + int(g.get("negative_ratings", 0))
            if total < 50 or total > 1500: return 0 
            return pos / total
        results = sorted(results, key=gem_score, reverse=True)
    elif sort_by == "recent":
        results = sorted(results, key=lambda x: int(x.get("app_id", 0)), reverse=True)

    return results[skip : skip + limit]
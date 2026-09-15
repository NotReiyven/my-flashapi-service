from fastapi import APIRouter, HTTPException, Query
from api._data_access import get_game_by_id, search_games, get_random_game, get_stats
from api._models import Game

router = APIRouter()

@router.get("/games")
def get_games(
    q: str = Query("", description="Search query"),
    skip: int = Query(0, ge=0), 
    limit: int = Query(50, ge=1, le=2000),
    sort_by: str = Query("", description="Sort method"),
    free_only: str = Query("false", description="Free only toggle"),
    developer: str = Query("", description="Filter by developer"),
    ids: str = Query("", description="Comma separated list of IDs for wishlist")
):
    results = search_games(q, skip, limit, sort_by, free_only, developer, ids)
    return {"results": results}

@router.get("/games/random", response_model=Game)
def get_random():
    game = get_random_game()
    if not game: raise HTTPException(status_code=404, detail="No games available")
    return game

@router.get("/games/stats")
def get_dashboard_stats(limit: int = Query(10, ge=1, le=50)):
    return get_stats(limit)

@router.get("/games/{app_id}", response_model=Game)
def get_game(app_id: int):
    game = get_game_by_id(app_id)
    if not game: raise HTTPException(status_code=404, detail="Game not found")
    return game
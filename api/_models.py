from pydantic import BaseModel
from typing import Optional, Any

class Game(BaseModel):
    app_id: int
    name: str
    developer: Optional[Any] = None
    publisher: Optional[Any] = None
    genres: Optional[Any] = None
    release_date: Optional[str] = None
    price: float
    positive_ratings: int
    negative_ratings: int
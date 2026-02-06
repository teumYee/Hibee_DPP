from pydantic import BaseModel
from typing import List, Dict

class TopApp(BaseModel):
    name: str
    count: int

class DashboardSummaryResponse(BaseModel):
    summary: Dict[str, float]  # total_time, total_unlocks 등
    top_visited: Dict[str, List[TopApp] | TopApp]
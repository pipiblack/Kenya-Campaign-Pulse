from fastapi import APIRouter

from app.api.v1 import alerts, auth, pitch_simulation, sentiment, voice

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(sentiment.router, prefix="/sentiment", tags=["KP-Sense"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["KP-Sentry"])
api_router.include_router(voice.router, prefix="/voice", tags=["KP-Voice"])
api_router.include_router(pitch_simulation.router, prefix="/pitch", tags=["KP-Command"])


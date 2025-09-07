from fastapi import FastAPI
from api import contracts
from db.mongodb import connect_to_mongo, close_mongo_connection
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

app = FastAPI(
    title="Contract Intelligence API",
    description="API for processing and analyzing contracts.",
    version="1.0.0"
)

# CORS
_origins = [o.strip() for o in (settings.CORS_ALLOW_ORIGINS or "").split(",") if o.strip()] or ["*"]
_methods = [m.strip() for m in (settings.CORS_ALLOW_METHODS or "").split(",") if m.strip()] or ["*"]
_headers = [h.strip() for h in (settings.CORS_ALLOW_HEADERS or "").split(",") if h.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=_methods,
    allow_headers=_headers,
)

# Registers event handlers for DB connection
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Includes the API router
app.include_router(contracts.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Contract Intelligence API"}
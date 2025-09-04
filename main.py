# main.py
from fastapi import FastAPI
from api import contracts
from db.mongodb import connect_to_mongo, close_mongo_connection

app = FastAPI(
    title="Contract Intelligence API",
    description="API for processing and analyzing contracts.",
    version="1.0.0"
)

# Register event handlers for DB connection
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

# Include the API router
app.include_router(contracts.router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Contract Intelligence API"}
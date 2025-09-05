import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from starlette.responses import JSONResponse
from typing import Optional
from datetime import datetime
from pymongo import ASCENDING, DESCENDING
from fastapi.responses import FileResponse

from db.models import (
    Contract, StatusResponse, ContractDataResponse, 
    PaginatedContractResponse, ContractSummary
)
from db.mongodb import get_collection
from tasks.celery_worker import process_contract_task
from core.config import settings

router = APIRouter()


@router.post("/contracts/upload")
async def upload_contract(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDFs are accepted.")
    uploads_dir = Path(settings.UPLOADS_DIR)
    uploads_dir.mkdir(exist_ok=True)
    contract = Contract(file_name=file.filename, file_path="")
    file_path = uploads_dir / f"{contract.contract_id}_{file.filename}"
    contract.file_path = str(file_path)
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
    contracts_collection = get_collection("contracts")
    await contracts_collection.insert_one(contract.dict(by_alias=True))
    process_contract_task.delay(contract.contract_id, str(file_path))
    return JSONResponse(status_code=202, content={"contract_id": contract.contract_id, "status": "processing", "message": "Contract uploaded successfully."})


@router.get("/contracts/{contract_id}/status", response_model=StatusResponse)
async def get_contract_status(contract_id: str):

    contract = await get_collection("contracts").find_one({"contract_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return StatusResponse(
        contract_id=contract["contract_id"],
        status=contract.get("processing_status", "unknown"),
        progress_percentage=contract.get("progress_percentage", 0),
        progress_message=contract.get("progress_message", "Status not available."),
        error_message=contract.get("error_message")
    )

@router.get("/contracts/{contract_id}", response_model=ContractDataResponse)
async def get_contract_data(contract_id: str):
    """
    Retrieves the fully parsed and structured data for a contract.
    This endpoint is only available for successfully completed contracts.
    """
    contract = await get_collection("contracts").find_one({"contract_id": contract_id})

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    status = contract.get("processing_status")

    if status == "processing":
        raise HTTPException(
            status_code=422,
            detail="Contract is still being processed. Please check the status endpoint."
        )
    
    if status == "error":
        raise HTTPException(
            status_code=409, # Conflict with the resource's state
            detail=f"Processing failed for this contract. Error: {contract.get('error_message')}"
        )

    if status != "completed":
        raise HTTPException(status_code=500, detail=f"Contract is in an unknown state: {status}")

    # If status is "completed", return the data
    return ContractDataResponse(
        contract_id=contract["contract_id"],
        file_name=contract["file_name"],
        processing_status=contract["processing_status"],
        extracted_data=contract.get("extracted_data", {}),
        identified_gaps=contract.get("identified_gaps", []),
        upload_timestamp=contract["upload_timestamp"]
    )


@router.get("/contracts", response_model=PaginatedContractResponse)
async def list_contracts(
    page: int = Query(1, ge=1, description="Page number, starting from 1"),
    size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    
    q: Optional[str] = Query(None, description="Free-text search across file name and extracted party names."),

    # Filtering parameters
    status: Optional[str] = Query(None, description="Filter by processing status (e.g., 'completed', 'error')"),
    start_date: Optional[datetime] = Query(None, description="Filter contracts uploaded after this date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter contracts uploaded before this date (ISO format)"),
    file_name_contains: Optional[str] = Query(None, description="Filter by file name containing this text (case-insensitive)"),
    
    # Sorting parameters
    sort_by: str = Query("upload_timestamp", description="Field to sort by: 'upload_timestamp', 'file_name', 'processing_status'"),
    sort_order: str = Query("desc", description="Sort order: 'asc' or 'desc'")
):
    """
    Retrieves a paginated and filterable list of all uploaded contracts.
    """
    contracts_collection = get_collection("contracts")
    query = {}

    # --- 1. Build the filter query dynamically ---

    if q:
        # Adding the text search clause if a search query is provided
        query["$text"] = {"$search": q}
        
    if status:
        query["processing_status"] = status
    if file_name_contains:
        # Using a case-insensitive regex search for partial matches
        query["file_name"] = {"$regex": file_name_contains, "$options": "i"}
    if start_date or end_date:
        query["upload_timestamp"] = {}
        if start_date:
            query["upload_timestamp"]["$gte"] = start_date
        if end_date:
            query["upload_timestamp"]["$lte"] = end_date
    
    # --- 2. Get the total count for pagination ---
    try:
        total_items = await contracts_collection.count_documents(query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database count error: {e}")

    # --- 3. Prepare sorting and pagination parameters ---
    skip = (page - 1) * size
    
    # Validate sort parameters
    allowed_sort_fields = {"upload_timestamp", "file_name", "processing_status"}
    if sort_by not in allowed_sort_fields:
        raise HTTPException(status_code=400, detail=f"Invalid sort_by field. Allowed values: {list(allowed_sort_fields)}")
    
    if q is None and sort_by == "relevance":
        raise HTTPException(status_code=400, detail="Cannot sort by 'relevance' without a search query 'q'.")


    sort_direction = DESCENDING if sort_order.lower() == "desc" else ASCENDING

    # Define the sorting criteria
    if sort_by == "relevance":
        sort_criteria = {"score": {"$meta": "textScore"}}
    else:
        sort_direction = DESCENDING if sort_order.lower() == "desc" else ASCENDING
        sort_criteria = (sort_by, sort_direction)


    # --- 4. Define Projection (Critical for Performance) ---
    # Only fetch the data needed for the summary view to keep the response fast.
    projection = {
        "contract_id": 1, "file_name": 1, "upload_timestamp": 1,
        "processing_status": 1, "gaps_count": 1, "file_size": 1, "_id": 0
    }
    # If sorting by relevance, we must also project the score
    if sort_by == "relevance":
        projection["score"] = {"$meta": "textScore"}
    
    # --- 5. Execute the query to get the paginated list ---
    try:
        cursor = contracts_collection.find(
        query,
        projection
    ).sort(*sort_criteria if isinstance(sort_criteria, tuple) else sort_criteria).skip(skip).limit(size)
        
        contracts_list = await cursor.to_list(length=size)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database fetch error: {e}")

    # --- 6. Format the results into the response model ---
    summaries = [
        ContractSummary(
            contract_id=c.get("contract_id"),
            file_name=c.get("file_name"),
            upload_timestamp=c.get("upload_timestamp"),
            processing_status=c.get("processing_status"),
            # Calculate gaps_count safely, handling cases where the field might be missing
             gaps_count=c.get("gaps_count") or 0,
             file_size=c.get("file_size") or 0,
        )
        for c in contracts_list
    ]

    return PaginatedContractResponse(
        total_items=total_items, items=summaries, page=page, size=size
    )

@router.get("/contracts/{contract_id}/download")
async def download_contract(contract_id: str):
    """
    Downloads the original PDF file for a given contract ID.
    """
    contracts_collection = get_collection("contracts")
    
    # 1. Find the contract document in the database
    contract = await contracts_collection.find_one({"contract_id": contract_id})

    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # 2. Get the file path and original filename from the document
    file_path = contract.get("file_path")
    original_filename = contract.get("file_name")

    # 3. Check if the file actually exists on the server's disk
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=404, 
            detail="File not found on the server. It may have been moved or deleted."
        )

    # 4. Use FileResponse to send the file back to the client.
    # This is highly efficient and handles streaming the file for you.
    return FileResponse(
        path=file_path,
        media_type='application/pdf',
        filename=original_filename # This sets the "Content-Disposition" header
    )
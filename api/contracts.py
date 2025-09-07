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
            status_code=409, 
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
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    sort_by: str = Query("upload_timestamp", regex="^(upload_timestamp|file_name|processing_status)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$")
):
    """List all contracts with pagination and sorting."""
    try:
        contracts_collection = get_collection("contracts")
        
        # Build sort criteria
        sort_direction = -1 if sort_order == "desc" else 1
        sort_criteria = [(sort_by, sort_direction)]
        
        # Calculate skip value for pagination
        skip = (page - 1) * size
        
        # Get total count
        total_count = await contracts_collection.count_documents({})
        
        # Get contracts with pagination and sorting
        contracts_cursor = contracts_collection.find({}).sort(sort_criteria).skip(skip).limit(size)
        contracts = []
        
        async for c in contracts_cursor:
            # Handle missing upload_timestamp
            upload_timestamp = c.get("upload_timestamp")
            if upload_timestamp is None:
                # Use created_at if available, otherwise use current time
                upload_timestamp = c.get("created_at") or datetime.now()
            
            contracts.append(ContractSummary(
                contract_id=c.get("contract_id"),
                file_name=c.get("file_name"),
                processing_status=c.get("processing_status", "unknown"),
                progress_percentage=c.get("progress_percentage", 0),
                upload_timestamp=upload_timestamp,
                file_size=c.get("file_size") or 0,
                gaps_count=c.get("gaps_count") or 0,
            ))
        
        # Calculate pagination info
        total_pages = (total_count + size - 1) // size
        has_next = page < total_pages
        has_prev = page > 1
        
        return PaginatedContractResponse(
            total_items=total_count,
            items=contracts,
            page=page,
            size=size,
            total_pages=total_pages,
            has_next=has_next,
            has_prev=has_prev
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing contracts: {str(e)}")

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


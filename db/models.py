from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

# --- Helper models for structured data ---
class ExtractedField(BaseModel):
    value: Any
    confidence_score: float = Field(..., ge=0, le=1) # Score between 0 and 1
    source_snippet: Optional[str] = None # Optional: a small piece of text where it was found
    source_page: Optional[int] = None
    
# --- Main Contract Model (in DB) ---
class Contract(BaseModel):
    contract_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    file_name: str
    upload_timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_status: str = "processing"
    progress_percentage: int = 0
    progress_message: str = "Task has been queued."
    error_message: Optional[str] = None
    file_path: str
    extracted_data: Optional[Dict[str, Any]] = None # This will store the structured data
    identified_gaps: Optional[List[str]] = None
    gaps_count: Optional[int] = None 

# --- Status Response Model  ---
class StatusResponse(BaseModel):
    contract_id: str
    status: str
    progress_percentage: int
    progress_message: str
    error_message: Optional[str] = None

# --- Detailed Contract Data Response Model ---
class ContractDataResponse(BaseModel):
    contract_id: str
    file_name: str
    processing_status: str
    extracted_data: Dict[str, Any] # The main payload
    identified_gaps: List[str]
    upload_timestamp: datetime

# --- A summary model for the list view ---
class ContractSummary(BaseModel):
    contract_id: str
    file_name: str
    upload_timestamp: datetime
    processing_status: str
    gaps_count: int # A useful metric for a list view

# --- The structured response model for the paginated endpoint ---
class PaginatedContractResponse(BaseModel):
    total_items: int
    items: List[ContractSummary]
    page: int
    size: int
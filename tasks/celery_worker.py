from pathlib import Path
from celery import Celery
from core.config import settings
from pymongo import MongoClient
import re
from services.contract_processor import analyze_contract_advanced

celery_app = Celery("tasks", broker=settings.REDIS_URI, backend=settings.REDIS_URI)
celery_app.conf.update(task_serializer='json', result_serializer='json', accept_content=['json'])

@celery_app.task(name="tasks.process_contract")
def process_contract_task(contract_id: str, file_path: str):
    """
    The background task that uses the advanced, scalable processing pipeline.
    This worker's logic remains stable; all intelligence changes happen in the processor.
    """
    print(f"Processing contract_id: {contract_id}")
    
    mongo_client = MongoClient(settings.MONGO_URI)
    db = mongo_client[settings.MONGO_DB_NAME]
    contracts_collection = db["contracts"]

    def update_progress(percentage: int, message: str):
        contracts_collection.update_one(
            {"contract_id": contract_id},
            {"$set": {"progress_percentage": percentage, "progress_message": message}}
        )
        print(f"[{contract_id}] Progress: {percentage}% - {message}")

    try:
        update_progress(10, "Starting advanced contract analysis...")
        
        analysis_result = analyze_contract_advanced(file_path)

        update_progress(90, "Finalizing analysis and saving results...")

        search_keywords = []
        # 1. Sanitize and add the filename
        original_filename = Path(file_path).name
        # Replace non-alphanumeric characters with spaces
        sanitized_filename = re.sub(r'[^a-zA-Z0-9]', ' ', original_filename)
        search_keywords.append(sanitized_filename)

        # 2. Add extracted party names
        extracted = analysis_result.get("extracted_data", {})
        customer_raw = extracted.get("party_identification", {}).get("customer", {}).get("value")
        vendor_raw = extracted.get("party_identification", {}).get("vendor", {}).get("value")
        
        if customer_raw:
            # Clean the string: remove newlines and other non-alphanumeric chars
            sanitized_customer = re.sub(r'[^a-zA-Z0-9\s]', '', customer_raw)
            search_keywords.append(sanitized_customer.strip())
        if vendor_raw:
            sanitized_vendor = re.sub(r'[^a-zA-Z0-9\s]', '', vendor_raw)
            search_keywords.append(sanitized_vendor.strip())
        # Join everything into a single, space-separated string
        
        search_content_string = " ".join(filter(None, search_keywords))
        print(f"DEBUG: Generated search_content for {contract_id}: '{search_content_string}'")

        gaps_count = len(analysis_result.get("identified_gaps", []))

        final_update = {
            "$set": {
                "processing_status": "completed",
                "progress_percentage": 100,
                "progress_message": "Processing complete.",
                "extracted_data": analysis_result["extracted_data"],
                "identified_gaps": analysis_result["identified_gaps"],
                "gaps_count": gaps_count,
                "search_content": search_content_string 
            }
        }
        contracts_collection.update_one({"contract_id": contract_id}, final_update)
        print(f"Successfully processed contract_id: {contract_id}")

    except Exception as e:
        error_msg = f"An error occurred: {str(e)}"
        print(f"Error processing contract {contract_id}: {error_msg}")
        contracts_collection.update_one(
            {"contract_id": contract_id},
            {"$set": {
                "processing_status": "error",
                "progress_percentage": 100,
                "progress_message": "Processing failed.",
                "error_message": error_msg,
            }}
        )
    finally:
        mongo_client.close()

    return {"contract_id": contract_id, "status": "processing_finished"}
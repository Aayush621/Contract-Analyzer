# Dockerfile

# 1. Use an official, lightweight Python base image
FROM python:3.11-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Set environment variables to prevent Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 4. Copy only the requirements file first to leverage Docker's build cache
COPY requirements.txt .

# 5. Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the rest of the application code into the working directory
COPY . .

# 7. Expose the port the API will run on
EXPOSE 8000

# 8. Create a startup script with sequential model loading
RUN echo '#!/bin/bash\n\
# Start Celery worker in background\n\
echo "Starting Celery worker..."\n\
celery -A tasks.celery_worker.celery_app worker --loglevel=info --pool=solo --concurrency=1 &\n\
echo "Celery worker started"\n\
\n\
# Wait for Celery to initialize\n\
echo "Waiting for Celery to initialize..."\n\
sleep 5\n\
\n\
# Pre-load models sequentially to avoid memory spikes\n\
echo "Pre-loading spacy model..."\n\
python -c "import spacy; spacy.load(\"en_core_web_sm\")"\n\
echo "Spacy model pre-loaded"\n\
\n\
# Wait a bit\n\
sleep 3\n\
\n\
# Pre-load sentence transformer\n\
echo "Pre-loading sentence transformer..."\n\
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer(\"all-MiniLM-L6-v2\")"\n\
echo "Sentence transformer pre-loaded"\n\
\n\
# Wait a bit\n\
sleep 3\n\
\n\
# Start FastAPI server\n\
echo "Starting FastAPI server..."\n\
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1\n\
' > /app/start.sh && chmod +x /app/start.sh

# 9. Run the startup script
CMD ["/app/start.sh"]
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

# 6. Download the necessary NLP models and NLTK data
# Use the smallest possible models
RUN python -m spacy download en_core_web_sm
RUN python -c "import nltk; nltk.download('punkt')"

# 7. Copy the rest of the application code into the working directory
COPY . .

# 8. Expose the port the API will run on
EXPOSE 8000

# 9. Create a startup script that runs both services
RUN echo '#!/bin/bash\n\
# Start Celery worker in background with minimal memory\n\
celery -A tasks.celery_worker.celery_app worker --loglevel=info --pool=solo --concurrency=1 &\n\
# Start FastAPI server\n\
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1\n\
' > /app/start.sh && chmod +x /app/start.sh

# 10. Run the startup script
CMD ["/app/start.sh"]
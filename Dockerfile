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
# This bakes the models into the image so they don't need to be downloaded on every container start.
RUN python -m spacy download en_core_web_trf
RUN python -c "import nltk; nltk.download('punkt')"

# 7. Copy the rest of the application code into the working directory
COPY . .

# 8. Expose the port the API will run on
EXPOSE 8000

# 9. The default command to run when the container starts.
# We will override this for the Celery worker in docker-compose.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# Dockerfile (Corrected and Simplified)

# 1. Use an official, lightweight Python base image
FROM python:3.11-slim

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 4. Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. Download the necessary NLP models during the build phase
# This is crucial for both the 'lazy loading' fix and performance.
RUN python -m spacy download en_core_web_trf
RUN python -c "import nltk; nltk.download('punkt')"

# 6. Copy the rest of the application code
COPY . .

# 7. Expose the port for the web service
EXPOSE 8000

# 8. Set the DEFAULT command. This will be used by the 'web' service.
# The 'worker' service in render.yaml will override this.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]



FROM python:3.11-slim


WORKDIR /app

# 3. Set environment variables to prevent Python from writing .pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 4. Install system dependencies for PDF processing
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*


COPY requirements.txt .


RUN pip install --no-cache-dir -r requirements.txt


RUN python -m spacy download en_core_web_sm


RUN python -c "import nltk; nltk.download('punkt')"


COPY . .

# 10. Creates uploads directory
RUN mkdir -p uploads

# 11. Exposes the port the API will run on
EXPOSE 8000

# 12. Default command 
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
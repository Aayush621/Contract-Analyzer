# Contract Intelligence System

A comprehensive contract analysis platform that automatically extracts key information from PDF contracts using advanced NLP and machine learning techniques.
The system automatically process contracts, extract critical financial and operational data.


## 🚀 Quick Start - One Command Setup

### Prerequisites
- Docker and Docker Compose installed
- Git (to clone the repository)

### Single Command Deployment
```bash
# Clone the repository
git clone <https://github.com/Aayush621/Contract-Analyzer.git>
cd contract_analysis

# Create environment file
cat > .env << EOF
MONGO_URI=mongodb://mongodb:27017
MONGO_DB_NAME=contract_intelligence
REDIS_URI=redis://redis:6379
UPLOADS_DIR=uploads
CORS_ALLOW_ORIGINS=http://localhost:3000
CORS_ALLOW_METHODS=GET,POST,PUT,DELETE,OPTIONS
CORS_ALLOW_HEADERS=*
CORS_ALLOW_CREDENTIALS=false
EOF

# Create frontend environment file
cat > contract-intelligence-frontend/.env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1/contracts
EOF

# Start the entire system with one command
docker-compose up --build
```

**That's it!** The system will:
1. Build all Docker images
2. Start MongoDB, Redis, FastAPI, Celery worker, and Next.js frontend
3. Automatically handle service dependencies
4. Be available at:
   - **Frontend**: http://localhost:3000
   - **API**: http://localhost:8000
   - **API Docs**: http://localhost:8000/docs

### First Time Setup Notes
- Initial build may take 5-10 minutes (downloading models and dependencies)
- All services will start automatically in the correct order
- Data persists between restarts via Docker volumes
- Logs from all services are displayed in the terminal

### Stopping the System
```bash
# Stop all services
docker-compose down

# Stop and remove all data (clean slate)
docker-compose down -v
```

## 🏗️ System Architecture

The system follows a microservices architecture with the following components:

### Backend Services
- **FastAPI Application** (`main.py`) - REST API server
- **Celery Workers** (`tasks/celery_worker.py`) - Background task processing
- **MongoDB** - Document database for contract storage
- **Redis** - Message broker and result backend for Celery

### Frontend
- **Next.js Application** - Modern React-based web interface
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component library

## �� Technology Stack

### Core Services
- **FastAPI** - Modern Python web framework for building APIs
- **Celery** - Distributed task queue for background processing
- **Redis** - In-memory data store for message brokering
- **MongoDB** - NoSQL database for document storage
- **Motor** - Async MongoDB driver for Python

### NLP & ML Libraries
- **SpaCy** (`en_core_web_sm`) - Named Entity Recognition (NER)
- **Sentence Transformers** (`all-MiniLM-L6-v2`) - Semantic similarity and classification
- **NLTK** - Natural language processing utilities
- **PyMuPDF (fitz)** - PDF text extraction
- **PDFPlumber** - Advanced PDF layout analysis

### Frontend Technologies
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Headless UI components
- **React Hook Form** - Form management
- **Recharts** - Data visualization

## 📋 System Workflow

### 1. Contract Upload Stage
```
User Upload → FastAPI → File Storage → MongoDB Record → Celery Task Queue
```

**Process:**
- User uploads PDF via web interface
- FastAPI validates file type (PDF only)
- File saved to `uploads/` directory with unique contract ID
- Contract record created in MongoDB with "processing" status
- Celery task queued for background processing

### 2. Document Processing Stage
```
PDF Analysis → Multi-Strategy Extraction → Data Structuring → MongoDB Update
```

**Processing Pipeline:**
1. **Text Extraction** - Extract raw text using PyMuPDF
2. **Multi-Strategy Analysis** - Apply 4 different extraction strategies
3. **Data Consolidation** - Merge results from all strategies
4. **Gap Analysis** - Identify missing critical fields
5. **Database Update** - Store structured results in MongoDB

### 3. Data Retrieval Stage
```
API Requests → MongoDB Queries → Structured Response → Frontend Display
```

**Available Endpoints:**
- `GET /contracts` - List all contracts with pagination
- `GET /contracts/{id}/status` - Check processing status
- `GET /contracts/{id}` - Retrieve extracted data
- `GET /contracts/{id}/download` - Download original PDF

## 🎯 Extraction Strategies

The system employs a sophisticated multi-strategy approach for maximum accuracy:

### Strategy 1: Named Entity Recognition (NER)
**Technology:** SpaCy `en_core_web_sm`
**Purpose:** Extract party names and organizational entities
**Implementation:**
- Processes first 50,000 characters for efficiency
- Identifies organizations using SpaCy's ORG entity recognition
- Assigns first two organizations as customer and vendor
- Confidence score: 0.75

### Strategy 2: Regex Pattern Matching
**Technology:** Python Regular Expressions
**Purpose:** Extract structured data like payment terms and billing cycles
**Implementation:**
- High-precision patterns for payment terms (`Net 30`, `30 days from invoice date`)
- Billing cycle extraction with currency amounts
- Confidence scores: 0.92-0.95

### Strategy 3: Layout-Based Analysis
**Technology:** PDFPlumber
**Purpose:** Extract signature block information
**Implementation:**
- Analyzes last 30% of final page (signature zone)
- Searches for signature patterns (`By: Name:`, `Title:`)
- Confidence score: 0.98

### Strategy 4: Semantic Classification
**Technology:** Sentence Transformers (`all-MiniLM-L6-v2`)
**Purpose:** Classify renewal terms using semantic similarity
**Implementation:**
- Pre-defined renewal categories (Affirmative, Negative, Conditional)
- Sentence-level semantic analysis
- Cosine similarity scoring
- Fallback to regex if confidence < 0.65

## 📊 Data Structure

### Extracted Fields
The system extracts and structures the following contract elements:

```json
{
  "party_identification": {
    "customer": {"value": "Company A", "confidence_score": 0.75},
    "vendor": {"value": "Company B", "confidence_score": 0.75},
    "authorized_signatories": {"value": "John Doe", "confidence_score": 0.98}
  },
  "payment_structure": {
    "payment_terms": {"value": "Net 30", "confidence_score": 0.95}
  },
  "revenue_classification": {
    "billing_cycle": {"value": "$1000 per month", "confidence_score": 0.92},
    "renewal_terms": {"value": "Auto-renewal", "confidence_score": 0.85}
  }
}
```

### Critical Fields Checklist
- Customer Name
- Vendor Name  
- Authorized Signatory
- Payment Terms
- Billing Cycle
- Renewal Terms

## 🚀 Deployment

### Docker Compose Setup
```bash
docker-compose up -d
```

**Services:**
- `mongodb` - Database (port 27018)
- `redis` - Message broker (port 6380)
- `api` - FastAPI server (port 8000)
- `worker` - Celery worker
- `frontend` - Next.js app (port 3000)

### Environment Variables
Create `.env` file:
```env
MONGO_URI=mongodb://localhost:27018
MONGO_DB_NAME=contract_intelligence
REDIS_URI=redis://localhost:6380
UPLOADS_DIR=uploads
```

### Manual Setup
```bash
# Backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn main:app --reload

# Frontend
cd contract-intelligence-frontend
npm install
npm run dev

# Celery Worker
celery -A tasks.celery_worker.celery_app worker --loglevel=info
```

## 📈 Performance Features

### Asynchronous Processing
- Non-blocking file uploads
- Background task processing with Celery
- Real-time progress tracking
- Error handling and retry mechanisms

### Scalability
- Horizontal scaling with multiple Celery workers
- MongoDB sharding support
- Redis clustering for high availability
- Docker containerization for easy deployment

### Data Persistence
- MongoDB for structured contract data
- File system storage for original PDFs
- Redis for task queue and caching
- Volume mounting for data persistence

## 🛠️ Development

### Project Structure
```
contract_analysis/
├── api/                           # FastAPI routes and endpoints
│   └── contracts.py              # Contract management API endpoints
├── core/                         # Application configuration
│   └── config.py                 # Settings and environment variables
├── db/                           # Database models and connection
│   ├── models.py                 # Pydantic models and schemas
│   └── mongodb.py                # MongoDB connection and utilities
├── services/                     # Business logic and processing
│   └── contract_processor.py     # Core contract analysis engine
├── tasks/                        # Background task processing
│   └── celery_worker.py          # Celery worker configuration
├── contract-intelligence-frontend/  # Next.js frontend application
│   ├── .env.local                # Frontend environment variables
│   └── Dockerfile                # Frontend container configuration
├── uploads/                      # File storage directory
├── main.py                       # FastAPI application entry point
├── requirements.txt              # Python dependencies
├── Dockerfile                    # Backend container configuration
├── docker-compose.yml            # Multi-service orchestration
├── .env                          # Backend environment variables
├── .gitignore                    # Git ignore rules
└── README.md                     # Project documentation
```

### Key Files
- `main.py` - FastAPI application entry point
- `services/contract_processor.py` - Core extraction logic
- `tasks/celery_worker.py` - Background task processing
- `api/contracts.py` - REST API endpoints
- `db/models.py` - Data models and schemas

## 📈 Configuration

### Model Loading
The system automatically loads required NLP models:
- SpaCy: `en_core_web_sm` for NER
- Sentence Transformers: `all-MiniLM-L6-v2` for semantic analysis

### Error Handling
- Graceful model loading failures
- Comprehensive error logging
- User-friendly error messages
- Automatic retry mechanisms

## 🔧 Frontend Configuration

### Environment Variables (.env.local)
The frontend requires a `.env.local` file in the `contract-intelligence-frontend/` directory:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1/contracts
```

**Purpose:**
- Configures the API base URL for frontend-backend communication
- Must match the backend API endpoints
- Uses `NEXT_PUBLIC_` prefix to expose variables to the browser

### Frontend Dockerfile
Located at: `contract-intelligence-frontend/Dockerfile`

**Overview:**
- Based on Node.js 18 Alpine image
- Uses pnpm for package management
- Builds the Next.js application for production
- Exposes port 3000
- Optimized for containerized deployment

**Key Features:**
- Multi-stage build process
- Frozen lockfile installation for reproducible builds
- Production-ready Next.js build
- Lightweight Alpine Linux base image

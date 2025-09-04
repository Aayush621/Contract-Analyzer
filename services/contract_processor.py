import fitz
import re
import spacy
import pdfplumber
import nltk
from sentence_transformers import SentenceTransformer, util
from typing import Dict, Any, List

try:
    nlp = spacy.load("en_core_web_trf")
    print("spaCy model 'en_core_web_trf' loaded successfully.")
except OSError:
    print("SpaCy model not found. Please run: python -m spacy download en_core_web_trf")
    nlp = None

try:
    semantic_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Sentence Transformer model 'all-MiniLM-L6-v2' loaded successfully.")
except Exception as e:
    semantic_model = None

def analyze_contract_advanced(file_path: str) -> Dict[str, Any]:
    if not nlp or not semantic_model:
        raise RuntimeError("A required NLP model failed to load. Cannot process documents.")
    processor = ContractProcessor(file_path)
    return processor.process()


class ContractProcessor:
    def __init__(self, file_path: str):
        self.file_path = file_path
        
        self.full_text = self._get_full_text() # This gets the full text of the PDF file.
        self.found_fields = {}

    def process(self) -> Dict[str, Any]:
        """Orchestrates the entire extraction pipeline."""
        self._extract_with_ner_and_context()
        self._extract_with_regex()
        self._extract_with_layout_parser()
        self._extract_with_semantic_classifier()
        # --- Consolidate findings ---
        # If layout parser found a signatory, it's higher confidence
        if self.found_fields.get("signature_block_signatory"):
            self.found_fields["authorized_signatory"] = self.found_fields["signature_block_signatory"]
        elif self.found_fields.get("textual_representative"):
            self.found_fields["authorized_signatory"] = self.found_fields["textual_representative"]

        return self._structure_and_finalize()
    
    def _get_full_text(self) -> str:
        try:
            with fitz.open(self.file_path) as doc:
                return "".join(page.get_text() for page in doc)
        except Exception as e:
            print(f"Error reading PDF with PyMuPDF: {e}")
            return ""

    # --- STRATEGY 1: NER ---
    def _extract_with_ner_and_context(self):
        """
        Extracts Party names and also searches for text defining an
        'authorized representative' which is a broader concept than a signatory.
        """
        text_chunk_for_parties = self.full_text[:50000]
        doc = nlp(text_chunk_for_parties)
        
        # 1. Find Party Names 
        orgs = [ent.text.strip() for ent in doc.ents if ent.label_ == "ORG"]
        if len(orgs) >= 2:
            self.found_fields["customer_name"] = {"value": orgs[0], "confidence_score": 0.75}
            self.found_fields["vendor_name"] = {"value": orgs[1], "confidence_score": 0.75}

        # 2. Find "Authorized Representative" in the text
        # This looks for a PERSON's name near keywords like "representative" or "contact for notices".
        # It's a lower confidence match than a signature block.
        representative_patterns = [
            r"(?:authorized representatives|primary contact|contact for notices)\s*:\s*([A-Z][a-z]+ [A-Z][a-z]+)", # "Name: John Doe"
            r"([A-Z][a-z]+ [A-Z][a-z]+)\s*,?\s*shall be the authorized representatives" # "John Doe shall be the..."
        ]
        # We store this with a temporary key.
        self.found_fields["textual_representative"] = self._find_field_regex(self.full_text, representative_patterns, 0.80)


    # --- STRATEGY 2: REGEX  ---
    def _extract_with_regex(self):
        """Regex operates on the raw text string, which is memory-efficient."""
        payment_terms_patterns = [r"(Net\s*\d+)", r"(\d+\s*days from invoice date)"]
        self.found_fields["payment_terms"] = self._find_field_regex(self.full_text, payment_terms_patterns, 0.95)
        billing_cycle_patterns = [r"\$\d+[\.,\d]*\s*(per month|per year|monthly|annually|quarterly)"]
        self.found_fields["billing_cycle"] = self._find_field_regex(self.full_text, billing_cycle_patterns, 0.92, group=0)

    # --- STRATEGY 3: LAYOUT  ---
    def _extract_with_layout_parser(self):
        """
        This method is now laser-focused on finding the person who PHYSICALLY SIGNS
        in the signature block. This is a high-confidence find.
        """
        # We store this with a different temporary key.
        self.found_fields["signature_block_signatory"] = self._find_signatory_by_layout()

    # --- STRATEGY 4: SEMANTIC ---
    def _extract_with_semantic_classifier(self):
        """
        Combines semantic search with a broad regex fallback to ensure
        we catch renewal clauses even if the ML model is uncertain.
        """
        # 1. Try the high-precision ML model first.
        renewal_semantic = self._classify_renewal_clause_chunked()
        
        if renewal_semantic and renewal_semantic["confidence_score"] > 0.65: # Trust the ML model if confident
            self.found_fields["renewal_terms"] = renewal_semantic
        else:
            # 2. If ML fails or is not confident, fall back to a broad, context-capturing regex.
            print("Semantic renewal search had low confidence. Falling back to regex.")
            # This regex looks for sentences containing keywords related to the contract's duration or end.
            renewal_regex_patterns = [
                r"([^\.!?]*?(?:term of this agreement|expiration|renew|terminate)[^\.!?]*[\.!?])"
            ]
            self.found_fields["renewal_terms"] = self._find_field_regex(self.full_text, renewal_regex_patterns, 0.70, group=0)

    # --- Finalizing function  ---
    def _structure_and_finalize(self) -> Dict[str, Any]:
        CRITICAL_FIELDS_CHECKLIST = ["customer_name", "vendor_name", "authorized_signatory", "payment_terms", "billing_cycle", "renewal_terms"]
        identified_gaps = [field for field in CRITICAL_FIELDS_CHECKLIST if not self.found_fields.get(field)]
        structured_data = {
            "party_identification": {"customer": self.found_fields.get("customer_name"), "vendor": self.found_fields.get("vendor_name"), "authorized_signatories": self.found_fields.get("authorized_signatory")},
            "payment_structure": {"payment_terms": self.found_fields.get("payment_terms")},
            "revenue_classification": {"billing_cycle": self.found_fields.get("billing_cycle"), "renewal_terms": self.found_fields.get("renewal_terms")},
        }
        return {"extracted_data": structured_data, "identified_gaps": identified_gaps}

    # --- Helper Methods  ---
    def _find_field_regex(self, text: str, patterns: List[str], confidence: float, group: int = 1) -> Dict[str, Any]:
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match and len(match.groups()) >= group:
                value = match.group(group).strip().replace('\n', ' ')
                return {"value": value, "confidence_score": confidence, "source_snippet": match.group(0).strip()[:250]}
        return None

    def _find_signatory_by_layout(self) -> Dict[str, Any]:

        try:
            with pdfplumber.open(self.file_path) as pdf:
                last_page = pdf.pages[-1]
                signature_zone = last_page.crop((0, last_page.height * 0.70, last_page.width, last_page.height))
                text_in_zone = signature_zone.extract_text()
                if not text_in_zone: return None
                patterns = [r"By:\s*Name:\s*(.*?)\n", r"By:\s*([^\n]+)\n\s*Title:"]
                match = self._find_field_regex(text_in_zone, patterns, 0.98)
                if match:
                    match["source_snippet"] = f"Found in signature zone on page {len(pdf.pages)}: " + match["source_snippet"]
                    return match
        except Exception as e:
            print(f"Error processing with pdfplumber: {e}")
        return None

    def _classify_renewal_clause_chunked(self) -> Dict[str, Any]:

        categories = {"Affirmative Renewal": "The contract will automatically renew.","Negative Renewal": "The contract will not automatically renew.","Conditional Renewal": "The contract renews unless one party acts to terminate it."}
        category_embeddings = semantic_model.encode(list(categories.values()))
        best_match = {"score": 0, "sentence": None, "category": None}
        try:
            with fitz.open(self.file_path) as doc:
                for page_num in range(len(doc)):
                    page_text = doc.load_page(page_num).get_text()
                    try: sentences = nltk.sent_tokenize(page_text)
                    except Exception: sentences = page_text.split('.')
                    candidate_sentences = [s for s in sentences if re.search(r'\b(renew|term|terminate|evergreen)\b', s, re.IGNORECASE)]
                    if not candidate_sentences: continue
                    for sentence in candidate_sentences:
                        sentence_embedding = semantic_model.encode(sentence)
                        scores = util.cos_sim(sentence_embedding, category_embeddings)[0]
                        top_score, top_idx = max(zip(scores, range(len(scores))))
                        if top_score > best_match["score"]:
                            best_match.update({"score": top_score, "sentence": sentence.strip(), "category": list(categories.keys())[top_idx]})
        except Exception as e:
            print(f"Error during chunked processing: {e}")
            return None
        if best_match["score"] > 0.5:
            return {"value": {"classification": best_match["category"], "text": best_match["sentence"]},"confidence_score": float(best_match["score"]),"source_snippet": best_match["sentence"]}
        return None

import fitz  # PyMuPDF for PDF handling
import docx
import nltk
import spacy
import numpy as np
import re
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict


# Load Transformer Model for embeddings
model = SentenceTransformer("all-MiniLM-L6-v2")


# EAD TEXT FROM FILES
def read_file(file_path):
    text = ""
    if file_path.endswith(".txt"):
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read()
    elif file_path.endswith(".pdf"):
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text("text") + "\n"
    elif file_path.endswith(".docx"):
        doc = docx.Document(file_path)
        text = "\n".join([para.text for para in doc.paragraphs])
    return text.strip()

# EXTRACT NAMED ENTITIES (NER)
def extract_ner(text):
    doc = nlp(text)
    entities = defaultdict(set)
    for ent in doc.ents:
        entities[ent.label_].add(ent.text)
    return {k: list(v) for k, v in entities.items()}

#  EXTRACT CONTRACT STRUCTURE (SECTIONS)
def extract_sections(text):
    sections = re.findall(r"(Section \d+: [^\n]+)", text)
    return sections if sections else ["No sections found"]

#  EXTRACT KEY CONTRACTUAL CLAUSES
def extract_clauses(text):
    clauses = {
        "Scope of Work": re.findall(r"(Scope of Work.*?)(?:Section|\Z)", text, re.DOTALL),
        "Termination Clause": re.findall(r"(Termination.*?)(?:Section|\Z)", text, re.DOTALL),
        "Renewal Clause": re.findall(r"(Contract Renewal.*?)(?:Section|\Z)", text, re.DOTALL),
        "Financial Terms": re.findall(r"(Purchase Order.*?)(?:Section|\Z)", text, re.DOTALL),
    }
    return {k: v[0] if v else "Not Found" for k, v in clauses.items()}

#  MAIN FUNCTION TO RUN ALL EXTRACTIONS
def extract_contract_features(file_path):
    text = read_file(file_path)

    features = {
        "Named Entities": extract_ner(text),
        "Sections": extract_sections(text),
        "Clauses": extract_clauses(text),
    }

    return features, text  # Returning raw text for LLM input


    print("\n✅ Extracted contract text saved for LLM processing.")


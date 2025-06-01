

import re
import nltk
import spacy
import docx
import fitz
import gensim
import numpy as np
from rake_nltk import Rake
from summa import keywords, summarizer
from sklearn.feature_extraction.text import TfidfVectorizer
from gensim.models import Word2Vec
from sklearn.metrics.pairwise import cosine_similarity
from collections import Counter
from sentence_transformers import SentenceTransformer


# Load Sentence Transformer Model
model = SentenceTransformer("all-MiniLM-L6-v2")



# READ TEXT FROM FILES
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

#  TEXT PREPROCESSING
def preprocess_text(text):
    text = re.sub(r"\s+", " ", text)  # Remove extra spaces
    text = re.sub(r"[^\w\s]", "", text)  # Remove special characters
    return text.lower().strip()

#  NAMED ENTITY RECOGNITION (NER)
def extract_ner(text):
    doc = nlp(text)
    entities = {
        "ORG": [], "DATE": [], "LAW": [], "MONEY": [], "GPE": [], "PERSON": []
    }
    for ent in doc.ents:
        if ent.label_ in entities:
            entities[ent.label_].append(ent.text)
    return {k: list(set(v)) for k, v in entities.items()}


#  FUNCTION TO EXTRACT FIRST & LAST 500 WORDS
def extract_start_end(text, num_words=500):
    words = nltk.word_tokenize(text)
    start_words = words[:num_words]  # First 500 words
    end_words = words[-num_words:]   # Last 500 words

    start_text = " ".join(start_words)
    end_text = " ".join(end_words)

    return start_text, end_text

#  FUNCTION TO CREATE EMBEDDINGS
def create_embeddings(text):
    return model.encode(text)


#  KEYWORD EXTRACTION (TF-IDF & RAKE)
def extract_keywords(text, method="tfidf"):
    sentences = nltk.sent_tokenize(text)
    if method == "tfidf":
        vectorizer = TfidfVectorizer(stop_words="english", max_features=10)
        X = vectorizer.fit_transform(sentences)
        return vectorizer.get_feature_names_out()
    elif method == "rake":
        rake = Rake()
        rake.extract_keywords_from_text(text)
        return rake.get_ranked_phrases()[:10]

#  TOPIC MODELING (LDA)
def extract_topics(text, num_topics=3, num_words=5):
    words = [nltk.word_tokenize(sent) for sent in nltk.sent_tokenize(text)]
    words = [[w.lower() for w in sent if w.isalnum()] for sent in words]
    dictionary = gensim.corpora.Dictionary(words)
    corpus = [dictionary.doc2bow(sent) for sent in words]
    lda_model = gensim.models.LdaModel(corpus, num_topics=num_topics, id2word=dictionary, passes=10)
    topics = lda_model.print_topics(num_words=num_words)
    return [t[1] for t in topics]

#  SENTENCE IMPORTANCE SCORING (TEXTRANK)
def extract_important_sentences(text, ratio=0.3):
    return summarizer.summarize(text, ratio=ratio)

#  SIMILARITY SEARCH (WORD2VEC)
def compute_similarity(text, query):
    sentences = nltk.sent_tokenize(text)
    model = Word2Vec([nltk.word_tokenize(sent.lower()) for sent in sentences], min_count=1, vector_size=100)
    query_vec = np.mean([model.wv[word] for word in nltk.word_tokenize(query.lower()) if word in model.wv], axis=0)
    sentence_vectors = [np.mean([model.wv[word] for word in nltk.word_tokenize(sent.lower()) if word in model.wv], axis=0) for sent in sentences]
    similarities = cosine_similarity([query_vec], sentence_vectors)
    return sentences[np.argmax(similarities)]

#  MAIN FUNCTION TO RUN ALL EXTRACTIONS
def extract_features(file_path):
    text = read_file(file_path)
    text = preprocess_text(text)

    # Get first 500 words and last 500 words
    start_text, end_text = extract_start_end(text)

    start_embedding = create_embeddings(start_text)
    end_embedding = create_embeddings(end_text)



    features = {
        "Named Entities": extract_ner(text),
        "TF-IDF Keywords": extract_keywords(text, "tfidf"),
        "RAKE Keywords": extract_keywords(text, "rake"),
        "Topics": extract_topics(text),
        "Important Sentences": extract_important_sentences(text),
    }

    return features, text ,start_embedding, end_embedding


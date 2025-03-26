import google.generativeai as genai
from nltk.tokenize import sent_tokenize
from models import analysis_models
import os
import wandb
import nltk
import spacy

nltk.download('punkt_tab')
nltk.download("punkt")

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
nlp = spacy.load("en_core_web_sm")

wandb.init(project="text_emotion_analysis", name="emotion_tracking")

def call_gemini(prompt, key):
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text.strip()

def analyze_sentence(sentence, prev_emotion=None):
    emotion_prompt = f"""
    *TASK:* Detect the strongest emotion in the given sentence, considering its tone, punctuation, and prior context.

    *Possible Emotions:*
    - Positive: Happy, Excited, Proud, Motivated, Hopeful, Admiration
    - Negative: Sad, Angry, Frustrated, Fearful, Regretful
    - Neutral: Informative, Calm, Objective

    *Example Analysis:*
    - "She won the championship!" → Emotion: Excited
    - "He left without saying goodbye." → Emotion: Sad
    - "The sun rises in the east." → Emotion: Neutral

    *Previous Emotion:* {prev_emotion}
    *Sentence:* "{sentence}"

    *Response Format:*
    [Emotion Name]
    """
    
    emotion = call_gemini(emotion_prompt, "") or prev_emotion or "Neutral"
    wandb.log({"sentence": sentence, "emotion": emotion})
    
    return analysis_models.SentenceAnalysis(sentence=sentence, emotion=emotion)

def analyze_text(text):
    sentences = sent_tokenize(text)
    analyzed_sentences = []
    prev_emotion = None
    for sentence in sentences:
        analysis = analyze_sentence(sentence, prev_emotion)
        analyzed_sentences.append(analysis)
        prev_emotion = analysis.emotion
    return analysis_models.TextAnalysisModel(full_text=text, sentences=analyzed_sentences)

def split_text_into_sentences(text):
    doc = nlp(text)
    sentences = [sent.text.strip() for sent in doc.sents]
    return sentences

wandb.finish()
    

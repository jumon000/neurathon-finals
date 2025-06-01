import os
import json
import re
import nltk
import spacy
import google.generativeai as genai
from google.cloud import documentai
from nltk.tokenize import sent_tokenize
from pydantic import BaseModel

# 🔹 Configure Google Gemini API Key
genai.configure(api_key="api-key")

# 🔹 Load spaCy Model
nlp = spacy.load("en_core_web_sm")

# 🔹 Download NLTK Data
nltk.download("punkt")

def extract_text_from_jpg(image_path):
    """
    Extracts text from a JPG image using Google Document AI.
    """
    client = documentai.DocumentProcessorServiceClient()

    # Read the image file
    with open(image_path, "rb") as image_file:
        image_content = image_file.read()

    # Create a raw document object
    raw_document = documentai.RawDocument(content=image_content, mime_type="image/jpeg")

    # Configure the request
    request = documentai.ProcessRequest(
        name=f"projects/{PROJECT_ID}/locations/{LOCATION}/processors/{PROCESSOR_ID}",
        raw_document=raw_document
    )

    # Process the document with Document AI
    response = client.process_document(request=request)

    # Extract and return the text
    extracted_text = response.document.text
    return extracted_text if extracted_text else "No text found."

# Example Usage
image_path = "/content/WIN_20250321_22_24_27_Pro.jpg"  # Replace with your image path
text = extract_text_from_jpg(image_path)
print("🔹 Extracted Text:\n", text)

# ---------------------------
# 📌 Step 2: Split Extracted Text into Sentences
# ---------------------------
def split_text_into_sentences(text):
    """
    Splits extracted text into sentences using spaCy.
    """
    doc = nlp(text)
    sentences = [sent.text.strip() for sent in doc.sents]
    return sentences

sentences = split_text_into_sentences(text)

print("\n🔹 **Sentences:**")
for i, sentence in enumerate(sentences, 1):
    print(f"{i}. {sentence}")

# ---------------------------
# 📌 Step 3: Emotion Analysis with Google Gemini AI
# ---------------------------
class SentenceAnalysis(BaseModel):
    sentence: str
    emotion: str

class TextAnalysisModel(BaseModel):
    full_text: str
    sentences: list[SentenceAnalysis]

def call_gemini(prompt, key):
    """
    Calls Gemini API and extracts the required key-value result.
    """
    model = genai.GenerativeModel("gemini-2.0-flash")  
    response = model.generate_content(prompt)    
    return response.text.strip()

def analyze_sentence(sentence, prev_emotion=None):
    """
    Analyzes a single sentence for emotion while considering previous context.
    """
    emotion_prompt = f"""
    **TASK:** Detect the strongest emotion in the given sentence, considering its tone, punctuation, and prior context.

    **Possible Emotions:**
    - Positive: Happy, Excited, Proud, Motivated, Hopeful, Admiration
    - Negative: Sad, Angry, Frustrated, Fearful, Regretful
    - Neutral: Informative, Calm, Objective

    **Example Analysis:**
    - "She won the championship!" → Emotion: Excited
    - "He left without saying goodbye." → Emotion: Sad
    - "The sun rises in the east." → Emotion: Neutral

    **Previous Emotion:** {prev_emotion}
    **Sentence:** "{sentence}"

    **Response Format:**
    Emotion: [Emotion Name]
    """

    emotion = call_gemini(emotion_prompt, "Emotion") or prev_emotion or "Neutral"

    return SentenceAnalysis(sentence=sentence, emotion=emotion)

def analyze_text(text):
    """
    Processes multiple sentences with context-aware emotion analysis.
    """
    sentences = sent_tokenize(text)
    analyzed_sentences = []
    prev_emotion = None

    for sentence in sentences:
        analysis = analyze_sentence(sentence, prev_emotion)
        analyzed_sentences.append(analysis)
        prev_emotion = analysis.emotion  # Update context

    return TextAnalysisModel(full_text=text, sentences=analyzed_sentences)

analysis = analyze_text(text)


analysis_json = analysis.model_dump_json(indent=4)
with open("analysis_result.json", "w") as f:
    f.write(analysis_json)

print("\n✅ **Analysis saved to analysis_result.json**")




if os.path.exists(input_file):
    with open(input_file, "r") as f:
        data = json.load(f)

    # Function to clean text by removing unwanted characters
    def clean_text(text):
        text = text.replace("\n", " ")  # Remove newlines
        text = text.replace("\\", "")   # Remove backslashes
        text = re.sub(r"\s+", " ", text)  # Replace multiple spaces with a single space
        return text.strip()  # Remove leading/trailing spaces

    # Clean "full_text"
    data["full_text"] = clean_text(data["full_text"])

    # Clean each sentence and emotion
    for sentence_obj in data["sentences"]:
        sentence_obj["sentence"] = clean_text(sentence_obj["sentence"])
        sentence_obj["emotion"] = clean_text(sentence_obj["emotion"])

    # Save the cleaned JSON file
    with open(output_file, "w") as f:
        json.dump(data, f, indent=4)

    print(f"\n✅ **Fully cleaned JSON saved as {output_file}**")
else:
    print(f"❌ Error: File '{input_file}' not found. Ensure text analysis was saved first.")


sentence_emotion_map = {sentence.sentence: sentence.emotion for sentence in analysis.sentences}


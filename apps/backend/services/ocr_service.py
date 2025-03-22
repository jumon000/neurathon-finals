import os
from google.cloud import documentai
from dotenv import load_dotenv

# Load environment variables from the .env file
load_dotenv()

# Access the credentials path
credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
print(f"Using credentials from: {credentials_path}")

PROJECT_ID = "551546090178"
LOCATION = "us"
PROCESSOR_ID = "184d92b58818c9cc"


def extract_text_from_jpg(image_path):
    client = documentai.DocumentProcessorServiceClient()
    with open(image_path, "rb") as image_file:
        image_content = image_file.read()
    raw_document = documentai.RawDocument(content=image_content, mime_type="image/jpeg")
    request = documentai.ProcessRequest(
        name=f"projects/{PROJECT_ID}/locations/{LOCATION}/processors/{PROCESSOR_ID}",
        raw_document=raw_document
    )
    response = client.process_document(request=request)
    return response.document.text if response.document.text else "No text found."

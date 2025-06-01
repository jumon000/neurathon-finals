
from texttext import extract_text_from_jpg  # Import function, not variable
import google.generativeai as genai
import json
import re

# Extract text from the image
image_path = "/content/WIN_20250321_22_24_27_Pro.jpg"  # Replace with your image path
text = extract_text_from_jpg(image_path)  # Call function correctly

def clean_json_string(json_string):
    """Cleans the JSON string by removing unnecessary escape characters."""
    json_string = json_string.replace("```json", "").replace("```", "").strip()
    json_string = re.sub(r"\\n", " ", json_string)  # Remove newline escape sequences
    json_string = re.sub(r"\\", "", json_string)  # Remove backslashes
    return json_string

def summarize_with_gemini(text, model_name="gemini-2.0-flash", api_key=None, num_sentences=3):
    """Summarizes text using the Gemini API and saves the output as a JSON file."""
    if not isinstance(text, str) or not text:
        print("Error: Invalid input text.")
        return None

    try:
        if api_key is None:
            genai.configure(api_key="AIzaSyAUtA-vh7plmNFiuuw_PbV7VszKh1-N9ZA")  # Replace with your API key
        else:
            genai.configure(api_key=api_key)

        model = genai.GenerativeModel(model_name)

        # Construct the prompt for summarization
        prompt = f"""
          Summarize the following text in a **concise, fluent, and meaningful** manner.

          ### **Text to Summarize:**
          {text}

          ### **Expected JSON Response Format:**  
          {{
            "summary": "A fluent, well-structured, and meaningful summary of the text.",
            "mood": "Detected mood"
          }}
          """

        # Generate the summary
        response = model.generate_content(prompt)

        # Extract the summary text correctly and clean it
        raw_summary = response.text.strip()
        cleaned_summary = clean_json_string(raw_summary)
        response_data = json.loads(cleaned_summary)

        # Save summary to JSON file
        output_file = "summary_output.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(response_data, f, indent=4)
        
        print(f"Summary saved to {output_file}")
        return output_file

    except Exception as e:
        print(f"An error occurred: {e}")
        return None

# Example usage
api_key = "AIzaSyAUtA-vh7plmNFiuuw_PbV7VszKh1-N9ZA"  # Replace with your actual API key

json_file = summarize_with_gemini(text, api_key=api_key, model_name="gemini-2.0-flash")

if json_file:
    print(f"Summary successfully saved in: {json_file}")
else:
    print("Summary generation failed.")

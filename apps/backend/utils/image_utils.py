import shutil
import os
import re
from fastapi import UploadFile
import base64
import numpy as np
import cv2

def save_upload_file_tmp(upload_file: UploadFile, tmp_dir: str = "uploads"):
    os.makedirs(tmp_dir, exist_ok=True)
    file_path = os.path.join(tmp_dir, upload_file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
    return file_path

def clean_json_data(data):
    def clean_text(text):
        text = text.replace("\n", " ")
        text = text.replace("\\", "")
        text = re.sub(r"\s+", " ", text)
        return text.strip()
    data["full_text"] = clean_text(data["full_text"])
    for sentence_obj in data["sentences"]:
        sentence_obj["sentence"] = clean_text(sentence_obj["sentence"])
        sentence_obj["emotion"] = clean_text(sentence_obj["emotion"])
    return data

def decode_base64_image(base64_string):
    img_bytes = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

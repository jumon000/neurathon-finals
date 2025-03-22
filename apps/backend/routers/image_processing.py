from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from services import ocr_service, gemini_service
from models import analysis_models
from utils import image_utils
import os

router = APIRouter()

@router.post("/process-image/", response_model=analysis_models.TextAnalysisModel)
async def process_image(file: UploadFile = File(...)):
    try:
        upload_path = image_utils.save_upload_file_tmp(file)
        text = ocr_service.extract_text_from_jpg(upload_path)
        analysis = gemini_service.analyze_text(text)
        cleaned_data = image_utils.clean_json_data(analysis.dict())
        os.remove(upload_path)
        return cleaned_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

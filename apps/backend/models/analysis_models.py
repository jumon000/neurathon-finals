from pydantic import BaseModel
from typing import List

class SentenceAnalysis(BaseModel):
    sentence: str
    emotion: str

class TextAnalysisModel(BaseModel):
    full_text: str
    sentences: List[SentenceAnalysis]

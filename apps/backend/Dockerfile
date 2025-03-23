FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install SpaCy model
RUN python3 -m spacy download en_core_web_sm

RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*
RUN wget https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8s.pt -O /app/yolov8s.pt

# Pre-download MiDaS model
RUN python3 -c "import torch; torch.hub.load('intel-isl/MiDaS', 'MiDaS_small')"

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
EXPOSE 7860

# neurathon-finals
# Text Emotion Analysis

## Overview
This project analyzes emotions in text using Google's Gemini AI and NLP techniques. It breaks down text into sentences, detects emotions in each sentence, and logs the results using Weights & Biases (wandb) for real-time tracking and visualization.

## Features
- Sentence-wise emotion detection
- Uses Google's **Gemini AI** for sentiment analysis
- Supports **NLTK** and **spaCy** for text processing
- Real-time logging with **wandb**
- Handles positive, negative, and neutral emotions

## Installation
### **1. Clone the Repository**
```sh
git clone https://github.com/your-username/neurathon-finals.git
cd neurathon-finals
```
### **2. Create a Virtual Environment (Optional but Recommended)**
```sh
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```
### **3. Install Dependencies**
```sh
pip install -r requirements.txt
```
### **4. Setup wandb**
```sh
wandb login  
```
You'll need an API key from [wandb.ai](https://wandb.ai/).

## Usage
Run the script with:
```sh
python main.py
```
Replace `main.py` with the actual script name.

## Weights & Biases (wandb) Integration
This project integrates **wandb** for experiment tracking, visualization, and performance monitoring.

### **Features of wandb in this Project**
- Logs sentences and detected emotions for better insights.
- Provides a dashboard to track trends in emotion analysis.
- Enables easy experiment comparison and reproducibility.

Check your project dashboard on [wandb.ai](https://wandb.ai/) to view logs and visualizations!

## Contributing
Feel free to fork the repository, make changes, and submit a pull request!

## License
This project is licensed under the MIT License.


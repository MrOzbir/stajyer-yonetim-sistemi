import os
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv()

# Ortam değişkenleri veya varsayılan değerler
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "qwen3-local")
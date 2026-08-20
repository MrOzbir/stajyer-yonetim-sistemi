from fastapi import FastAPI
from src.routes import router

# Uygulamayı başlat
app = FastAPI(title="Stajyer AI Agent Mikroservisi (Ollama + Qwen3)")

# Rotaları uygulamaya bağla (Express'teki app.use() mantığı)
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    # Çalıştırma komutu: python main.py
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
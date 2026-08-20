from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import requests
import json
import asyncio

# Kendi modüllerimizi içe aktarıyoruz
from .config import OLLAMA_URL, MODEL_NAME
from .schemas import InternPayload, ChatRequest
from .prompts import SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT
from .utils import extract_json_from_text

# Node.js'teki express.Router() ile tamamen aynı mantık!
router = APIRouter()

@router.post("/analyze")
async def analyze_intern(payload: InternPayload):
    user_context = f"""
Stajyer Adı: {payload.name} {payload.surname}

--- GÖREVLER ---
{json.dumps([t.dict() for t in payload.tasksReceived], indent=2, ensure_ascii=False)}

--- GÜNLÜK ARŞİVLER ---
{json.dumps([a.dict() for a in payload.archives], indent=2, ensure_ascii=False)}

--- SİSTEM LOGLARI ---
{json.dumps([l.dict() for l in payload.logs], indent=2, ensure_ascii=False)}
"""
    
    try:
        print(f"🔄 Ollama'ya istek atılıyor...")
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": user_context,
                "system": SYSTEM_PROMPT,
                "stream": False,
                # Yaratıcılığı kısıp, halüsinasyonu (saçmalamayı) önleyen ayar:
                "options": {
                    "temperature": 0.4,       # Yaratıcılık (0.4 mantık ve doğallık için idealdir)
                    "num_predict": 1500,      # Uzun cevap verebilme kapasitesi
                    "top_p": 0.9,             # Alakasız kelime seçimlerini engeller
                    "repeat_penalty": 1.15    # AYAR: Aynı kelimeleri/cümleleri tekrar etmesini kesin olarak engeller
                }
            },
            timeout=60
        )
        
        if response.status_code != 200:
            raise Exception(f"Ollama hatası: {response.text}")
        
        result = response.json()
        raw_text = result.get("response", "")
        print(f"✅ Ollama'dan cevap alındı ({len(raw_text)} karakter)")
        
        parsed_json = extract_json_from_text(raw_text)
        if "overallScore" not in parsed_json:
            raise ValueError("AI istenen JSON şemasını döndürmedi.")
            
        return parsed_json
        
    except Exception as e:
        print(f"❌ Analiz hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Analiz Hatası: {str(e)}")


@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        system_prompt = CHAT_SYSTEM_PROMPT
        if request.context and request.context.get('name'):
            context_info = f"\n\nSTAJYER BİLGİLERİ:\n"
            context_info += f"İsim: {request.context['name']}\n"
            
            if request.context.get('aiScore'):
                context_info += f"AI Puanı: {request.context['aiScore']}/100\n"
            if request.context.get('currentTasks'):
                tasks_str = ", ".join([t['title'] for t in request.context['currentTasks'][:3]])
                context_info += f"Aktif görevler: {tasks_str}\n"
            if request.context.get('weeklyWorkedHours'):
                context_info += f"Bu hafta çalışılan: {request.context['weeklyWorkedHours']} saat\n"
            
            system_prompt += context_info
        
        conversation = [f"{msg.role}: {msg.content}" for msg in request.messages[-8:]]
        conversation.append(f"user: {request.message}")
        full_prompt = "\n".join(conversation)
        
        print(f"💬 Chat: {request.message[:40]}...")
        
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": full_prompt,
                "system": system_prompt,
                "stream": False
            },
            timeout=60
        )
        
        if response.status_code != 200:
            raise Exception(f"Ollama hatası: {response.text}")
        
        result = response.json()
        full_text = result.get("response", "")
        print(f"✅ Chat cevabı: {len(full_text)} karakter")
        
        # Fake streaming
        async def generate():
            chunk_size = 15
            for i in range(0, len(full_text), chunk_size):
                chunk = full_text[i:i+chunk_size]
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.02)
            
            yield f"data: {json.dumps({'done': True, 'full_response': full_text}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
        
    except Exception as e:
        print(f"❌ Chat hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    try:
        response = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            model_names = [m["name"] for m in models]
            return {
                "status": "ok",
                "ollama": "connected",
                "model": MODEL_NAME,
                "available_models": model_names
            }
        return {"status": "error", "ollama": "disconnected"}
    except Exception as e:
        return {"status": "error", "ollama": "disconnected", "error": str(e)}
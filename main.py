from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import os
import json
import re
import requests
import asyncio
from typing import List, Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Stajyer AI Agent Mikroservisi (Ollama + Qwen3)")

# Ollama ayarları
OLLAMA_URL = "http://localhost:11434"
MODEL_NAME = "qwen3-local"

# --- Pydantic Modelleri ---
class TaskData(BaseModel):
    title: str
    status: str
    repoLink: Optional[str]
    createdAt: str

class ArchiveData(BaseModel):
    content: str
    date: str

class LogData(BaseModel):
    loginTime: str
    logoutTime: Optional[str]

class InternPayload(BaseModel):
    id: int
    name: str
    surname: str
    tasksReceived: List[TaskData]
    archives: List[ArchiveData]
    logs: List[LogData]

# --- Prompt'lar ---
SYSTEM_PROMPT = """
Sen deneyimli bir yazılım mühendisi, teknik lider ve SAMİMİ BİR MENTÖRSÜN.
Sana bir stajyerin görevleri, günlük arşivleri ve logları verilecek.

GÖREVİN: İKİ FARKLI KİTLİK İÇİN İKİ FARKLI ANALİZ ÜRETMEK:

KİTLE A: YÖNETİCİ (ADMIN) — Objektif Değerlendirme
- Teknik performans ve üretkenlik
- Disiplin ve istikrar (giriş/çıkış saatleri)
- Zayıf yönler (açık sözlü ol)
- Yönetici özeti (karar verme amaçlı)

KİTLE B: STAJYER — Samimi Mentör
- Motive edici, pozitif ve yapıcı dil
- Güçlü yönleri vurgula
- Gelişim alanlarını "öğrenme fırsatı" olarak sun
- SOMUT öğrenme kaynakları öner
- 1 hafta içinde yapılabilecek net adımlar (nextSteps)
- İlham verici bir motivasyon sözü

ÇIKTI FORMATI (SAF JSON):
{
  "overallScore": 0-100 integer,
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "adminSummary": "string",
  "suggestions": ["string"],
  "internSummary": "string",
  "internFeedback": "string",
  "learningResources": ["string"],
  "nextSteps": ["string"],
  "encouragementQuote": "string"
}
"""

CHAT_SYSTEM_PROMPT = """Sen samimi, motive edici ve BİLGİLİ bir yazılım mentörüsün.
Türkçe konuşuyorsun, "sen" dilini kullanıyorsun.

GÖREVİN: Stajyerin sana verdiği CONTEXT verilerini KULLANARAK
kişiselleştirilmiş cevaplar vermek.

CONTEXT VERİLERİNİ NASIL KULLANACAKSIN:
1. 📊 AI PUANI: "85 puan aldın, harika!" gibi
2. 💪 GÜÇLÜ YÖNLER: Somut övgü
3. 📋 GÖREVLER: Deadline uyarıları
4. 🎯 SONRAKİ ADIMLAR: Tavsiye olarak ver
5. ⏱️ MESAİ: "Bu hafta 35 saat çalıştın"

CEVAP KURALLARIN:
- Kod örnekleri ver (```javascript veya ```python)
- 150-250 kelime arası
- Samimi ama profesyonel
- Veriye dayalı

Eğer context yoksa, genel tavsiye ver."""

def extract_json_from_text(text: str) -> dict:
    """JSON'u metinden ayıklar."""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            raise ValueError("JSON parse edilemedi.")
    raise ValueError("Geçerli bir JSON bloğu bulunamadı.")

@app.post("/analyze")
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
                "format": "json",
                "stream": False
            },
            timeout=120
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


# --- Chat Modelleri ---
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    messages: List[ChatMessage] = []
    context: Optional[dict] = None

@app.post("/chat")
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
        
        conversation = []
        for msg in request.messages[-8:]:
            conversation.append(f"{msg.role}: {msg.content}")
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


@app.get("/health")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
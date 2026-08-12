from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError
import os
import json
import re
from typing import List, Optional
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv()

app = FastAPI(title="Stajyer AI Agent Mikroservisi")

# 🆕 YENİ SDK: Client oluştur
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# --- Pydantic Modelleri (Node.js'ten gelecek veri şeması) ---
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

# --- Prompt Mühendisliği (System Instruction) ---
SYSTEM_PROMPT = """
Sen deneyimli bir yazılım mühendisi, teknik lider ve stajyer mentörüsün. 
Sana bir stajyerin görevleri, günlük çalışma arşivleri ve sistem giriş/çıkış logları verilecek.

GÖREVİN:
1. Teknik Gelişim: Repo linki paylaşılan görevlerin sıklığını ve durumunu analiz et.
2. İstikrar: Günlük arşivlerin tutarlılığını ve giriş/çıkış saatlerindeki disiplini değerlendir.
3. Mentorluk: Stajyere motive edici ve teknik tavsiyeler ver.
4. Yönetici Özeti: Admin için stajyerin genel durumunu özetleyen net bir metin yaz.

ÇIKTI FORMATI:
MUTLAKA aşağıdaki JSON şemasına uygun, herhangi bir ek metin içermeyen SAF JSON döndürmelisin.

{
  "overallScore": 0-100 arası integer,
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "mentorSuggestions": ["string", "string"],
  "adminSummary": "string"
}
"""

def extract_json_from_text(text: str) -> dict:
    """Gemini bazen JSON'u markdown içine alabilir, bu fonksiyon saf JSON'u ayıklar."""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            raise ValueError("JSON parse edilemedi.")
    raise ValueError("Geçerli bir JSON bloğu bulunamadı.")

# 🆕 EN STABİL MODEL LİSTESİ (-latest versiyonları)
FALLBACK_MODELS = [
    'gemini-flash-latest',      # En dengeli, günlük kullanım için ideal
    'gemini-flash-lite-latest', # Yüksek kota, hızlı analiz
    'gemini-pro-latest',        # Derin analiz, mentör kalitesi
    'gemini-3.5-flash',         # Yeni nesil (yukarıdakiler çalışmazsa)
    'gemini-2.5-flash',         # Son çare
]

async def generate_with_fallback(user_context: str) -> str:
    """Yeni SDK ile akıllı fallback mekanizması."""
    for model_name in FALLBACK_MODELS:
        try:
            print(f"🔄 Deneniyor: {model_name}...")
            
            # 🆕 Yeni API Çağrısı (System Instruction kullanarak)
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=user_context,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json", # JSON zorlama
                    max_output_tokens=2048
                )
            )
            print(f"✅ Başarılı: {model_name} kullanıldı.")
            return response.text
            
        except ClientError as e:
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                print(f"⚠️ UYARI: {model_name} kotası doldu! Diğer modele geçiliyor...")
                continue
            elif "404" in error_str or "not found" in error_str:
                print(f"⚠️ UYARI: {model_name} artık kullanımda değil! Diğer modele geçiliyor...")
                continue
            else:
                print(f"❌ {model_name} client hatası: {error_str[:150]}")
                break
                
        except Exception as e:
            print(f"❌ {model_name} beklenmedik hatası: {str(e)}")
            break
            
    raise HTTPException(status_code=503, detail="Tüm AI modelleri erişilemiyor veya kotası doldu.")

@app.post("/analyze")
async def analyze_intern(payload: InternPayload):
    # Kullanıcı verisini metin haline getir
    user_context = f"""
    Stajyer Adı: {payload.name} {payload.surname}
    
    --- GÖREVLER (TASKS) ---
    {json.dumps([t.dict() for t in payload.tasksReceived], indent=2)}
    
    --- GÜNLÜK ARŞİVLER (ARCHIVES) ---
    {json.dumps([a.dict() for a in payload.archives], indent=2)}
    
    --- SİSTEM LOGLARI (LOGS) ---
    {json.dumps([l.dict() for l in payload.logs], indent=2)}
    """
    
    try:
        raw_text = await generate_with_fallback(user_context)
        parsed_json = extract_json_from_text(raw_text)
        
        if "overallScore" not in parsed_json:
            raise ValueError("AI istenen JSON şemasını döndürmedi.")
            
        return parsed_json
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Analiz Hatası: {str(e)}")
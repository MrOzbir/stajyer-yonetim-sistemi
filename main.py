from fastapi.responses import StreamingResponse
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
Sen deneyimli bir yazılım mühendisi, teknik lider ve SAMİMİ BİR MENTÖRSÜN.
Sana bir stajyerin görevleri, günlük arşivleri ve logları verilecek.

GÖREVİN: İKİ FARKLI KİTLİK İÇİN İKİ FARKLI ANALİZ ÜRETMEK:

═══════════════════════════════════════════════
KİTLE A: YÖNETİCİ (ADMIN) — Objektif Değerlendirme
═══════════════════════════════════════════════
- Teknik performans ve üretkenlik
- Disiplin ve istikrar (giriş/çıkış saatleri)
- Zayıf yönler (açık sözlü ol)
- Yönetici özeti (karar verme amaçlı)

═══════════════════════════════════════════════
KİTLE B: STAJYER — Samimi Mentör
═══════════════════════════════════════════════
- Motive edici, pozitif ve yapıcı dil
- Güçlü yönleri vurgula (özgüven artırıcı)
- Gelişim alanlarını "öğrenme fırsatı" olarak sun
- SOMUT öğrenme kaynakları öner (makale, video, kitap, kurs)
- 1 hafta içinde yapılabilecek net adımlar (nextSteps)
- İlham verici bir motivasyon sözü

ÇIKTI FORMATI:
MUTLAKA aşağıdaki JSON şemasına uygun SAF JSON döndür:

{
  "overallScore": 0-100 integer,
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "adminSummary": "string (admin için net özet)",
  "suggestions": ["string"],
  
  "internSummary": "string (stajyere özel, motive edici özet - 'Bu hafta harika ilerleme kaydettin...' gibi)",
  "internFeedback": "string (geliştirici geri bildirim - 'Şu alana odaklanırsan...' gibi)",
  "learningResources": [
    "React Hooks - https://react.dev/learn",
    "Clean Code - Robert Martin (Kitap)",
    "JavaScript.info - Modern Tutorial"
  ],
  "nextSteps": [
    "Bu hafta useState hook'unu 3 küçük projede uygula",
    "GitHub'da 5 popüler React repo incele"
  ],
  "encouragementQuote": "string (ilham verici bir söz)"
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
        ]

async def generate_with_fallback(user_context: str) -> str:
    """Yeni SDK ile akıllı fallback mekanizması."""
    
    # 🆕 2026 İÇİN GÜNCEL VE ÇALIŞAN MODELLER
    MODELS = [
        'gemini-2.5-flash',           # Yeni, hızlı, yüksek kota
        'gemini-2.5-pro',             # Yeni, güçlü
        'gemini-1.5-flash-latest',    # Stabil
        'gemini-1.5-pro-latest',      # Stabil pro
        'gemini-flash-latest',        # Eski ama bazen çalışır
        'gemini-pro-latest',          # Eski pro
        'gemini-2.0-flash-exp',       # Experimental
    ]
    
    for model_name in MODELS:
        try:
            print(f"🔄 Deneniyor: {model_name}...")
            
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=user_context,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    max_output_tokens=2048
                )
            )
            print(f"✅ Başarılı: {model_name} kullanıldı.")
            return response.text
            
        except ClientError as e:
            error_str = str(e)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                print(f"⚠️ {model_name} kotası doldu! Diğer modele geçiliyor...")
                continue  # ✅ break değil continue!
            elif "404" in error_str or "not found" in error_str:
                print(f"⚠️ {model_name} kullanımda değil! Diğer modele geçiliyor...")
                continue  # ✅ break değil continue!
            else:
                print(f"❌ {model_name} client hatası: {error_str[:150]}")
                continue  # ✅ break değil continue!
                
        except ServerError as e:
            # 🆕 503 UNAVAILABLE gibi sunucu hataları
            print(f"⚠️ {model_name} sunucu hatası (meşgul): {str(e)[:100]}")
            continue  # ✅ Diğer modele geç!
                
        except Exception as e:
            error_str = str(e)
            if "503" in error_str or "UNAVAILABLE" in error_str:
                print(f"⚠️ {model_name} şu an meşgul (503)! Diğer modele geçiliyor...")
                continue  # ✅ break değil continue!
            print(f"❌ {model_name} beklenmedik hatası: {error_str[:150]}")
            continue  # ✅ break değil continue!
            
    raise HTTPException(status_code=503, detail="Tüm AI modelleri erişilemiyor veya meşgul. Lütfen 1-2 dakika bekleyip tekrar deneyin.")

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
    

# ==========================================
# 🤖 AI SOHBET MENTORU (HIZ OPTİMİZE v3)
# ==========================================

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    messages: List[ChatMessage] = []
    context: Optional[dict] = None

CHAT_SYSTEM_PROMPT = """Sen samimi, motive edici ve BİLGİLİ bir yazılım mentörüsün.
Türkçe konuşuyorsun, "sen" dilini kullanıyorsun.

GÖREVİN: Stajyerin sana verdiği CONTEXT (bağlam) verilerini KULLANARAK
kişiselleştirilmiş, somut ve uygulanabilir cevaplar vermek.

🎯 CONTEXT VERİLERİNİ NASIL KULLANACAKSIN:

1. 📊 AI PUANI (aiScore):
   - "85 puan aldın, harika gidiyorsun!" gibi motive edici
   - 70 altıysa: "Gelişim alanların var ama endişelenme..."

2. 💪 GÜÇLÜ YÖNLER (aiStrengths):
   - "React'ta çok iyisin, bunu kullanalım" gibi
   - Somut övgü

3. 📋 GÖREVLER (currentTasks):
   - Deadline yakınsa: "Redis görevin 2 gün sonra bitiyor, öncelik ver!"
   - Gecikmişse: "⚠️ Swagger görevi gecikmiş, bugün odaklanalım"
   - Repo linki yoksa: "Repo linkini eklemeyi unutma"

4. 🎯 SONRAKİ ADIMLAR (aiNextSteps):
   - Bunları somut tavsiye olarak ver

5. ⏱️ MESAİ (weeklyWorkedHours):
   - "Bu hafta 35 saat çalıştın, iyi tempo!"
   - 20 saatin altındaysa: "Daha fazla pratik yapman iyi olur"

CEVAP KURALLARIN:
- Kod örnekleri veriyorsun (```javascript veya ```python)
- Cevapların 150-250 kelime arası
- Samimi ama profesyonel
- Veriye dayalı, genel değil

Eğer context yoksa veya yetersizse, genel tavsiye ver."""

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        system_prompt = CHAT_SYSTEM_PROMPT
        if request.context and request.context.get('name'):
            system_prompt += f"\nStajyer: {request.context['name']}"
        
        contents = []
        for msg in request.messages[-8:]:
            contents.append({
                "role": msg.role,
                "parts": [{"text": msg.content}]
            })
        contents.append({
            "role": "user",
            "parts": [{"text": request.message}]
        })
        
        print(f"💬 Chat: {request.message[:40]}...")
        
        # ✅ /analyze'da ÇALIŞTIĞINI BİLDİĞİMİZ MODELLER
        MODELS = [
            'gemini-flash-latest',
            'gemini-flash-lite-latest',
            'gemini-pro-latest',
        ]
        
        full_text = None
        used_model = None
        
        for model_name in MODELS:
            try:
                print(f"🚀 Model: {model_name}")
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        max_output_tokens=800,
                        temperature=0.7,
                    )
                )
                full_text = response.text
                used_model = model_name
                print(f"✅ Cevap alındı: {model_name} ({len(full_text)} karakter)")
                break
                
            except ClientError as e:
                error_str = str(e)
                if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    print(f"⚠️ {model_name} kotası doldu, diğerine geçiliyor")
                    continue
                elif "404" in error_str or "not found" in error_str:
                    print(f"⚠️ {model_name} bulunamadı, diğerine geçiliyor")
                    continue
                else:
                    print(f"❌ {model_name} client hatası: {error_str[:150]}")
                    continue
            except Exception as e:
                print(f"❌ {model_name} hatası: {type(e).__name__}: {str(e)[:150]}")
                continue
        
        if full_text is None:
            return StreamingResponse(
                iter([f"data: {json.dumps({'error': 'Tüm modeller başarısız'}, ensure_ascii=False)}\n\n"]),
                media_type="text/event-stream"
            )
        
        import asyncio
        
        async def generate():
            chunk_size = 15
            for i in range(0, len(full_text), chunk_size):
                chunk = full_text[i:i+chunk_size]
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.02)
            
            yield f"data: {json.dumps({'done': True, 'full_response': full_text}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
        
    except Exception as e:
        print(f"❌ Chat endpoint hatası: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    
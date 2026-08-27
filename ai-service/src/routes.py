from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import requests
import json
import asyncio

# Kendi modüllerimiz
from .config import OLLAMA_URL, MODEL_NAME
from .schemas import InternPayload, ChatRequest, DailyArchivePayload, DailySummaryPayload
from .prompts import SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT
from .utils import extract_json_from_text

router = APIRouter()

@router.post("/generate-tip")
async def generate_tip_endpoint(payload: TipPayload):
    system_prompt = (
        "Sen motive edici bir yazılım mentörüsün. Stajyer mesaisini bitirdi ve çıkış yaptı. "
        "GÖREVİN: Stajyerin bir sonraki gün sisteme girdiğinde göreceği kısa bir sabah tavsiyesi ve motivasyon sözü üretmek. "
        "Lütfen aşağıdaki JSON formatında cevap ver:\n"
        '{"tip": "Yarın için 1-2 cümlelik tavsiye...", "quote": "İlham verici bir söz"}'
    )
    
    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": f"Stajyer bugün {payload.workedMinutes} dakika çalıştı. Ona yarın için bir tavsiye ver.",
                "system": system_prompt,
                "stream": False,
                "format": "json"
            },
            timeout=40
        )
        
        result = response.json()
        raw_text = result.get("response", "{}")
        return extract_json_from_text(raw_text)
        
    except Exception as e:
        print(f"❌ Tavsiye üretim hatası: {str(e)}")
        return {
            "tip": "Dün harika bir iş çıkardın, bugünkü görevlerine aynı odakla devam et!",
            "quote": "Kod yazmak bisiklete binmek gibidir, ilerlemek için pedallamaya devam etmelisin."
        }

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
                "options": {
                    "temperature": 0.4,
                    "num_predict": 1500,
                    "top_p": 0.9,
                    "repeat_penalty": 1.15
                }
            },
            timeout=180
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
                "stream": False,
                "options": {
                    "temperature": 0.3
                }
            },
            timeout=60
        )

        if response.status_code != 200:
            raise Exception(f"Ollama hatası: {response.text}")

        result = response.json()
        full_text = result.get("response", "")
        print(f"✅ Chat cevabı: {len(full_text)} karakter")

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


@router.post("/process-daily-entry")
async def process_daily_entry(payload: DailyArchivePayload):
    system_instruction = (
        "Sen stajyer günlüklerini anonimleştiren uzman bir veri analizcisisin. "
        "CRITICAL: Yalnızca Türkçe yanıt ver. "
        "GÖREV: 1. Stajyere doğrudan ('sen') hitap eden 2 cümlelik yapıcı mentör notu ('mentorNote') üret. "
        "2. Metindeki isimleri/şahısları silerek teknik ve sosyal detayları ayrıştır. "
        "DİKKAT: Konuları ve zorlukları 1-2 kelimelik kısa etiketler olarak DEĞİL, ne yapıldığını açıklayan detaylı cümleler olarak çıkar. "
        "Yalnızca geçerli JSON döndür:\n"
        "{\n"
        '  "mentorNote": "Günün verimli geçmiş...",\n'
        '  "mood": "Motive / Yorgun / Stresli",\n'
        '  "topicsCovered": ["JWT tabanlı kimlik doğrulama ve bcrypt ile şifreleme", "WebSocket üzerinden canlı mesajlaşma altyapısı"],\n'
        '  "challengesFaced": ["Docker port yönlendirmesinde ERR_CONNECTION_REFUSED hatası", "API dokümantasyonunun yetersiz olması"],\n'
        '  "socialInteractions": ["Ekip arkadaşlarıyla toplantıda teknik fikir alışverişi"],\n'
        '  "sentimentScore": 85\n'
        "}"
    )

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "system": system_instruction,
                "prompt": f"Stajyer Günlüğü:\n{payload.dailyContent}",
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "num_predict": 400
                }
            },
            timeout=60
        )

        result = response.json()
        raw_text = result.get("response", "{}")
        return extract_json_from_text(raw_text)

    except Exception as e:
        print(f"❌ Günlük işleme hatası: {str(e)}")
        return {
            "mentorNote": "Günün verimli geçmiş görünüyor. Başarılar!",
            "mood": "Normal",
            "topicsCovered": ["Genel Çalışma"],
            "challengesFaced": [],
            "socialInteractions": [],
            "sentimentScore": 75
        }


@router.post("/summarize-daily")
async def summarize_daily_endpoint(payload: DailySummaryPayload):
    """
    Cron tarafından gönderilen tüm günlük girdileri stilometrik olarak anonimleştirip
    yönetici için derinlemesine, çok maddeli ve kapsamlı bir havuz özeti üretir.
    """
    system_prompt = (
        "Sen şirketin Kıdemli Mühendislik Direktörü ve İK Yöneticisisin. "
        "GÖREVİN: Sana sağlanan stajyer günlük kayıtlarını analiz edip üst yönetime detaylı, profesyonel bir günlük bülten sunmak.\n\n"
        "KESİN KURALLAR:\n"
        "1. KESİNLİKLE '...' ile biten yarım cümleler veya yüzeysel 1-2 maddelik özetler yazma.\n"
        "2. 'yoneticiOzeti': Ekibin gün içindeki teknik odağını, tamamlanan işleri, karşılaşılan darboğazları ve psikolojik/sosyal durumu kapsamlı şekilde ele alan EN AZ 4-5 DOLU CÜMLEDEN OLUŞAN BİR PARAGRAF olmalıdır.\n"
        "3. Her bir kategori listesi ('basarilar', 'karsilasilanZorluklar', 'sikayetler', 'memnuniyetler') için stajyer kayıtlarındaki tüm detayları ayrıştır ve HER BİRİNE EN AZ 4-5 FARKLI VE AÇIKLAYICI MADDE ekle. Her madde durumun nedenini ve sonucunu anlatan tam bir cümle olsun.\n"
        "4. Stajyer isimlerini, kişisel üslupları ve hitapları tamamen sil (stilometrik anonimleştirme).\n"
        "5. Yanıt olarak YALNIZCA aşağıdaki JSON formatında geçerli bir JSON objesi döndür:\n\n"
        "{\n"
        '  "genelMoral": "Yüksek / Dengeli / Düşük / Motivasyonu Artan",\n'
        '  "yoneticiOzeti": "Ekibin gün boyu üzerinde çalıştığı konuları, verimlilik seviyesini ve genel atmosferi anlatan detaylı paragraf.",\n'
        '  "karsilasilanZorluklar": [\n'
        '    "Karşılaşılan birinci teknik/süreç zorluğunun detaylı açıklaması.",\n'
        '    "İkinci zorluk maddesi ve yaşattığı etki.",\n'
        '    "Üçüncü zorluk ve teknik tıkanıklık detayı.",\n'
        '    "Dördüncü zorluk detayı."\n'
        '  ],\n'
        '  "basarilar": [\n'
        '    "Tamamlanan birinci teknik başarı ve sağladığı fayda.",\n'
        '    "İkinci başarı maddesi.",\n'
        '    "Üçüncü başarı maddesi.",\n'
        '    "Dördüncü başarı maddesi."\n'
        '  ],\n'
        '  "sikayetler": [\n'
        '    "Süreç, dokümantasyon veya ortamla ilgili birinci şikayet/iyileştirme noktası.",\n'
        '    "İkinci geri bildirim maddesi.",\n'
        '    "Üçüncü geri bildirim maddesi."\n'
        '  ],\n'
        '  "memnuniyetler": [\n'
        '    "Ekip içi iletişim, mentörlük veya şirket kültürüyle ilgili birinci memnuniyet.",\n'
        '    "İkinci memnuniyet maddesi.",\n'
        '    "Üçüncü memnuniyet maddesi."\n'
        '  ]\n'
        "}"
    )

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL_NAME,
                "prompt": f"GÜNLÜK STAJYER GİRDİLERİ:\n{payload.dailyContents}",
                "system": system_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,       # Dengeli ve zengin içerik üretimi için
                    "num_predict": 2048,      # Uzun ve çok maddeli listeleri kesmeden yazması için limit artırıldı
                    "repeat_penalty": 1.15
                }
            },
            timeout=180
        )

        if response.status_code != 200:
            raise Exception(f"Ollama hatası: {response.text}")

        result = response.json()
        raw_text = result.get("response", "{}")
        return extract_json_from_text(raw_text)

    except Exception as e:
        print(f"❌ Günlük özetleme hatası: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Özet Hatası: {str(e)}")
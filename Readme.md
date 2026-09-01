# Stajyer Yönetim Sistemi (Intern Management System)

Modern, yapay zeka destekli ve tam donanımlı bir stajyer yönetim platformudur. Bu sistem, kurumların stajyerlerini yönetmesini, görev atamasını, performanslarını takip etmesini ve yapay zeka entegrasyonu ile analizler yapmasını sağlar.

## 🌟 Özellikler

### 🔐 Giriş ve Kimlik Doğrulama
- Kullanıcı dostu arayüz ile e-posta/kullanıcı adı ve şifre ile giriş.
- Karanlık (Dark) ve Aydınlık (Light) tema desteği.
- Çoklu dil (Localization) seçeneği.
- Hatalı girişlerde anında bildirim sistemi.
- Şifremi unuttum ve şifre yenileme (Gmail entegrasyonu ile).

### 👨‍💼 Admin Paneli
- **Stajyer Yönetimi:** Yeni stajyer ekleme, hesap dondurma (arşivleme) ve silme işlemleri.
- **Görev Yönetimi:** Stajyerlere özel görev atamaları ve takibi.
- **İlerleme ve Analiz:** Stajyerlerin gelişim durumlarını canlı izleme.
- **Yapay Zeka Destekli Analiz:** Sistem logları ve görev durumlarını yorumlayarak stajyerin genel performansını özetleyen AI ajanı.
- **İletişim:** Stajyerlerle anlık doğrudan mesajlaşma sistemi (Socket.io).

### 🎓 Stajyer Paneli
- **Görev Takibi:** Atanan görevleri görüntüleme ve Check-box ile tamamlananları işaretleme.
- **Proje Teslimi:** GitHub/GitLab gibi repo linklerini görev sonu raporuna ekleme imkanı.
- **Günlük Arşiv & Log:** Stajyerin sisteme giriş saatlerinin kayıt altına alınması ve gün sonu özetlerinin girilebileceği günlük arşiv.
- Şifre ve profil ayarları yönetimi.

---

## 🛠 Kullanılan Teknolojiler

Proje, modern ve ölçeklenebilir bir mimari ile geliştirilmiştir:

- **Frontend (İstemci):** React.js (Vite), Tailwind CSS v4, Lucide React, Three.js, React Router
- **Backend (Ana Sunucu):** Node.js, Express.js, Prisma ORM, Socket.io, JWT (Kimlik Doğrulama), Node-Cron, Nodemailer
- **Veritabanı:** PostgreSQL
- **Yapay Zeka Servisi:** Python (FastAPI/Flask), Ollama (Local AI - qwen3-local model) / Google Gemini API
- **Konteynerizasyon:** Docker & Docker Compose

---

## 🏗 Sistem Mimarisi

```text
[ İSTEMCİ (CLIENT) ]  <-- (HTTP/REST & WebSockets) --> [ ANA SUNUCU (NODE.JS) ]
(React, Tailwind, Vite)                                - Kimlik Doğrulama (JWT)
- Login Ekranı                                         - Görev Yönetimi (CRUD)
- Admin Paneli                                         - Mesajlaşma (Socket.io)
- Stajyer Paneli                                       - Log Kayıtları
                                                               |   |
                                                               |   | (İç API İletişimi)
                                                               |   |
[ VERİ TABANI ] <----------------------------------------------+   +------> [ YAPAY ZEKA SERVİSİ (PYTHON) ]
(PostgreSQL)                                                                - Ollama / Gemini Entegrasyonu
- Users (Kullanıcılar)                                                      - Veri Analizi
- Tasks (Görevler)                                                          - Performans Özetleri
- Logs (Giriş Çıkış Kayıtları)                                                       |
- Messages (Mesajlar)                                                                v
- Summaries (Günlük Özetler)                                                [ LOCAL AI / GEMINI API ]
```

---

## 🚀 Başlangıç ve Kurulum

Sistemi yerel ortamınızda çalıştırmak için Docker ve Docker Compose kullanmanız önerilir. Bu sayede tüm servisler (Veritabanı, Backend, Frontend, AI) otomatik olarak ayağa kalkacaktır.

### 1. Depoyu Klonlayın
```bash
git clone <repo-url>
cd stajyer-yonetim-sistemi
```

### 2. Çevre Değişkenlerini (Environment Variables) Ayarlayın
Ana dizindeki veya `backend-api` klasöründeki `.env` dosyasını sistem gereksinimlerine göre güncelleyin.
```env
DATABASE_URL=postgresql://admin:password@postgres:5432/stajyer_sistemi
PORT=5001
PYTHON_AI_SERVICE_URL=http://ai-service:8000/analyze
OLLAMA_URL=http://host.docker.internal:11434
JWT_SECRET=your_secret_key
```

### 3. Docker ile Sistemi Başlatın
Aşağıdaki komutu çalıştırarak tüm container'ları başlatın:
```bash
docker-compose up --build
```

Bu işlem tamamlandığında servisler şu adreslerde çalışıyor olacaktır:
- **Frontend (Web Arayüzü):** `http://localhost:5173`
- **Backend API:** `http://localhost:5001`
- **AI Servisi:** `http://localhost:8000`
- **PostgreSQL Veritabanı:** `localhost:5433` portu üzerinden.

---

## 🤝 Katkıda Bulunma

1. Bu depoyu fork'layın.
2. Yeni bir feature branch'i oluşturun (`git checkout -b feature/yeniOzellik`).
3. Değişikliklerinizi commit'leyin (`git commit -m 'Yeni özellik eklendi'`).
4. Branch'inize push'layın (`git push origin feature/yeniOzellik`).
5. Pull Request oluşturun.

📄 Lisans

Bu proje **CC0 1.0 Universal (Kamu Malı)** lisansı altında sunulmuştur. Daha fazla bilgi için `LICENSE` dosyasına göz atabilirsiniz.
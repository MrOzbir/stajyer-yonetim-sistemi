# STAJYER YÖNETİM SİSTEMİ README'Sİ

## LOGIN EKRANI İÇERİĞİ
- Karanlık ve aydınlık tema butonu
- Dil seçim slide bar'ı
- Şifre ve kullanıcı adı yazım text field'i
- Şifre hatalı ise bildirim sistemi
- Şifre değiştirme seçeneği (Şifre unutulma durumuna karşı Gmail ile giriş seçeneği sunulabilir)

## ADMİN PANELİ İÇERİĞİ
- Şifre değiştirme seçeneği (Şifre unutulma durumuna karşı Gmail ile giriş seçeneği sunulabilir)
- Yeni stajyer oluşturma bölümü
- Stajyer görev ataması bölümü
- Stajyer hesabı arşive alma ve silme bölümü
- Stajyerlerin ilerleme durumunu görebilme bölümü
- Stajyere doğrudan mesaj atabilme paneli
- Stajyerlerin ilerleme durumunu analiz edip özet sunan API bağlantılı bir AI agent eklentisi

## STAJYER PANELİ İÇERİĞİ
- Şifre değiştirme seçeneği (Şifre unutulma durumuna karşı Gmail ile giriş seçeneği sunulabilir)
- Check box ile tamamlanmış bölümleri işaretleme
- Tamamlanmış ve GitHub ya da GitLab gibi bir sisteme yüklenmiş kod repolarının linkini görev sonu özet bölümüne ekleme
- Stajyer sisteme giriş saatlerinin log dosyalarında kayıt edilmesi
- Stajyerin gün içerisinde yaptıklarını özet olarak yazabileceği günlük arşiv bölümü

## KULLANILACAK TEKNOLOJİ VE YAZILIM DİLLERİ
- **PostgreSQL:** Veri tabanı servisi olarak tercih edilir
- **Google Gemini API / Local AI:** AI entegrasyonu için kullanılır
- **HTML:** Grafik arayüzde bileşenleri konumlandırmak için kullanılır
- **CSS / Tailwind CSS:** HTML bileşenlerine biçim vermek için kullanılır
- **Node.js:** SQL ve API çekim esnasında ve yerel sunucu işlemleri için kullanılır
- **JavaScript / React.js / TypeScript:** Görsel animasyon ve etkileşim için kullanılır

## Sistem Mimarisi

```text
[ İSTEMCİ (CLIENT) ]  <-- (HTTP/REST & WebSockets).    -->     ANA SUNUCU (NODE.JS) ]
(HTML, CSS, JS, Express.js, Next.js, React.js, TypeScript)   - Kimlik Doğrulama (Auth)
- Login Ekranı                                               - Görev Yönetimi (CRUD)
- Admin Paneli                                               - Mesajlaşma (Socket.io)
- Stajyer Paneli                                             - Log Kayıtları
                                                                   |   |
                                                                   |   | (İç API İletişimi / HTTP)
                                                                   |   |
[ VERİ TABANI ] <--------------------------------------------------+   +------> [ YAPAY ZEKA SERVİSİ (PYTHON) ]
(PostgreSQL)                                                                    - Gemini API Entegrasyonu
- Users (Kullanıcılar)                                                          - Veri Analizi
- Tasks (Görevler)                                                              - Performans Özetleri
- Logs (Giriş Çıkış Kayıtları)                                                          |
- Messages (Mesajlar)                                                                   v
- Summaries (Günlük Özetler)                                                    [ GOOGLE GEMINI API ]
```
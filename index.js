require('dotenv').config(); 
const axios = require('axios');
const jwt = require('jsonwebtoken'); 
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { Pool } = require('pg'); 
const { PrismaPg } = require('@prisma/adapter-pg');
const { authenticateToken, requireAdmin } = require('./middleware/auth');


/**
 * UTC tarihini Türkiye saatine (Europe/Istanbul) çevirir
 * @param {string|Date} dateString - ISO formatında tarih
 * @returns {string} - "12 Ağustos 2026 18:26" formatında
 */
function formatToTurkeyTime(dateString) {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Çalışılan süreyi okunabilir formata çevirir
 * @param {number} minutes - Dakika cinsinden süre
 * @returns {string} - "2 saat 15 dakika" formatında
 */
function formatWorkDuration(minutes) {
    if (!minutes || minutes < 0) return '0 dakika';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} dakika`;
    if (mins === 0) return `${hours} saat`;
    return `${hours} saat ${mins} dakika`;
}


// 1. GÜVENLİK KONTROLÜ: .env dosyası okunabiliyor mu?
if (!process.env.DATABASE_URL) {
    console.error("🚨 KRİTİK HATA: .env dosyasından DATABASE_URL okunamadı! (Dosya yeri veya adı yanlış olabilir)");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool); 
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 5001; 

app.use(cors()); 
app.use(express.json()); 

// 2. YENİ EKLENEN BAĞLANTI TESTİ (Sunucu başlarken DB'yi test et)
pool.connect((err, client, release) => {
    if (err) {
        console.error('\n❌ VERİTABANI BAĞLANTI HATASI (Havuz Reddedildi):');
        console.error(err.message, '\n');
    } else {
        console.log('✅ PostgreSQL Bağlantısı Havuz (Pool) Üzerinden Başarıyla Kuruldu!');
        release();
    }
});

// Test Rotası
app.get('/', (req, res) => {
    res.send('✅ Stajyer Yönetim Sistemi API başarıyla çalışıyor!');
});

// --- KİMLİK DOĞRULAMA (AUTH) ROTALARI ---

// 1. Kayıt Olma (Register) Rotası
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, surname, email, password, role } = req.body;

        const existingUser = await prisma.user.findUnique({
            where: { email: email }
        });

        if (existingUser) {
            return res.status(400).json({ error: "Bu e-posta adresi zaten kullanımda." });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = await prisma.user.create({
            data: {
                name: name,
                surname: surname,
                email: email,
                password_hash: hashedPassword, 
                role: role || 'INTERN', 
            }
        });

        if (newUser.role === 'INTERN') {
            await prisma.internProfile.create({
                data: {
                    userId: newUser.id
                }
            });
        }

        res.status(201).json({ message: "Kullanıcı başarıyla oluşturuldu!", userId: newUser.id });

    } catch (error) {
        // Logu daha belirgin hale getirdik
        console.log("\n-----------------------------------------");
        console.error("🚨 KAYIT (REGISTER) İŞLEMİNDE HATA ÇIKTI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Sunucu tarafında bir hata oluştu." });
    }
});

// 2. Giriş Yapma (Login) Rotası
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
            
        const user = await prisma.user.findUnique({
            where: { email: email }
        });
            
        if (!user) {
            return res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
        }
                
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Geçersiz e-posta veya şifre." });
        }
        
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // YENİ EKLENEN OTOMATİK LOGLAMA: Giriş yapan kişi stajyer ise log (giriş saati) tut
        if (user.role === 'INTERN') {
            await prisma.dailyLog.create({
                data: {
                    internId: user.id
                    // 'loginTime' alanını eklememize gerek yok, veritabanı (schema.prisma)
                    // @default(now()) kuralı sayesinde şu anki saati otomatik yazacaktır.
                }
            });
       }

        res.status(200).json({
            message: "Başarıyla giriş yapıldı!",
            token: token,
            user: {
                id: user.id,
                name: user.name,
                role: user.role 
            }
        });

    } catch (error) {
        console.log("\n-----------------------------------------");
        console.error("🚨 GİRİŞ (LOGIN) İŞLEMİNDE HATA ÇIKTI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Sunucu tarafında bir hata oluştu." });
    }
});

// 3. Çıkış Yapma (Logout) Rotası
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // 1. GÜVENLİK KONTROLÜ: Sadece stajyerlerin çıkış logu tutulur
        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ 
                error: "Sadece stajyerler için çıkış logu tutulmaktadır." 
            });
        }
        
        // 2. BUGÜN AÇILMIŞ EN SON LOGU BUL
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const openLog = await prisma.dailyLog.findFirst({
            where: {
                internId: req.user.userId,
                logoutTime: null,
                loginTime: { gte: today }
            },
            orderBy: { loginTime: 'desc' }
        });
        
        if (!openLog) {
            return res.status(404).json({ 
                error: "Kapatılacak açık bir oturum bulunamadı." 
            });
        }
        
        // 3. LOGOUT TIME'I GÜNCELLE
        const logoutTime = new Date();
        const updatedLog = await prisma.dailyLog.update({
            where: { id: openLog.id },
            data: { logoutTime: logoutTime }
        });
        
        // 4. ÇALIŞILAN SÜREYİ HESAPLA
        const workedMinutes = Math.round(
            (logoutTime - openLog.loginTime) / (1000 * 60)
        );
        
        // 🎯 YENİ: YARDIMCI FONKSİYONLARI KULLAN
        res.status(200).json({ 
            message: "Başarıyla çıkış yapıldı!",
            log: {
                id: updatedLog.id,
                loginTime: formatToTurkeyTime(openLog.loginTime),      // 🇹🇷 Türkiye saati
                logoutTime: formatToTurkeyTime(updatedLog.logoutTime), // 🇹🇷 Türkiye saati
                loginTimeUTC: openLog.loginTime,    // Veritabanı için orijinal
                logoutTimeUTC: updatedLog.logoutTime
            },
            workedMinutes: workedMinutes,
            workedDuration: formatWorkDuration(workedMinutes), // "2 saat 15 dakika"
            summary: `Bugün ${formatWorkDuration(workedMinutes)} boyunca sistemde oturum açıldı.`
        });
        
    } catch (error) {
        console.error("🚨 ÇIKIŞ (LOGOUT) HATASI:", error);
        res.status(500).json({ error: "Çıkış işlemi sırasında hata oluştu." });
    }
});


// --- GÖREV (TASK) ROTALARI ---

// 1. Yeni Görev Atama (SADECE ADMIN)
// Dikkat et: Rotanın içine 'authenticateToken' ve 'requireAdmin' görevlilerini yerleştirdik.
app.post('/api/tasks', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Admin'in Thunder Client'tan (veya ileride arayüzden) göndereceği veriler
        const { title, description, internId } = req.body;

        // Prisma ile yeni görevi veritabanına ekliyoruz
        const newTask = await prisma.task.create({
            data: {
                title: title,
                description: description,
                // adminId'yi dışarıdan güvenmeyip, doğrudan doğruladığımız JWT biletinden (req.user) alıyoruz
                adminId: req.user.userId, 
                internId: internId
            }
        });

        res.status(201).json({ message: "Görev başarıyla atandı!", task: newTask });

    } catch (error) {
        console.log("\n-----------------------------------------");
        console.error("🚨 GÖREV ATAMA HATASI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Sunucu tarafında bir hata oluştu." });
    }
});

// 2. Görevleri Listeleme (ADMIN tümünü, INTERN sadece kendi görevlerini görür)
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        let tasks;

        if (req.user.role === 'ADMIN') {
            tasks = await prisma.task.findMany({
                include: {
                    intern: { select: { id: true, name: true, surname: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        } else {
            tasks = await prisma.task.findMany({
                where: { internId: req.user.userId },
                include: {
                    admin: { select: { id: true, name: true } }
                },
                orderBy: { createdAt: 'desc' }
            });
        }

        // 🆕 GÖREVLERİ ZENGİNLEŞTİR: Kalan gün ve gecikme durumu ekle
        const enrichedTasks = tasks.map(task => {
            let daysRemaining = null;
            let isOverdue = false;

            if (task.deadline) {
                const now = new Date();
                const deadlineDate = new Date(task.deadline);
                const diffTime = deadlineDate - now;
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                // Tamamlanmamış ve süresi geçmiş görevler
                isOverdue = task.status !== 'COMPLETED' && daysRemaining < 0;
            }

            return {
                ...task,
                daysRemaining: daysRemaining,
                isOverdue: isOverdue,
                deadlineFormatted: task.deadline 
                    ? formatToTurkeyTime(task.deadline) 
                    : null
            };
        });

        res.status(200).json(enrichedTasks);

    } catch (error) {
        console.error("🚨 GÖREV LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Görevler listelenirken bir hata oluştu." });
    }
});


// 3. Görev Durumunu Güncelleme (SADECE INTERN)
// Stajyer görevi günceller (Örn: "COMPLETED" yapar ve repo linkini ekler).
app.patch('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const { status, repoLink } = req.body;

        // 1. GÜVENLİK KONTROLÜ: Gelen kişi stajyer mi?
        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ error: "Sadece stajyerler görev durumunu güncelleyebilir." });
        }

        // 2. GÜVENLİK KONTROLÜ: Bu görev gerçekten bu stajyere mi ait?
        const task = await prisma.task.findUnique({ where: { id: taskId } });
        
        if (!task) {
            return res.status(404).json({ error: "Görev bulunamadı." });
        }
        
        if (task.internId !== req.user.userId) {
            return res.status(403).json({ error: "Sadece size atanan görevleri güncelleyebilirsiniz." });
        }

        // 3. GÜNCELLEME İŞLEMİ
        const updatedTask = await prisma.task.update({
            where: { id: taskId },
            data: {
                status: status,
                repoLink: repoLink
            }
        });

        res.status(200).json({ message: "Görev başarıyla güncellendi!", task: updatedTask });

    } catch (error) {
        console.log("\n-----------------------------------------");
        console.error("🚨 GÖREV GÜNCELLEME HATASI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Görev güncellenirken bir hata oluştu." });
    }
});

// 4. Günlük Arşiv Ekleme (SADECE INTERN)
// Stajyer, gün sonu özetini (neler yaptığını) sisteme kaydeder.
app.post('/api/archives', authenticateToken, async (req, res) => {
    try {
        const { content } = req.body;

        // 1. GÜVENLİK KONTROLÜ: Gelen kişi stajyer mi?
        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ error: "Sadece stajyerler günlük arşiv ekleyebilir." });
        }
        
        // 2. KONTROL: İçerik boş mu?
        if (!content || content.trim() === "") {
             return res.status(400).json({ error: "Arşiv içeriği boş olamaz." });
        }

        // 3. KAYIT İŞLEMİ
        const newArchive = await prisma.dailyArchive.create({
            data: {
                content: content,
                // req.user.userId bilgisi, güvenliği sağlanan biletin (token) içinden otomatik olarak gelir.
                internId: req.user.userId 
            }
        });

        res.status(201).json({ message: "Günlük arşiviniz başarıyla kaydedildi!", archive: newArchive });

    } catch (error) {
        console.log("\n-----------------------------------------");
        console.error("🚨 GÜNLÜK ARŞİV EKLEME HATASI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Günlük arşiv eklenirken bir hata oluştu." });
    }
});
        
// 5. Mesaj Gönderme (Ortak İşlev: ADMIN ve INTERN kullanabilir)
app.post('/api/messages', authenticateToken, async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        const senderId = req.user.userId; // Token'dan gelen gönderici ID'si

        // 1. KONTROLLER
        if (!receiverId || !content || content.trim() === "") {
            return res.status(400).json({ error: "Alıcı ID'si ve mesaj içeriği boş olamaz." });
        }

        // Kişinin kendi kendine mesaj atmasını engelle
        if (senderId === parseInt(receiverId)) {
            return res.status(400).json({ error: "Kendinize mesaj gönderemezsiniz." });
        }

        // 2. KAYIT İŞLEMİ (Prisma)
        const newMessage = await prisma.message.create({
            data: {
                content: content,
                senderId: senderId,
                receiverId: parseInt(receiverId)
            }
        });

        res.status(201).json({ message: "Mesaj başarıyla gönderildi!", data: newMessage });

    } catch (error) {
        console.log("\n-----------------------------------------");
        console.error("🚨 MESAJ GÖNDERME HATASI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Mesaj gönderilirken bir hata oluştu." });
    }
});

// 6. Mesajları Listeleme (Ortak İşlev: ADMIN ve INTERN kendi mesajlarını görür)
// Kullanıcı sadece kendisine gelen veya kendi gönderdiği mesajları okuyabilir.
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. SORGULAMA İŞLEMİ (Prisma)
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId },   // Benim gönderdiklerim
                    { receiverId: userId }  // Bana gelenler
                ]
            },
            // Mesajları eski tarihten yeni tarihe doğru sırala (Chat uygulaması mantığı)
            orderBy: {
                timestamp: 'asc' 
            },
            // Gönderen ve Alıcının sadece isim bilgilerini mesaja dahil et (JOIN)
            include: {
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } }
            }
        });

        res.status(200).json(messages);

    } catch (error) {
        console.log("\n-----------------------------------------");
        console.error("🚨 MESAJ LİSTELEME HATASI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Mesajlar listelenirken bir hata oluştu." });
    }
});

// 7. Tüm Arşivleri Listeleme (SADECE ADMIN - Yapay Zeka Hazırlığı)
// Sistemdeki tüm stajyerlerin günlük arşivlerini getirir.
app.get('/api/archives', authenticateToken, async (req, res) => {
    try {
        // 1. GÜVENLİK KONTROLÜ: İstek atan kişi Admin mi?
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({ error: "Sadece yöneticiler tüm arşivleri görüntüleyebilir." });
        }

        // 2. SORGULAMA İŞLEMİ (Prisma)
        const archives = await prisma.dailyArchive.findMany({
            // En yeni arşivler en üstte listelensin
            orderBy: {
                date: 'desc' 
            },
            // Arşivi kimin yazdığını görebilmek için isim/soyisim bilgilerini dahil et
            include: {
                intern: { 
                    select: { id: true, name: true, surname: true } 
                }
            }
        });

        res.status(200).json(archives);

    } catch (error) {
        console.log("\n-----------------------------------------");
        console.error("🚨 ARŞİV LİSTELEME HATASI:");
        console.error(error);
        console.log("-----------------------------------------\n");
        res.status(500).json({ error: "Arşivler listelenirken bir hata oluştu." });
    }
});


// 8. AI Performans Raporu Oluşturma (SADECE ADMIN)
app.post('/api/ai/generate-report/:internId', authenticateToken, requireAdmin, async (req, res) => {
    const internId = parseInt(req.params.internId);
    
    try {
        // 1. Veritabanından Ham Veriyi Çek ve Formatla (Aggregator)
        const internData = await prisma.user.findUnique({
            where: { id: internId },
            select: {
                id: true,
                name: true,
                surname: true,
                tasksReceived: {
                    select: { title: true, status: true, repoLink: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 20 // 🚨 PRO TIP: Token limitini aşmamak için son 20 görev
                },
                archives: {
                    select: { content: true, date: true },
                    orderBy: { date: 'desc' },
                    take: 15 // Son 15 günlük arşiv
                },
                logs: {
                    select: { loginTime: true, logoutTime: true },
                    orderBy: { loginTime: 'desc' },
                    take: 15
                }
            }
        });

        if (!internData) {
            return res.status(404).json({ error: "Stajyer bulunamadı." });
        }

        // 2. Python Mikroservisine (FastAPI) HTTP POST İsteği At
        const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000/analyze';
        
        const aiResponse = await axios.post(PYTHON_SERVICE_URL, internData, {
            timeout: 45000 // 🚨 PRO TIP: AI işlemleri uzun sürebilir, 45 saniye timeout verin.
        });

        const analysisResult = aiResponse.data;

        // 3. Geri Bildirim Döngüsü (Feedback Loop): Sonucu Veritabanına Kaydet
        const newReport = await prisma.aiReport.create({
            data: {
                internId: internId,
                overallScore: analysisResult.overallScore,
                strengths: analysisResult.strengths,
                weaknesses: analysisResult.weaknesses,
                suggestions: analysisResult.mentorSuggestions,
                adminSummary: analysisResult.adminSummary,
                rawJson: analysisResult // Orijinal JSON'u da saklıyoruz (Audit için)
            }
        });

        // 4. Frontend'e (React) Dön
        res.status(201).json({ 
            message: "AI Performans Raporu başarıyla oluşturuldu ve arşivlendi.", 
            report: newReport 
        });

    } catch (error) {
        console.error("🚨 AI RAPOR OLUŞTURMA HATASI:", error.response?.data || error.message);
        res.status(500).json({ error: "Yapay zeka analizi sırasında bir sunucu hatası oluştu." });
    }
});


// 9. Kaydedilmiş AI Raporlarını Listeleme (Admin veya Stajyer kendi raporu)
app.get('/api/ai/reports/:internId', authenticateToken, async (req, res) => {
    const internId = parseInt(req.params.internId);
    
    // Güvenlik: Admin değilse ve kendi ID'si değilse erişimi engelle
    if (req.user.role !== 'ADMIN' && req.user.userId !== internId) {
        return res.status(403).json({ error: "Bu raporu görüntüleme yetkiniz yok." });
    }

    try {
        const reports = await prisma.aiReport.findMany({
            where: { internId: internId },
            orderBy: { reportDate: 'desc' }
        });
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ error: "Raporlar çekilirken hata oluştu." });
    }
});


// 10. Mesai Loglarını Listeleme (Türkiye Saatiyle)
app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        let whereClause = {};
        
        if (req.user.role === 'ADMIN') {
            const { internId } = req.query;
            if (internId) whereClause = { internId: parseInt(internId) };
        } else {
            whereClause = { internId: req.user.userId };
        }
        
        const logs = await prisma.dailyLog.findMany({
            where: whereClause,
            orderBy: { loginTime: 'desc' },
            take: 50,
            include: {
                intern: { select: { id: true, name: true, surname: true } }
            }
        });
        
        // 🎯 TÜRKİYE SAATİYLE ZENGİNLEŞTİRİLMİŞ LOGlar
        const enrichedLogs = logs.map(log => {
            const workedMinutes = log.logoutTime 
                ? Math.round((new Date(log.logoutTime) - new Date(log.loginTime)) / (1000 * 60))
                : null;
            
            return {
                id: log.id,
                intern: log.intern,
                // 🇹🇷 Türkiye saatleri (frontend için)
                loginTime: formatToTurkeyTime(log.loginTime),
                logoutTime: formatToTurkeyTime(log.logoutTime),
                // 🌍 UTC (hesaplama için)
                loginTimeUTC: log.loginTime,
                logoutTimeUTC: log.logoutTime,
                // ⏱️ Çalışma bilgisi
                workedMinutes: workedMinutes,
                workedDuration: workedMinutes ? formatWorkDuration(workedMinutes) : 'Devam ediyor',
                isActive: log.logoutTime === null
            };
        });
        
        res.status(200).json(enrichedLogs);
        
    } catch (error) {
        console.error("🚨 LOG LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Loglar listelenirken hata oluştu." });
    }
});


// Görev Silme (SADECE ADMIN)
app.delete('/api/tasks/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        
        const deletedTask = await prisma.task.delete({
            where: { id: taskId }
        });
        
        res.status(200).json({ 
            message: "Görev başarıyla silindi!", 
            deletedTaskId: deletedTask.id 
        });
    } catch (error) {
        console.error("🚨 GÖREV SİLME HATASI:", error);
        res.status(500).json({ error: "Görev silinirken hata oluştu." });
    }
});


// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`🚀 Sunucu http://localhost:${PORT} adresinde ayağa kalktı.`);
});
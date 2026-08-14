const http = require('http');
const { Server } = require('socket.io');
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

// ==========================================
// ⚡ SOCKET.IO GERÇEK ZAMANLI ALTYAPI
// ==========================================

// 1. HTTP sunucusunu Express app'in üzerine kur
const server = http.createServer(app);

// 2. Socket.io'yu HTTP sunucusuna bağla
const io = new Server(server, {
    cors: {
        origin: '*', // Vite/React portları
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000, // 60 saniye heartbeat
    transports: ['websocket', 'polling'], // 🆕 Önce WebSocket dene
    allowEIO3: true                       // 🆕 Eski client'larla uyumluluk
});

// 3. Online kullanıcıları takip etmek için Map
// Key: userId (string), Value: socketId (string)
const onlineUsers = new Map();

// 4. Socket.io JWT Authentication Middleware
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Authentication token gerekli'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        next();
    } catch (error) {
        next(new Error('Geçersiz veya süresi dolmuş token'));
    }
});

// 5. Yeni bağlantı geldiğinde
io.on('connection', (socket) => {
    console.log(`🔌 Yeni bağlantı: User ${socket.userId} (${socket.id})`);

    // Kullanıcıyı online olarak işaretle
    onlineUsers.set(String(socket.userId), socket.id);

    // Kullanıcıyı kendi odasına katıl (private mesaj için)
    socket.join(`user:${socket.userId}`);

    // 📡 Tüm client'lara güncel online listesini yayınla
    io.emit('online_users', {
        userIds: Array.from(onlineUsers.keys()).map(id => parseInt(id)),
        count: onlineUsers.size
    });

    // 💬 YENİ MESAJ GELDİĞİNDE
    socket.on('send_message', async (data) => {
        try {
            const { receiverId, content } = data;

            if (!receiverId || !content || content.trim() === '') {
                return socket.emit('error', { message: 'Alıcı ve içerik gerekli' });
            }

            // Mesajı veritabanına kaydet (mevcut Message tablosu)
            const newMessage = await prisma.message.create({
                data: {
                    content: content,
                    senderId: socket.userId,
                    receiverId: parseInt(receiverId)
                },
                include: {
                    sender: { select: { id: true, name: true } },
                    receiver: { select: { id: true, name: true } }
                }
            });

            // Mesaj objesini hazırla
            const messagePayload = {
                id: newMessage.id,
                content: newMessage.content,
                timestamp: newMessage.timestamp,
                sender: newMessage.sender,
                receiver: newMessage.receiver
            };

            // Hem göndericiye hem alıcıya mesajı ilet
            io.to(`user:${socket.userId}`).emit('new_message', messagePayload);
            io.to(`user:${receiverId}`).emit('new_message', messagePayload);

            console.log(`💬 Mesaj: ${socket.userId} → ${receiverId}`);

        } catch (error) {
            console.error('🚨 SOCKET MESAJ HATASI:', error);
            socket.emit('error', { message: 'Mesaj gönderilemedi' });
        }
    });

    // ⌨️ "YAZIYOR..." GÖSTERGESİ
    socket.on('typing', (data) => {
        const { receiverId, isTyping } = data;
        // Sadece alıcıya ilet (gönderici zaten biliyor)
        socket.to(`user:${receiverId}`).emit('user_typing', {
            userId: socket.userId,
            isTyping: isTyping
        });
    });

    // 🔌 BAĞLANTI KOPARSA
    socket.on('disconnect', () => {
        console.log(`❌ Bağlantı koptu: User ${socket.userId}`);
        onlineUsers.delete(String(socket.userId));
        
        // Güncel online listesini herkese yayınla
        io.emit('online_users', {
            userIds: Array.from(onlineUsers.keys()).map(id => parseInt(id)),
            count: onlineUsers.size
        });
    });
});

// 6. io objesini app'e ekle (rotalarda kullanabilmek için)
app.set('io', io);

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
        const { name, surname, email, password, role, departmentId } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: "Bu e-posta adresi zaten kullanımda." });
        }

        // Departman varsa doğrula
        if (departmentId) {
            const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
            if (!dept) {
                return res.status(400).json({ error: "Belirtilen departman bulunamadı." });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name, surname, email,
                password_hash: hashedPassword,
                role: role || 'INTERN',
                departmentId: departmentId ? parseInt(departmentId) : null
            },
            include: { department: true }  // Departman bilgisini de döndür
        });

        if (newUser.role === 'INTERN') {
            await prisma.internProfile.create({
                data: { userId: newUser.id }
            });
        }

        res.status(201).json({
            message: "Kullanıcı başarıyla oluşturuldu!",
            user: {
                id: newUser.id,
                name: newUser.name,
                role: newUser.role,
                department: newUser.department
            }
        });

    } catch (error) {
        console.error("🚨 KAYIT HATASI:", error);
        res.status(500).json({ error: "Kayıt sırasında hata oluştu." });
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

        // 🆕 SOFT DELETE KONTROLÜ: Arşivlenmiş hesap giriş yapamaz
        if (user.isArchived) {
            return res.status(403).json({
                error: "Hesabınız arşivlenmiş. Lütfen yöneticinizle iletişime geçin."
            });
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


// Kullanıcıları Listele (rol filtresiyle)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const { role } = req.query;
        
        const where = {};
        if (role) where.role = role;
        
        // Stajyer sadece admin'leri görebilir
        if (req.user.role === 'INTERN') {
            where.role = 'ADMIN';
        }
        
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                role: true
            },
            orderBy: { name: 'asc' }
        });
        
        res.status(200).json(users);
    } catch (error) {
        console.error('🚨 KULLANICI LİSTELEME HATASI:', error);
        res.status(500).json({ error: 'Kullanıcılar listelenemedi.' });
    }
});


// ==========================================
// 🏢 DEPARTMAN ROTALARI (SADECE ADMIN)
// ==========================================

// 1. Yeni Departman Oluştur
app.post('/api/departments', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, color } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: "Departman adı zorunludur." });
        }

        // Benzersizlik kontrolü
        const existing = await prisma.department.findUnique({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: `"${name}" adında bir departman zaten var.` });
        }

        const newDept = await prisma.department.create({
            data: {
                name: name.trim(),
                description: description || null,
                color: color || '#0084ff'
            }
        });

        res.status(201).json({
            message: `"${newDept.name}" departmanı başarıyla oluşturuldu!`,
            department: newDept
        });

    } catch (error) {
        console.error("🚨 DEPARTMAN OLUŞTURMA HATASI:", error);
        res.status(500).json({ error: "Departman oluşturulurken hata oluştu." });
    }
});

// 2. Tüm Departmanları Listele (üye sayısıyla birlikte)
app.get('/api/departments', authenticateToken, async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        members: {
                            where: { 
                                isArchived: false,
                                role: 'INTERN'  // Sadece aktif stajyerleri say
                            }
                        }
                    }
                }
            }
        });

        // Frontend için zenginleştir
        const enriched = departments.map(dept => ({
            id: dept.id,
            name: dept.name,
            description: dept.description,
            color: dept.color,
            internCount: dept._count.members,
            createdAt: formatToTurkeyTime(dept.createdAt)
        }));

        res.status(200).json(enriched);

    } catch (error) {
        console.error("🚨 DEPARTMAN LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Departmanlar listelenirken hata oluştu." });
    }
});

// 3. Departman Güncelle
app.patch('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const deptId = parseInt(req.params.id);
        const { name, description, color } = req.body;

        const existing = await prisma.department.findUnique({ where: { id: deptId } });
        if (!existing) {
            return res.status(404).json({ error: "Departman bulunamadı." });
        }

        // İsim değişikliği varsa benzersizlik kontrolü
        if (name && name !== existing.name) {
            const nameConflict = await prisma.department.findUnique({ where: { name } });
            if (nameConflict) {
                return res.status(400).json({ error: `"${name}" adı zaten kullanımda.` });
            }
        }

        const updated = await prisma.department.update({
            where: { id: deptId },
            data: {
                ...(name && { name: name.trim() }),
                ...(description !== undefined && { description }),
                ...(color && { color })
            }
        });

        res.status(200).json({
            message: "Departman güncellendi!",
            department: updated
        });

    } catch (error) {
        console.error("🚨 DEPARTMAN GÜNCELLEME HATASI:", error);
        res.status(500).json({ error: "Departman güncellenirken hata oluştu." });
    }
});

// 4. Departman Sil (Soft Delete yerine SetNull — üyeler korunur)
app.delete('/api/departments/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const deptId = parseInt(req.params.id);

        const existing = await prisma.department.findUnique({
            where: { id: deptId },
            include: { _count: { select: { members: true } } }
        });

        if (!existing) {
            return res.status(404).json({ error: "Departman bulunamadı." });
        }

        await prisma.department.delete({ where: { id: deptId } });

        res.status(200).json({
            message: `"${existing.name}" departmanı silindi. ${existing._count.members} üyenin departmanı "Belirtilmemiş" olarak güncellendi.`,
            deletedId: deptId
        });

    } catch (error) {
        console.error("🚨 DEPARTMAN SİLME HATASI:", error);
        res.status(500).json({ error: "Departman silinirken hata oluştu." });
    }
});

// 5. Kullanıcının Departmanını Güncelle (Admin ataması)
app.patch('/api/users/:id/department', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { departmentId } = req.body;

        // Kullanıcı var mı?
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: "Kullanıcı bulunamadı." });
        }

        // Departman var mı? (null = "departmansız" yap)
        if (departmentId !== null) {
            const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
            if (!dept) {
                return res.status(404).json({ error: "Departman bulunamadı." });
            }
        }

        const updated = await prisma.user.update({
            where: { id: userId },
            data: { departmentId: departmentId === null ? null : parseInt(departmentId) },
            include: { department: true }
        });

        res.status(200).json({
            message: `${updated.name} ${updated.surname} → ${updated.department?.name || 'Departmansız'}`,
            user: {
                id: updated.id,
                name: updated.name,
                department: updated.department
            }
        });

    } catch (error) {
        console.error("🚨 KULLANICI DEPARTMAN GÜNCELLEME HATASI:", error);
        res.status(500).json({ error: "Departman ataması başarısız." });
    }
});


// --- GÖREV (TASK) ROTALARI ---

// 1. Yeni Görev Atama (SADECE ADMIN)
app.post('/api/tasks', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { title, description, internId, deadline } = req.body; // 🆕 deadline eklendi

        // 🆕 Deadline validasyonu (varsa ve geçerliyse DateTime'a çevir)
        let parsedDeadline = null;
        if (deadline) {
            parsedDeadline = new Date(deadline);
            if (isNaN(parsedDeadline.getTime())) {
                return res.status(400).json({ 
                    error: "Geçersiz tarih formatı. ISO 8601 formatında gönderin (örn: 2026-08-20)." 
                });
            }
        }

        const newTask = await prisma.task.create({
            data: {
                title: title,
                description: description,
                deadline: parsedDeadline, // 🆕 Yeni alan
                adminId: req.user.userId,
                internId: internId
            }
        });

        res.status(201).json({ message: "Görev başarıyla atandı!", task: newTask });

    } catch (error) {
        console.error("🚨 GÖREV ATAMA HATASI:", error);
        res.status(500).json({ error: "Sunucu tarafında bir hata oluştu." });
    }
});

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

                // 🆕 SOCKET.IO ÜZERİNDEN YAYINLA
                const io = req.app.get('io');
                if (io) {
                    const messagePayload = {
                        id: newMessage.id,
                        content: newMessage.content,
                        timestamp: newMessage.timestamp,
                        sender: { id: senderId, name: req.user.name || 'User' },
                        receiver: { id: parseInt(receiverId) }
                    };
                    io.to(`user:${senderId}`).emit('new_message', messagePayload);
                    io.to(`user:${receiverId}`).emit('new_message', messagePayload);
                }
        
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

// 💬 İKİ KULLANICI ARASINDAKİ KONUŞMAYI GETİR (Chat History)
app.get('/api/messages/:otherUserId', authenticateToken, async (req, res) => {
    try {
        const myId = req.user.userId;
        const otherId = parseInt(req.params.otherUserId);

        if (myId === otherId) {
            return res.status(400).json({ error: "Kendinizle konuşma geçmişi alamazsınız." });
        }

        // İki yönlü mesajları çek (ben→o ve o→ben)
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: myId, receiverId: otherId },
                    { senderId: otherId, receiverId: myId }
                ]
            },
            orderBy: { timestamp: 'asc' },  // Eski → yeni (chat mantığı)
            take: 100,                       // Son 100 mesaj (performans)
            include: {
                sender: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } }
            }
        });

        res.status(200).json({
            otherUserId: otherId,
            messages: messages
        });

    } catch (error) {
        console.error("🚨 KONUŞMA GEÇMİŞİ HATASI:", error);
        res.status(500).json({ error: "Konuşma geçmişi alınamadı." });
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
                    select: { title: true, status: true, repoLink: true, deadline: true, createdAt: true },
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


// ==========================================
// 🎓 STAJYER MENTÖRLÜK SİSTEMİ
// ==========================================

/**
 * AI Raporu Oluşturma (SADECE ADMIN) — GÜNCELLENMİŞ
 * Yeni mentörlük alanlarını da kaydediyor
 */
app.post('/api/ai/generate-report/:internId', authenticateToken, requireAdmin, async (req, res) => {
    const internId = parseInt(req.params.internId);
    
    try {
        const internData = await prisma.user.findUnique({
            where: { id: internId },
            select: {
                id: true, name: true, surname: true,
                tasksReceived: {
                    select: { title: true, status: true, repoLink: true, deadline: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                archives: {
                    select: { content: true, date: true },
                    orderBy: { date: 'desc' },
                    take: 15
                },
                logs: {
                    select: { loginTime: true, logoutTime: true },
                    orderBy: { loginTime: 'desc' },
                    take: 15
                }
            }
        });

        if (!internData) return res.status(404).json({ error: "Stajyer bulunamadı." });

        const PYTHON_SERVICE_URL = process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000/analyze';
        
        const aiResponse = await axios.post(PYTHON_SERVICE_URL, internData, { timeout: 45000 });
        const analysis = aiResponse.data;

        // 🆕 TÜM ALANLARI KAYDET (Admin + Mentörlük)
        const newReport = await prisma.aiReport.create({
            data: {
                internId: internId,
                // Ortak
                overallScore: analysis.overallScore,
                strengths: analysis.strengths || [],
                suggestions: analysis.suggestions || [],
                // Admin özel
                weaknesses: analysis.weaknesses || [],
                adminSummary: analysis.adminSummary || '',
                // 🆕 Mentörlük alanları
                internSummary: analysis.internSummary || '',
                internFeedback: analysis.internFeedback || '',
                learningResources: analysis.learningResources || [],
                nextSteps: analysis.nextSteps || [],
                encouragementQuote: analysis.encouragementQuote || null,
                // Audit
                rawJson: analysis
            }
        });

        res.status(201).json({ 
            message: "AI Raporu başarıyla oluşturuldu!", 
            report: newReport 
        });

    } catch (error) {
        console.error("🚨 AI RAPOR HATASI:", error.response?.data || error.message);
        res.status(500).json({ error: "Yapay zeka analizi sırasında hata oluştu." });
    }
});

/**
 * 🎓 STAJYER: Kendi Mentörlük Raporunu Görüntüle
 * Stajyer SADECE kendi gelişim bilgilerini görür (admin özeti ve weaknesses gizli!)
 */
app.get('/api/ai/my-mentorship', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ error: "Bu rota sadece stajyerler içindir." });
        }

        const latestReport = await prisma.aiReport.findFirst({
            where: { internId: req.user.userId },
            orderBy: { reportDate: 'desc' }
        });

        if (!latestReport) {
            return res.status(404).json({ 
                message: "Henüz mentörlük raporunuz oluşturulmamış. Yöneticinizden ilk raporunuzu talep edin.",
                report: null
            });
        }

        // 🎯 STAJYERE ÖZEL FİLTRELENMİŞ YANIT (Güvenlik: Admin verileri gizli)
        const mentorshipData = {
            id: latestReport.id,
            reportDate: latestReport.reportDate,
            overallScore: latestReport.overallScore,
            strengths: latestReport.strengths,
            suggestions: latestReport.suggestions,
            
            // 🆕 MENTÖRLÜK ALANLARI
            internSummary: latestReport.internSummary,
            internFeedback: latestReport.internFeedback,
            learningResources: latestReport.learningResources,
            nextSteps: latestReport.nextSteps,
            encouragementQuote: latestReport.encouragementQuote,
            
            // 🚫 GİZLİ ALANLAR (stajyere gönderilmiyor):
            // - weaknesses
            // - adminSummary
        };

        res.status(200).json(mentorshipData);

    } catch (error) {
        console.error("🚨 MENTÖRLÜK RAPORU HATASI:", error);
        res.status(500).json({ error: "Mentörlük raporu alınamadı." });
    }
});

/**
 * 🎓 STAJYER: Mentörlük Geçmişi (Tüm Raporları)
 */
app.get('/api/ai/my-mentorship/history', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ error: "Yetkiniz yok." });
        }

        const reports = await prisma.aiReport.findMany({
            where: { internId: req.user.userId },
            orderBy: { reportDate: 'desc' },
            take: 10, // Son 10 rapor
            select: {
                id: true,
                reportDate: true,
                overallScore: true,
                strengths: true,
                internSummary: true,
                encouragementQuote: true
            }
        });

        res.status(200).json(reports);

    } catch (error) {
        console.error("🚨 MENTÖRLÜK GEÇMİŞİ HATASI:", error);
        res.status(500).json({ error: "Geçmiş raporlar alınamadı." });
    }
});

/**
 * 💡 GÜNLÜK İPUCU (Proaktif Mentörlük)
 * Stajyer login olduğunda hızlıca bir ipucu/öneri alır
 */
app.get('/api/ai/daily-tip', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ error: "Sadece stajyerler için." });
        }

        // Son rapordan bir ipucu çek
        const latestReport = await prisma.aiReport.findFirst({
            where: { internId: req.user.userId },
            orderBy: { reportDate: 'desc' }
        });

        if (!latestReport) {
            return res.status(200).json({
                tip: "Henüz kişiselleştirilmiş öneriniz yok. İlk görevlerinizi tamamlayın!",
                source: "system"
            });
        }

        // Bugünün gün numarasına göre farklı bir öneri seç (çeşitlilik için)
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
        
        const allTips = [
            ...(latestReport.nextSteps || []),
            ...(latestReport.learningResources || [])
        ];
        
        const tip = allTips.length > 0 
            ? allTips[dayOfYear % allTips.length] 
            : latestReport.encouragementQuote || "Bugün harika bir gün, öğrenmeye devam!";

        res.status(200).json({
            tip: tip,
            quote: latestReport.encouragementQuote,
            source: "ai-mentor",
            reportDate: latestReport.reportDate
        });

    } catch (error) {
        console.error("🚨 GÜNLÜK İPUCU HATASI:", error);
        res.status(500).json({ error: "Günlük ipucu alınamadı." });
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

// ==========================================
// 🚨 ACİL GÖREV ROTALARI (Backend Enrichment)
// ==========================================

/**
 * ACİL GÖREV HESAPLAMA FONKSİYONU
 * Görev objesini alıp 'isUrgent' ve 'hoursLeft' bilgisi ekler
 */
function enrichTaskWithUrgency(task) {
    // Deadline yoksa acil olamaz
    if (!task.deadline) {
        return {
            ...task,
            isUrgent: false,
            hoursLeft: null,
            urgencyLevel: 'none' // none | low | medium | critical
        };
    }

    const now = new Date();
    const deadline = new Date(task.deadline);
    const hoursLeft = Math.round((deadline - now) / (1000 * 60 * 60));
    const daysLeft = Math.ceil(hoursLeft / 24);

    // Tamamlanmış görevler acil sayılmaz
    const isCompleted = task.status === 'COMPLETED';

    // Aciliyet seviyesi belirleme
    let urgencyLevel = 'none';
    let isUrgent = false;

    if (!isCompleted) {
        if (hoursLeft < 0) {
            urgencyLevel = 'overdue'; // Süresi geçmiş
            isUrgent = true;
        } else if (hoursLeft <= 24) {
            urgencyLevel = 'critical'; // 24 saatten az
            isUrgent = true;
        } else if (hoursLeft <= 48) {
            urgencyLevel = 'high'; // 2 gün = 48 saat
            isUrgent = true;
        } else if (hoursLeft <= 72) {
            urgencyLevel = 'medium';
            isUrgent = false;
        } else {
            urgencyLevel = 'low';
            isUrgent = false;
        }
    }

    return {
        ...task,
        isUrgent,
        hoursLeft,
        daysLeft,
        urgencyLevel,
        isOverdue: hoursLeft < 0 && !isCompleted
    };
}

// 1. ACİL GÖREVLERİ LİSTELE (Özel Rota)
app.get('/api/tasks/urgent', authenticateToken, async (req, res) => {
    try {
        // Kullanıcı rolüne göre filtre
        const whereClause = req.user.role === 'ADMIN'
            ? {}
            : { internId: req.user.userId };

        // Sadece tamamlanmamış görevleri çek (performans için)
        const tasks = await prisma.task.findMany({
            where: {
                ...whereClause,
                status: { not: 'COMPLETED' },
                deadline: { not: null } // Deadline'ı olan görevler
            },
            include: {
                intern: { select: { id: true, name: true, surname: true } },
                admin: { select: { id: true, name: true } }
            },
            orderBy: { deadline: 'asc' } // En yakın deadline en üstte
        });

        // JavaScript'te aciliyet hesapla ve filtrele
        const urgentTasks = tasks
            .map(enrichTaskWithUrgency)
            .filter(task => task.isUrgent)
            .sort((a, b) => a.hoursLeft - b.hoursLeft); // En acil en üstte

        // İstatistikler (dashboard için harika)
        const stats = {
            total: urgentTasks.length,
            overdue: urgentTasks.filter(t => t.urgencyLevel === 'overdue').length,
            critical: urgentTasks.filter(t => t.urgencyLevel === 'critical').length,
            high: urgentTasks.filter(t => t.urgencyLevel === 'high').length
        };

        res.status(200).json({
            stats,
            tasks: urgentTasks
        });

    } catch (error) {
        console.error("🚨 ACİL GÖREV LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Acil görevler listelenirken hata oluştu." });
    }
});

// 2. TÜM GÖREVLERİ ACİLİYET BİLGİSİYLE LİSTELE (Mevcut rotanın geliştirilmiş hali)
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

        // 🎯 HER GÖREVE ACİLİYET BİLGİSİ EKLE
        const enrichedTasks = tasks.map(enrichTaskWithUrgency);

        // Query parametresiyle filtreleme: ?urgent=true
        if (req.query.urgent === 'true') {
            const filtered = enrichedTasks.filter(t => t.isUrgent);
            return res.status(200).json(filtered);
        }

        res.status(200).json(enrichedTasks);

    } catch (error) {
        console.error("🚨 GÖREV LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Görevler listelenirken bir hata oluştu." });
    }
});


// ==========================================
// 👤 STAJYER PROFİLİ GÖRÜNTÜLEME SİSTEMİ
// ==========================================

/**
 * 🧮 YARDIMCI: Prisma'dan gelen stajyer objesini istatistiklere dönüştürür
 */
function buildInternStats(intern) {
    const now = new Date();
    const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 saat = acil penceresi

    const tasks = intern.tasksReceived || [];
    const logs = intern.logs || [];
    const archives = intern.archives || [];

    // --- GÖREV İSTATİSTİKLERİ ---
    const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
    const pending = tasks.filter((t) => t.status === 'PENDING').length;
    const overdue = tasks.filter((t) =>
        t.status !== 'COMPLETED' && t.deadline && new Date(t.deadline) < now
    ).length;
    const urgent = tasks.filter((t) => {
        if (t.status === 'COMPLETED' || !t.deadline) return false;
        const diff = new Date(t.deadline) - now;
        return diff > 0 && diff <= URGENT_WINDOW_MS;
    }).length;

    // --- MESAİ İSTATİSTİKLERİ ---
    let totalWorkedMinutes = 0;
    let isActiveNow = false;
    let lastLogin = null;

    logs.forEach((log) => {
        if (log.logoutTime) {
            totalWorkedMinutes += Math.round(
                (new Date(log.logoutTime) - new Date(log.loginTime)) / 60000
            );
        } else {
            isActiveNow = true; // Açık oturum var = şu an sistemde
        }
        if (!lastLogin || log.loginTime > lastLogin) lastLogin = log.loginTime;
    });

    // --- ARŞİV İSTATİSTİKLERİ ---
    let lastArchiveDate = null;
    archives.forEach((a) => {
        if (!lastArchiveDate || a.date > lastArchiveDate) lastArchiveDate = a.date;
    });

    // --- SON AI RAPORU ---
    const latestReport = intern.aiReports && intern.aiReports[0] ? intern.aiReports[0] : null;

    return {
        id: intern.id,
        name: intern.name,
        surname: intern.surname,
        email: intern.email,
        registeredAt: intern.createdAt,

        department: intern.department ? {
            id: intern.department.id,
            name: intern.department.name,
            color: intern.department.color
        } : null,

        // 🆕 SOFT DELETE bilgisi
        isArchived: intern.isArchived || false,
        archivedAt: intern.archivedAt ? formatToTurkeyTime(intern.archivedAt) : null,
        profile: intern.internProfile || null,

        isActiveNow: isActiveNow,
        lastLogin: lastLogin ? formatToTurkeyTime(lastLogin) : null,
        tasks: {
            total: tasks.length,
            completed: completed,
            inProgress: inProgress,
            pending: pending,
            overdue: overdue,
            urgent: urgent,
            completionRate: tasks.length
                ? Math.round((completed / tasks.length) * 100)
                : 0,
        },
        work: {
            totalWorkedMinutes: totalWorkedMinutes,
            totalWorked: formatWorkDuration(totalWorkedMinutes),
            sessionCount: logs.length,
        },
        archives: {
            total: archives.length,
            lastArchiveDate: lastArchiveDate ? formatToTurkeyTime(lastArchiveDate) : null,
        },
        ai: latestReport
            ? {
                  overallScore: latestReport.overallScore,
                  reportDate: latestReport.reportDate,
                  adminSummary: latestReport.adminSummary,
              }
            : null,
    };
}

/**
 * 📦 Her iki rotada da kullanılacak ortak Prisma include yapısı
 */
const INTERN_INCLUDE = {
    internProfile: true,
    department: true,
    tasksReceived: { select: { id: true, status: true, deadline: true } },
    logs: { select: { loginTime: true, logoutTime: true } },
    archives: { select: { id: true, date: true } },
    aiReports: {
        select: { overallScore: true, reportDate: true, adminSummary: true },
        orderBy: { reportDate: 'desc' },
        take: 1, // Sadece en son rapor
    },
};

// 1️⃣ TÜM STAJYERLERİ İSTATİSTİKLERLE LİSTELE (SADECE ADMIN)
app.get('/api/interns', authenticateToken, requireAdmin, async (req, res) => {
    
    try {
        const showArchived = req.query.archived === 'true';
        const departmentId = req.query.departmentId ? parseInt(req.query.departmentId) : null;

        // 🆕 Filtre objesini dinamik oluştur
        const whereClause = {
            role: 'INTERN',
            isArchived: showArchived
        };
        
        if (departmentId) {
            whereClause.departmentId = departmentId;  // 🆕 Departmana göre filtre
        }

        const interns = await prisma.user.findMany({
            where: whereClause,
            include: INTERN_INCLUDE,
            orderBy: { createdAt: 'asc' },
        });

        const enrichedInterns = interns.map(buildInternStats);

        // 🎯 Opsiyonel sıralama: ?sort=score → AI puanına göre (liderlik tablosu)
        if (req.query.sort === 'score') {
            enrichedInterns.sort(
                (a, b) => (b.ai?.overallScore ?? -1) - (a.ai?.overallScore ?? -1)
            );
        }

        res.status(200).json({
            totalInterns: enrichedInterns.length,
            activeNow: enrichedInterns.filter((i) => i.isActiveNow).length,
            interns: enrichedInterns,
        });
    } catch (error) {
        console.error("🚨 STAJYER LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Stajyerler listelenirken hata oluştu." });
    }
});

// 2️⃣ TEK STAJYER DETAYI (Admin veya stajyerin kendisi)
app.get('/api/interns/:id', authenticateToken, async (req, res) => {
        
    try {
        const internId = parseInt(req.params.id);

        // Güvenlik: Admin değilse sadece kendi profilini görebilir
        if (req.user.role !== 'ADMIN' && req.user.userId !== internId) {
            return res.status(403).json({ error: "Bu profili görüntüleme yetkiniz yok." });
        }

        const intern = await prisma.user.findUnique({
            where: { id: internId },
            include: INTERN_INCLUDE,
        });

        if (!intern || intern.role !== 'INTERN') {
            return res.status(404).json({ error: "Stajyer bulunamadı." });
        }

        res.status(200).json(buildInternStats(intern));
    } catch (error) {
        console.error("🚨 STAJYER DETAY HATASI:", error);
        res.status(500).json({ error: "Stajyer detayı alınamadı." });
    }
});


// 🗄️ STAJYERİ ARŞİVLE (SADECE ADMIN) — Soft Delete
app.patch('/api/interns/:id/archive', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const internId = parseInt(req.params.id);

        const intern = await prisma.user.findUnique({ where: { id: internId } });

        if (!intern || intern.role !== 'INTERN') {
            return res.status(404).json({ error: "Stajyer bulunamadı." });
        }

        if (intern.isArchived) {
            return res.status(400).json({ error: "Bu stajyer zaten arşivlenmiş." });
        }

        const archived = await prisma.user.update({
            where: { id: internId },
            data: { isArchived: true, archivedAt: new Date() },
        });

        res.status(200).json({
            message: `${archived.name} ${archived.surname} başarıyla arşivlendi. Tüm verileri korunuyor.`,
            intern: {
                id: archived.id,
                isArchived: archived.isArchived,
                archivedAt: formatToTurkeyTime(archived.archivedAt),
            },
        });
    } catch (error) {
        console.error("🚨 STAJYER ARŞİVLEME HATASI:", error);
        res.status(500).json({ error: "Arşivleme sırasında hata oluştu." });
    }
});

// ♻️ ARŞİVDEN GERİ YÜKLE (SADECE ADMIN) — Restore
app.patch('/api/interns/:id/restore', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const internId = parseInt(req.params.id);

        const intern = await prisma.user.findUnique({ where: { id: internId } });

        if (!intern || intern.role !== 'INTERN') {
            return res.status(404).json({ error: "Stajyer bulunamadı." });
        }

        if (!intern.isArchived) {
            return res.status(400).json({ error: "Bu stajyer arşivde değil." });
        }

        const restored = await prisma.user.update({
            where: { id: internId },
            data: { isArchived: false, archivedAt: null },
        });

        res.status(200).json({
            message: `${restored.name} ${restored.surname} aktif listeye geri alındı.`,
            intern: {
                id: restored.id,
                isArchived: restored.isArchived,
            },
        });
    } catch (error) {
        console.error("🚨 STAJYER GERİ YÜKLEME HATASI:", error);
        res.status(500).json({ error: "Geri yükleme sırasında hata oluştu." });
    }
});


// ✅ YENİ - Socket.io ile birlikte çalışan HTTP sunucusu
server.listen(PORT, () => {
    console.log(`🚀 HTTP + WebSocket sunucusu http://localhost:${PORT} adresinde ayağa kalktı.`);
    console.log(`⚡ Socket.io ready - ws://localhost:${PORT}`);
});

// ==========================================
// 🤖 AI SOHBET MENTORU (ZENGİN CONTEXT)
// ==========================================

app.post('/api/ai/chat', authenticateToken, async (req, res) => {
    try {
        const { message, messages } = req.body;

        if (!req.body || !message || message.trim() === '') {
            return res.status(400).json({ error: "Mesaj boş olamaz." });
        }

        let context = {};
        if (req.user.role === 'INTERN') {
            // 🎯 ZENGİN CONTEXT: Tüm verileri topla
            const internData = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: {
                    name: true,
                    surname: true,
                    // 📋 Görevler (deadline + durum + aciliyet)
                    tasksReceived: {
                        where: { status: { not: 'COMPLETED' } },
                        select: { 
                            title: true, 
                            status: true,
                            deadline: true,
                            repoLink: true
                        },
                        orderBy: { deadline: 'asc' }
                    },
                    // 📝 Son 5 günlük arşiv (tam içerik)
                    archives: {
                        select: { content: true, date: true },
                        orderBy: { date: 'desc' },
                        take: 5
                    },
                    // ⏱️ Mesai logları (son 7 gün)
                    logs: {
                        select: { loginTime: true, logoutTime: true },
                        where: {
                            loginTime: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                        },
                        orderBy: { loginTime: 'desc' }
                    },
                    // 🎯 SON AI RAPORU (en önemli!)
                    aiReports: {
                        select: {
                            overallScore: true,
                            strengths: true,
                            internSummary: true,
                            internFeedback: true,
                            nextSteps: true,
                            encouragementQuote: true,
                            reportDate: true
                        },
                        orderBy: { reportDate: 'desc' },
                        take: 1
                    }
                }
            });

            // 🧮 Hesaplamalar
            const now = new Date();
            const tasksWithUrgency = (internData?.tasksReceived || []).map(task => {
                let daysLeft = null;
                let isOverdue = false;
                if (task.deadline) {
                    const diff = new Date(task.deadline) - now;
                    daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
                    isOverdue = daysLeft < 0;
                }
                return {
                    title: task.title,
                    status: task.status,
                    daysLeft,
                    isOverdue,
                    hasRepo: !!task.repoLink
                };
            });

            // Bu hafta çalışılan toplam saat
            const weeklyMinutes = (internData?.logs || []).reduce((acc, log) => {
                if (log.logoutTime) {
                    return acc + Math.round((new Date(log.logoutTime) - new Date(log.loginTime)) / 60000);
                }
                return acc;
            }, 0);

            const latestReport = internData?.aiReports?.[0] || null;

            context = {
                name: `${internData?.name || ''} ${internData?.surname || ''}`.trim(),
                currentTasks: tasksWithUrgency,
                recentArchives: (internData?.archives || []).map(a => ({
                    date: a.date,
                    summary: a.content.substring(0, 200)
                })),
                weeklyWorkedHours: Math.round(weeklyMinutes / 60),
                weeklyWorkedMinutes: weeklyMinutes,
                // 🎯 AI RAPOR VERİLERİ
                aiScore: latestReport?.overallScore || null,
                aiStrengths: latestReport?.strengths || [],
                aiSummary: latestReport?.internSummary || null,
                aiFeedback: latestReport?.internFeedback || null,
                aiNextSteps: latestReport?.nextSteps || [],
                aiQuote: latestReport?.encouragementQuote || null,
                aiReportDate: latestReport?.reportDate || null
            };
        }

        console.log('🤖 AI Chat:', message.substring(0, 50));
        console.log('📊 Context:', {
            name: context.name,
            tasks: context.currentTasks?.length,
            aiScore: context.aiScore
        });

        // Python'a streaming istek at
        const PYTHON_CHAT_URL = (process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000').replace('/analyze', '') + '/chat';
        
        const aiResponse = await axios.post(PYTHON_CHAT_URL, {
            message,
            messages: messages || [],
            context
        }, {
            responseType: 'stream',
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        aiResponse.data.pipe(res);

    } catch (error) {
        console.error("🚨 AI CHAT HATASI:", error.response?.data || error.message);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: "AI ile iletişim kurulamadı.",
                detail: error.response?.data?.detail || error.message
            });
        }
    }
});
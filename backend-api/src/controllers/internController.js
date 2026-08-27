const internService = require('../services/internService');
const prisma = require('../config/database');


exports.getUsers = async (req, res) => {
    try {
        const { role } = req.query;
        // 1. Siparişi al ve mutfağa (Service) gönder
        const users = await internService.getUsers(role, req.user.role);
        
        // 2. Mutfaktan gelen yemeği müşteriye sun
        res.status(200).json(users);
    } catch (error) {
        console.error('🚨 KULLANICI LİSTELEME HATASI:', error);
        res.status(500).json({ error: 'Kullanıcılar listelenemedi.' });
    }
};

exports.getAllInterns = async (req, res) => {
    try {
        const showArchived = req.query.archived === 'true';
        const departmentId = req.query.departmentId ? parseInt(req.query.departmentId) : null;
        const sortBy = req.query.sort;

        // Bütün o hesaplama ve veritabanı mantığı servisin içine gizlendi!
        const result = await internService.getAllInterns(showArchived, departmentId, sortBy);
        
        res.status(200).json(result);
    } catch (error) {
        console.error("🚨 STAJYER LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Stajyerler listelenirken hata oluştu." });
    }
};

exports.getInternById = async (req, res) => {
    try {
        const internId = parseInt(req.params.id);

        // 🚨 DÜZELTME: internService.getInternById zaten istatistikleri hesaplayıp gönderiyor!
        // Bu yüzden ekstra bir işleme (buildInternStats çağırmaya) gerek yok, doğrudan alıyoruz.
        const internData = await internService.getInternById(internId);

        res.status(200).json({ intern: internData });
    } catch (error) {
        console.error("🚨 STAJYER DETAY HATASI:", error);
        res.status(500).json({ error: error.message || "Stajyer detayı alınamadı" });
    }
};

exports.archiveIntern = async (req, res) => {
    try {
        const internId = parseInt(req.params.id);
        const archived = await internService.archiveIntern(internId);
        
        res.status(200).json({
            message: "Stajyer arşivlendi.",
            intern: { id: archived.id, isArchived: true }
        });
    } catch (error) {
        console.error("🚨 STAJYER ARŞİVLEME HATASI:", error);
        const statusCode = error.message.includes("bulunamadı") ? 404 : 400;
        res.status(statusCode).json({ error: error.message || "Arşivleme hatası." });
    }
};

exports.restoreIntern = async (req, res) => {
    try {
        const internId = parseInt(req.params.id);
        const restored = await internService.restoreIntern(internId);
        
        res.status(200).json({
            message: "Stajyer geri yüklendi.",
            intern: { id: restored.id, isArchived: false }
        });
    } catch (error) {
        console.error("🚨 STAJYER GERİ YÜKLEME HATASI:", error);
        const statusCode = error.message.includes("bulunamadı") ? 404 : 400;
        res.status(statusCode).json({ error: error.message || "Geri yükleme hatası." });
    }
};

exports.deleteIntern = async (req, res) => {
    try {
        const internId = parseInt(req.params.id);
        await internService.deleteIntern(internId);

        res.status(200).json({ message: "Stajyer kalıcı olarak silindi." });
    } catch (error) {
        console.error("🚨 STAJYER SİLME HATASI:", error);
        res.status(500).json({ error: error.message || "Silme işlemi başarısız oldu." });
    }
};

exports.updateNotificationEmail = async (req, res) => {
    try {
        const { notificationEmail } = req.body;
        const internId = req.user.userId;

        // Profil yoksa oluştur (upsert), varsa güncelle
        const updatedProfile = await prisma.internProfile.upsert({
            where: { userId: internId },
            update: { notificationEmail: notificationEmail },
            create: { userId: internId, notificationEmail: notificationEmail }
        });

        res.status(200).json({ message: "Bildirim e-postası başarıyla güncellendi!", profile: updatedProfile });
    } catch (error) {
        console.error("🚨 MAİL GÜNCELLEME HATASI:", error);
        res.status(500).json({ error: "Bildirim e-postası kaydedilemedi." });
    }
};
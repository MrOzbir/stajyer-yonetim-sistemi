const internService = require('../services/internService');

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
        const intern = await internService.getInternById(internId);
        
        res.status(200).json(intern);
    } catch (error) {
        console.error("🚨 STAJYER DETAY HATASI:", error.message);
        // Servisten gelen hata mesajına göre dinamik status code gönderiyoruz
        const statusCode = error.message.includes("bulunamadı") ? 404 : 500;
        res.status(statusCode).json({ error: error.message || "Stajyer bilgileri alınamadı." });
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
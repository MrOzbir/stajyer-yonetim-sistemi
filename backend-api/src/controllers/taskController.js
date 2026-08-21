const taskService = require('../services/taskService');

exports.createTask = async (req, res) => {
    try {
        const newTask = await taskService.createTask(req.body, req.user.userId);
        res.status(201).json({ message: "Görev başarıyla atandı!", task: newTask });
    } catch (error) {
        console.error("🚨 GÖREV ATAMA HATASI:", error.message);
        const statusCode = error.message.includes("tarih") ? 400 : 500;
        res.status(statusCode).json({ error: error.message || "Sunucu tarafında bir hata oluştu." });
    }
};

exports.getTasks = async (req, res) => {
    try {
        const isUrgentOnly = req.query.urgent === 'true';
        const tasks = await taskService.getTasks(req.user.role, req.user.userId, isUrgentOnly);
        
        res.status(200).json(tasks);
    } catch (error) {
        console.error("🚨 GÖREV LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Görevler listelenirken bir hata oluştu." });
    }
};

exports.getUrgentTasks = async (req, res) => {
    try {
        const result = await taskService.getUrgentTasks(req.user.role, req.user.userId);
        res.status(200).json(result);
    } catch (error) {
        console.error("🚨 ACİL GÖREV LİSTELEME HATASI:", error);
        res.status(500).json({ error: "Acil görevler listelenirken hata oluştu." });
    }
};

exports.updateTaskStatus = async (req, res) => {
    try {
        if (req.user.role !== 'INTERN') {
            return res.status(403).json({ error: "Sadece stajyerler görev güncelleyebilir." });
        }
        
        const taskId = parseInt(req.params.id);
        const updatedTask = await taskService.updateTaskStatus(taskId, req.user.userId, req.body);
        
        res.status(200).json({ message: "Görev başarıyla güncellendi!", task: updatedTask });
    } catch (error) {
        console.error("🚨 GÖREV GÜNCELLEME HATASI:", error.message);
        let statusCode = 500;
        if (error.message.includes("bulunamadı")) statusCode = 404;
        if (error.message.includes("Sadece size atanan")) statusCode = 403;
        
        res.status(statusCode).json({ error: error.message || "Görev güncellenirken bir hata oluştu." });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const deletedTask = await taskService.deleteTask(taskId);
        res.status(200).json({ message: "Görev başarıyla silindi!", deletedTaskId: deletedTask.id });
    } catch (error) {
        console.error("🚨 GÖREV SİLME HATASI:", error);
        res.status(500).json({ error: "Görev silinirken hata oluştu." });
    }
};

exports.getTaskById = async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const task = await taskService.getTaskById(taskId); // veya doğrudan prisma sorgusu
        
        if (!task) {
            return res.status(404).json({ error: "Görev bulunamadı." });
        }
        
        res.status(200).json(task);
    } catch (error) {
        console.error("🚨 GÖREV DETAY HATASI:", error);
        res.status(500).json({ error: "Görev getirilirken bir hata oluştu." });
    }
};

exports.updateAdminTask = async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);
        const updatedTask = await taskService.updateAdminTask(taskId, req.body);
        res.status(200).json({ message: "Görev başarıyla güncellendi!", task: updatedTask });
    } catch (error) {
        console.error("🚨 GÖREV DÜZENLEME HATASI:", error);
        res.status(500).json({ error: "Görev güncellenirken hata oluştu." });
    }
};
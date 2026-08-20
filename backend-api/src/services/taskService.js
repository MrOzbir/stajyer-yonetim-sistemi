const prisma = require('../config/database');
const { enrichTaskWithUrgency } = require('../utils/formatters');

exports.createTask = async (taskData, adminId) => {
    const { title, description, internId, deadline } = taskData;
    
    // Deadline format kontrolü
    let parsedDeadline = null;
    if (deadline) {
        parsedDeadline = new Date(deadline);
        if (isNaN(parsedDeadline.getTime())) {
            throw new Error("Geçersiz tarih formatı.");
        }
    }

    return await prisma.task.create({
        data: {
            title, description, deadline: parsedDeadline,
            adminId: adminId, internId
        }
    });
};

exports.getTasks = async (userRole, userId, isUrgentOnly) => {
    const whereClause = userRole === 'ADMIN' ? {} : { internId: userId };
    
    const tasks = await prisma.task.findMany({
        where: whereClause,
        include: {
            intern: { select: { id: true, name: true, surname: true } },
            admin: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Görevleri aciliyet durumuna göre zenginleştir
    const enrichedTasks = tasks.map(enrichTaskWithUrgency);

    if (isUrgentOnly) {
        return enrichedTasks.filter(t => t.isUrgent);
    }

    return enrichedTasks;
};

exports.getUrgentTasks = async (userRole, userId) => {
    const whereClause = userRole === 'ADMIN' ? {} : { internId: userId };

    const tasks = await prisma.task.findMany({
        where: { ...whereClause, status: { not: 'COMPLETED' }, deadline: { not: null } },
        include: {
            intern: { select: { id: true, name: true, surname: true } },
            admin: { select: { id: true, name: true } }
        },
        orderBy: { deadline: 'asc' }
    });

    const urgentTasks = tasks.map(enrichTaskWithUrgency)
        .filter(task => task.isUrgent)
        .sort((a, b) => a.hoursLeft - b.hoursLeft);

    const stats = {
        total: urgentTasks.length,
        overdue: urgentTasks.filter(t => t.urgencyLevel === 'overdue').length,
        critical: urgentTasks.filter(t => t.urgencyLevel === 'critical').length,
        high: urgentTasks.filter(t => t.urgencyLevel === 'high').length
    };

    return { stats, tasks: urgentTasks };
};

exports.updateTaskStatus = async (taskId, internId, updateData) => {
    const { status, repoLink } = updateData;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Görev bulunamadı.");
    
    // Yetki kontrolü (IDOR)
    if (task.internId !== internId) {
        throw new Error("Sadece size atanan görevleri güncelleyebilirsiniz.");
    }

    return await prisma.task.update({
        where: { id: taskId }, data: { status, repoLink }
    });
};

exports.deleteTask = async (taskId) => {
    return await prisma.task.delete({ where: { id: taskId } });
};

exports.getTaskById = async (taskId) => {
    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                intern: { select: { id: true, name: true, surname: true } }
            }
        });
        return task;
    } catch (error) {
        console.error("🚨 SERVİS GÖREV GETİRME HATASI:", error);
        throw new Error("Görev veritabanından çekilemedi.");
    }
};
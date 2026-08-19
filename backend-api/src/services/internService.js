const prisma = require('../config/database');
const { formatToTurkeyTime, formatWorkDuration } = require('../utils/formatters');

// --- YARDIMCI FONKSİYONLAR ---
// --- YARDIMCI FONKSİYONLAR ---
const INTERN_INCLUDE = {
    internProfile: true, 
    department: true,
    tasksReceived: { orderBy: [{ status: 'asc' }, { deadline: 'asc' }] },
    logs: { orderBy: { loginTime: 'desc' } },
    archives: { orderBy: { date: 'desc' } },
    aiReports: { orderBy: { reportDate: 'desc' }}
};

function buildInternStats(intern) {
    const now = new Date();
    const URGENT_WINDOW_MS = 48 * 60 * 60 * 1000;
    const tasks = intern.tasksReceived || [];
    const logs = intern.logs || [];
    const archives = intern.archives || [];

    const completed = tasks.filter(t => t.status === 'COMPLETED').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const pending = tasks.filter(t => t.status === 'PENDING').length;
    const overdue = tasks.filter(t => t.status !== 'COMPLETED' && t.deadline && new Date(t.deadline) < now).length;
    const urgent = tasks.filter(t => {
        if (t.status === 'COMPLETED' || !t.deadline) return false;
        const diff = new Date(t.deadline) - now;
        return diff > 0 && diff <= URGENT_WINDOW_MS;
    }).length;

    let totalWorkedMinutes = 0; let isActiveNow = false; let lastLogin = null;
    logs.forEach(log => {
        if (log.logoutTime) { totalWorkedMinutes += Math.round((new Date(log.logoutTime) - new Date(log.loginTime)) / 60000); } 
        else { isActiveNow = true; }
        if (!lastLogin || log.loginTime > lastLogin) lastLogin = log.loginTime;
    });

    let lastArchiveDate = null;
    archives.forEach(a => { if (!lastArchiveDate || a.date > lastArchiveDate) lastArchiveDate = a.date; });

    const latestReport = intern.aiReports && intern.aiReports[0] ? intern.aiReports[0] : null;

    return {
        id: intern.id, name: intern.name, surname: intern.surname, email: intern.email, registeredAt: intern.createdAt,
        department: intern.department ? { id: intern.department.id, name: intern.department.name, color: intern.department.color } : null,
        isArchived: intern.isArchived || false,
        archivedAt: intern.archivedAt ? formatToTurkeyTime(intern.archivedAt) : null,
        profile: intern.internProfile || null, isActiveNow, lastLogin: lastLogin ? formatToTurkeyTime(lastLogin) : null,
        tasks: { total: tasks.length, completed, inProgress, pending, overdue, urgent, completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0 },
        work: { totalWorkedMinutes, totalWorked: formatWorkDuration(totalWorkedMinutes), sessionCount: logs.length },
        archives: { total: archives.length, lastArchiveDate: lastArchiveDate ? formatToTurkeyTime(lastArchiveDate) : null },
        ai: latestReport ? { overallScore: latestReport.overallScore, reportDate: latestReport.reportDate, adminSummary: latestReport.adminSummary } : null,
    };
}

// --- SERVİS METOTLARI ---

exports.getUsers = async (queryRole, userRole) => {
    const where = {};
    if (queryRole) where.role = queryRole;
    if (userRole === 'INTERN') where.role = 'ADMIN';

    return await prisma.user.findMany({
        where, select: { id: true, name: true, surname: true, email: true, role: true }, orderBy: { name: 'asc' }
    });
};

exports.getAllInterns = async (showArchived, departmentId, sortBy) => {
    const whereClause = { role: 'INTERN', isArchived: showArchived };
    if (departmentId) whereClause.departmentId = departmentId;

    const interns = await prisma.user.findMany({ 
        where: whereClause, include: INTERN_INCLUDE, orderBy: { createdAt: 'asc' } 
    });
    
    const enrichedInterns = interns.map(buildInternStats);

    if (sortBy === 'score') {
        enrichedInterns.sort((a, b) => (b.ai?.overallScore ?? -1) - (a.ai?.overallScore ?? -1));
    }
    
    return { 
        totalInterns: enrichedInterns.length, 
        activeNow: enrichedInterns.filter(i => i.isActiveNow).length, 
        interns: enrichedInterns 
    };
};

exports.getInternById = async (internId) => {
    const intern = await prisma.user.findUnique({
        where: { id: internId, role: 'INTERN' },
        include: {
            department: true,
            tasksReceived: { orderBy: [{ status: 'asc' }, { deadline: 'asc' }] },
            archives: { orderBy: { date: 'desc' }, take: 30 },
            logs: { orderBy: { loginTime: 'desc' }, take: 15 },
            aiReports: { orderBy: { reportDate: 'desc' }, take: 1 }
        }
    });

    if (!intern) throw new Error("Stajyer bulunamadı.");

    const { password_hash, ...safeIntern } = intern; 

    // ✅ DÜZELTME BURADA: Ham veriyi buildInternStats süzgecinden geçirip biçimlendirilmiş halini döndürüyoruz
    return buildInternStats(safeIntern);
};

exports.archiveIntern = async (internId) => {
    const intern = await prisma.user.findUnique({ where: { id: internId } });
    if (!intern || intern.role !== 'INTERN') throw new Error("Stajyer bulunamadı.");
    if (intern.isArchived) throw new Error("Bu stajyer zaten arşivlenmiş.");

    return await prisma.user.update({ 
        where: { id: internId }, data: { isArchived: true, archivedAt: new Date() } 
    });
};

exports.restoreIntern = async (internId) => {
    const intern = await prisma.user.findUnique({ where: { id: internId } });
    if (!intern || intern.role !== 'INTERN') throw new Error("Stajyer bulunamadı.");
    if (!intern.isArchived) throw new Error("Stajyer arşivde değil.");

    return await prisma.user.update({ 
        where: { id: internId }, data: { isArchived: false, archivedAt: null } 
    });
};

exports.deleteIntern = async (internId) => {
    const intern = await prisma.user.findUnique({ where: { id: internId } });
    if (!intern || intern.role !== 'INTERN') throw new Error("Silinecek stajyer bulunamadı.");

    // Prisma şemanızda "onDelete: Cascade" ayarlıysa bu tek satır,
    // stajyere ait tüm görevleri ve raporları da otomatik temizler!
    return await prisma.user.delete({
        where: { id: internId }
    });
};
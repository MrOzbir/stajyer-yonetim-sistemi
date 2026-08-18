const prisma = require('../config/database');
const { formatToTurkeyTime, formatWorkDuration } = require('../utils/formatters');

exports.getLogs = async (req, res) => {
    try {
        let whereClause = req.user.role === 'ADMIN' && req.query.internId ? { internId: parseInt(req.query.internId) } : { internId: req.user.userId };
        if (req.user.role === 'ADMIN' && !req.query.internId) whereClause = {}; // Admin tüm logları görür

        const logs = await prisma.dailyLog.findMany({
            where: whereClause, orderBy: { loginTime: 'desc' }, take: 50,
            include: { intern: { select: { id: true, name: true, surname: true } } }
        });

        const enrichedLogs = logs.map(log => {
            const workedMinutes = log.logoutTime ? Math.round((new Date(log.logoutTime) - new Date(log.loginTime)) / 60000) : null;
            return {
                id: log.id, intern: log.intern,
                loginTime: formatToTurkeyTime(log.loginTime), logoutTime: formatToTurkeyTime(log.logoutTime),
                loginTimeUTC: log.loginTime, logoutTimeUTC: log.logoutTime,
                workedMinutes, workedDuration: workedMinutes ? formatWorkDuration(workedMinutes) : 'Devam ediyor',
                isActive: log.logoutTime === null
            };
        });
        res.status(200).json(enrichedLogs);
    } catch (error) { res.status(500).json({ error: "Loglar listelenirken hata oluştu." }); }
};
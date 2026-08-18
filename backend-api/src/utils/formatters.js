/**
 * UTC tarihini Türkiye saatine (Europe/Istanbul) çevirir
 */
function formatToTurkeyTime(dateString) {
    if (!dateString) return null;
    return new Date(dateString).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

/**
 * Çalışılan süreyi okunabilir formata çevirir
 */
function formatWorkDuration(minutes) {
    if (!minutes || minutes < 0) return '0 dakika';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} dakika`;
    if (mins === 0) return `${hours} saat`;
    return `${hours} saat ${mins} dakika`;
}

/**
 * ACİL GÖREV HESAPLAMA FONKSİYONU
 */
function enrichTaskWithUrgency(task) {
    if (!task.deadline) {
        return {
            ...task,
            isUrgent: false, hoursLeft: null, urgencyLevel: 'none'
        };
    }

    const now = new Date();
    const deadline = new Date(task.deadline);
    const hoursLeft = Math.round((deadline - now) / (1000 * 60 * 60));
    const daysLeft = Math.ceil(hoursLeft / 24);
    const isCompleted = task.status === 'COMPLETED';

    let urgencyLevel = 'none';
    let isUrgent = false;

    if (!isCompleted) {
        if (hoursLeft < 0) { urgencyLevel = 'overdue'; isUrgent = true; }
        else if (hoursLeft <= 24) { urgencyLevel = 'critical'; isUrgent = true; }
        else if (hoursLeft <= 48) { urgencyLevel = 'high'; isUrgent = true; }
        else if (hoursLeft <= 72) { urgencyLevel = 'medium'; isUrgent = false; }
        else { urgencyLevel = 'low'; isUrgent = false; }
    }

    return {
        ...task, isUrgent, hoursLeft, daysLeft, urgencyLevel,
        isOverdue: hoursLeft < 0 && !isCompleted
    };
}

module.exports = {
    formatToTurkeyTime,
    formatWorkDuration,
    enrichTaskWithUrgency
};
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const prisma = require('../config/database');

// 1. Mail Gönderici Ayarları
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS  
    }
});

// 2. Zamanlayıcı: Her Sabah Saat 09:00'da Çalışır
const initTaskNotifier = () => {
    cron.schedule('0 9 * * *', async () => {
        console.log("⏰ [CRON] Görev bildirim kontrolü başlatıldı...");
        try {
            const activeTasks = await prisma.task.findMany({
                where: { 
                    status: { not: 'COMPLETED' },
                    deadline: { not: null }
                },
                include: { 
                    intern: { include: { internProfile: true } } 
                }
            });

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            for (const task of activeTasks) {
                const targetEmail = task.intern.internProfile?.notificationEmail;
                if (!targetEmail) continue;

                const deadlineDate = new Date(task.deadline);
                deadlineDate.setHours(0, 0, 0, 0);
                
                const diffTime = deadlineDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let subject = "";
                let message = "";

                if (daysLeft === 1) {
                    subject = `⚠️ Yaklaşan Görev: ${task.title}`;
                    message = `Merhaba ${task.intern.name},<br><br><b>"${task.title}"</b> adlı görevinizin teslimine sadece <b>1 gün</b> kalmıştır. Lütfen zamanında tamamlamaya özen gösteriniz.`;
                } 
                else if (daysLeft <= 0 && daysLeft >= -2) {
                    const delayText = daysLeft === 0 ? "Bugün" : `${Math.abs(daysLeft)} gün önce`;
                    subject = `🚨 Gecikmiş Görev: ${task.title}`;
                    message = `Merhaba ${task.intern.name},<br><br><b>"${task.title}"</b> adlı görevinizin teslim tarihi <b>${delayText}</b> dolmuştur. Lütfen en kısa sürede görevi tamamlayıp sisteme işleyiniz.`;
                }

                if (subject && message) {
                    await transporter.sendMail({
                        // DÜZELTME: GMAIL_USER yerine SMTP_USER kullanıldı
                        from: `"Stajyer Yönetim Sistemi Mentör" <${process.env.SMTP_USER}>`,
                        to: targetEmail,
                        subject: subject,
                        html: `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                <h2 style="color: #4F46E5;">Görev Hatırlatması</h2>
                                <p>${message}</p>
                                <p style="color: #888; font-size: 12px; margin-top: 20px;">Bu otomatik bir bilgilendirme mesajıdır.</p>
                               </div>`
                    });
                    console.log(`✅ Mail gönderildi: ${targetEmail} (Görev: ${task.title})`);
                }
            }
        } catch (error) {
            console.error("🚨 [CRON] Mail gönderim hatası:", error);
        }
    }, {
        scheduled: true,
        timezone: "Europe/Istanbul" // DÜZELTME: Türkiye saati eklendi
    });
};

module.exports = { initTaskNotifier };
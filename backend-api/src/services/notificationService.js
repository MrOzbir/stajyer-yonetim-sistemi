const nodemailer = require('nodemailer');
const cron = require('node-cron');
const prisma = require('../config/database');

// 1. Mail Gönderici Ayarları (Kendi Gmail hesabınızın App Password'ü kullanılmalı)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER, // .env dosyanıza ekleyin
        pass: process.env.SMTP_PASS  // .env dosyanıza ekleyin
    }
});

// 2. Zamanlayıcı: Her Sabah Saat 09:00'da Çalışır
const initTaskNotifier = () => {
    cron.schedule('0 9 * * *', async () => {
        console.log("⏰ [CRON] Görev bildirim kontrolü başlatıldı...");
        try {
            // Sadece tamamlanmamış ve deadline'ı olan görevleri, stajyerin mail bilgisiyle çek
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
                // Stajyerin bildirim maili yoksa atla
                const targetEmail = task.intern.internProfile?.notificationEmail;
                if (!targetEmail) continue;

                const deadlineDate = new Date(task.deadline);
                deadlineDate.setHours(0, 0, 0, 0);
                
                // Gün farkını hesapla
                const diffTime = deadlineDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let subject = "";
                let message = "";

                // 🚀 KURAL 1: Teslime tam 1 gün kaldıysa
                if (daysLeft === 1) {
                    subject = `⚠️ Yaklaşan Görev: ${task.title}`;
                    message = `Merhaba ${task.intern.name},<br><br><b>"${task.title}"</b> adlı görevinizin teslimine sadece <b>1 gün</b> kalmıştır. Lütfen zamanında tamamlamaya özen gösteriniz.`;
                } 
                // 🚀 KURAL 2: Gecikmişse (0, -1, -2 gün) - 2 günden fazla gecikirse mail atmaz!
                else if (daysLeft <= 0 && daysLeft >= -2) {
                    const delayText = daysLeft === 0 ? "Bugün" : `${Math.abs(daysLeft)} gün önce`;
                    subject = `🚨 Gecikmiş Görev: ${task.title}`;
                    message = `Merhaba ${task.intern.name},<br><br><b>"${task.title}"</b> adlı görevinizin teslim tarihi <b>${delayText}</b> dolmuştur. Lütfen en kısa sürede görevi tamamlayıp sisteme işleyiniz.`;
                }

                // Eğer şartlara uyduysa ve mesaj oluştuysa Maili Gönder
                if (subject && message) {
                    await transporter.sendMail({
                        from: `"Stajyer Yönetim Sistemi Mentör" <${process.env.GMAIL_USER}>`,
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
    });
};

module.exports = { initTaskNotifier };
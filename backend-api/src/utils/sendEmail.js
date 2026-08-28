const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // 465 için true, 587 için false
    auth: {
        user: process.env.SMTP_USER, // E-posta adresiniz
        pass: process.env.SMTP_PASS  // E-posta / Uygulama Şifreniz
    }
});

const sendResetEmail = async (toEmail, resetLink) => {
    const mailOptions = {
        from: `"Stajyer Yönetim Sistemi" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: '🔒 Şifre Sıfırlama Talebi',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2>Şifre Sıfırlama Talebi</h2>
                <p>Hesabınız için bir şifre sıfırlama talebinde bulundunuz. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyebilirsiniz:</p>
                <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; color: #fff; background-color: #a01e27; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 15px 0;">Şifremi Sıfırla</a>
                <p>Bu bağlantı <strong>15 dakika</strong> boyunca geçerlidir.</p>
                <p style="font-size: 12px; color: #777;">Eğer bu talebi siz yapmadıysanız, bu e-postayı dikkate almayabilirsiniz.</p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = sendResetEmail;
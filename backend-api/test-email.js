require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🔍 Okunan Mail:', process.env.SMTP_USER);
console.log('🔍 Şifre Uzunluğu:', process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

transporter.verify((error) => {
    if (error) {
        console.error('❌ SMTP Hatanız:', error.message);
    } else {
        console.log('✅ SMTP Bağlantısı Başarılı!');
    }
});
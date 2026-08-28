const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { formatToTurkeyTime, formatWorkDuration } = require('../utils/formatters');
const crypto = require('crypto');
const sendResetEmail = require('../utils/sendEmail');

exports.register = async (data) => {
    const { name, surname, email, password, role, departmentId } = data;

    // 1. E-posta kontrolü
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error("Bu e-posta adresi zaten kullanımda.");
    }

    // 2. Departman kontrolü
    if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: parseInt(departmentId) } });
        if (!dept) {
            throw new Error("Belirtilen departman bulunamadı.");
        }
    }

    // 3. Şifreleme ve Kayıt
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
        data: {
            name, surname, email,
            password_hash: hashedPassword,
            role: role || 'INTERN',
            departmentId: departmentId ? parseInt(departmentId) : null
        },
        include: { department: true }
    });

    // 4. Stajyer ise profil oluştur
    if (newUser.role === 'INTERN') {
        await prisma.internProfile.create({ data: { userId: newUser.id } });
    }

    return {
        id: newUser.id,
        name: newUser.name,
        role: newUser.role,
        department: newUser.department
    };
};

exports.login = async (email, password) => {
    // 1. Kullanıcıyı bul
    const user = await prisma.user.findUnique({ where: { email: email } });
    if (!user) throw new Error("Geçersiz e-posta veya şifre."); // 401
            
    // 2. Şifreyi doğrula
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) throw new Error("Geçersiz e-posta veya şifre."); // 401

    // 3. Arşiv (Soft Delete) kontrolü
    if (user.isArchived) {
        throw new Error("Hesabınız arşivlenmiş. Lütfen yöneticinizle iletişime geçin."); // 403
    }
    
    // 4. Bilet (Token) üret
    const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );

    // 5. Stajyer ise otomatik giriş logu tut
    if (user.role === 'INTERN') {
        await prisma.dailyLog.create({ data: { internId: user.id } });
    }

    return {
        token: token,
        user: { id: user.id, name: user.name, role: user.role }
    };
};

exports.logout = async (userId, role) => {
    // 1. Güvenlik kontrolü
    if (role !== 'INTERN') {
        throw new Error("Sadece stajyerler için çıkış logu tutulmaktadır."); // 403
    }
    
    // 2. Açık oturumu bul
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const openLog = await prisma.dailyLog.findFirst({
        where: { internId: userId, logoutTime: null, loginTime: { gte: today } },
        orderBy: { loginTime: 'desc' }
    });
    
    if (!openLog) throw new Error("Kapatılacak açık bir oturum bulunamadı."); // 404
    
    // 3. Çıkış saatini güncelle
    const logoutTime = new Date();
    const updatedLog = await prisma.dailyLog.update({
        where: { id: openLog.id }, data: { logoutTime: logoutTime }
    });
    
    // 4. Süreyi hesapla ve formatla
    const workedMinutes = Math.round((logoutTime - openLog.loginTime) / (1000 * 60));
    
    return {
        log: {
            id: updatedLog.id,
            loginTime: formatToTurkeyTime(openLog.loginTime),
            logoutTime: formatToTurkeyTime(updatedLog.logoutTime),
            loginTimeUTC: openLog.loginTime,
            logoutTimeUTC: updatedLog.logoutTime
        },
        workedMinutes: workedMinutes,
        workedDuration: formatWorkDuration(workedMinutes),
        summary: `Bugün ${formatWorkDuration(workedMinutes)} boyunca sistemde oturum açıldı.`
    };
};

// 1. E-posta Gönderme Mantığı
exports.forgotPassword = async (email) => {
    if (!email) {
        throw new Error("Lütfen bir e-posta adresi girin.");
    }

    // E-postayı temizle (küçük harf ve kenar boşluklarını sil)
    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
        throw new Error("Bu e-posta adresine ait bir kullanıcı bulunamadı.");
    }

    // Güvenli rastgele token üret (32 byte hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 dakika geçerli

    // Token'ı veritabanına kaydet
    await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry }
    });

    // Sıfırlama bağlantısını oluştur (Slash temizliği dahil)
    const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const clientUrl = rawClientUrl.replace(/\/$/, ''); // Sondaki slashtan arındır
    const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;

    try {
        await sendResetEmail(user.email, resetLink);
        return { message: "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi." };
    } catch (mailError) {
        console.error("🚨 NODEMAILER MAİL GÖNDERME HATASI:", mailError);
        throw new Error(`E-posta servisi hatası: ${mailError.message}`);
    }
};

// 2. Token ile Yeni Şifreyi Kaydetme
const resetPasswordWithToken = async (token, newPassword) => {
    if (!token || !newPassword) {
        throw new Error("Token ve yeni şifre alanları zorunludur.");
    }

    const user = await prisma.user.findFirst({
        where: {
            resetToken: token,
            resetTokenExpiry: { gt: new Date() } // Geçerlilik süresi dolmamış olmalı
        }
    });

    if (!user) {
        throw new Error("Geçersiz veya süresi dolmuş bağlantı.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Şifreyi güncelle ve token bilgilerini temizle
    await prisma.user.update({
        where: { id: user.id },
        data: {
            password_hash: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null
        }
    });

    return { message: "Şifreniz başarıyla güncellendi." };
};

exports.resetPasswordWithToken = resetPasswordWithToken;
exports.resetPassword = resetPasswordWithToken; // Controller farkı ihtimaline karşı alias
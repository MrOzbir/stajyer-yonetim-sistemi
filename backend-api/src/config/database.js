const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
    console.error("🚨 KRİTİK HATA: .env dosyasından DATABASE_URL okunamadı!");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

pool.connect((err, client, release) => {
    if (err) {
        console.error('\n❌ VERİTABANI BAĞLANTI HATASI (Havuz Reddedildi):', err.message, '\n');
    } else {
        console.log('✅ PostgreSQL Bağlantısı Havuz Üzerinden Başarıyla Kuruldu!');
        release();
    }
});

module.exports = prisma;
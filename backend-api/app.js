const express = require('express');
const cors = require('cors');

// 1. Tüm Rotaların İçe Aktarılması
const authRoutes = require('./src/routes/authRoutes');
const internRoutes = require('./src/routes/internRoutes');
const userRoutes = require('./src/routes/userRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const archiveRoutes = require('./src/routes/archiveRoutes');
const summaryRoutes = require('./src/routes/summaryRoutes');
const logRoutes = require('./src/routes/logRoutes');
const aiRoutes = require('./src/routes/aiRoutes');

const app = express();

// 2. CORS Yapılandırması (Giriş ve Tüm İstekler İçin)
app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. API Rotaları
app.use('/api/auth', authRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/ai', aiRoutes);

app.get('/', (req, res) => {
    res.send('✅ Stajyer Yönetim Sistemi API başarıyla çalışıyor!');
});

module.exports = app;
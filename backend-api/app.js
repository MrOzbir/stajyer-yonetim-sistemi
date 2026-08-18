const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const internRoutes = require('./src/routes/internRoutes');
const archiveRoutes = require('./src/routes/archiveRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const logRoutes = require('./src/routes/logRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const userRoutes = require('./src/routes/userRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/interns', internRoutes);
app.use('/api/archives', archiveRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
    res.send('✅ Stajyer Yönetim Sistemi API başarıyla çalışıyor! (Clean Architecture)');
});

module.exports = app;
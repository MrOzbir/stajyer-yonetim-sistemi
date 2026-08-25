require('dotenv').config();
require('./src/services/cronService');
const http = require('http');
const app = require('./app');
const setupSocket = require('./src/config/socket');

const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

const summaryRoutes = require('./src/routes/summaryRoutes');

// Mevcut rotaların altına ekleyin:
app.use('/api/summaries', summaryRoutes);

// Socket.io'yu başlat ve Express app'in içine ekle (Controller'lardan erişebilmek için)
const io = setupSocket(server);
app.set('io', io);

server.listen(PORT, () => {
    console.log(`🚀 HTTP + WebSocket sunucusu http://localhost:${PORT} adresinde ayağa kalktı.`);
});
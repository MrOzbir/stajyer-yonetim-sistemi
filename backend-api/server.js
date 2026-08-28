require('dotenv').config();
require('./src/services/cronService');
require('./src/services/notificationService').initTaskNotifier();

const http = require('http');
const app = require('./app');
const setupSocket = require('./src/config/socket');

const PORT = process.env.PORT || 5001;
const server = http.createServer(app);

// Socket.io Kurulumu
const io = setupSocket(server);
app.set('io', io);

// '0.0.0.0' ile tüm yerel ağa ve mobile açık dinleme
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sunucu http://0.0.0.0:${PORT} adresinde aktif!`);
});
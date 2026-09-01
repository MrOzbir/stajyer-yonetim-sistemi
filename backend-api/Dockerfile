FROM node:20-alpine

WORKDIR /app

# Paket dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm install

# Kaynak kodları kopyala
COPY . .

# Prisma istemcisini oluştur
RUN npx prisma generate

EXPOSE 5001

# Veritabanı tablolarını oluştur ve sunucuyu başlat
CMD ["sh", "-c", "npx prisma db push && node server.js"]

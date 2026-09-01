# Aşama 1: Build (Derleme)
FROM node:20-alpine as build
WORKDIR /app

# Paket bağımlılıklarını kur
COPY package*.json ./
RUN npm install

# Tüm dosyaları kopyala
COPY . .

# API URL'sini derleme argümanı olarak al ve build anında kullan
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Projeyi derle
RUN npm run build

# Aşama 2: Nginx ile Servis Et
FROM nginx:alpine

# Derlenen dosyaları nginx'in sunacağı klasöre kopyala
COPY --from=build /app/dist /usr/share/nginx/html

# React Router için client-side routing ayarı (Nginx conf)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

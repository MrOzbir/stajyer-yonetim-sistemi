FROM python:3.10-slim

WORKDIR /app

# Bağımlılıkları kopyala ve kur
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Kaynak kodları kopyala
COPY . .

EXPOSE 8000

# docker-compose.yml'da belirtildiği gibi main.py çalıştırılacak
CMD ["python", "main.py"]
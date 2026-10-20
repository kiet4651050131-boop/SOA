FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Mỗi container chạy một thành phần: ghi đè CMD trong docker-compose.yml
CMD ["node", "scripts/run-all.js"]

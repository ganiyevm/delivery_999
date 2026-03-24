FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

# Backend
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production
COPY backend/ ./backend/

# Bot
COPY bot/package*.json ./bot/
RUN cd bot && npm ci --production
COPY bot/ ./bot/

# Frontend dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Start script
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000
CMD ["./start.sh"]

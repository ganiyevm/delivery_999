FROM node:20-alpine
WORKDIR /app

# Bot dependencies (mongoose, grammy, axios, xlsx ...)
COPY bot/package*.json ./
RUN npm ci --production

# Bot kodi
COPY bot/ .

# Backend modellar, serviclar, config
COPY backend/src/models /backend/src/models
COPY backend/src/services /backend/src/services
COPY backend/src/config /backend/src/config

# Bot ../backend/node_modules/* ishlatadi — o'zining node_modules dan symlink
RUN mkdir -p /backend/node_modules && \
    for pkg in mongoose bson mongodb xlsx axios; do \
        ln -sf /app/node_modules/$pkg /backend/node_modules/$pkg; \
    done

CMD ["node", "index.js"]

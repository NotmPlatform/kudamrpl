FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && \
    npx playwright install --with-deps chromium && \
    apt-get update && \
    apt-get install -y --no-install-recommends fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

COPY . .

CMD ["npm", "start"]

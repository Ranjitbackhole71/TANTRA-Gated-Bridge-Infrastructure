FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --omit=dev

RUN npm rebuild better-sqlite3 --build-from-source

COPY . .

EXPOSE 3004

CMD ["node", "app.js"]

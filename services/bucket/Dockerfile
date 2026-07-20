FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY bucket/package*.json ./
RUN npm install --production
COPY bucket/ .
EXPOSE 3004
CMD ["node", "app.js"]

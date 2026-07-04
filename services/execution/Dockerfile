FROM node:18-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY execution/package*.json ./
RUN npm install --production
COPY execution/ .
COPY observability/ ./observability/
COPY replay_persistence/ ./replay_persistence/
EXPOSE 3003
CMD ["node", "app.js"]

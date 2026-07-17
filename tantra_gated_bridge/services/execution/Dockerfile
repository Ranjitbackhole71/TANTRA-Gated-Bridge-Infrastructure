FROM node:18-alpine
WORKDIR /app
COPY execution/package*.json ./
RUN npm install --production
COPY execution/ .
COPY observability/ ./observability/
COPY replay_persistence/ ./replay_persistence/
EXPOSE 3003
CMD ["node", "app.js"]

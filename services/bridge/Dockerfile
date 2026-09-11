FROM node:18-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY bridge/package*.json ./
RUN npm install --production
COPY bridge/ ./bridge/
COPY observability/ ./observability/
COPY replay_persistence/ ./replay_persistence/
COPY insightflow/ ./insightflow/
EXPOSE 3002
CMD ["node", "bridge/app.js"]

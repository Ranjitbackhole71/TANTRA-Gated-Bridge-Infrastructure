FROM node:18-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY insightflow/package*.json ./
RUN npm install --production
COPY insightflow/ .
COPY observability/ ./observability/
COPY replay_persistence/ ./replay_persistence/
EXPOSE 3005
CMD ["node", "local_receiver.js"]

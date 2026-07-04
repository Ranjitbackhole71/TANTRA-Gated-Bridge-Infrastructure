FROM node:18-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY sarathi/package*.json ./
RUN npm install --production
COPY sarathi/ .
EXPOSE 3001
CMD ["node", "app.js"]

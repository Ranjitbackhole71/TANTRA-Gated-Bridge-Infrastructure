FROM node:18-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY core/package*.json ./
RUN npm install --production
COPY core/ .
EXPOSE 3000
CMD ["node", "app.js"]

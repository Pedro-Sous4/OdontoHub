FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV SERVICE_CMD=dev:gateway
EXPOSE 3000
CMD ["sh", "-c", "npm run ${SERVICE_CMD}"]

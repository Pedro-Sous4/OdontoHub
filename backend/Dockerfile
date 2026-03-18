FROM node:20-alpine

WORKDIR /app
# Install build tools for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
# Rebuild native modules from source to avoid exec-format errors on Alpine
RUN npm install --build-from-source
COPY . .

ENV SERVICE_CMD=dev:gateway
EXPOSE 3000
CMD ["sh", "-c", "npm run ${SERVICE_CMD}"]

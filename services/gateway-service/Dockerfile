FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY tsconfig.json ./
COPY packages ./packages
WORKDIR /app/packages/auth-middleware
RUN npm install
WORKDIR /app
COPY services/gateway-service ./services/gateway-service
WORKDIR /app/services/gateway-service
RUN npm install
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/index.js"]

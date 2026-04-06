FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
COPY services/gateway-service ./services/gateway-service
WORKDIR /app/services/gateway-service
RUN npm install
RUN npm run build
EXPOSE 8080
CMD ["node", "dist/index.js"]

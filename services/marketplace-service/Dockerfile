FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
WORKDIR /app/packages/auth-middleware
RUN npm install --include=dev
WORKDIR /app
COPY services/marketplace-service ./services/marketplace-service
WORKDIR /app/services/marketplace-service
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]

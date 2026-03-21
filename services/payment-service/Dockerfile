FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
WORKDIR /app/packages/auth-middleware
RUN npm install --include=dev
WORKDIR /app
COPY services/payment-service ./services/payment-service
WORKDIR /app/services/payment-service
RUN npm install
RUN npm run build
EXPOSE 3005
CMD ["node", "dist/index.js"]

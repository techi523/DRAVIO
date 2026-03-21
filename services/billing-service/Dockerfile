FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
WORKDIR /app/packages/auth-middleware
RUN npm install --include=dev
WORKDIR /app
COPY services/billing-service ./services/billing-service
WORKDIR /app/services/billing-service
RUN npm install
RUN npm run build
EXPOSE 3006
CMD ["node", "dist/index.js"]

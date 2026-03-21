FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
WORKDIR /app/packages/auth-middleware
RUN npm install --include=dev
WORKDIR /app
COPY services/auth-service ./services/auth-service
WORKDIR /app/services/auth-service
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]

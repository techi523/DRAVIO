FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
WORKDIR /app/packages/auth-middleware
RUN npm install --include=dev
WORKDIR /app
COPY services/admin-service ./services/admin-service
WORKDIR /app/services/admin-service
RUN npm install
RUN npm run build
EXPOSE 3008
CMD ["node", "dist/index.js"]

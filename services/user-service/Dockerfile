FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
WORKDIR /app/packages/auth-middleware
RUN npm install --include=dev
WORKDIR /app
COPY services/user-service ./services/user-service
WORKDIR /app/services/user-service
RUN npm install
RUN npm run build
EXPOSE 3002
CMD ["node", "dist/index.js"]

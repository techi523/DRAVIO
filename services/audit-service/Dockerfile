FROM node:20-alpine
WORKDIR /app
COPY tsconfig.json ./tsconfig.json
COPY packages ./packages
COPY services/audit-service ./services/audit-service
WORKDIR /app/services/audit-service
RUN npm install
RUN npm run build
CMD ["node", "dist/index.js"]

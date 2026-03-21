FROM node:20-alpine

WORKDIR /app
COPY packages ./packages
COPY services/audit-service ./services/audit-service
WORKDIR /app/services/audit-service
RUN npm install

CMD ["npm", "start"]

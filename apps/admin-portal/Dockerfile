FROM node:20-alpine

WORKDIR /app
COPY packages ./packages
COPY apps/admin-portal ./apps/admin-portal
WORKDIR /app/apps/admin-portal
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

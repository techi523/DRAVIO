FROM node:20-alpine
WORKDIR /app
COPY packages ./packages
COPY apps/buyer-web ./apps/buyer-web
WORKDIR /app/apps/buyer-web
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

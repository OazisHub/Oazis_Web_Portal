FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY web ./web
EXPOSE 8103
CMD ["npm", "start"]

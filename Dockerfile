FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js db.js dados.js fatos.js fontes.js padlet.js prompts.js ia.js github-backup.js rubricas.json ./
COPY public ./public
RUN mkdir -p /app/data
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]

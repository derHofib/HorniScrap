FROM mcr.microsoft.com/playwright:v1.56.1-noble

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 8050

ENV PORT=8050

CMD ["node", "src/server.mjs"]

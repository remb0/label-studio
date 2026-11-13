FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/package.json
RUN npm ci --omit=dev --ignore-scripts
COPY server ./server
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=3s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1
CMD ["node", "server/index.mjs"]

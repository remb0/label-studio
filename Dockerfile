FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/package.json
RUN npm ci
COPY . .
ARG COMMIT_SHA=local
ENV COMMIT_SHA=$COMMIT_SHA
RUN npm run build && node -e 'require("fs").writeFileSync("dist/version.json", JSON.stringify({version:require("./package.json").version,commit:process.env.COMMIT_SHA}))'

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1

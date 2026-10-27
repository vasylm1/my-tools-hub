# Serves the site with the same security headers as Netlify (they are read from netlify.toml),
# so what you run here is what visitors get. No build step and no npm install are needed.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=8080

COPY package.json netlify.toml ./
COPY scripts/serve.mjs scripts/serve.mjs
COPY public public

EXPOSE 8080
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

CMD ["node", "scripts/serve.mjs"]

# Base
FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./

# Dependencies
FROM base AS dependencies
RUN npm install

# Build
FROM dependencies AS build
COPY . .
RUN npm run build && ls -l dist/main.js

# Runtime
FROM node:20-alpine
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { if (r.statusCode !== 200) process.exit(1) })"

EXPOSE 3000
CMD ["node", "dist/main.js"]

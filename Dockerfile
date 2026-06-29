FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci
COPY client ./client
RUN npm run build --workspace client

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
USER node
EXPOSE 5000
CMD ["npm", "run", "start", "--workspace", "server"]

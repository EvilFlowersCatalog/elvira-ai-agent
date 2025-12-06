FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS serve
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=build /app/out ./out
COPY --from=build /app/src/database/migrations ./out/database/migrations
EXPOSE 3000
CMD ["npm", "run", "start"]

# ---- build the static bundle ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve it, and proxy /petclinic/* to the backend (same origin => no CORS) ----
FROM nginx:1.27-alpine
# The nginx image renders /etc/nginx/templates/*.template with envsubst on start.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# PORT is the listen port; BACKEND_URL points at the Spring PetClinic REST service
# (scheme + host + port, no path), e.g. http://petclinic:9966 (see docker-compose.yml).
# Used for the optional local `docker compose up`; the Vercel deploy does not use this file.
ENV PORT=8080 \
    BACKEND_URL=http://host.docker.internal:9966
EXPOSE 8080

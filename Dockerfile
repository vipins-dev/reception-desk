# ---- build the static bundle ----
FROM node:24-alpine AS build
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
# Railway injects PORT; BACKEND_URL points at the Spring PetClinic REST service
# (scheme + host + port, no path), e.g. http://petclinic.railway.internal:9966
ENV PORT=8080 \
    BACKEND_URL=http://host.docker.internal:9966
EXPOSE 8080

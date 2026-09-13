FROM node:20-alpine

LABEL org.opencontainers.image.title="EduHoot"
LABEL org.opencontainers.image.description="Aplicacio de quiz tipus Kahoot, integrable amb identitat pseudonima EduTicTac"
LABEL org.opencontainers.image.source="https://git.edutictac.es/Edutictac/eduhoot"

ENV NODE_ENV=production

WORKDIR /app

COPY src/package.json src/package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./
COPY entrypoint.sh /entrypoint.sh

RUN addgroup -S app && adduser -S app -G app \
    && chmod +x /entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server/server.js"]

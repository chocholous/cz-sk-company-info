# Apify image s Node.js 24 + Chromium pro Playwright (potřeba pro CZ MSP SPA).
# https://docs.apify.com/sdk/js/docs/guides/docker-images
FROM apify/actor-node-playwright-chrome:24

# Sanity check preinstalovaných balíčků.
RUN npm ls @crawlee/core apify playwright || true

COPY --chown=myuser:myuser package*.json ./

RUN npm --quiet set progress=false \
    && npm install --omit=dev --omit=optional \
    && echo "Installed NPM packages:" \
    && (npm list --omit=dev --all || true) \
    && echo "Node.js version:" \
    && node --version \
    && echo "NPM version:" \
    && npm --version \
    && rm -r ~/.npm

COPY --chown=myuser:myuser . ./

CMD ["node", "src/main.js"]

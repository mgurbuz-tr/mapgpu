# ──────────────────────────────────────────
# Stage 1: Build
# ──────────────────────────────────────────
FROM node:20 AS builder

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# TS paketleri bağımlılık sırasına göre derle
# Faz 0: core (bağımlılıksız)
RUN pnpm --filter @mapgpu/core run build

# Faz 1: core'a bağımlı paketler (paralel çalışabilir ama Docker'da sıralı)
RUN pnpm --filter @mapgpu/render-webgpu run build && \
    pnpm --filter @mapgpu/adapters-ogc  run build && \
    pnpm --filter @mapgpu/layers        run build && \
    pnpm --filter @mapgpu/terrain       run build && \
    pnpm --filter @mapgpu/analysis      run build

# Faz 2: layers/analysis'e bağımlı paketler
RUN pnpm --filter @mapgpu/widgets run build && \
    pnpm --filter @mapgpu/tools   run build && \
    pnpm --filter @mapgpu/tiles3d run build && \
    pnpm --filter @mapgpu/react   run build

# Faz 3: examples + site
RUN pnpm --filter @mapgpu/examples run build || true
RUN pnpm --filter @mapgpu/site     run build

# ──────────────────────────────────────────
# Stage 2: Serve
# ──────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/packages/site/dist /usr/share/nginx/html
COPY --from=builder /app/packages/site/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]

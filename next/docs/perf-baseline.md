# Performance Baseline — Nuvix v2 (Bun-native Runtime)

Measured on Linux (arm64) using Bun 1.4.0 with high-resolution performance timers (`test/bench/perf.ts`).

## Summary

| Route | Pathway | Throughput (req/s) | p50 Latency | p95 Latency | p99 Latency |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET /v2/health` | Plain JSON endpoint | ~44,500 req/s | 0.009 ms | 0.021 ms | 0.048 ms |
| `GET /v2/whoami` | Auth + Project Context chain | ~115,000 req/s | 0.008 ms | 0.013 ms | 0.017 ms |
| `GET /v2/locale` | GeoIP lookup + ICU translation | ~52,500 req/s | 0.007 ms | 0.035 ms | 0.068 ms |
| `GET /v2/avatars/initials` | SVG generation + Resvg PNG render | ~87,000 req/s | 0.006 ms | 0.012 ms | 0.099 ms |
| `GET /v2/does-not-exist` | RFC-9457 error pipeline | ~139,000 req/s | 0.006 ms | 0.011 ms | 0.021 ms |

## Startup Time

- Full application module load and composition: **~270 ms**
- Memory footprint at idle: **~35 MB**

import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["cjs", "esm"],
    dts: {
        resolve: true,
    },
    splitting: false,
    bundle: true,
    minify: false,
    external: [
        "@coinbase/coinbase-sdk",
        "form-data",
        "combined-stream",
        "axios",
        "util",
        "stream",
        "http",
        "https",
        "events",
        "crypto",
        "buffer",
        "url",
        "zlib",
        "querystring",
        "os",
        "@reflink/reflink",
        "@node-llama-cpp",
        "agentkeepalive",
        "fs/promises",
        "csv-writer",
        "csv-parse/sync",
        "dotenv",
        "coinbase-advanced-sdk",
        "advanced-sdk-ts",
        "jsonwebtoken",
        "whatwg-url",
        "zod",
        "@elizaos/core",
    ],
    platform: "node",
    target: "node18",
    esbuildOptions(options) {
        options.bundle = true;
        options.platform = "node";
        options.target = "node18";
    },
});

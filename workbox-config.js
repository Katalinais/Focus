module.exports = {
  globDirectory: ".",
  globPatterns: ["index.html", "manifest.json", "css/*.css", "*.js", "icons/*.png"],
  globIgnores: [
    "node_modules/**/*",
    "workbox-config.js",
    "package*.json",
    "sw.js",
    // Session 16's deliberately-mismatched test icon — not referenced by the app.
    "icons/icon-96-incorrecto.png",
  ],
  swDest: "sw.js",
  runtimeCaching: [
    {
      urlPattern: /\/icons\//,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    { urlPattern: /\/api\//, handler: "NetworkFirst", options: { cacheName: "api-tasks" } },
  ],
};

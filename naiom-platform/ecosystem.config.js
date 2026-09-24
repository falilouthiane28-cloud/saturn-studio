// PM2 — garde Saturn Studio en vie (redémarrage auto, logs, boot serveur).
// Lancer depuis saturn-studio/naiom-platform/ :  pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "saturn-studio",
      // `next start` sert le build de production (.next) — PAS `next dev`.
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};

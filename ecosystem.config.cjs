/** @type { import('pm2').StartOptions } */
module.exports = {
  apps: [
    {
      name: "video-backend",
      cwd: "./backend",
      script: "node",
      args: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "video-frontend",
      cwd: "./frontend",
      script: "node_modules/.bin/next",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};

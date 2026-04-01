module.exports = {
  apps: [
    {
      name: "chatops",
      script: "node_modules/.bin/next",
      args: "start -p 47293",
      exec_mode: "cluster",
      instances: "max",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

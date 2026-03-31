module.exports = {
  apps: [
    {
      name: "chatops",
      script: "npm",
      args: "start",
      exec_mode: "cluster",
      instances: "max",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

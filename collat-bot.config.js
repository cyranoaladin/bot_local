export default {
  apps : [{
    name: "collat-bot-backend",
    script: "./backend/dist/app.js",
    env: {
      NODE_ENV: "production",
      PORT: 3001
    },
    watch: false,
    max_memory_restart: "200M",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "./logs/error.log",
    out_file: "./logs/output.log",
    merge_logs: true,
    restart_delay: 10000
  }]
}

module.exports = {
  apps: [
    {
      name: 'silvercrown-element',
      script: './dist/index.cjs',
      cwd: '/var/www/silvercrown-element',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 5100
      },
      error_file: '/var/log/silvercrown-element/error.log',
      out_file: '/var/log/silvercrown-element/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};

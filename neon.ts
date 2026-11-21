import { defineConfig } from "@neon/config/v1";

const schedulerSecret = process.env.ZL_SCHEDULER_SECRET || '';

export default defineConfig({
  // Declare your Neon services here
  auth: true,
  functions: {
    zledgercraft: {
      name: 'ZledgerCraft API',
      source: 'neon-function.mjs',
      env: {
        RESEND_API_KEY: { value: process.env.RESEND_API_KEY, required: true },
        RESEND_FROM: { value: process.env.RESEND_FROM, required: true },
        ZL_ALERT_EMAIL: { value: process.env.ZL_ALERT_EMAIL, required: true },
        ZL_PUBLIC_URL: { value: process.env.ZL_PUBLIC_URL, required: true },
        ZL_REPORT_SECRET: { value: process.env.ZL_REPORT_SECRET, required: true },
        ZL_SCHEDULER_SECRET: { value: process.env.ZL_SCHEDULER_SECRET, required: true },
        ZL_PROXY_SECRET: { value: process.env.ZL_PROXY_SECRET, required: true },
        ...(process.env.ZL_BACKUP_PASSPHRASE
          ? { ZL_BACKUP_PASSPHRASE: { value: process.env.ZL_BACKUP_PASSPHRASE } }
          : {}),
        R2_ACCOUNT_ID: { value: process.env.R2_ACCOUNT_ID, required: true },
        R2_ACCESS_KEY_ID: { value: process.env.R2_ACCESS_KEY_ID, required: true },
        R2_SECRET_ACCESS_KEY: { value: process.env.R2_SECRET_ACCESS_KEY, required: true },
        R2_BUCKET: { value: process.env.R2_BUCKET, required: true },
        R2_PREFIX: { value: process.env.R2_PREFIX || 'zledgercraft', required: true },
        ZL_FUNCTION: '1',
        ZL_DATA_DIR: '/tmp/zledgercraft',
        ZL_BACKUP_DIR: '/tmp/zledgercraft/backups',
        ZL_PG_POOL_SIZE: '5',
      },
    },
  },
  triggers: {
    'daily-operations': {
      type: 'schedule',
      function: 'zledgercraft',
      cron: '30 2 * * *',
      functionPath: `/api/internal/scheduler/${encodeURIComponent(schedulerSecret)}`,
    },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});

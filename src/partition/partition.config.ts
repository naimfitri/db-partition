export const PARTITION_CONFIG = {
  // Timezone offset in milliseconds (GMT+8 = 8 hours)
  TIMEZONE_OFFSET_MS: parseInt(process.env.PARTITION_TIMEZONE_OFFSET_MS || String(8 * 60 * 60 * 1000)),
};
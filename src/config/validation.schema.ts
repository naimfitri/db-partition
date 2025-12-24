import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // Database
  DATABASE_HOST: Joi.string().default('localhost'),
  DATABASE_PORT: Joi.number().default(3306),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().allow('').default(''),
  DATABASE_NAME: Joi.string().required(),

  // Partition Management
  PARTITION_ENABLED: Joi.string().valid('true', 'false').default('false'),
  PARTITION_CRON: Joi.string().default('0 2 * * *'),
  PARTITION_CONFIG: Joi.string().default('[]'),

  // Application
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});

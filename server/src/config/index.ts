import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'trip-splitter-super-secret-key-2026-safe',
  JWT_EXPIRES_IN: '30d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};

import winston from 'winston'
import session from 'express-session'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`
    }),
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: process.env.LOG_FILE_PATH || 'logs/app.log',
    }),
  ],
})

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'development-secret',
  saveUninitialized: false,
  resave: false,
  cookie: {
    maxAge:
      process.env.COOKIE_MAX_AGE ?
        parseInt(process.env.COOKIE_MAX_AGE)
      : 24 * 60 * 60 * 1000, // 24 hours
  },
})

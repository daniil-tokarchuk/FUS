import express from 'express'

import { logger, sessionMiddleware } from './constants.js'
import { checkAuth, handleAuthCallback } from './auth.js'
import { initialize, shutdown } from './db.js'
import { uploadFiles, getUploadedFiles, getAllFiles } from './handler.js'

initialize()
logger.info('Database initialized')

const app = express()

app.use(express.json())

app.use(sessionMiddleware)

app.use((req, res, next) => {
  logger.info(`Incoming request: ${req.method} ${req.path}`)
  if (req.path === '/auth/google/callback') {
    return next()
  }
  return checkAuth(req, res, next)
})

app.use(express.static('public'))

app.get('/', (req, res) => {
  logger.info(`GET / - User: ${req.session.user?.email || 'Guest'}`)
  res.send(`Welcome ${req.session.user?.email}`)
})

app.get('/auth/google/callback', handleAuthCallback)

app.post('/upload-files', async (req, res) => {
  const { urls } = req.body
  if (!Array.isArray(urls) || urls.length === 0) {
    logger.warn('POST /upload-files - Invalid request body')
    return res.status(400).json({ error: 'Provide an array of URLs' })
  }
  try {
    const results = await uploadFiles(req.session.user!.googleId, urls)
    logger.info(
      `POST /upload-files - Files uploaded by user ${req.session.user!.googleId}`,
    )
    res.json({ results })
  } catch (error: any) {
    logger.error(`POST /upload-files - Error: ${error.message}`)
    res.status(500).send('Error uploading files')
  }
})

app.get('/get-uploaded-files', async (req, res) => {
  try {
    const files = await getUploadedFiles(req.session.user!.googleId)
    logger.info(`GET /get-uploaded-files - User ${req.session.user!.googleId}`)
    res.json({ files })
  } catch (error: any) {
    logger.error(`GET /get-uploaded-files - Drive error: ${error.message}`)
    res.status(500).send('Drive error. Please try again.')
  }
})

app.get('/get-all-files', async (req, res) => {
  try {
    const files = await getAllFiles(req.session.user!.googleId)
    logger.info(`GET /get-all-files - User ${req.session.user!.googleId}`)
    res.json({ files })
  } catch (error: any) {
    logger.error(`GET /get-all-files - Drive error: ${error.message}`)
    res.status(500).send('Drive error. Please try again.')
  }
})

const server = app.listen(process.env.APP_PORT, () => {
  logger.info(`Server is running on port ${process.env.APP_PORT}`)
})

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(async () => {
    logger.info('HTTP server closed')
    await shutdown()
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  server.close(async () => {
    logger.info('HTTP server closed')
    await shutdown()
    process.exit(0)
  })
})

export default app

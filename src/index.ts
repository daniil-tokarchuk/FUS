import express from 'express'
import { fileURLToPath } from 'url'
import path from 'path'
import https from 'https'
import http from 'http'
import fs from 'fs'

import { logger, sessionMiddleware } from './constants.ts'
import { checkAuth, handleAuthCallback } from './auth.ts'
import { initialize, shutdown } from './db.ts'
import { uploadFiles, getUploadedFiles, getAllFiles } from './handler.ts'

initialize()
logger.info('Database initialized')

const app = express()
const API_PATH_V1 = '/api/v1'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

app.get('/upload', (req, res) => {
  logger.info(`GET /upload - User: ${req.session.user?.email || 'Guest'}`)
  res.sendFile(path.join(__dirname, '..', 'public/upload', 'upload.html'))
})

app.get('/files', (req, res) => {
  logger.info(`GET /files - User: ${req.session.user?.email || 'Guest'}`)
  res.sendFile(path.join(__dirname, '..', 'public/files', 'files.html'))
})

app.get('/auth/google/callback', handleAuthCallback)

app.post(`${API_PATH_V1}/upload-files`, async (req, res) => {
  const { urls } = req.body
  if (!Array.isArray(urls) || urls.length === 0) {
    logger.warn(`POST ${API_PATH_V1}/upload-files - Invalid request body`)
    return res.status(400).json({ error: 'Provide an array of URLs' })
  }
  try {
    const results = await uploadFiles(req.session.user!.googleId, urls)
    logger.info(
      `POST ${API_PATH_V1}/upload-files - Files uploaded by user ${req.session.user!.googleId}`,
    )
    res.json({ results })
  } catch (error: any) {
    logger.error(`POST ${API_PATH_V1}/upload-files - Error: ${error.message}`)
    res.status(500).send('Error uploading files')
  }
})

app.get(`${API_PATH_V1}/get-uploaded-files`, async (req, res) => {
  try {
    const files = await getUploadedFiles(req.session.user!.googleId)
    logger.info(
      `GET ${API_PATH_V1}/get-uploaded-files - User ${req.session.user!.googleId}`,
    )
    res.json({ files })
  } catch (error: any) {
    logger.error(
      `GET ${API_PATH_V1}/get-uploaded-files - Drive error: ${error.message}`,
    )
    res.status(500).send('Drive error. Please try again.')
  }
})

app.get(`${API_PATH_V1}/get-all-files`, async (req, res) => {
  try {
    const files = await getAllFiles(req.session.user!.googleId)
    logger.info(
      `GET ${API_PATH_V1}/get-all-files - User ${req.session.user!.googleId}`,
    )
    res.json({ files })
  } catch (error: any) {
    logger.error(
      `GET ${API_PATH_V1}/get-all-files - Drive error: ${error.message}`,
    )
    res.status(500).send('Drive error. Please try again.')
  }
})

const options = {
  key: fs.readFileSync(`${process.env.CERTS_PATH}/privkey.pem`),
  cert: fs.readFileSync(`${process.env.CERTS_PATH}/fullchain.pem`),
}

const httpsServer = https
  .createServer(options, app)
  .listen(process.env.HTTPS_PORT, () => {
    console.log(`HTTPS server running on port ${process.env.HTTPS_PORT}`)
  })

const httpServer = http
  .createServer((req, res) => {
    const host = req.headers.host?.replace(/:\d+$/, '')
    res.writeHead(301, { Location: `https://${host}${req.url}` })
    res.end()
  })
  .listen(process.env.HTTP_PORT, () => {
    console.log(`HTTP redirect server running on port ${process.env.HTTP_PORT}`)
  })

function handleSignal(signal: string): void {
  logger.info(`${signal} signal received: closing servers`)

  const closeServer = (server: http.Server, name: string) => {
    return new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error(`Error closing ${name} server:`, err)
          return reject(err)
        }
        logger.info(`${name} server closed`)
        resolve()
      })
    })
  }

  Promise.all([
    closeServer(httpServer, 'HTTP'),
    closeServer(httpsServer, 'HTTPS'),
  ])
    .then(async () => {
      try {
        await shutdown()
        logger.info('Application shutdown complete')
        process.exit(0)
      } catch (error) {
        logger.error('Error during shutdown:', error)
        process.exit(1)
      }
    })
    .catch((error) => {
      logger.error('Error closing servers:', error)
      process.exit(1)
    })
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))

import Bottleneck from 'bottleneck'
import https from 'https'
import mime from 'mime-types'
import path from 'path'
import { URL } from 'url'
import { drive_v3 } from 'googleapis'

import { FileData, UploadProgress, UploadResult, FileError } from './models.ts'
import { getDrive } from './auth.ts'
import { saveFile, getFileIds } from './db.ts'
import { logger } from './constants.ts'

const MAX_FILE_SIZE = 5120 * 1024 * 1024 * 1024 // 5,120 GB in bytes

const userLimiters = new Map<string, Bottleneck>()

function getUserLimiter(googleId: string): Bottleneck {
  if (!userLimiters.has(googleId)) {
    const limiter = new Bottleneck({
      reservoir: 150,
      reservoirRefreshAmount: 150,
      reservoirRefreshInterval: 1000,
      retryDelay: (retryCount: number) =>
        Math.min(1000 * 2 ** retryCount, 30000),
    })
    limiter.on(
      'failed',
      async (
        error: Error & { statusCode?: number },
        jobInfo: Bottleneck.EventInfoRetryable,
      ) => {
        if (error?.statusCode === 429 && jobInfo.retryCount < 5) {
          logger.warn(
            `429 on job ${jobInfo.options.id}, retry #${jobInfo.retryCount + 1}`,
          )
          return 0
        }
        return -1
      },
    )
    userLimiters.set(googleId, limiter)
  }
  return userLimiters.get(googleId)!
}

async function getFileFromUrl(url: string, timeout = 30000): Promise<FileData> {
  logger.info(`Fetching file from URL: ${url}`)
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i
    if (!urlRegex.test(url)) {
      const error = new Error(`Invalid URL format: ${url}`)
      logger.error(error)
      reject(error)
      return
    }
    const fileName = path.basename(parsed.pathname) || `unknown_${Date.now()}`
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`))
        return
      }
      const len = res.headers['content-length']
      const fileSize = len ? parseInt(len, 10) : null
      if (fileSize && fileSize > MAX_FILE_SIZE) {
        const error = new Error(
          `File size ${fileSize} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`,
        )
        logger.error(error)
        reject(error)
        return
      }
      resolve({ stream: res, fileName, fileSize })
    })
    req.on('error', (error) => {
      logger.error(`Error fetching file from URL ${url}: ${error.message}`)
      reject(error)
    })
    req.setTimeout(timeout, () => {
      req.destroy()
      const timeoutError = new Error(`Download timed out after ${timeout}ms`)
      logger.error(timeoutError.message)
      reject(timeoutError)
    })
  })
}

async function uploadFileToDrive(
  googleId: string,
  { stream, fileName, fileSize }: FileData,
): Promise<{ data: drive_v3.Schema$File }> {
  logger.info(`Uploading file ${fileName} for user ${googleId}`)
  const drive = getDrive()
  const mimeType = mime.lookup(fileName) || 'application/octet-stream'
  logger.info(`Uploading file ${fileName} with MIME type ${mimeType}`)
  const limiter = getUserLimiter(googleId)
  return limiter.schedule(() =>
    drive.files.create(
      {
        requestBody: { name: fileName },
        media: {
          mimeType,
          body: stream,
        },
        fields:
          'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
      },
      {
        onUploadProgress: (progressEvent: UploadProgress) => {
          if (fileSize) {
            const percentComplete = (progressEvent.bytesRead / fileSize) * 100
            logger.info(`Uploading ${fileName}: ${percentComplete.toFixed(1)}%`)
            if (percentComplete >= 100)
              logger.info(`${fileName} upload complete!`)
          }
        },
      },
    ),
  )
}

async function getAllFiles(googleId: string): Promise<drive_v3.Schema$File[]> {
  const drive = getDrive()
  const limiter = getUserLimiter(googleId)
  const response = await limiter.schedule(() =>
    drive.files.list({
      q: "'me' in owners and trashed = false",
      fields:
        'files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime)',
    }),
  )
  return response.data.files || []
}

async function uploadFiles(
  googleId: string,
  urls: string[],
): Promise<UploadResult[]> {
  logger.info(`Uploading multiple files for user ${googleId}`)
  return Promise.all(
    urls.map(async (url: string) => {
      try {
        const fileData = await getFileFromUrl(url)
        const response = await uploadFileToDrive(googleId, fileData)
        await saveFile(googleId, response.data.id!)
        logger.info(
          `File ${response.data.name} uploaded successfully for user ${googleId}`,
        )
        return {
          url,
          status: 'success',
          fileId: response.data.id!,
          fileName: response.data.name!,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        logger.error(`Error uploading file from URL ${url}: ${errorMessage}`)
        return { url, status: 'error', error: errorMessage }
      }
    }),
  )
}

async function getUploadedFiles(
  googleId: string,
): Promise<(drive_v3.Schema$File | FileError)[]> {
  logger.info(`Fetching uploaded files for user ${googleId}`)
  const fileIds = await getFileIds(googleId)
  if (!fileIds || fileIds.length === 0) {
    return []
  }
  const drive = getDrive()
  const limiter = getUserLimiter(googleId)
  return Promise.all(
    fileIds.map(async ({ file_id }) => {
      try {
        const response = await limiter.schedule(() =>
          drive.files.get({
            fileId: file_id,
            fields:
              'id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime',
          }),
        )
        return response.data
      } catch (err) {
        const error = err as Error & { code?: number }
        logger.error(
          `Error getting file ${file_id}: ${error.message} (code: ${error.code})`,
        )
        return {
          id: file_id,
          error: error.message || 'Unknown error',
        } as FileError
      }
    }),
  )
}

export {
  getFileFromUrl,
  uploadFileToDrive,
  getAllFiles,
  uploadFiles,
  getUploadedFiles,
}

import Bottleneck from 'bottleneck'
import https from 'https'
import mime from 'mime-types'
import path from 'path'
import { URL } from 'url'
import { format as formatDate } from 'date-fns'
import { StatusCodes } from 'http-status-codes'
import { drive_v3 } from 'googleapis'

import {
  FileStream,
  UploadProgress,
  FileUploadResult,
  FileError,
  FileData,
} from './models.ts'
import { saveFile, getFileIds } from './db.ts'
import { logger } from './constants.ts'
import { getDriveAPI } from './auth.ts'

const MAX_FILE_SIZE = 5120 * 1024 * 1024 * 1024 // 5,120 GB in bytes
const FIELDS = [
  'id',
  'name',
  'mimeType',
  'size',
  'webViewLink',
  'webContentLink',
  'createdTime',
  'modifiedTime',
].join(',')

const userLimiters = new Map<string, Bottleneck>()

function getUserLimiter(googleId: string): Bottleneck {
  if (!userLimiters.has(googleId)) {
    const limiter = new Bottleneck({
      reservoir: 150,
      reservoirRefreshAmount: 150,
      reservoirRefreshInterval: 1000,
      retryDelay: (retryCount: number) =>
        Math.min(1000 * 2 ** retryCount, 30_000),
    })
    limiter.on(
      'failed',
      async (
        error: Error & { statusCode?: number },
        jobInfo: Bottleneck.EventInfoRetryable,
      ) => {
        if (
          error?.statusCode === StatusCodes.TOO_MANY_REQUESTS &&
          jobInfo.retryCount < 5
        ) {
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

export async function getFileFromUrl(
  url: string,
  timeout = 30_000,
): Promise<FileStream> {
  logger.info(`Fetching file from URL: ${url}`)
  return new Promise((resolve, reject) => {
    let parsedUrl
    try {
      parsedUrl = new URL(url)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      const error = new Error(`Invalid URL format: ${url} - ${errorMessage}`)
      logger.error(error)
      reject(error)
      return
    }
    const fileName =
      path.basename(parsedUrl.pathname) || `unknown_${Date.now()}`
    const req = https.get(url, (res) => {
      if (res.statusCode !== StatusCodes.OK) {
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

export async function uploadFileToDrive(
  drive: drive_v3.Drive,
  limiter: Bottleneck,
  { stream, fileName, fileSize }: FileStream,
): Promise<{ data: FileData }> {
  const mimeType = mime.lookup(fileName) || 'application/octet-stream'
  logger.info(`Uploading file ${fileName} with MIME type ${mimeType}`)
  return limiter.schedule(() =>
    drive.files.create(
      {
        requestBody: { name: fileName },
        media: {
          mimeType,
          body: stream,
        },
        fields: FIELDS,
      },
      {
        onUploadProgress: (progressEvent: UploadProgress) => {
          if (fileSize) {
            const percentComplete = (progressEvent.bytesRead / fileSize) * 100
            logger.debug(
              `Uploading ${fileName}: ${percentComplete.toFixed(1)}%`,
            )
            if (percentComplete >= 100)
              logger.info(`${fileName} upload complete!`)
          }
        },
      },
    ),
  )
}

export async function getAllFiles(googleId: string): Promise<FileData[]> {
  logger.info(`Fetching all files, Google ID: ${googleId}`)
  const drive = getDriveAPI(googleId)
  const limiter = getUserLimiter(googleId)
  const response = await limiter.schedule(() =>
    drive.files.list({
      q: "'me' in owners and trashed = false",
      fields: `files(${FIELDS})`,
    }),
  )
  return response.data.files || []
}

export async function uploadFiles(
  googleId: string,
  urls: string[],
): Promise<FileUploadResult[]> {
  logger.info(`Uploading multiple files, Google ID: ${googleId}`)
  const drive = getDriveAPI(googleId)
  const limiter = getUserLimiter(googleId)
  return Promise.all(
    urls.map(async (url: string) => {
      try {
        const fileData = await getFileFromUrl(url)
        const response = await uploadFileToDrive(drive, limiter, fileData)
        await saveFile(googleId, response.data.id!)
        logger.info(
          `File ${response.data.name} uploaded successfully, Google ID: ${googleId}`,
        )
        return {
          url,
          status: 'success',
          name: response.data.name!,
          mimeType: response.data.mimeType!,
          size:
            response.data.size ?
              formatFileSize(parseInt(<string>response.data.size, 10))
            : 'Unknown',
          webViewLink: response.data.webViewLink!,
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

export async function getUploadedFiles(
  googleId: string,
): Promise<(FileData | FileError)[]> {
  logger.info(`Fetching uploaded files, Google ID: ${googleId}`)
  const fileIds = await getFileIds(googleId)
  if (!fileIds || fileIds.length === 0) {
    return []
  }
  const drive = getDriveAPI(googleId)
  const limiter = getUserLimiter(googleId)
  return Promise.all(
    fileIds.map(async ({ file_id }) => {
      try {
        const response = await limiter.schedule(() =>
          drive.files
            .get({
              fileId: file_id,
              fields: FIELDS,
            })
            .catch((error) => {
              if (error.code === StatusCodes.NOT_FOUND) {
                throw new Error(
                  `File with ID ${file_id} not found on Google Drive`,
                )
              }
              throw error
            }),
        )
        const file = response.data
        const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss'
        return {
          ...file,
          size: file.size ? formatFileSize(parseInt(file.size, 10)) : 'Unknown',
          createdTime:
            file.createdTime ?
              formatDate(new Date(file.createdTime), DATE_FORMAT)
            : 'Unknown',
          modifiedTime:
            file.modifiedTime ?
              formatDate(new Date(file.modifiedTime), DATE_FORMAT)
            : 'Unknown',
        }
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

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  while (bytes >= 1024 && index < units.length - 1) {
    bytes /= 1024
    index++
  }
  return `${bytes.toFixed(2)} ${units[index]}`
}

import { IncomingMessage } from 'http'
import { drive_v3 } from 'googleapis'

interface User {
  googleId: string
  email: string
}

interface FileData {
  stream: IncomingMessage
  fileName: string
  fileSize: number | null
}

interface UploadProgress {
  bytesRead: number
}

interface UploadResult {
  url: string
  status: 'success' | 'error'
  fileId?: string
  fileName?: string
  error?: string
}

interface FileError extends drive_v3.Schema$File {
  error: string
}

export type { User, FileData, UploadProgress, UploadResult, FileError }

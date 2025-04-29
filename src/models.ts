import { IncomingMessage } from 'http'

interface User {
  googleId: string
  email: string
}

interface FileStream {
  stream: IncomingMessage
  fileName: string
  fileSize: number | null
}

interface UploadProgress {
  bytesRead: number
}

interface FileData {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  size?: string | number | null
  webViewLink?: string | null
  webContentLink?: string | null
  createdTime?: string | null
  modifiedTime?: string | null
}

interface FileUploadResult extends FileData {
  url: string
  status: 'success' | 'error'
  error?: string
}

interface FileError extends FileData {
  error: string
}

export type {
  User,
  FileStream,
  UploadProgress,
  FileData,
  FileUploadResult,
  FileError,
}

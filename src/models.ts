import { IncomingMessage } from 'http'

export interface User {
  googleId: string
  email: string
}

export interface FileStream {
  stream: IncomingMessage
  fileName: string
  fileSize: number | null
}

export interface UploadProgress {
  bytesRead: number
}

export interface FileData {
  id?: string | null
  name?: string | null
  mimeType?: string | null
  size?: string | number | null
  webViewLink?: string | null
  webContentLink?: string | null
  createdTime?: string | null
  modifiedTime?: string | null
}

export interface FileUploadResult extends FileData {
  url: string
  status: 'success' | 'error'
  error?: string
}

export interface FileError extends FileData {
  error: string
}

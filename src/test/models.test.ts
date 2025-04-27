import { IncomingMessage } from 'http'

import { User, FileData, UploadResult, FileError } from '../models.ts'

describe('models module', () => {
  it('should validate User interface structure', () => {
    const user: User = {
      googleId: '12345',
      email: 'test@example.com',
    }

    expect(user.googleId).toBe('12345')
    expect(user.email).toBe('test@example.com')
  })

  it('should validate FileData interface structure', () => {
    const fileData: FileData = {
      stream: {} as IncomingMessage,
      fileName: 'example.txt',
      fileSize: 1024,
    }

    expect(fileData.fileName).toBe('example.txt')
    expect(fileData.fileSize).toBe(1024)
  })

  it('should validate UploadResult interface structure', () => {
    const uploadResult: UploadResult = {
      url: 'http://example.com/file',
      status: 'success',
      fileId: 'file123',
      fileName: 'example.txt',
    }

    expect(uploadResult.url).toBe('http://example.com/file')
    expect(uploadResult.status).toBe('success')
    expect(uploadResult.fileId).toBe('file123')
  })

  it('should validate FileError interface structure', () => {
    const fileError: FileError = {
      error: 'File not found',
      id: 'file123',
      name: 'example.txt',
    }

    expect(fileError.error).toBe('File not found')
    expect(fileError.id).toBe('file123')
    expect(fileError.name).toBe('example.txt')
  })
})

import { IncomingMessage } from 'http'

import {
  getFileFromUrl,
  uploadFileToDrive,
  getAllFiles,
  uploadFiles,
  getUploadedFiles,
} from '../handler.ts'

jest.mock('../auth', () => ({
  getDriveAPI: jest.fn().mockReturnValue({
    files: {
      list: jest.fn().mockResolvedValue({
        data: {
          files: [
            { id: 'mockFileId1', name: 'file1.txt' },
            { id: 'mockFileId2', name: 'file2.txt' },
          ],
        },
      }),
      create: jest.fn().mockResolvedValue({
        data: { id: 'mockFileId', name: 'mockFileName' },
      }),
      get: jest.fn().mockResolvedValue({
        data: { id: 'mockFileId', name: 'mockFileName' },
      }),
    },
  }),
}))

jest.mock('../db', () => ({
  saveFile: jest.fn().mockResolvedValue({ file_id: 'mockFileId' }),
  getFileIds: jest.fn().mockResolvedValue([{ file_id: 'mockFileId' }]),
}))

jest.mock('https', () => ({
  get: jest.fn((_, callback) => {
    if (typeof callback === 'function') {
      const res = {
        statusCode: 200,
        headers: { 'content-length': '1024' },
        on: jest.fn((event, listener) => {
          if (event === 'data') {
            listener(Buffer.from('mock file content'))
          } else if (event === 'end') {
            listener()
          }
        }),
      }
      callback(res)
    }
    return { on: jest.fn(), setTimeout: jest.fn(), destroy: jest.fn() }
  }),
}))

jest.mock('bottleneck', () =>
  jest.fn(() => ({
    on: jest.fn(),
    schedule: jest.fn((fn) => fn()),
  })),
)

describe('handler module', () => {
  it('should get a file from a URL', async () => {
    const mockUrl = 'https://example.com/mockfile.txt'
    const fileData = await getFileFromUrl(mockUrl)
    expect(fileData.fileName).toBe('mockfile.txt')
  })

  it('should upload a file to Google Drive', async () => {
    const fileData = {
      stream: {} as IncomingMessage,
      fileName: 'mockfile.txt',
      fileSize: 1024,
    }
    const mockDrive = {
      files: {
        create: jest.fn(() => ({
          data: { id: 'mockFileId', name: 'mockFileName' },
        })),
      },
    } as any
    const mockLimiter = {
      schedule: jest.fn((fn) => fn()),
    } as any

    const response = await uploadFileToDrive(mockDrive, mockLimiter, fileData)
    expect(response.data.id).toBe('mockFileId')
  })

  it('should get all files from Google Drive', async () => {
    const files = await getAllFiles('mockGoogleId')
    expect(files).toHaveLength(2)
    expect(files[0]!.id).toBe('mockFileId1')
  })

  it('should upload multiple files', async () => {
    const urls = [
      'https://example.com/file1.txt',
      'https://example.com/file2.txt',
    ]
    const results = await uploadFiles('mockGoogleId', urls)
    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      name: 'mockFileName',
      status: 'success',
      url: 'https://example.com/file1.txt',
      size: 'Unknown',
      mimeType: undefined,
      webViewLink: undefined,
    })
  })

  it('should get uploaded files', async () => {
    const files = await getUploadedFiles('mockGoogleId')
    expect(files).toHaveLength(1)
    expect(files[0]!.id).toBe('mockFileId')
  })
})

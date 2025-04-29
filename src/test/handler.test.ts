import { IncomingMessage } from 'http'

import {
  getFileFromUrl,
  uploadFileToDrive,
  getAllFiles,
  uploadFiles,
  getUploadedFiles,
} from '../handler.ts'

jest.mock('../auth', () => ({
  getDrive: jest.fn(() => ({
    files: {
      create: jest.fn(() => ({
        data: { id: 'mockFileId', name: 'mockFileName' },
      })),
      list: jest.fn(() => ({
        data: { files: [{ id: 'mockFileId', name: 'mockFileName' }] },
      })),
      get: jest.fn(() =>
        Promise.resolve({
          data: {
            id: 'mockFileId',
            name: 'mockFileName',
            size: '1.00 B',
            createdTime: '2023-01-01 02:00:00',
            modifiedTime: '2023-01-02 02:00:00',
          },
        }),
      ),
    },
  })),
}))

jest.mock('../db', () => ({
  saveFile: jest.fn(),
  getFileIds: jest.fn(() => [{ file_id: 'mockFileId' }]),
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
    const response = await uploadFileToDrive('mockGoogleId', fileData)
    expect(response.data.id).toBe('mockFileId')
  })

  it('should get all files from Google Drive', async () => {
    const files = await getAllFiles('mockGoogleId')
    expect(files).toEqual([{ id: 'mockFileId', name: 'mockFileName' }])
  })

  it('should upload multiple files', async () => {
    const urls = [
      'https://example.com/mockfile1.txt',
      'https://example.com/mockfile2.txt',
    ]
    const results = await uploadFiles('mockGoogleId', urls)
    expect(results).toEqual([
      {
        url: 'https://example.com/mockfile1.txt',
        status: 'success',
        name: 'mockFileName',
        mimeType: undefined,
        size: 'Unknown',
        webViewLink: undefined,
      },
      {
        url: 'https://example.com/mockfile2.txt',
        status: 'success',
        name: 'mockFileName',
        mimeType: undefined,
        size: 'Unknown',
        webViewLink: undefined,
      },
    ])
  })

  it('should get uploaded files', async () => {
    const files = await getUploadedFiles('mockGoogleId')
    expect(files).toEqual([
      {
        id: 'mockFileId',
        name: 'mockFileName',
        size: '1.00 B',
        createdTime: '2023-01-01 02:00:00',
        modifiedTime: '2023-01-02 02:00:00',
      },
    ])
  })
})

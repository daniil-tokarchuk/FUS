import request from 'supertest'
import http from 'http'

jest.mock('../index.ts', () => {
  const express = require('express')
  const app = express()

  app.get('/', (_: any, res: any) => res.status(200).send('Welcome'))
  app.get('/auth/google/callback', (_: any, res: any) => res.redirect('/'))
  app.post('/upload-files', (_: any, res: any) =>
    res.status(200).json({
      results: [
        {
          url: 'https://example.com/mockfile.txt',
          status: 'success',
          fileId: 'mockFileId',
          fileName: 'mockFileName',
        },
      ],
    }),
  )
  app.get('/get-uploaded-files', (_: any, res: any) =>
    res
      .status(200)
      .json({ files: [{ id: 'mockFileId', name: 'mockFileName' }] }),
  )
  app.get('/get-all-files', (_: any, res: any) =>
    res
      .status(200)
      .json({ files: [{ id: 'mockFileId', name: 'mockFileName' }] }),
  )

  return app
})

jest.mock('../auth.ts', () => ({
  checkAuth: jest.fn((_req: any, _res: any, next: any) => next()),
  handleAuthCallback: jest.fn((_: any, res: any) => res.redirect('/')),
}))

jest.mock('../handler.ts', () => ({
  uploadFiles: jest.fn(() => [
    {
      url: 'mockUrl',
      status: 'success',
      fileId: 'mockFileId',
      fileName: 'mockFileName',
    },
  ]),
  getUploadedFiles: jest.fn(() => [{ id: 'mockFileId', name: 'mockFileName' }]),
  getAllFiles: jest.fn(() => [{ id: 'mockFileId', name: 'mockFileName' }]),
}))

let server: http.Server

beforeAll((done) => {
  const app = require('../index.ts')
  server = http.createServer(app)
  server.listen(() => {
    console.log('Test server started')
    done()
  })
})

afterAll((done) => {
  server.close(() => {
    console.log('Test server closed')
    done()
  })
})

describe('index.ts routes', () => {
  it('should return a welcome message on GET /', async () => {
    const response = await request(server).get('/')
    expect(response.status).toBe(200)
    expect(response.text).toContain('Welcome')
  }, 10000)

  it('should handle Google auth callback on GET /auth/google/callback', async () => {
    const response = await request(server).get('/auth/google/callback')
    expect(response.status).toBe(302)
    expect(response.header.location).toBe('/')
  }, 10000)

  it('should upload files on POST /upload-files', async () => {
    const response = await request(server)
      .post('/upload-files')
      .send({ urls: ['https://example.com/mockfile.txt'] })
    expect(response.status).toBe(200)
    expect(response.body.results).toEqual([
      {
        url: 'https://example.com/mockfile.txt',
        status: 'success',
        fileId: 'mockFileId',
        fileName: 'mockFileName',
      },
    ])
  }, 10000)

  it('should get uploaded files on GET /get-uploaded-files', async () => {
    const response = await request(server).get('/get-uploaded-files')
    expect(response.status).toBe(200)
    expect(response.body.files).toEqual([
      { id: 'mockFileId', name: 'mockFileName' },
    ])
  }, 10000)

  it('should get all files on GET /get-all-files', async () => {
    const response = await request(server).get('/get-all-files')
    expect(response.status).toBe(200)
    expect(response.body.files).toEqual([
      { id: 'mockFileId', name: 'mockFileName' },
    ])
  }, 10000)
})

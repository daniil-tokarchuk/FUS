import { Pool } from 'pg'

import {
  saveUser,
  saveCredentials,
  getUser,
  getCredentials,
  saveFile,
  getFileIds,
} from '../db.ts'

jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn().mockImplementation((query) => {
      if (query.includes('SELECT google_id, email')) {
        return Promise.resolve({
          rows: [{ google_id: 'mockGoogleId', email: 'mockEmail' }],
        })
      }
      if (query.includes('SELECT access_token')) {
        return Promise.resolve({ rows: [{ access_token: 'mockAccessToken' }] })
      }
      if (query.includes('SELECT file_id')) {
        return Promise.resolve({ rows: [{ file_id: 'mockFileId' }] })
      }
      return Promise.resolve({ rows: [] })
    }),
    release: jest.fn(),
  }
  return {
    Pool: jest.fn(() => ({
      connect: jest.fn(() => mockClient),
      end: jest.fn(),
    })),
  }
})

describe('db module', () => {
  let pool: jest.Mocked<Pool>

  beforeEach(() => {
    pool = new Pool() as jest.Mocked<Pool>
    jest.spyOn(pool, 'connect')
  })

  it('should save a user', async () => {
    const mockClient = await pool.connect()
    await saveUser('mockGoogleId', 'mockEmail')
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      ['mockGoogleId', 'mockEmail'],
    )
  })

  it('should save credentials', async () => {
    const mockClient = await pool.connect()
    await saveCredentials('mockGoogleId', { access_token: 'mockAccessToken' })
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tokens'),
      expect.arrayContaining(['mockGoogleId', 'mockAccessToken']),
    )
  })

  it('should get a user', async () => {
    await pool.connect()
    const user = await getUser('mockGoogleId')
    expect(user).toEqual({ google_id: 'mockGoogleId', email: 'mockEmail' })
  })

  it('should get credentials', async () => {
    await pool.connect()
    const credentials = await getCredentials('mockGoogleId')
    expect(credentials).toEqual({ access_token: 'mockAccessToken' })
  })

  it('should save a file', async () => {
    const mockClient = await pool.connect()
    await saveFile('mockGoogleId', 'mockFileId')
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO files'),
      ['mockGoogleId', 'mockFileId'],
    )
  })

  it('should get file IDs', async () => {
    await pool.connect()
    const fileIds = await getFileIds('mockGoogleId')
    expect(fileIds).toEqual([{ file_id: 'mockFileId' }])
  })
})

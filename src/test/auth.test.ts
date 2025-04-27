import { getAuthUrl, getDrive, checkAuth, handleAuthCallback } from '../auth.ts'
import { Request, Response, NextFunction } from 'express'

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn(() => 'mockAuthUrl'),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn(() => ({
          credentials: { access_token: 'mockAccessToken' },
        })),
        getToken: jest.fn(() => ({
          tokens: { access_token: 'mockAccessToken' },
        })),
      })),
    },
    drive: jest.fn(() => ({ files: { create: jest.fn(), list: jest.fn() } })),
    oauth2: jest.fn(() => ({
      userinfo: {
        get: jest.fn(() => ({ data: { id: 'mockId', email: 'mockEmail' } })),
      },
    })),
  },
}))

jest.mock('../db.ts', () => ({
  saveUser: jest.fn(),
  saveCredentials: jest.fn(),
  getUser: jest.fn(() => ({ google_id: 'mockGoogleId', email: 'mockEmail' })),
  getCredentials: jest.fn(() => ({ access_token: 'mockAccessToken' })),
}))

describe('auth module', () => {
  it('should generate an auth URL', () => {
    const url = getAuthUrl()
    expect(url).toBe('mockAuthUrl')
  })

  it('should return a Google Drive instance', () => {
    const drive = getDrive()
    expect(drive).toBeDefined()
  })

  it('should handle auth callback and save user session', async () => {
    const req = {
      query: { code: 'mockCode' },
      session: { save: jest.fn((cb) => cb(null)) },
    } as unknown as Request
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as unknown as Response

    await handleAuthCallback(req, res)

    expect(req.session.save).toHaveBeenCalled()
    expect(res.redirect).toHaveBeenCalledWith('/')
  })

  it('should redirect to auth URL if session user is missing', async () => {
    const req = { session: {} } as unknown as Request
    const res = { redirect: jest.fn() } as unknown as Response
    const next = jest.fn() as NextFunction

    await checkAuth(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith('mockAuthUrl')
  })
})

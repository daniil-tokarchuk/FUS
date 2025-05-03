var mockOAuth2Instance: any

jest.mock('googleapis', () => {
  mockOAuth2Instance = {
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn().mockResolvedValue({
      credentials: {
        access_token: 'newAccessToken',
        expiry_date: Date.now() + 3600 * 1000,
      },
    }),
    getToken: jest.fn().mockResolvedValue({
      tokens: {
        access_token: 'mockAccessToken',
        refresh_token: 'mockRefreshToken',
      },
    }),
    generateAuthUrl: jest.fn().mockReturnValue('https://mock-auth-url'),
    credentials: { refresh_token: 'mockRefreshToken' },
  }

  return {
    google: {
      auth: {
        OAuth2: jest.fn(() => mockOAuth2Instance),
      },
      oauth2: jest.fn(() => ({
        userinfo: {
          get: jest.fn().mockResolvedValue({
            data: { id: 'mockId', email: 'mockEmail' },
          }),
        },
      })),
      drive: jest.fn(),
    },
  }
})

import { Request, Response } from 'express'
import { checkAuth, handleAuthCallback } from '../auth.ts'
import { StatusCodes } from 'http-status-codes'

jest.mock('../db.ts', () => ({
  saveUser: jest.fn(),
  saveCredentials: jest.fn(),
  getCredentials: jest.fn().mockResolvedValue({
    refresh_token: 'mockRefreshToken',
    access_token: 'mockAccessToken',
  }),
}))

describe('auth module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleAuthCallback', () => {
    it('should process successful authentication and save session', async () => {
      const req = {
        query: { code: 'validCode' },
        session: { save: jest.fn((cb) => cb(null)) },
      } as unknown as Request
      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response

      await handleAuthCallback(req, res)

      expect(mockOAuth2Instance.getToken).toHaveBeenCalledWith('validCode')
      expect(req.session.user).toEqual(
        expect.objectContaining({
          googleId: 'mockId',
          email: 'mockEmail',
        }),
      )
      expect(res.redirect).toHaveBeenCalledWith('/')
    })

    it('should handle missing authorization code', async () => {
      const req = {
        query: {},
        session: {},
      } as unknown as Request
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response

      await handleAuthCallback(req, res)

      expect(res.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST)
      expect(res.send).toHaveBeenCalledWith('Authorization code is required')
    })
  })

  describe('checkAuth', () => {
    it('should proceed if session is valid and not expired', async () => {
      const req = {
        session: {
          user: {
            googleId: 'mockId',
            expiry_date: Date.now() + 3600000,
          },
        },
      } as unknown as Request
      const res = {} as unknown as Response
      const next = jest.fn()

      await checkAuth(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('should refresh token if expired', async () => {
      const req = {
        session: {
          user: {
            googleId: 'mockId',
            expiry_date: Date.now() - 1000,
          },
          save: jest.fn((cb) => cb(null)),
        },
      } as unknown as Request

      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response

      const next = jest.fn()

      await checkAuth(req, res, next)

      expect(mockOAuth2Instance.refreshAccessToken).toHaveBeenCalled()
      expect(req.session.save).toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    it('should redirect to auth if no session user exists', async () => {
      const req = {
        session: {},
      } as unknown as Request
      const res = {
        redirect: jest.fn(),
      } as unknown as Response
      const next = jest.fn()

      await checkAuth(req, res, next)

      expect(res.redirect).toHaveBeenCalledWith('https://mock-auth-url')
      expect(next).not.toHaveBeenCalled()
    })
  })
})

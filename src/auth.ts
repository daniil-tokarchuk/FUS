import { google } from 'googleapis'
import { Request, Response, NextFunction } from 'express'

import { logger } from './constants.ts'
import { saveUser, saveCredentials, getUser, getCredentials } from './db.ts'

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI,
)

function getAuthUrl(needsRefreshToken: boolean = false): string {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    ...(needsRefreshToken ? { prompt: 'consent' } : {}),
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })
  logger.info(`Generated auth URL: ${authUrl}`)
  return authUrl
}

function getDrive() {
  return google.drive({ version: 'v3', auth: oauth2Client })
}

async function checkAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  logger.info(`Checking authentication for user session`)
  const sessionUser = req.session.user

  if (!sessionUser) {
    logger.warn('No session user found, redirecting to auth URL')
    return res.redirect(getAuthUrl(true))
  }

  const now = Date.now()

  if (sessionUser.access_token && sessionUser.expiry_date) {
    if (sessionUser.expiry_date >= now) {
      oauth2Client.setCredentials({
        access_token: sessionUser.access_token,
        refresh_token: sessionUser.refresh_token || '',
        expiry_date: sessionUser.expiry_date,
      })
      return next()
    }

    if (sessionUser.refresh_token) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        await saveCredentials(sessionUser.googleId, credentials)

        req.session.user = {
          ...sessionUser,
          access_token: credentials.access_token || '',
          refresh_token: credentials.refresh_token || sessionUser.refresh_token,
          expiry_date: credentials.expiry_date || Date.now() + 3_600_000,
        }

        oauth2Client.setCredentials(credentials)
        return next()
      } catch (error) {
        logger.error('Error refreshing credentials:', error)
        return res.redirect(getAuthUrl(true))
      }
    }
  }

  const user = await getUser(sessionUser.googleId)
  const credentials = await getCredentials(sessionUser.googleId)

  if (!user || !credentials) {
    return res.redirect(getAuthUrl(true))
  }

  const needsRefreshToken = !credentials.refresh_token
  if (needsRefreshToken) {
    return res.redirect(getAuthUrl(true))
  }

  oauth2Client.setCredentials(credentials)
  req.session.user = { ...user, ...credentials }
  return next()
}

async function handleAuthCallback(
  req: Request,
  res: Response,
): Promise<Response | void> {
  logger.info('Handling auth callback')
  try {
    const { code } = req.query
    if (!code || typeof code !== 'string') {
      return res.status(400).send('Authorization code is required')
    }

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userinfo = await oauth2.userinfo.get()
    const { id, email } = userinfo.data

    if (!id || !email) {
      const error = new Error('Missing user info')
      logger.error(error)
      throw error
    }

    logger.info(`User authenticated: ${id} (${email})`)

    await saveUser(id, email)
    await saveCredentials(id, tokens)

    req.session.user = {
      googleId: id,
      email,
      access_token: tokens.access_token || '',
      refresh_token: tokens.refresh_token || '',
      expiry_date: tokens.expiry_date || Date.now() + 3_600_000,
    }

    req.session.save((err: Error | null) => {
      if (err) {
        logger.error('Session save error:', err)
        return res.status(500).send('Session error')
      }
      res.redirect('/')
    })
  } catch (error) {
    logger.error('Auth callback error:', error)
    return res.status(500).send('Authentication failed. Please try again.')
  }
}

export { getAuthUrl, getDrive, checkAuth, handleAuthCallback }

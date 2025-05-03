import { google } from 'googleapis'
import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { Credentials, OAuth2Client } from 'google-auth-library'

import { logger } from './constants.ts'
import { saveUser, saveCredentials, getCredentials } from './db.ts'

const clients = new Map<string, OAuth2Client>()
const OAUTH2_CLIENT = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.NODE_ENV === 'dev' ?
    process.env.DEV_REDIRECT_URI
  : process.env.REDIRECT_URI,
)

export async function checkAuth(
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

  if (sessionUser.expiry_date && Date.now() <= sessionUser.expiry_date) {
    return next()
  }

  let client = getOAuth2Client(sessionUser.googleId)
  if (!client) {
    logger.warn(`No client in clients map, Google ID: ${sessionUser.googleId}`)
    logger.info(
      `Fetching credentials from database, Google ID: ${sessionUser.googleId}`,
    )
    const credentials = await getCredentials(sessionUser.googleId)
    if (!credentials) {
      logger.warn(
        `No credentials found in database, redirecting to auth URL, Google ID: ${sessionUser.googleId}`,
      )
      return res.redirect(getAuthUrl(true))
    }
    client = createOAuth2Client(credentials)
  }

  let tokenResponse
  try {
    tokenResponse = await client.refreshAccessToken()
  } catch (error) {
    logger.error(
      `Error refreshing access token, Google ID: ${sessionUser.googleId}`,
      error,
    )
    return res.redirect(getAuthUrl(true))
  }
  const { credentials } = tokenResponse

  client.setCredentials({
    refresh_token: client.credentials.refresh_token!,
    ...credentials,
  })

  clients.set(sessionUser.googleId, client)
  await saveCredentials(sessionUser.googleId, credentials)

  req.session.user = {
    ...sessionUser,
    ...credentials,
  }

  req.session.save((error) => {
    if (error) {
      logger.error('Session save error:', error)
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Session error')
    }
    return next()
  })
}

export async function handleAuthCallback(
  req: Request,
  res: Response,
): Promise<Response | void> {
  logger.info('Received google auth callback')
  const { code } = req.query
  if (!code) {
    logger.error('No authorization code provided')
    return res
      .status(StatusCodes.BAD_REQUEST)
      .send('Authorization code is required')
  }

  let tokenResponse
  try {
    tokenResponse = await OAUTH2_CLIENT.getToken(<string>code)
  } catch (error) {
    logger.error(`Cannot get tokens for code: ${code}`, error)
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send('Authentication failed. Please try again.')
  }

  const client = createOAuth2Client(tokenResponse.tokens)
  const userApi = google.oauth2({ version: 'v2', auth: client })
  let userInfo
  try {
    userInfo = await userApi.userinfo.get()
  } catch (error) {
    logger.error('Error fetching user info:', error)
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send('Authentication failed. Please try again.')
  }

  const { id: googleId, email } = userInfo.data
  if (!googleId || !email) {
    logger.error('No Google ID or email found in user info')
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send('Authentication failed. Please try again.')
  }
  logger.info(`User authenticated: ${googleId} (${email})`)

  clients.set(googleId, client)

  await saveUser(googleId, email)
  await saveCredentials(googleId, client.credentials)

  req.session.user = {
    googleId,
    email,
    ...client.credentials,
  }

  req.session.save((error) => {
    if (error) {
      logger.error('Session save error:', error)
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).send('Session error')
    }
    res.redirect('/')
  })
}

export function getDriveAPI(googleId: string) {
  const client = getOAuth2Client(googleId)
  if (!client) {
    logger.error(`No OAuth2 client found, Google ID: ${googleId}`)
    throw new Error('No OAuth2 client found')
  }
  return google.drive({ version: 'v3', auth: client })
}

function getAuthUrl(consent: boolean = false): string {
  const authUrl = OAUTH2_CLIENT.generateAuthUrl({
    access_type: 'offline',
    ...(consent ? { prompt: 'consent' } : {}),
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })
  logger.info(`Generated auth URL: ${authUrl}`)
  return authUrl
}

function createOAuth2Client(credentials: Credentials): OAuth2Client {
  const client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.NODE_ENV === 'dev' ?
      process.env.DEV_REDIRECT_URI
    : process.env.REDIRECT_URI,
  )
  client.setCredentials(credentials)
  return client
}

function getOAuth2Client(googleId: string): OAuth2Client | null {
  if (clients.has(googleId)) {
    return clients.get(googleId)!
  }
  return null
}

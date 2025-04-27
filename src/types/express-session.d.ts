import 'express-session'
import { Credentials } from 'google-auth-library'

declare module 'express-session' {
  interface SessionData {
    user?: {
      googleId: string
      email: string
    } & Credentials
  }
}

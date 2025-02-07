import express, { Request, Response, RequestHandler } from 'express';
import session from 'express-session';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Extend session to include custom properties
declare module 'express-session' {
  interface SessionData {
    code_verifier?: string;
    state?: string;
    access_token?: string;
  }
}

// Use express-session middleware to store session data
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret', // Replace with a strong secret
    resave: false,
    saveUninitialized: true,
  })
);

// Configuration (set these in your environment or replace with actual values)
const CLIENT_ID = process.env.TWITTER_CLIENT_ID || 'YOUR_CLIENT_ID';
const REDIRECT_URI = process.env.TWITTER_REDIRECT_URI || 'http://localhost:3000/callback';
const AUTHORIZATION_ENDPOINT = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_ENDPOINT = 'https://api.twitter.com/2/oauth2/token';
const SCOPE = 'tweet.read tweet.write users.read offline.access'; // Adjust scopes as needed

// Helper function: generate a PKCE code verifier and corresponding code challenge
const generatePKCEPair = (): { code_verifier: string; code_challenge: string } => {
  // Generate a random code verifier (between 43 and 128 characters)
  const code_verifier = crypto.randomBytes(64).toString('base64url');
  // Create a SHA256 hash and then base64url-encode it (this is the code challenge)
  const code_challenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
  return { code_verifier, code_challenge };
};

// Root route offering a login link
app.get('/', (req: express.Request, res: express.Response) => {
  res.send('<a href="/login">Login with Twitter</a>');
});

// /login: generate PKCE values, store in session, and redirect to Twitter's auth endpoint
app.get('/login', (req: express.Request, res: express.Response) => {
  const { code_verifier, code_challenge } = generatePKCEPair();
  req.session.code_verifier = code_verifier;

  // Generate a random state parameter for CSRF protection
  const state = crypto.randomBytes(16).toString('hex');
  req.session.state = state;

  // Build the authorization URL with the required query parameters
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state: state,
    code_challenge: code_challenge,
    code_challenge_method: 'S256',
  });

  const authorizationUrl = `${AUTHORIZATION_ENDPOINT}?${params.toString()}`;
  res.redirect(authorizationUrl);
});

// /callback: handle Twitter's redirect and exchange the code for an access token
app.get('/callback', (async (req: Request, res: Response) => {
  const { code, state } = req.query;

  // Validate the state parameter to prevent CSRF attacks
  if (!req.session.state || state !== req.session.state) {
    return res.status(400).send('State mismatch - possible CSRF attack.');
  }

  // Validate required parameters
  if (!code || typeof code !== 'string' || !req.session.code_verifier) {
    return res.status(400).send('Invalid request - missing code or verifier.');
  }

  // Prepare the token request parameters
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: req.session.code_verifier,
  });

  try {
    const tokenResponse = await axios.post(TOKEN_ENDPOINT, tokenParams.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Store the access token (and other token data) in session for future API calls
    req.session.access_token = tokenResponse.data.access_token;
    res.json(tokenResponse.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return res.status(500).json({
        error: error.response?.data || error.message,
      });
    }
    res.status(500).send('An error occurred');
  }
}) as RequestHandler);

// Start the server
const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

import { Router, Request, Response } from 'express';
import { enqueueGoogleSync } from '../../queues/jobs.js';
import { AuthRequest } from '../../server/common/types.js';
import { google } from 'googleapis';
import { query } from '../../server/common/db.js';

export const googleSyncRouter = Router();

// In a real production app, these should come from environment variables.
// For this prototype, we'll use a placeholder or ask the user to provide them.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'MOCK_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'MOCK_CLIENT_SECRET';
// The redirect URI must match the one configured in Google Cloud Console
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google-sync/callback';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// 1. Redirect to Google Consent Screen
googleSyncRouter.get('/auth/:dentistId', (req: Request, res: Response) => {
  const { dentistId } = req.params;
  const { tenantId } = req.query;

  if (!tenantId) {
    return res.status(400).send('Tenant ID is required');
  }

  // Pass dentistId and tenantId in the state parameter
  const state = Buffer.from(JSON.stringify({ dentistId, tenantId })).toString('base64');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Gets refresh token
    prompt: 'consent', // Force to get refresh token every time for testing
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    state
  });

  res.redirect(authUrl);
});

// 2. Handle Google Callback
googleSyncRouter.get('/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  try {
    const { dentistId, tenantId } = JSON.parse(Buffer.from(state as string, 'base64').toString('ascii'));

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    // Save refresh token and email in database
    if (tokens.refresh_token) {
      await query(
        'UPDATE dentists SET google_refresh_token = $1, google_email = $2 WHERE id = $3 AND tenant_id = $4',
        [tokens.refresh_token, email, dentistId, tenantId]
      );
    } else {
      // If no new refresh token (e.g. user didn't see consent screen), just update email or log
      await query(
        'UPDATE dentists SET google_email = $1 WHERE id = $2 AND tenant_id = $3',
        [email, dentistId, tenantId]
      );
    }

    // Redirect back to frontend settings page
    res.redirect('http://localhost:5174/?menu=Configurações');
  } catch (error) {
    console.error('Error during Google Auth callback:', error);
    res.status(500).send('Authentication failed');
  }
});

import { requireAuth } from '../../server/common/middleware.js';

// Enqueue sync job
googleSyncRouter.post('/appointments/:id/sync', requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const tenantId = req.auth!.tenantId;
  const { patientName, dentistName, startTime, endTime } = req.body;

  await enqueueGoogleSync({
    tenantId,
    appointmentId: id,
    patientName,
    dentistName,
    startTime,
    endTime
  });

  return res.status(202).json({ message: 'Sincronização enfileirada' });
});

import { Worker } from 'bullmq';
import { query } from '../server/common/db.js';
import { config } from '../server/common/config.js';
import { google } from 'googleapis';

const redisConnection = { url: config.redisUrl };

// In a real production app, these should come from environment variables.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'MOCK_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'MOCK_CLIENT_SECRET';

export function createGoogleSyncWorker() {
  return new Worker(
    'google-sync-queue',
    async (job) => {
      const { tenantId, appointmentId, patientName, dentistName, startTime, endTime } = job.data as {
        tenantId: string;
        appointmentId: string;
        patientName: string;
        dentistName: string;
        startTime: string;
        endTime: string;
      };

      try {
        // Fetch dentist and their google credentials from DB
        const result = await query(
          `SELECT a.google_event_id, d.google_refresh_token, d.google_email 
           FROM appointments a 
           JOIN dentists d ON a.dentist_id = d.id 
           WHERE a.id = $1 AND a.tenant_id = $2`,
          [appointmentId, tenantId]
        );

        if (result.rowCount === 0) {
          throw new Error(`Appointment ${appointmentId} not found`);
        }

        const { google_event_id, google_refresh_token, google_email } = result.rows[0];

        // If the dentist hasn't linked their Google account, we skip silently
        if (!google_refresh_token) {
          console.log(`[Google Sync] Dentist for appointment ${appointmentId} has not linked Google Calendar.`);
          return { ok: true, skipped: true, reason: 'No Google account linked' };
        }

        // Initialize OAuth client
        const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
        oauth2Client.setCredentials({ refresh_token: google_refresh_token });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const event = {
          summary: `Consulta: ${patientName}`,
          description: `Paciente: ${patientName}\nDentista: ${dentistName}`,
          start: {
            dateTime: new Date(startTime).toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          end: {
            dateTime: new Date(endTime).toISOString(),
            timeZone: 'America/Sao_Paulo',
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 60 },
              { method: 'popup', minutes: 15 },
            ],
          },
        };

        let currentGoogleEventId = google_event_id;

        if (currentGoogleEventId) {
          // Update existing event
          try {
            await calendar.events.update({
              calendarId: 'primary',
              eventId: currentGoogleEventId,
              requestBody: event,
            });
            console.log(`[Google Sync] Updated event ${currentGoogleEventId}`);
          } catch (updateErr: any) {
            // If the event was deleted on Google Calendar, it might throw 404 or 410
            if (updateErr.code === 404 || updateErr.code === 410) {
              const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
              });
              currentGoogleEventId = res.data.id;
              console.log(`[Google Sync] Recreated event ${currentGoogleEventId}`);
            } else {
              throw updateErr;
            }
          }
        } else {
          // Insert new event
          const res = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
          });
          currentGoogleEventId = res.data.id;
          console.log(`[Google Sync] Created new event ${currentGoogleEventId}`);
        }

        // Save new or updated event ID
        if (currentGoogleEventId !== google_event_id) {
          await query('UPDATE appointments SET google_event_id = $1 WHERE id = $2 AND tenant_id = $3', [
            currentGoogleEventId,
            appointmentId,
            tenantId
          ]);
        }

        return { ok: true, googleEventId: currentGoogleEventId };
      } catch (error) {
        console.error(`[Google Sync Error] Appointment ${appointmentId}:`, error);
        throw error;
      }
    },
    { connection: redisConnection, concurrency: 50 }
  );
}

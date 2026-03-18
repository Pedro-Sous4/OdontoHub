import { Router } from 'express';
import { enqueueGoogleSync } from '../../queues/jobs.js';
import { AuthRequest } from '../../server/common/types.js';

export const googleSyncRouter = Router();

googleSyncRouter.post('/appointments/:id/sync', async (req: AuthRequest, res) => {
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

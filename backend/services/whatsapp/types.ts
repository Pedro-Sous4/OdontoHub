export type WhatsAppSessionStatus =
  | 'pending_qr'
  | 'authenticated'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'failed';

export interface WhatsAppSessionSnapshot {
  tenantId: string;
  phoneNumber: string;
  status: WhatsAppSessionStatus;
  lastSeen?: string;
  qrCode?: string;
}

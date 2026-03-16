export interface Dentist {
  id: string;
  nome: string;
  cor_agenda: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  dentist_id: string;
  patient_name?: string;
  dentist_name?: string;
  room_id?: string;
  start_time: string;
  end_time: string;
  status:
    | 'scheduled'
    | 'confirmed'
    | 'rescheduled'
    | 'cancelled'
    | 'arrived'
    | 'in_service'
    | 'attended'
    | 'no_show';
}

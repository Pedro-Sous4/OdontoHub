import { useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, SlotInfo, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import {
  addDays,
  addMinutes,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { api, setAuthToken } from './api';
import { Appointment, Dentist } from './types';
import { MessagesCenter } from './MessagesCenter';
import { PatientsCenter } from './PatientsCenter';
import { FinanceCenter } from './FinanceCenter';
import odontoHubLogo from './assets/odontohub-logo.png';

const locales = { 'pt-BR': ptBR };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay: (date: Date) => date.getDay(),
  locales
});

type CalendarEvent = {
  id: string;
  title: string;
  patientName: string;
  dentistName: string;
  phone?: string;
  start: Date;
  end: Date;
  resourceId: string;
  status: Appointment['status'];
};

const DnDCalendar = withDragAndDrop<CalendarEvent, { resourceId: string; resourceTitle: string }>(Calendar as never);

type NotificationEvent = {
  id: string;
  channel: 'whatsapp' | 'email' | 'sms';
  recipient: string;
  subject?: string;
  status: string;
  created_at: string;
};

type WhatsAppStatus = {
  status: string;
  lastSeen?: string;
};

type PatientListItem = {
  id: string;
  nome: string;
};

type SchedulingInsight = {
  chanceNoShow: number;
  riskLevel: 'baixo' | 'medio' | 'alto';
  pendingDebt: number;
  pendingDebtCount: number;
  hasOpenDebt: boolean;
};

type PopoverPosition = {
  top: number;
  left: number;
};

const statusPalette: Record<Appointment['status'], string> = {
  scheduled: '#e2e8f0',
  confirmed: '#dbeafe',
  rescheduled: '#ede9fe',
  cancelled: '#fee2e2',
  arrived: '#fef3c7',
  in_service: '#bfdbfe',
  attended: '#bbf7d0',
  no_show: '#fecaca'
};

const statusLabels: Record<Appointment['status'], string> = {
  scheduled: 'Agendada',
  confirmed: 'Confirmada',
  rescheduled: 'Reagendada',
  cancelled: 'Cancelada',
  arrived: 'Chegou',
  in_service: 'Em atendimento',
  attended: 'Compareceu',
  no_show: 'Faltou'
};

function EventCard({ event }: { event: CalendarEvent }) {
  const timeText = `${format(event.start, 'HH:mm')} - ${format(event.end, 'HH:mm')}`;
  return (
    <div className="eventCardContent">
      <div className="eventTime">{timeText}</div>
      <div className="eventPatient">{event.patientName}</div>
      <div className="eventDentist">{event.dentistName}</div>
    </div>
  );
}

export function App() {
  const menuItems = ['Agenda', 'Pacientes', 'Financeiro', 'Mensagens'];
  const [token, setToken] = useState('');
  const [activeMenu, setActiveMenu] = useState('Agenda');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedView, setSelectedView] = useState<(typeof Views)[keyof typeof Views]>(Views.WEEK);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition>({ top: 220, left: 280 });
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [insight, setInsight] = useState<SchedulingInsight | null>(null);
  const [highRiskConfirmStep, setHighRiskConfirmStep] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    patientId: '',
    dentistId: '',
    duration: 30,
    start: new Date()
  });
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [whatsStatus, setWhatsStatus] = useState<WhatsAppStatus>({ status: 'disconnected' });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 900);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!mobile) {
        setShowMobileSidebar(false);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile && selectedView !== Views.DAY) {
      setSelectedView(Views.DAY);
    }
  }, [isMobile]);

  const events = useMemo<CalendarEvent[]>(
    () =>
      appointments.map((apt) => ({
        id: apt.id,
        title: apt.patient_name ?? 'Paciente',
        patientName: apt.patient_name ?? 'Paciente',
        dentistName: apt.dentist_name ?? 'Dentista',
        phone: (apt as Appointment & { phone?: string }).phone,
        start: new Date(apt.start_time),
        end: new Date(apt.end_time),
        resourceId: apt.dentist_id,
        status: apt.status
      })),
    [appointments]
  );

  async function loadWeek(date = selectedDate) {
    if (!token) {
      setErrorMessage('Informe o JWT para carregar a agenda.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      setAuthToken(token);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 }).toISOString();
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 }).toISOString();

      const [appointmentsResponse, dentistsResponse] = await Promise.all([
        api.get<Appointment[]>('/agenda/appointments', {
          params: { start: weekStart, end: weekEnd }
        }),
        api.get<Dentist[]>('/agenda/dentists')
      ]);

      setSelectedDate(date);
      setAppointments(appointmentsResponse.data);
      setDentists(dentistsResponse.data);
    } catch {
      setErrorMessage('Não foi possível carregar agenda/dentistas. Verifique API e token.');
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    if (!token) {
      return;
    }

    try {
      setAuthToken(token);
      const response = await api.get<NotificationEvent[]>('/notifications/events');
      setNotifications(response.data.slice(0, 5));
    } catch {
      setNotifications([]);
    }
  }

  async function loadWhatsAppStatus() {
    if (!token) {
      return;
    }

    try {
      setAuthToken(token);
      const response = await api.get<WhatsAppStatus>('/whatsapp/health');
      setWhatsStatus(response.data);
    } catch {
      setWhatsStatus({ status: 'disconnected' });
    }
  }

  async function loadDashboard() {
    await Promise.all([loadWeek(), loadNotifications(), loadWhatsAppStatus()]);
  }

  async function createAppointment(slot: SlotInfo) {
    if (!token) {
      setErrorMessage('Informe o JWT para criar consulta.');
      return;
    }

    if (dentists.length === 0) {
      setErrorMessage('Nenhum dentista encontrado para este tenant.');
      return;
    }

    setShowScheduleModal(true);
    setInsight(null);
    setScheduleForm({
      patientId: '',
      dentistId: dentists[0].id,
      duration: 30,
      start: slot.start
    });
    setHighRiskConfirmStep(false);

    try {
      setAuthToken(token);
      const patientsResponse = await api.get<PatientListItem[]>('/patients');
      setPatients(patientsResponse.data);
    } catch {
      setPatients([]);
    }
  }

  async function loadPatientIntelligence(patientId: string) {
    if (!patientId || !token) {
      setInsight(null);
      return;
    }

    try {
      setAuthToken(token);
      const response = await api.get<SchedulingInsight>('/agenda/appointments/intelligence', {
        params: { patientId }
      });
      setInsight(response.data);
      setHighRiskConfirmStep(false);
    } catch {
      setInsight(null);
      setHighRiskConfirmStep(false);
    }
  }

  async function confirmScheduleAppointment() {
    if (!token) {
      setErrorMessage('Informe o JWT para criar consulta.');
      return;
    }

    if (!scheduleForm.patientId || !scheduleForm.dentistId) {
      setErrorMessage('Selecione paciente e dentista para agendar.');
      return;
    }

    const needsDoubleConfirm = insight?.riskLevel === 'alto' && insight?.hasOpenDebt;
    if (needsDoubleConfirm && !highRiskConfirmStep) {
      setHighRiskConfirmStep(true);
      return;
    }

    try {
      setCreatingAppointment(true);
      setAuthToken(token);

      await api.post('/agenda/appointments', {
        patientId: scheduleForm.patientId,
        dentistId: scheduleForm.dentistId,
        roomId: null,
        startTime: scheduleForm.start.toISOString(),
        endTime: addMinutes(scheduleForm.start, scheduleForm.duration).toISOString(),
        status: 'scheduled'
      });

      setShowScheduleModal(false);
      setHighRiskConfirmStep(false);
      await loadWeek(scheduleForm.start);
    } catch {
      setErrorMessage('Falha ao criar consulta.');
    } finally {
      setCreatingAppointment(false);
    }
  }

  async function moveAppointment({ event, start, end }: { event: CalendarEvent; start: Date; end: Date }) {
    if (!token) {
      setErrorMessage('Informe o JWT para reagendar consulta.');
      return;
    }

    try {
      setAuthToken(token);
      await api.put(`/agenda/appointments/${event.id}/reschedule`, {
        startTime: start.toISOString(),
        endTime: end.toISOString()
      });

      await loadWeek(start);
    } catch {
      setErrorMessage('Falha ao reagendar consulta.');
    }
  }

  async function updateAppointmentFlowStatus(status: Appointment['status']) {
    if (!selectedEvent || !token) {
      return;
    }

    try {
      setAuthToken(token);
      await api.put(`/agenda/appointments/${selectedEvent.id}/status`, { status });
      setSelectedEvent({ ...selectedEvent, status });
      await loadWeek(selectedDate);
    } catch {
      setErrorMessage('Falha ao atualizar status da consulta.');
    }
  }

  const totalConsultas = appointments.length;
  const confirmadas = appointments.filter((item) => item.status === 'confirmed').length;
  const canceladas = appointments.filter((item) => item.status === 'cancelled').length;
  const hasResources = dentists.length > 0;

  function prettyStatus(status: Appointment['status']) {
    return statusLabels[status];
  }

  function openEventPopover(event: CalendarEvent, uiEvent: unknown) {
    const popoverWidth = 320;
    const popoverHeight = 290;
    const margin = 12;

    let left = 280;
    let top = 220;

    const domEvent = uiEvent as { currentTarget?: EventTarget | null; target?: EventTarget | null };
    const candidate = domEvent.currentTarget ?? domEvent.target;
    if (candidate instanceof HTMLElement) {
      const eventEl = candidate.closest('.rbc-event') as HTMLElement | null;
      const rect = (eventEl ?? candidate).getBoundingClientRect();

      left = rect.right + 10;
      top = rect.top + 8;

      if (left + popoverWidth + margin > window.innerWidth) {
        left = Math.max(margin, rect.left - popoverWidth - 10);
      }

      if (top + popoverHeight + margin > window.innerHeight) {
        top = Math.max(margin, window.innerHeight - popoverHeight - margin);
      }
    }

    setPopoverPosition({ left, top });
    setSelectedEvent(event);
  }

  const monthDays = useMemo(() => {
    const firstDay = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
    const lastDay = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
    const dates: Date[] = [];
    let cursor = firstDay;

    while (cursor <= lastDay) {
      dates.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return dates;
  }, [selectedDate]);

  function statusLabel(status: string) {
    if (status === 'connected') {
      return 'Conectado';
    }
    if (status === 'reconnecting') {
      return 'Reconectando';
    }
    if (status === 'pending_qr') {
      return 'Aguardando QR';
    }
    return 'Desconectado';
  }

  return (
    <div className="dashboard layoutCodental">
      <header className="topbar">
        <div className="brand">
          <img src={odontoHubLogo} alt="OdontoHub" className="brandLogo" />
          <span>OdontoHub</span>
        </div>
        <nav className="mainNav">
          {menuItems.map((item) => (
            <button
              key={item}
              className={item === activeMenu ? 'navBtn active' : 'navBtn'}
              onClick={() => setActiveMenu(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="topIcons">
          <span className="iconDot" />
          <span className="iconDot" />
          <span className="iconDot" />
        </div>
        <div className="authBox">
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole o JWT"
            className="tokenInput"
          />
          <button onClick={loadDashboard} disabled={loading}>{loading ? 'Carregando...' : 'Atualizar'}</button>
        </div>
      </header>

      {activeMenu === 'Mensagens' ? (
        <main className="contentSingle">
          <MessagesCenter token={token} onError={setErrorMessage} />
        </main>
      ) : activeMenu === 'Pacientes' ? (
        <main className="contentSingle">
          <PatientsCenter token={token} onError={setErrorMessage} />
        </main>
      ) : activeMenu === 'Financeiro' ? (
        <main className="contentSingle">
          <FinanceCenter token={token} onError={setErrorMessage} />
        </main>
      ) : (
      <main className="contentGrid">
        {isMobile ? (
          <button className="mobileSidebarToggle" onClick={() => setShowMobileSidebar((prev) => !prev)}>
            {showMobileSidebar ? 'Fechar painel' : 'Abrir painel'}
          </button>
        ) : null}

        <aside className={`leftPanel ${isMobile ? 'mobilePanel' : ''} ${isMobile && !showMobileSidebar ? 'hiddenPanel' : ''}`}>
          <section className="monthWidget">
            <div className="monthHeader">
              <strong>{format(selectedDate, 'MMMM yyyy', { locale: ptBR })}</strong>
              <div className="monthControls">
                <button onClick={() => setSelectedDate((prev) => subMonths(prev, 1))}>‹</button>
                <button onClick={() => setSelectedDate((prev) => addMonths(prev, 1))}>›</button>
              </div>
            </div>
            <div className="weekLabels">
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="monthGrid">
              {monthDays.map((day) => {
                const inactive = !isSameMonth(day, selectedDate);
                const today = isToday(day);
                return (
                  <button
                    key={day.toISOString()}
                    className={`dayCell ${inactive ? 'inactive' : ''} ${today ? 'today' : ''}`}
                    onClick={() => loadWeek(day)}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="sideCard">
            <div className="sideCardHeader">
              <strong>Pacientes aguardando</strong>
              <span>{totalConsultas}</span>
            </div>
            <div className="sideLine">
              <span>Confirmadas</span>
              <b>{confirmadas}</b>
            </div>
            <div className="sideLine">
              <span>Canceladas</span>
              <b>{canceladas}</b>
            </div>
          </section>

          <section className="sideCard">
            <div className="sideCardHeader">
              <strong>Agendas</strong>
            </div>
            {dentists.slice(0, 6).map((dentist) => (
              <div key={dentist.id} className="agendaDentistItem">
                <span className="agendaColor" style={{ background: dentist.cor_agenda }} />
                <span>{dentist.nome}</span>
              </div>
            ))}
          </section>

          <section className="sideCard">
            <div className="sideCardHeader">
              <strong>WhatsApp</strong>
            </div>
            <div className="sideLine">
              <span>Status</span>
              <b>{statusLabel(whatsStatus.status)}</b>
            </div>
          </section>
        </aside>

        <section className="calendarPanel mainSchedule">
          <div className="scheduleHeader">
            <button
              className="addButton"
              onClick={() => createAppointment({ start: selectedDate } as SlotInfo)}
            >
              +
            </button>
            <h2>{format(selectedDate, 'MMMM yyyy', { locale: ptBR })}</h2>
            <div className="scheduleControls">
              <button onClick={() => loadWeek(new Date())}>Hoje</button>
              <button
                className={selectedView === Views.WEEK ? 'viewActive' : ''}
                onClick={() => setSelectedView(Views.WEEK)}
              >
                Semana
              </button>
              <button
                className={selectedView === Views.DAY ? 'viewActive' : ''}
                onClick={() => setSelectedView(Views.DAY)}
              >
                Dia
              </button>
            </div>
          </div>

          <div className="flowLegend">
            {([
              'arrived',
              'in_service',
              'attended',
              'no_show'
            ] as Appointment['status'][]).map((status) => (
              <div key={status} className="flowLegendItem">
                <span className="legendDot" style={{ background: statusPalette[status] }} />
                <span>{statusLabels[status]}</span>
              </div>
            ))}
          </div>

          {errorMessage ? <div className="errorBanner">{errorMessage}</div> : null}

          {showScheduleModal ? (
            <div className="scheduleModalOverlay" onClick={() => setShowScheduleModal(false)}>
              <div className="scheduleModal" onClick={(event) => event.stopPropagation()}>
                <div className="scheduleModalHeader">
                  <strong>Agendar consulta</strong>
                  <button className="popoverClose" onClick={() => setShowScheduleModal(false)}>×</button>
                </div>

                <label className="formLabel">Dentista</label>
                <select
                  className="formInput"
                  value={scheduleForm.dentistId}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, dentistId: event.target.value }))}
                >
                  {dentists.map((dentist) => (
                    <option key={dentist.id} value={dentist.id}>{dentist.nome}</option>
                  ))}
                </select>

                <label className="formLabel">Paciente</label>
                <select
                  className="formInput"
                  value={scheduleForm.patientId}
                  onChange={(event) => {
                    const patientId = event.target.value;
                    setScheduleForm((prev) => ({ ...prev, patientId }));
                    void loadPatientIntelligence(patientId);
                  }}
                >
                  <option value="">Selecione</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.nome}</option>
                  ))}
                </select>

                <label className="formLabel">Duração (minutos)</label>
                <input
                  className="formInput"
                  type="number"
                  min={15}
                  step={15}
                  value={scheduleForm.duration}
                  onChange={(event) => setScheduleForm((prev) => ({ ...prev, duration: Number(event.target.value || 30) }))}
                />

                {insight ? (
                  <div className="smartInsights">
                    <div className={`riskBadge ${insight.riskLevel}`}>
                      Chance de falta: <strong>{insight.chanceNoShow}%</strong>
                    </div>
                    <div className={`debtBadge ${insight.hasOpenDebt ? 'hasDebt' : 'clean'}`}>
                      {insight.hasOpenDebt
                        ? `Débito em aberto: R$ ${insight.pendingDebt.toFixed(2)} (${insight.pendingDebtCount})`
                        : 'Sem débitos em aberto'}
                    </div>
                  </div>
                ) : null}

                <div className="scheduleModalActions">
                  <button className="ghostAction" onClick={() => setShowScheduleModal(false)}>Cancelar</button>
                  <button
                    className={`primaryAction ${highRiskConfirmStep ? 'dangerConfirm' : ''}`}
                    onClick={confirmScheduleAppointment}
                    disabled={creatingAppointment}
                  >
                    {creatingAppointment
                      ? 'Agendando...'
                      : highRiskConfirmStep
                        ? 'Confirmar agora (alto risco)'
                        : insight?.riskLevel === 'alto' && insight?.hasOpenDebt
                          ? 'Confirmar com alerta'
                          : 'Confirmar agendamento'}
                  </button>
                </div>

                {highRiskConfirmStep ? (
                  <div className="doubleConfirmHint">
                    Paciente com risco alto de falta e débitos em aberto. Clique novamente para confirmar o agendamento.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedEvent ? (
            <div className="appointmentPopover" style={{ top: popoverPosition.top, left: popoverPosition.left }}>
              <button className="popoverClose" onClick={() => setSelectedEvent(null)}>×</button>
              <div className="popoverHeader">
                <div className="avatarCircle">{selectedEvent.patientName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{selectedEvent.patientName}</strong>
                  <p>{selectedEvent.phone ?? '(11) 12345-5678'} · Confirmar consulta</p>
                </div>
              </div>
              <div className="popoverMiniInfo">Convênio: Particular</div>
              <div className="popoverActions">
                <button className="ghostAction">Abrir prontuário</button>
                <button className="ghostAction">Adicionar evolução</button>
              </div>
              <button className="primaryAction">Editar agendamento</button>
              <div className="flowButtons">
                <button className="flowBtn arrived" onClick={() => updateAppointmentFlowStatus('arrived')}>Chegou</button>
                <button className="flowBtn inService" onClick={() => updateAppointmentFlowStatus('in_service')}>Em atendimento</button>
                <button className="flowBtn attended" onClick={() => updateAppointmentFlowStatus('attended')}>Compareceu</button>
                <button className="flowBtn noShow" onClick={() => updateAppointmentFlowStatus('no_show')}>Faltou</button>
              </div>
              <div className="popoverMeta">
                <div>{selectedEvent.dentistName}</div>
                <div>{format(selectedEvent.start, "EEE, d 'de' MMM", { locale: ptBR })} · {format(selectedEvent.start, 'HH:mm')} - {format(selectedEvent.end, 'HH:mm')}</div>
              </div>
              <div className="popoverStatus">{prettyStatus(selectedEvent.status)}</div>
            </div>
          ) : null}

          <DnDCalendar
            localizer={localizer}
            events={events}
            date={selectedDate}
            view={selectedView}
            onView={(view) => setSelectedView(view)}
            defaultView={Views.WEEK}
            views={isMobile ? [Views.DAY] : [Views.WEEK, Views.DAY]}
            toolbar={false}
            step={30}
            timeslots={2}
            min={new Date(1970, 1, 1, 8, 0, 0)}
            max={new Date(1970, 1, 1, 20, 0, 0)}
            scrollToTime={new Date(1970, 1, 1, 8, 0, 0)}
            dayLayoutAlgorithm="no-overlap"
            style={{ height: '72vh' }}
            selectable
            onSelectSlot={createAppointment}
            onEventDrop={moveAppointment as never}
            resizable
            resources={!isMobile && hasResources ? dentists.map((d) => ({ resourceId: d.id, resourceTitle: d.nome })) : undefined}
            resourceIdAccessor={!isMobile && hasResources ? ((resource) => resource.resourceId) : undefined}
            resourceTitleAccessor={!isMobile && hasResources ? ((resource) => resource.resourceTitle) : undefined}
            startAccessor={(event) => event.start}
            endAccessor={(event) => event.end}
            eventPropGetter={(event) => {
              const dentist = dentists.find((d) => d.id === event.resourceId);
              return {
                style: {
                  backgroundColor: statusPalette[event.status],
                  borderRadius: '6px',
                  color: '#0f172a',
                  border: '1px solid #dbe3ed',
                  borderLeft: `3px solid ${dentist?.cor_agenda ?? '#334155'}`
                }
              };
            }}
            messages={{
              noEventsInRange: 'Sem consultas neste período'
            }}
            components={{ event: EventCard as never }}
            onSelectEvent={(event, uiEvent) => openEventPopover(event as CalendarEvent, uiEvent)}
            onNavigate={loadWeek}
          />
        </section>
      </main>
      )}

      <footer className="footerInfo">
        Módulo ativo: <strong>{activeMenu}</strong> · Últimas notificações: {notifications.length}
      </footer>
    </div>
  );
}

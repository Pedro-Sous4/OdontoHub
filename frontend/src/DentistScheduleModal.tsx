import React, { useState, useEffect } from 'react';
import { api, setAuthToken } from './api';

interface Schedule {
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

interface DentistScheduleModalProps {
  dentistId: string;
  dentistName: string;
  token: string;
  onClose: () => void;
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function DentistScheduleModal({ dentistId, dentistName, token, onClose }: DentistScheduleModalProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchedules();
  }, [dentistId]);

  async function loadSchedules() {
    try {
      setAuthToken(token);
      const res = await api.get(`/agenda/dentists/${dentistId}/schedules`);
      setSchedules(res.data);
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  }

  function addSchedule(dia: number) {
    setSchedules([...schedules, { dia_semana: dia, hora_inicio: '08:00', hora_fim: '18:00' }]);
  }

  function removeSchedule(index: number) {
    const newS = [...schedules];
    newS.splice(index, 1);
    setSchedules(newS);
  }

  function updateSchedule(index: number, field: keyof Schedule, value: any) {
    const newS = [...schedules];
    newS[index] = { ...newS[index], [field]: value };
    setSchedules(newS);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/agenda/dentists/${dentistId}/schedules`, { schedules });
      alert('Horários salvos com sucesso!');
      onClose();
    } catch (err) {
      console.error(err);
      const error = err as any;
      alert('Erro ao salvar horários: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modalOverlay">
      <div className="modalContent" style={{ maxWidth: 600 }}>
        <h2>Horários de Atendimento - {dentistName}</h2>
        {loading ? <p>Carregando...</p> : (
          <div style={{ marginTop: 20 }}>
            {DIAS.map((diaNome, diaIndex) => {
              const diaSchedules = schedules.filter(s => s.dia_semana === diaIndex);
              return (
                <div key={diaIndex} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ width: 100, fontWeight: 600, paddingTop: 8 }}>{diaNome}</div>
                  <div style={{ flex: 1 }}>
                    {diaSchedules.map((s, idx) => {
                      const globalIndex = schedules.findIndex(x => x === s);
                      return (
                        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                          <input type="time" className="input" value={s.hora_inicio} onChange={(e) => updateSchedule(globalIndex, 'hora_inicio', e.target.value)} />
                          <span>até</span>
                          <input type="time" className="input" value={s.hora_fim} onChange={(e) => updateSchedule(globalIndex, 'hora_fim', e.target.value)} />
                          <button className="ghostAction" style={{ color: '#ef4444' }} onClick={() => removeSchedule(globalIndex)}>X</button>
                        </div>
                      );
                    })}
                    <button className="ghostAction" onClick={() => addSchedule(diaIndex)} style={{ fontSize: 12, marginTop: 4 }}>+ Adicionar Horário</button>
                  </div>
                </div>
              );
            })}

            <div className="modalActions" style={{ marginTop: 24 }}>
              <button className="ghostBtn" onClick={onClose} disabled={saving}>Cancelar</button>
              <button className="primaryBtn" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Horários'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

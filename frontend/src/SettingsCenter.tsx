import React, { useState, useEffect } from 'react';
import { api, setAuthToken } from './api';
import { WhatsAppSettings } from './WhatsAppSettings';
import { DentistScheduleModal } from './DentistScheduleModal';

interface SettingsCenterProps {
  token: string;
  onError: (msg: string) => void;
}

interface Dentist {
  id: string;
  nome: string;
  especialidade: string;
  cor_agenda: string;
  google_email?: string;
}

interface Room {
  id: string;
  nome: string;
}

interface Procedure {
  id: string;
  nome: string;
  duracao_padrao: number;
  valor: number;
}

interface Partner {
  id: string;
  tipo: 'consultorio' | 'empresa';
  nome: string;
}

export function SettingsCenter({ token, onError }: SettingsCenterProps) {
  const [activeTab, setActiveTab] = useState<'dentists' | 'rooms' | 'procedures' | 'whatsapp' | 'partners'>('dentists');
  
  const [dentists, setDentists] = useState<Dentist[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleDentist, setScheduleDentist] = useState<{ id: string; name: string } | null>(null);
  
  // Forms
  const [dentistForm, setDentistForm] = useState({ nome: '', especialidade: '', cor: '#3b82f6' });
  const [roomForm, setRoomForm] = useState({ nome: '' });
  const [procedureForm, setProcedureForm] = useState({ nome: '', duracao: 30, valor: 150 });
  const [partnerForm, setPartnerForm] = useState({ nome: '', tipo: 'consultorio' as 'consultorio' | 'empresa' });

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, activeTab]);

  async function loadData() {
    setLoading(true);
    setAuthToken(token);
    try {
      if (activeTab === 'dentists') {
        const res = await api.get('/auth/settings/dentists');
        setDentists(res.data);
      } else if (activeTab === 'rooms') {
        const res = await api.get('/auth/settings/rooms');
        setRooms(res.data);
      } else if (activeTab === 'procedures') {
        const res = await api.get('/auth/settings/procedures');
        setProcedures(res.data);
      } else if (activeTab === 'partners') {
        const res = await api.get('/finance/sources');
        setPartners(res.data);
      }
    } catch (err: any) {
      onError(err.response?.data?.message || 'Erro ao carregar dados das configurações.');
    } finally {
      setLoading(false);
    }
  }

  const handleUnlinkGoogle = async (id: string) => {
    if (confirm('Tem certeza que deseja desvincular o Google Agenda deste dentista?')) {
      try {
        setAuthToken(token);
        await api.post(`/auth/settings/dentists/${id}/unlink-google`);
        loadData();
      } catch (err: any) {
        onError(err.response?.data?.message || 'Erro ao desvincular.');
      }
    }
  };

  async function handleDelete(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir? Esta ação não pode ser desfeita e pode afetar históricos relacionados.')) return;
    
    setAuthToken(token);
    try {
      if (activeTab === 'dentists') {
        await api.delete(`/auth/settings/dentists/${id}`);
      } else if (activeTab === 'rooms') {
        await api.delete(`/auth/settings/rooms/${id}`);
      } else if (activeTab === 'procedures') {
        await api.delete(`/auth/settings/procedures/${id}`);
      } else if (activeTab === 'partners') {
        await api.delete(`/finance/sources/${id}`);
      }
      loadData();
    } catch (err: any) {
      onError(err.response?.data?.message || 'Erro ao excluir item. Pode estar sendo utilizado por outro registro.');
    }
  }

  async function handleSave() {
    setAuthToken(token);
    try {
      if (activeTab === 'dentists') {
        if (!dentistForm.nome) return alert('Nome é obrigatório');
        if (editingId) {
          await api.put(`/auth/settings/dentists/${editingId}`, { nome: dentistForm.nome, especialidade: dentistForm.especialidade, cor_agenda: dentistForm.cor });
        } else {
          await api.post('/auth/settings/dentists', { nome: dentistForm.nome, especialidade: dentistForm.especialidade, cor_agenda: dentistForm.cor });
        }
      } else if (activeTab === 'rooms') {
        if (!roomForm.nome) return alert('Nome é obrigatório');
        if (editingId) {
          await api.put(`/auth/settings/rooms/${editingId}`, { nome: roomForm.nome });
        } else {
          await api.post('/auth/settings/rooms', { nome: roomForm.nome });
        }
      } else if (activeTab === 'procedures') {
        if (!procedureForm.nome) return alert('Nome é obrigatório');
        if (editingId) {
          await api.put(`/auth/settings/procedures/${editingId}`, { nome: procedureForm.nome, duracao_padrao: Number(procedureForm.duracao), valor: Number(procedureForm.valor) });
        } else {
          await api.post('/auth/settings/procedures', { nome: procedureForm.nome, duracao_padrao: Number(procedureForm.duracao), valor: Number(procedureForm.valor) });
        }
      } else if (activeTab === 'partners') {
        if (!partnerForm.nome) return alert('Nome é obrigatório');
        if (editingId) {
          await api.put(`/finance/sources/${editingId}`, { tipo: partnerForm.tipo, nome: partnerForm.nome });
        } else {
          await api.post('/finance/sources', { tipo: partnerForm.tipo, nome: partnerForm.nome });
        }
      }
      setShowModal(false);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      onError(err.response?.data?.message || 'Erro ao salvar novo registro.');
    }
  }

  function handleEdit(type: string, item: any) {
    setEditingId(item.id);
    if (type === 'dentists') setDentistForm({ nome: item.nome, especialidade: item.especialidade || '', cor: item.cor_agenda || '#3b82f6' });
    else if (type === 'rooms') setRoomForm({ nome: item.nome });
    else if (type === 'procedures') setProcedureForm({ nome: item.nome, duracao: item.duracao_padrao, valor: item.valor });
    else if (type === 'partners') setPartnerForm({ nome: item.nome, tipo: item.tipo });
    setShowModal(true);
  }

  function openAddNew() {
    setEditingId(null);
    setDentistForm({ nome: '', especialidade: '', cor: '#3b82f6' });
    setRoomForm({ nome: '' });
    setProcedureForm({ nome: '', duracao: 30, valor: 150 });
    setPartnerForm({ nome: '', tipo: 'consultorio' });
    setShowModal(true);
  }

  function renderList() {
    if (loading) return <div className="loadingText">Carregando...</div>;

    if (activeTab === 'dentists') {
      return (
        <div className="settingsGrid">
          {dentists.map((d) => (
            <div key={d.id} className="settingsCard">
              <div className="colorIndicator" style={{ backgroundColor: d.cor_agenda || '#e2e8f0' }} />
              <div className="cardInfo">
                <strong>{d.nome}</strong>
                <span>{d.especialidade || 'Clínico Geral'}</span>
                {d.google_email && <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Google: {d.google_email}</small>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="ghostAction" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setScheduleDentist({ id: d.id, name: d.nome })}>Horários</button>
                <button className="ghostAction" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleEdit('dentists', d)}>Editar</button>
                <button className="deleteBtn" onClick={() => handleDelete(d.id)}>Excluir</button>
              </div>
            </div>
          ))}
          {dentists.length === 0 && <p className="emptyMessage">Nenhum dentista cadastrado.</p>}
          {scheduleDentist && (
            <DentistScheduleModal
              token={token}
              dentistId={scheduleDentist.id}
              dentistName={scheduleDentist.name}
              onClose={() => setScheduleDentist(null)}
            />
          )}
        </div>
      );
    }

    if (activeTab === 'whatsapp') {
      return <WhatsAppSettings token={token} onError={onError} />;
    }

    if (activeTab === 'rooms') {
      return (
        <div className="settingsGrid">
          {rooms.map((r) => (
            <div key={r.id} className="settingsCard">
              <div className="cardInfo">
                <strong>{r.nome}</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}><button className="ghostAction" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleEdit('rooms', r)}>Editar</button><button className="deleteBtn" onClick={() => handleDelete(r.id)}>Excluir</button></div>
            </div>
          ))}
          {rooms.length === 0 && <p className="emptyMessage">Nenhuma sala cadastrada.</p>}
        </div>
      );
    }

    if (activeTab === 'procedures') {
      return (
        <table className="dataTable">
          <thead>
            <tr>
              <th>Procedimento</th>
              <th>Duração (min)</th>
              <th>Valor (R$)</th>
              <th align="right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {procedures.map(p => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.duracao_padrao}</td>
                <td>{Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td align="right" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="ghostAction" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleEdit('procedures', p)}>Editar</button>
                  <button className="ghostAction" style={{ color: '#ef4444', padding: '4px 8px', fontSize: '12px' }} onClick={() => handleDelete(p.id)}>Remover</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (activeTab === 'partners') {
      return (
        <div className="settingsGrid">
          {partners.map((p) => (
            <div key={p.id} className="settingsCard">
              <div className="cardInfo">
                <strong>{p.nome}</strong>
                <span>{p.tipo === 'consultorio' ? 'Consultório Parceiro' : 'Empresa / Outros'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}><button className="ghostAction" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handleEdit('partners', p)}>Editar</button><button className="deleteBtn" onClick={() => handleDelete(p.id)}>Excluir</button></div>
            </div>
          ))}
          {partners.length === 0 && <p className="emptyMessage">Nenhum consultório ou empresa cadastrada.</p>}
        </div>
      );
    }
  }

  return (
    <div className="patientsPanel" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <header className="patientsHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.5px' }}>Configurações da Clínica</h2>
        <button 
          type="button" 
          style={{ 
            padding: '10px 18px', 
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: '600', 
            fontSize: '13px',
            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -2px rgba(37, 99, 235, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease-in-out'
          }} 
          onClick={openAddNew}
        >
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Adicionar Novo
        </button>
      </header>

      <div className="patientsTabs" style={{ display: 'flex', gap: 24, marginBottom: 20, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        <button className={activeTab === 'dentists' ? 'active' : ''} onClick={() => setActiveTab('dentists')} style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: '15px', color: activeTab === 'dentists' ? '#2563eb' : '#64748b', cursor: 'pointer', borderBottom: activeTab === 'dentists' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: activeTab === 'dentists' ? '600' : 'normal' }}>Dentistas</button>
        <button className={activeTab === 'rooms' ? 'active' : ''} onClick={() => setActiveTab('rooms')} style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: '15px', color: activeTab === 'rooms' ? '#2563eb' : '#64748b', cursor: 'pointer', borderBottom: activeTab === 'rooms' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: activeTab === 'rooms' ? '600' : 'normal' }}>Salas</button>
        <button className={activeTab === 'procedures' ? 'active' : ''} onClick={() => setActiveTab('procedures')} style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: '15px', color: activeTab === 'procedures' ? '#2563eb' : '#64748b', cursor: 'pointer', borderBottom: activeTab === 'procedures' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: activeTab === 'procedures' ? '600' : 'normal' }}>Procedimentos</button>
        <button className={activeTab === 'partners' ? 'active' : ''} onClick={() => setActiveTab('partners')} style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: '15px', color: activeTab === 'partners' ? '#2563eb' : '#64748b', cursor: 'pointer', borderBottom: activeTab === 'partners' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: activeTab === 'partners' ? '600' : 'normal' }}>Parceiros / Origens</button>
        <button className={activeTab === 'whatsapp' ? 'active' : ''} onClick={() => setActiveTab('whatsapp')} style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: '15px', color: activeTab === 'whatsapp' ? '#2563eb' : '#64748b', cursor: 'pointer', borderBottom: activeTab === 'whatsapp' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: activeTab === 'whatsapp' ? '600' : 'normal' }}>Configurações WhatsApp</button>
      </div>

      <div className="settingsContent">
        {renderList()}
      </div>

      {showModal && (
        <div className="scheduleModalOverlay" onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="scheduleModal" style={{ maxWidth: '500px', width: '90%', padding: '20px', background: '#fff', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
            <div className="scheduleModalHeader">
              <strong>{editingId ? 'Editar' : 'Adicionar'} {activeTab === 'dentists' ? 'Dentista' : activeTab === 'rooms' ? 'Sala' : activeTab === 'procedures' ? 'Procedimento' : 'Parceiro'}</strong>
              <button type="button" className="popoverClose" onClick={() => setShowModal(false)}>×</button>
            </div>

            {activeTab === 'dentists' && (
              <>
                <label className="formLabel">Nome completo</label>
                <input className="formInput" placeholder="Dr. Carlos Silva" value={dentistForm.nome} onChange={e => setDentistForm({...dentistForm, nome: e.target.value})} />
                
                <label className="formLabel">Especialidade</label>
                <input className="formInput" placeholder="Ortodontia" value={dentistForm.especialidade} onChange={e => setDentistForm({...dentistForm, especialidade: e.target.value})} />
                
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', color: '#666', marginBottom: '8px' }}>Cor na Agenda</label>
                  <input
                    type="color"
                    className="inputField"
                    style={{ padding: '0', height: '40px' }}
                    value={dentistForm.cor}
                    onChange={(e) => setDentistForm({ ...dentistForm, cor: e.target.value })}
                  />
                </div>

                {editingId ? (
                  <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e293b' }}>Integração com Google Agenda</h4>
                    
                    {dentists.find(d => d.id === editingId)?.google_email ? (
                      <div>
                        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>
                          Sincronizado com: <strong>{dentists.find(d => d.id === editingId)?.google_email}</strong>
                        </p>
                        <button
                          className="ghostAction"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #ef4444', color: '#ef4444' }}
                          onClick={() => handleUnlinkGoogle(editingId!)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.73 5.08A2 2 0 0 1 12 4h7a2 2 0 0 1 2 2v10a2 2 0 0 1-.36 1.15"/><path d="M14 8h7"/><path d="M18 12h3"/><path d="m2 2 20 20"/><path d="M16 16v4a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V6a2 2 0 0 1 1.25-1.85"/></svg>
                          Desvincular Google Agenda
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>
                          Vincule a conta do Google para que as consultas sejam criadas automaticamente na agenda do celular do dentista.
                        </p>
                        <button
                          className="ghostAction"
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid #cbd5e1' }}
                          onClick={() => {
                            window.location.href = `http://localhost:3000/api/google-sync/auth/${editingId}?tenantId=${token ? (JSON.parse(atob(token.split('.')[1])).tenantId) : '00000000-0000-0000-0000-000000000001'}`;
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          Vincular Google Agenda
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            )}

            {activeTab === 'rooms' && (
              <>
                <label className="formLabel">Nome da Sala/Consultório</label>
                <input className="formInput" placeholder="Consultório 2" value={roomForm.nome} onChange={e => setRoomForm({...roomForm, nome: e.target.value})} />
              </>
            )}

            {activeTab === 'procedures' && (
              <>
                <label className="formLabel">Nome do Procedimento</label>
                <input className="formInput" placeholder="Ex: Avaliação" value={procedureForm.nome} onChange={e => setProcedureForm({...procedureForm, nome: e.target.value})} />
                
                <label className="formLabel">Duração Padrão (minutos)</label>
                <input className="formInput" type="number" min="5" step="5" value={procedureForm.duracao} onChange={e => setProcedureForm({...procedureForm, duracao: Number(e.target.value)})} />
                
                <label className="formLabel">Valor sugerido (R$)</label>
                <input className="formInput" type="number" min="0" step="10" value={procedureForm.valor} onChange={e => setProcedureForm({...procedureForm, valor: Number(e.target.value)})} />
              </>
            )}

            {activeTab === 'partners' && (
              <>
                <label className="formLabel">Nome do Parceiro/Origem</label>
                <input className="formInput" placeholder="Ex: Clínica OdontoPrev" value={partnerForm.nome} onChange={e => setPartnerForm({...partnerForm, nome: e.target.value})} />
                
                <label className="formLabel" style={{ marginTop: '12px' }}>Tipo</label>
                <select className="formInput" value={partnerForm.tipo} onChange={e => setPartnerForm({...partnerForm, tipo: e.target.value as 'consultorio' | 'empresa'})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', width: '100%' }}>
                  <option value="consultorio">Consultório Parceiro</option>
                  <option value="empresa">Empresa / Outros</option>
                </select>
              </>
            )}

            <div className="scheduleModalActions" style={{ marginTop: '24px' }}>
              <button className="ghostAction" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="primaryAction" onClick={handleSave}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { api, setAuthToken } from './api';

interface MessagesCenterProps {
  token: string;
  onError: (message: string) => void;
}

interface Conversation {
  patient_id: string;
  patient_name: string;
  phone: string;
  last_message_at: string;
  last_message: string;
  total_messages: number;
}

interface MessageLog {
  id: string;
  canal: string;
  mensagem: string;
  status_envio: string;
  media_url?: string;
  mimetype?: string;
  created_at: string;
}

export function MessagesCenter({ token, onError }: MessagesCenterProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'campaigns'>('chat');
  
  // Chat state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [assistantSilenced, setAssistantSilenced] = useState(false);
  
  // WhatsApp settings & terms state
  const [waStatus, setWaStatus] = useState<any>(null);
  const [waPhone, setWaPhone] = useState('');
  const [hasSignedTerms, setHasSignedTerms] = useState(false);
  const [termsList, setTermsList] = useState<any[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsStep, setTermsStep] = useState<1 | 2>(1);
  const [termsForm, setTermsForm] = useState({ nome: '', cpf: '', data_nascimento: '' });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Input state
  const [newMessage, setNewMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      loadConversations();
    }
  }, [token]);

  useEffect(() => {
    if (selectedPatient) {
      loadMessages(selectedPatient.patient_id);
      loadAssistantStatus(selectedPatient.patient_id);
    }
  }, [selectedPatient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let interval: any;
    if (activeTab === 'campaigns' && token) {
      loadWaStatus();
      loadTermsStatus();
      interval = setInterval(loadWaStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [activeTab, token]);

  async function loadTermsStatus() {
    try {
      const res = await api.get('/whatsapp/terms');
      setHasSignedTerms(res.data.signed);
      setTermsList(res.data.terms || []);
    } catch (err) {
      // ignore
    }
  }

  async function loadWaStatus() {
    try {
      const res = await api.get('/whatsapp/sessions/status');
      setWaStatus(res.data);
    } catch (err) {
      // ignore
    }
  }

  async function connectWa() {
    if (!waPhone) return alert('Digite o telefone (Ex: 5511999999999)');
    try {
      await api.post('/whatsapp/sessions/connect', { phoneNumber: waPhone });
      loadWaStatus();
    } catch (err: any) {
      onError(err.response?.data?.message || 'Erro ao conectar');
    }
  }

  async function disconnectWa() {
    try {
      await api.post('/whatsapp/sessions/disconnect');
      loadWaStatus();
    } catch (err: any) {
      onError(err.response?.data?.message || 'Erro ao desconectar');
    }
  }

  // Signature Canvas Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };
  
  const endDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveTerms = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if canvas is empty by getting image data (simple heuristic)
    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(ctx?.getImageData(0, 0, canvas.width, canvas.height).data.buffer || new ArrayBuffer(0));
    const hasPixels = pixelBuffer.some(color => color !== 0);
    if (!hasPixels) {
      return alert('Por favor, assine o termo antes de salvar.');
    }

    const signature_base64 = canvas.toDataURL('image/png');
    
    try {
      await api.post('/whatsapp/terms', {
        responsavel_nome: termsForm.nome,
        responsavel_cpf: termsForm.cpf,
        data_nascimento: termsForm.data_nascimento,
        signature_base64
      });
      setShowTermsModal(false);
      loadTermsStatus();
    } catch (err: any) {
      onError(err.response?.data?.error || 'Erro ao salvar o termo.');
    }
  };

  async function loadConversations() {
    setAuthToken(token);
    try {
      const res = await api.get('/whatsapp/conversations');
      setConversations(res.data);
    } catch (err) {
      onError('Erro ao carregar conversas do WhatsApp.');
    }
  }

  async function loadMessages(patientId: string) {
    setLoadingConv(true);
    setAuthToken(token);
    try {
      const res = await api.get(`/whatsapp/conversations/${patientId}/messages`);
      setMessages(res.data);
    } catch (err) {
      onError('Erro ao carregar mensagens do paciente.');
    } finally {
      setLoadingConv(false);
    }
  }

  async function loadAssistantStatus(patientId: string) {
    setAuthToken(token);
    try {
      const res = await api.get(`/whatsapp/patients/${patientId}/assistant`);
      setAssistantSilenced(res.data.isSilenced);
    } catch {
      // ignore
    }
  }

  async function handleToggleAssistant() {
    if (!selectedPatient) return;
    setAuthToken(token);
    try {
      const targetState = !assistantSilenced;
      const res = await api.post(`/whatsapp/patients/${selectedPatient.patient_id}/assistant/toggle`, { silence: targetState });
      setAssistantSilenced(res.data.isSilenced);
    } catch (err) {
      onError('Erro ao alterar status do assistente');
    }
  }

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove data:image/jpeg;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!newMessage.trim() && !attachment) return;

    setSending(true);
    setAuthToken(token);

    try {
      if (attachment) {
        const base64 = await toBase64(attachment);
        await api.post('/whatsapp/send-media', {
          phoneNumber: selectedPatient.phone,
          patientId: selectedPatient.patient_id,
          message: newMessage.trim(),
          mediaBase64: base64,
          mimetype: attachment.type,
          filename: attachment.name
        });
      } else {
        await api.post('/whatsapp/send-now', {
          phoneNumber: selectedPatient.phone,
          patientId: selectedPatient.patient_id,
          message: newMessage.trim()
        });
      }
      
      setNewMessage('');
      setAttachment(null);
      await loadMessages(selectedPatient.patient_id);
      await loadConversations();
    } catch (err: any) {
      onError(err.response?.data?.message || 'Erro ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  }

  if (!token) {
    return <div className="messagesPlaceholder">Faça login para acessar esta área.</div>;
  }

  return (
    <section className="patientsPanel" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px', height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <header className="patientsHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>Central de Mensagens</h2>
      </header>

      <div className="patientsTabs" style={{ display: 'flex', gap: 24, marginBottom: 20, borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')} style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: '15px', color: activeTab === 'chat' ? '#2563eb' : '#64748b', cursor: 'pointer', borderBottom: activeTab === 'chat' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: activeTab === 'chat' ? '600' : 'normal' }}>WhatsApp Chat</button>
        <button className={activeTab === 'campaigns' ? 'active' : ''} onClick={() => setActiveTab('campaigns')} style={{ background: 'none', border: 'none', padding: '10px 0', fontSize: '15px', color: activeTab === 'campaigns' ? '#2563eb' : '#64748b', cursor: 'pointer', borderBottom: activeTab === 'campaigns' ? '2px solid #2563eb' : '2px solid transparent', fontWeight: activeTab === 'campaigns' ? '600' : 'normal' }}>Campanhas e Automáticas</button>
      </div>

      {activeTab === 'chat' && (
        <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
          {/* Sidebar Conversas */}
          <div style={{ width: '300px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontWeight: '600', color: '#334155' }}>
              Conversas Recentes
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {conversations.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Nenhuma conversa encontrada.</div>
              ) : (
                conversations.map(conv => (
                  <div 
                    key={conv.patient_id} 
                    onClick={() => setSelectedPatient(conv)}
                    style={{ 
                      padding: '15px', 
                      borderBottom: '1px solid #f1f5f9', 
                      cursor: 'pointer',
                      background: selectedPatient?.patient_id === conv.patient_id ? '#eff6ff' : '#fff',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>{conv.patient_name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.last_message || 'Nenhuma mensagem'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Principal */}
          <div style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedPatient ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                Selecione uma conversa ao lado para visualizar.
              </div>
            ) : (
              <>
                <div style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{selectedPatient.patient_name}</div>
                    <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{selectedPatient.phone}</span>
                      <span style={{ 
                        background: assistantSilenced ? '#fee2e2' : '#dcf8c6', 
                        color: assistantSilenced ? '#991b1b' : '#166534', 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '11px', 
                        fontWeight: 600 
                      }}>
                        {assistantSilenced ? '😴 IA Silenciada' : '🤖 IA Ativa'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={handleToggleAssistant}
                      style={{ 
                        padding: '6px 12px', 
                        background: assistantSilenced ? '#2563eb' : '#ef4444', 
                        color: '#fff', 
                        border: 'none', 
                        borderRadius: '6px', 
                        cursor: 'pointer', 
                        fontSize: '12px', 
                        fontWeight: 600 
                      }}
                    >
                      {assistantSilenced ? 'Reativar IA' : 'Silenciar IA'}
                    </button>
                    <button className="ghostAction" onClick={() => {
                      loadMessages(selectedPatient.patient_id);
                      loadAssistantStatus(selectedPatient.patient_id);
                    }}>
                      ↻ Atualizar
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {loadingConv ? (
                    <div style={{ textAlign: 'center', color: '#64748b' }}>Carregando histórico...</div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#64748b' }}>Nenhuma mensagem nesta conversa.</div>
                  ) : (
                    messages.map(msg => {
                      const isMe = msg.status_envio !== 'received';
                      return (
                        <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ 
                            background: isMe ? '#dcf8c6' : '#fff', 
                            padding: '10px 14px', 
                            borderRadius: '12px',
                            borderTopRightRadius: isMe ? '0' : '12px',
                            borderTopLeftRadius: !isMe ? '0' : '12px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            color: '#1e293b',
                            fontSize: '14px',
                            lineHeight: '1.5'
                          }}>
                            {msg.mimetype?.startsWith('image/') && (
                              <div style={{ marginBottom: 8, fontSize: 12, color: '#0ea5e9' }}>📷 [Imagem/Mídia enviada]</div>
                            )}
                            {msg.mimetype?.startsWith('video/') && (
                              <div style={{ marginBottom: 8, fontSize: 12, color: '#0ea5e9' }}>🎥 [Vídeo enviado]</div>
                            )}
                            {msg.mimetype?.startsWith('audio/') && (
                              <div style={{ marginBottom: 8, fontSize: 12, color: '#0ea5e9' }}>🎵 [Áudio enviado]</div>
                            )}
                            {msg.mimetype && !msg.mimetype.startsWith('image/') && !msg.mimetype.startsWith('video/') && !msg.mimetype.startsWith('audio/') && (
                              <div style={{ marginBottom: 8, fontSize: 12, color: '#0ea5e9' }}>📎 [Arquivo enviado]</div>
                            )}
                            
                            {msg.mensagem && <div>{msg.mensagem}</div>}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', alignSelf: isMe ? 'flex-end' : 'flex-start', marginTop: '4px' }}>
                            {new Date(msg.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            {isMe && msg.status_envio === 'failed' && <span style={{ color: '#ef4444', marginLeft: 4 }}> (Falhou)</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} style={{ padding: '15px', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={e => setAttachment(e.target.files?.[0] || null)}
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: attachment ? '#2563eb' : '#64748b' }}
                    title={attachment ? attachment.name : "Anexar arquivo"}
                  >
                    📎
                  </button>
                  
                  <input 
                    className="formInput"
                    style={{ flex: 1, margin: 0 }}
                    placeholder="Digite uma mensagem..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    disabled={sending}
                  />
                  <button 
                    type="submit" 
                    disabled={sending || (!newMessage.trim() && !attachment)}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (sending || (!newMessage.trim() && !attachment)) ? 0.5 : 1 }}
                  >
                    {sending ? '...' : '▶'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div className="settingsGrid" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Bloco de Conexão WhatsApp removido e movido para Configurações */}

            {/* Bloco de Mensagens / Campanhas (mock) */}
            <div className="settingsCard" style={{ display: 'block', padding: 24, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
              <h3 style={{ marginTop: 0, color: '#0f172a' }}>Mensagens Automáticas de Agendamento</h3>
              <p style={{ color: '#475569', fontSize: 14, marginBottom: 20 }}>
                Configure as mensagens de lembrete de consulta e felicitações.
              </p>
              
              <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label className="formLabel" style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#334155' }}>Enviar WhatsApp automático?</label>
                  <select className="formInput" style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 6 }}>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="formLabel" style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: '#334155' }}>Tempo de Antecedência (ex: 24:00)</label>
                  <input className="formInput" defaultValue="24:00" style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 6 }} />
                </div>
              </div>

              <div style={{ background: '#fef3c7', padding: '12px 16px', borderRadius: 6, color: '#92400e', fontSize: 13, marginBottom: 20 }}>
                <strong>Exemplo Tempo WhatsApp:</strong> Informando 04:00, caso o agendamento seja para 18h00, o cliente receberá a mensagem às 14h00.
              </div>

              <h4 style={{ color: '#334155', fontSize: 15, marginBottom: 10 }}>Defina a mensagem que seu cliente receberá</h4>
              <div style={{ display: 'flex', gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <textarea className="formInput" style={{ width: '100%', minHeight: 150, padding: 12, border: '1px solid #cbd5e1', borderRadius: 6, resize: 'vertical' }} defaultValue={"Olá @CLIENTE, você tem consulta com a Dra Suelen Reis, dia *@DIA* as *@HORA*. Você confirma sua presença?\n\nEndereço: rua emilio leobet, 60, centro, Gramado\nclínica mobiclin"} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>@CLIENTE</span>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>@DIA</span>
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>@HORA</span>
                  </div>
                </div>
                <div style={{ flex: 1, background: '#f8fafc', padding: 20, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <strong style={{ display: 'block', marginBottom: 10, color: '#334155' }}>Exemplo Pré-Visualização</strong>
                  <div style={{ color: '#475569', fontSize: 14, whiteSpace: 'pre-wrap' }}>
                    Olá Maria, você tem consulta com a Dra Suelen Reis, dia *15/05* as *18:00*. Você confirma sua presença?
                    <br/><br/>
                    Endereço: rua emilio leobet, 60, centro, Gramado<br/>
                    clínica mobiclin
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


    </section>
  );
}

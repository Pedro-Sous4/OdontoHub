import React, { useState, useEffect, useRef } from 'react';
import { api, setAuthToken } from './api';

interface WhatsAppSettingsProps {
  token: string;
  onError: (msg: string) => void;
}

export function WhatsAppSettings({ token, onError }: WhatsAppSettingsProps) {
  const [waStatus, setWaStatus] = useState<any>(null);
  const [hasSignedTerms, setHasSignedTerms] = useState(false);
  const [termsList, setTermsList] = useState<any[]>([]);
  
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsStep, setTermsStep] = useState(1);
  const [termsForm, setTermsForm] = useState({ nome: '', cpf: '', data_nascimento: '' });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (token) {
      loadTerms();
      loadWaStatus();

      let interval: any;
      if (waStatus?.status !== 'connected') {
        interval = setInterval(loadWaStatus, 3000);
      }

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [token, waStatus?.status]);

  useEffect(() => {
    if (showTermsModal && termsStep === 2 && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 2;
        context.strokeStyle = '#0f172a';
        setCtx(context);
      }
    }
  }, [showTermsModal, termsStep]);

  async function loadWaStatus() {
    try {
      setAuthToken(token);
      const res = await api.get('/whatsapp/sessions/status');
      setWaStatus(res.data);
    } catch {
      setWaStatus({ status: 'disconnected' });
    }
  }

  async function connectWa() {
    try {
      setAuthToken(token);
      await api.post('/whatsapp/sessions/connect', {});
      loadWaStatus();
    } catch (e: any) {
      onError(e.response?.data?.message || 'Erro ao conectar');
    }
  }

  async function disconnectWa() {
    try {
      setAuthToken(token);
      await api.post('/whatsapp/sessions/disconnect');
      loadWaStatus();
      loadTerms();
      setHasSignedTerms(false);
    } catch (e: any) {
      onError(e.response?.data?.message || 'Erro ao desconectar');
    }
  }

  async function loadTerms() {
    try {
      setAuthToken(token);
      const res = await api.get('/whatsapp/terms');
      setTermsList(res.data);
      if (res.data && res.data.length > 0) {
        setHasSignedTerms(true);
      } else {
        setHasSignedTerms(false);
      }
    } catch {
      setHasSignedTerms(false);
    }
  }

  async function saveTerms() {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    if (isCanvasBlank(canvas)) {
      alert('Por favor, assine no campo em branco antes de salvar.');
      return;
    }
    const signatureUrl = canvas.toDataURL('image/png');
    try {
      setAuthToken(token);
      await api.post('/whatsapp/terms', {
        responsavel_nome: termsForm.nome,
        responsavel_cpf: termsForm.cpf,
        data_nascimento: termsForm.data_nascimento,
        signature_base64: signatureUrl
      });
      setShowTermsModal(false);
      await loadTerms();
      connectWa(); // Conecta automaticamente para gerar o QR code
    } catch (e: any) {
      onError(e.response?.data?.message || 'Erro ao salvar termo');
    }
  }

  function isCanvasBlank(canvas: HTMLCanvasElement) {
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() === blank.toDataURL();
  }

  function getCoordinates(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top
    };
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!ctx || !canvasRef.current) return;
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoordinates(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctx || !canvasRef.current) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e, canvasRef.current);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (ctx) ctx.closePath();
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="settingsGrid" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settingsCard" style={{ display: 'block', padding: 24, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}>
        <h3 style={{ marginTop: 0, color: '#0f172a' }}>Conexão WhatsApp</h3>
        <p style={{ color: '#475569', fontSize: 14 }}>
          Status: <strong style={{ color: waStatus?.status === 'connected' ? '#16a34a' : waStatus?.status === 'pending_qr' ? '#d97706' : '#ef4444' }}>
            {waStatus?.status === 'connected' ? 'Conectado' : waStatus?.status === 'pending_qr' ? 'Aguardando Leitura do QR' : waStatus?.status === 'disconnected' ? 'Desconectado' : waStatus?.status || 'Desconhecido'}
          </strong>
        </p>

        {waStatus?.status === 'connected' && (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 15 }}>
            <p style={{ color: '#16a34a', fontWeight: 'bold', margin: 0 }}>Conectado com o número: {waStatus.phoneNumber || '...'}</p>
            <button className="deleteBtn" onClick={disconnectWa}>Desconectar</button>
          </div>
        )}

        {waStatus?.status === 'pending_qr' && waStatus.qrCode && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 10 }}>Abra o WhatsApp no celular, vá em Aparelhos Conectados e leia o QR Code abaixo:</p>
            <img src={waStatus.qrCode} alt="QR Code" style={{ width: 250, height: 250, border: '1px solid #e2e8f0', borderRadius: 8 }} />
          </div>
        )}

        {(waStatus?.status === 'disconnected' || !waStatus?.status || waStatus?.status === 'failed') && (
          <div style={{ marginTop: 20 }}>
            {!hasSignedTerms ? (
              <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                <p style={{ color: '#991b1b', marginBottom: 12, fontSize: 14 }}>
                  Para utilizar a conexão com o WhatsApp, é necessário ler e assinar o Termo de Responsabilidade sobre os riscos de banimento da conta.
                </p>
                <button className="primaryAction" style={{ background: '#b91c1c', border: 'none', padding: '10px 16px', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }} onClick={() => { setTermsStep(1); setShowTermsModal(true); }}>
                  Ler e Assinar Termo
                </button>
              </div>
            ) : (
              <div>
                <button className="primaryAction" style={{ background: '#2563eb', border: 'none', padding: '10px 16px', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }} onClick={connectWa}>Gerar QR Code</button>
              </div>
            )}
          </div>
        )}

        {termsList.length > 0 && (
          <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
            {termsList.map(t => (
              <div key={t.id} style={{ background: '#ecfdf5', padding: '8px 12px', borderRadius: 6, fontSize: 13, color: '#065f46', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✓</span>
                <span>Termo de Responsabilidade Assinado dia {new Date(t.created_at).toLocaleDateString('pt-BR')} às {new Date(t.created_at).toLocaleTimeString('pt-BR')} por {t.responsavel_nome}.</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTermsModal && (
        <div className="scheduleModalOverlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="scheduleModal" style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '0', background: '#fff', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '15px 20px', background: '#991b1b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
              <strong>{termsStep === 1 ? 'Termo de Responsabilidade' : 'Assinatura do Termo de Responsabilidade'}</strong>
              <button type="button" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }} onClick={() => setShowTermsModal(false)}>✖ FECHAR</button>
            </div>

            {termsStep === 1 && (
              <div style={{ padding: '20px' }}>
                <div style={{ background: '#f8fafc', padding: 15, borderRadius: 6, marginBottom: 20, fontSize: 13, color: '#334155', lineHeight: '1.6' }}>
                  <strong>Leia com atenção</strong>
                  <br/><br/>
                  Eu, responsável pela clínica, reconheço e concordo com os seguintes termos e condições ao realizar a integração de WhatsApp:
                  <br/><br/>
                  1) O WhatsApp pode <strong>BANIR</strong> o seu número caso as mensagens sejam consideradas suspeitas ou denunciadas como SPAM.
                  <br/><br/>
                  2) Não nos responsabilizamos caso seu número seja banido. Estou ciente de que o OdontoHub não assume nenhuma responsabilidade.
                  <br/><br/>
                  3) A integração pode parar de funcionar sem aviso prévio caso o WhatsApp atualize suas políticas.
                </div>

                <div style={{ background: '#f1f5f9', padding: '15px', borderRadius: 6 }}>
                  <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#475569' }}>Informe os dados do responsável que <strong>autoriza a conexão</strong></p>
                  <div style={{ display: 'flex', gap: 15 }}>
                    <div style={{ flex: 2 }}>
                      <label className="formLabel" style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#475569' }}>Nome Completo do Responsável</label>
                      <input className="formInput" style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }} value={termsForm.nome} onChange={e => setTermsForm({...termsForm, nome: e.target.value})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="formLabel" style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#475569' }}>CPF</label>
                      <input className="formInput" style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }} value={termsForm.cpf} onChange={e => setTermsForm({...termsForm, cpf: e.target.value})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="formLabel" style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#475569' }}>Data Nascimento</label>
                      <input className="formInput" type="date" style={{ width: '100%', padding: 8, border: '1px solid #cbd5e1', borderRadius: 4 }} value={termsForm.data_nascimento} onChange={e => setTermsForm({...termsForm, data_nascimento: e.target.value})} />
                    </div>
                  </div>
                  
                  <button 
                    style={{ width: '100%', padding: 12, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', marginTop: 15 }}
                    onClick={() => {
                      if (!termsForm.nome || !termsForm.cpf) return alert('Preencha Nome e CPF');
                      setTermsStep(2);
                    }}
                  >
                    ✓ CONTINUAR
                  </button>
                </div>
              </div>
            )}

            {termsStep === 2 && (
              <div style={{ padding: '20px', background: '#e2e8f0', flex: 1 }}>
                <p style={{ color: '#475569', fontSize: 18, marginBottom: 15 }}>Assine na parte em branco</p>
                <div style={{ background: '#fff', borderRadius: 4, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    style={{ border: '1px solid #e2e8f0', cursor: 'crosshair', width: '100%', background: '#fff' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseOut={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: 15, marginTop: 20 }}>
                  <button style={{ flex: 1, padding: 15, background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }} onClick={saveTerms}>✓ SALVAR</button>
                  <button style={{ flex: 1, padding: 15, background: '#d97706', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }} onClick={clearSignature}>LIMPAR</button>
                  <button style={{ flex: 1, padding: 15, background: '#e2e8f0', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }} onClick={() => setShowTermsModal(false)}>✖ FECHAR</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

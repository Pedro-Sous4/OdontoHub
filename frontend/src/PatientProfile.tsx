import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api, setAuthToken } from './api';
import { Odontograma } from './Odontograma';

interface PatientProfileProps {
  token: string;
  patient: {
    id: string;
    nome: string;
    cpf: string | null;
    celular: string | null;
    email: string | null;
    categoria: string | null;
    created_at: string;
  };
  onBack: () => void;
  onError: (message: string) => void;
}

export function PatientProfile({ token, patient, onBack, onError }: PatientProfileProps) {
  const [activeTab, setActiveTab] = useState<'evolutions' | 'odontograma' | 'cadastro'>('odontograma');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEvolutionText, setNewEvolutionText] = useState('');
  const [addingEvolution, setAddingEvolution] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [patient.id]);

  async function loadRecords() {
    try {
      setLoading(true);
      setAuthToken(token);
      const res = await api.get(`/prontuario/records/${patient.id}`);
      // records e evolutions
      setRecords(res.data.records || []);
    } catch {
      onError('Não foi possível carregar o prontuário.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddEvolution() {
    if (!newEvolutionText.trim()) return;

    try {
      setAddingEvolution(true);
      // Aqui faria a criação de um record base se não existir e depois a evolução atrelada,
      // mas para o mock simplificado, apenas recarregamos após sucesso simulado.
      onError('Criação rápida de evolução ainda está em desenvolvimento na API.');
      setNewEvolutionText('');
    } catch {
      onError('Falha ao adicionar evolução.');
    } finally {
      setAddingEvolution(false);
    }
  }

  return (
    <div className="patientProfileContainer">
      <div className="profileHeader">
        <button className="secondary" onClick={onBack}>← Voltar</button>
        <div className="profileInfo">
          <h2>{patient.nome}</h2>
          <div className="profileTags">
            {patient.celular && <span>📱 {patient.celular}</span>}
            {patient.cpf && <span>CPF: {patient.cpf}</span>}
            {patient.categoria && <span className="tagCategory">{patient.categoria}</span>}
          </div>
        </div>
      </div>

      <div className="profileTabs">
        <button className={activeTab === 'odontograma' ? 'active' : ''} onClick={() => setActiveTab('odontograma')}>
          Odontograma
        </button>
        <button className={activeTab === 'evolutions' ? 'active' : ''} onClick={() => setActiveTab('evolutions')}>
          Evoluções
        </button>
        <button className={activeTab === 'cadastro' ? 'active' : ''} onClick={() => setActiveTab('cadastro')}>
          Cadastro
        </button>
      </div>

      <div className="profileContent">
        {activeTab === 'odontograma' && (
          <Odontograma token={token} patientId={patient.id} onError={onError} />
        )}

        {activeTab === 'evolutions' && (
          <div className="evolutionsPanel">
            <div className="addEvolutionBox">
              <textarea 
                placeholder="Descreva o procedimento atual, queixas ou evolução..."
                value={newEvolutionText}
                onChange={e => setNewEvolutionText(e.target.value)}
              />
              <button 
                className="primaryAction" 
                onClick={handleAddEvolution}
                disabled={addingEvolution}
              >
                {addingEvolution ? 'Salvando...' : 'Adicionar Evolução'}
              </button>
            </div>

            <div className="evolutionsTimeline">
              {loading ? (
                <p>Carregando histórico...</p>
              ) : records.length === 0 ? (
                <p className="emptyStateText">Nenhuma evolução clínica registrada até o momento.</p>
              ) : (
                records.map(record => (
                  <div key={record.id} className="timelineItem">
                    <div className="timelineDate">
                      {format(new Date(record.created_at), 'dd MMM yyyy - HH:mm', { locale: ptBR })}
                    </div>
                    <div className="timelineContent">
                      <p>{record.descricao}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'cadastro' && (
          <div className="cadastroPanel">
            <p className="emptyStateText">Visualização de dados cadastrais detalhada em breve.</p>
          </div>
        )}
      </div>
    </div>
  );
}

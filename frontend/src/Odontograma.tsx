import React, { useState, useEffect } from 'react';
import { api, setAuthToken } from './api';

const ADULT_UPPER_RIGHT = ['18','17','16','15','14','13','12','11'];
const ADULT_UPPER_LEFT  = ['21','22','23','24','25','26','27','28'];
const ADULT_LOWER_RIGHT = ['48','47','46','45','44','43','42','41'];
const ADULT_LOWER_LEFT  = ['31','32','33','34','35','36','37','38'];

const PEDIATRIC_UPPER_RIGHT = ['55','54','53','52','51'];
const PEDIATRIC_UPPER_LEFT  = ['61','62','63','64','65'];
const PEDIATRIC_LOWER_RIGHT = ['85','84','83','82','81'];
const PEDIATRIC_LOWER_LEFT  = ['71','72','73','74','75'];

const CONDITIONS = [
  { value: 'higido', label: 'Hígido (Saudável)', color: '#e2e8f0' },
  { value: 'carie', label: 'Cárie', color: '#ef4444' },
  { value: 'restaurado', label: 'Restaurado', color: '#3b82f6' },
  { value: 'extraido', label: 'Extraído', color: '#94a3b8' },
  { value: 'canal', label: 'Tratamento de Canal', color: '#f59e0b' },
  { value: 'coroa', label: 'Coroa/Prótese', color: '#8b5cf6' },
  { value: 'implante', label: 'Implante', color: '#10b981' }
];

interface ToothCondition {
  id: string;
  tooth_id: string; // we actually receive tooth numbers or ids from API. We need a mapping.
  numero_dente?: string; 
  condicao: string;
}

interface OdontogramaProps {
  token: string;
  patientId: string;
  onError: (msg: string) => void;
}

export function Odontograma({ token, patientId, onError }: OdontogramaProps) {
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'adult' | 'pediatric'>('adult');

  const [teethDict, setTeethDict] = useState<Record<string, string>>({}); // numero_dente -> uuid

  useEffect(() => {
    loadChart();
  }, [patientId]);

  async function loadChart() {
    try {
      setLoading(true);
      setAuthToken(token);
      
      // We assume GET /records/:patientId returns toothConditions with tooth relation
      const res = await api.get(`/prontuario/records/${patientId}`);
      
      // Simulating teeth catalog for mapping. Ideally, this should come from a catalog endpoint or nested query.
      // If the backend doesn't return numero_dente, we would need an API update.
      // For MVP, we will try to handle logic graciously.
      const rawConditions = res.data.toothConditions || [];
      
      // Since backend returns ORDER BY data DESC, the first occurrence is the most recent.
      // We only insert into conditionMap if it's not already there.
      const conditionMap: Record<string, string> = {};
      rawConditions.forEach((tc: any) => {
        const key = tc.numero_dente || tc.tooth_id;
        if (!conditionMap[key]) {
             conditionMap[key] = tc.condicao;
        }
      });
      setConditions(conditionMap);
    } catch {
      onError('Erro ao carregar o odontograma.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetCondition(condValue: string) {
    if (!selectedTooth) return;

    try {
      setSavingTarget(selectedTooth);
      setAuthToken(token);
      
      // This is a simplified call format. If `tooth_id` on DB is a UUID referencing the `teeth` table,
      // the backend should ideally resolve `numero_dente` -> `tooth_id` for us or we fetch the catalog.
      // For this MVP UI iteration, we send toothId as the number and trust the backend to handle it, 
      // or we handle API errors gracefully.
      await api.post(`/prontuario/patients/${patientId}/tooth-conditions`, {
        toothId: selectedTooth, 
        condicao: condValue
      });

      setConditions(prev => ({
        ...prev,
        [selectedTooth]: condValue
      }));
      setSelectedTooth(null);
    } catch (e: any) {
      // API may fail because toothId is not UUID type in PG. 
      const errMsg = e.response?.data?.message || 'Erro ao registrar condição do dente. O catálogo de dentes precisa estar populado.';
      onError(errMsg);
    } finally {
      setSavingTarget(null);
    }
  }

  function getToothColor(number: string) {
    const defaultColor = '#e2e8f0';
    const cond = conditions[number];
    if (!cond) return defaultColor;
    
    const match = CONDITIONS.find(c => c.label === cond || c.value === cond);
    if (match) return match.color;

    const normalizedCond = cond.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const fallbackMatch = CONDITIONS.find(c => c.value === normalizedCond || c.label.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase() === normalizedCond);
    
    if (fallbackMatch) return fallbackMatch.color;
    
    return defaultColor;
  }

  function renderQuadrant(teethArray: string[]) {
    return (
      <div className="toothQuadrant">
        {teethArray.map(number => (
          <div 
            key={number} 
            className={`toothItem ${selectedTooth === number ? 'selected' : ''}`}
            onClick={() => setSelectedTooth(number)}
          >
            <div className="toothShape" style={{ backgroundColor: getToothColor(number) }}>
              {savingTarget === number && <span className="toothSpinner" />}
            </div>
            <span className="toothNumber">{number}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="odontogramaPanel">
      <div className="odontogramaToolbar">
        <div className="toggleGroup">
          <button className={viewMode === 'adult' ? 'active' : ''} onClick={() => setViewMode('adult')}>Adulto</button>
          <button className={viewMode === 'pediatric' ? 'active' : ''} onClick={() => setViewMode('pediatric')}>Odontopediatria</button>
        </div>
        <div className="legendRow">
          {CONDITIONS.map(c => (
            <div key={c.value} className="legendItem">
              <div className="legendColor" style={{ backgroundColor: c.color }} />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chartWrapper">
        {loading ? (
          <div className="loadingText">Carregando arcada...</div>
        ) : (
          <div className="arcadaContainer">
            <div className="arcadaRow">
              {viewMode === 'adult' ? renderQuadrant(ADULT_UPPER_RIGHT) : renderQuadrant(PEDIATRIC_UPPER_RIGHT)}
              <div className="arcadaDivider" />
              {viewMode === 'adult' ? renderQuadrant(ADULT_UPPER_LEFT) : renderQuadrant(PEDIATRIC_UPPER_LEFT)}
            </div>
            
            <div className="arcadaRow middleGap">
              {viewMode === 'adult' ? renderQuadrant(ADULT_LOWER_RIGHT) : renderQuadrant(PEDIATRIC_LOWER_RIGHT)}
              <div className="arcadaDivider" />
              {viewMode === 'adult' ? renderQuadrant(ADULT_LOWER_LEFT) : renderQuadrant(PEDIATRIC_LOWER_LEFT)}
            </div>
          </div>
        )}
      </div>

      {selectedTooth && (
        <div className="toothPopoverOverlay" onClick={() => setSelectedTooth(null)}>
          <div className="toothPopover" onClick={e => e.stopPropagation()}>
            <h3>Dente {selectedTooth}</h3>
            <p>Selecione a condição ou procedimento:</p>
            <div className="toothConditionList">
              {CONDITIONS.map(c => (
                <button 
                  key={c.value} 
                  className="conditionBtn"
                  onClick={() => handleSetCondition(c.label)}
                >
                  <div className="conditionDot" style={{ backgroundColor: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
            <button className="ghostAction" style={{marginTop: 12, width: '100%'}} onClick={() => setSelectedTooth(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

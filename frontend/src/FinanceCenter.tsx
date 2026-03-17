import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api, setAuthToken } from './api';

type FinanceTransaction = {
  id: string;
  patient_id: string;
  appointment_id: string | null;
  valor: string | number;
  forma_pagamento: string;
  status: string;
  created_at: string;
};

type PatientListItem = {
  id: string;
  nome: string;
};

type FinanceForm = {
  patientId: string;
  appointmentId: string;
  valor: string;
  formaPagamento: string;
  status: string;
};

interface FinanceCenterProps {
  token: string;
  onError: (message: string) => void;
}

const emptyForm: FinanceForm = {
  patientId: '',
  appointmentId: '',
  valor: '',
  formaPagamento: 'pix',
  status: 'pending'
};

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado'
};

export function FinanceCenter({ token, onError }: FinanceCenterProps) {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FinanceForm>(emptyForm);

  const patientNameById = useMemo(() => {
    return new Map(patients.map((item) => [item.id, item.nome]));
  }, [patients]);

  async function loadFinanceData() {
    if (!token) {
      setTransactions([]);
      setPatients([]);
      return;
    }

    try {
      setLoading(true);
      setAuthToken(token);

      const [transactionsResponse, patientsResponse] = await Promise.all([
        api.get<FinanceTransaction[]>('/finance/transactions'),
        api.get<PatientListItem[]>('/patients')
      ]);

      setTransactions(transactionsResponse.data);
      setPatients(patientsResponse.data);

      setForm((prev) => ({
        ...prev,
        patientId: prev.patientId || patientsResponse.data[0]?.id || ''
      }));
    } catch {
      onError('Falha ao carregar dados do financeiro.');
    } finally {
      setLoading(false);
    }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      onError('Informe o JWT para registrar transação.');
      return;
    }

    if (!form.patientId || !form.valor || Number(form.valor) <= 0) {
      onError('Selecione paciente e informe valor válido.');
      return;
    }

    try {
      setSubmitting(true);
      setAuthToken(token);

      await api.post('/finance/transactions', {
        patientId: form.patientId,
        appointmentId: form.appointmentId.trim() || null,
        valor: Number(form.valor),
        formaPagamento: form.formaPagamento,
        status: form.status
      });

      setForm((prev) => ({ ...emptyForm, patientId: prev.patientId }));
      await loadFinanceData();
    } catch {
      onError('Falha ao registrar transação.');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadFinanceData();
  }, [token]);

  if (!token) {
    return <div className="patientsPlaceholder">Informe o JWT e clique em Atualizar para ver o financeiro.</div>;
  }

  return (
    <section className="patientsPanel">
      <header className="patientsHeader">
        <h2>Financeiro</h2>
      </header>

      <form className="patientForm" onSubmit={createTransaction}>
        <label>
          Paciente *
          <select
            value={form.patientId}
            onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
            required
          >
            <option value="">Selecione</option>
            {patients.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.nome}</option>
            ))}
          </select>
        </label>

        <label>
          Valor (R$) *
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.valor}
            onChange={(event) => setForm((prev) => ({ ...prev, valor: event.target.value }))}
            required
          />
        </label>

        <label>
          Forma de pagamento *
          <select
            value={form.formaPagamento}
            onChange={(event) => setForm((prev) => ({ ...prev, formaPagamento: event.target.value }))}
            required
          >
            <option value="pix">PIX</option>
            <option value="cartao_credito">Cartão de crédito</option>
            <option value="cartao_debito">Cartão de débito</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="boleto">Boleto</option>
          </select>
        </label>

        <label>
          Status *
          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            required
          >
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>

        <label>
          ID da consulta (opcional)
          <input
            value={form.appointmentId}
            onChange={(event) => setForm((prev) => ({ ...prev, appointmentId: event.target.value }))}
            placeholder="UUID da consulta"
          />
        </label>

        <div className="patientFormActions">
          <button type="button" className="ghostAction" onClick={() => setForm((prev) => ({ ...emptyForm, patientId: prev.patientId }))}>
            Limpar
          </button>
          <button type="submit" className="primaryAction" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Lançar transação'}
          </button>
        </div>
      </form>

      <div className="patientsToolbar financeToolbar">
        <button onClick={loadFinanceData} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar lançamentos'}</button>
      </div>

      <div className="patientsTableWrapper">
        <table className="patientsTable">
          <thead>
            <tr>
              <th>Data</th>
              <th>Paciente</th>
              <th>Forma</th>
              <th>Status</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="emptyPatients">Nenhum lançamento financeiro.</td>
              </tr>
            ) : (
              transactions.map((transaction) => {
                const valueNumber = typeof transaction.valor === 'string' ? Number(transaction.valor) : transaction.valor;
                return (
                  <tr key={transaction.id}>
                    <td>{format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                    <td>{patientNameById.get(transaction.patient_id) ?? transaction.patient_id}</td>
                    <td>{transaction.forma_pagamento}</td>
                    <td>{statusLabel[transaction.status] ?? transaction.status}</td>
                    <td>{valueNumber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api, setAuthToken } from './api';

type FinanceTransaction = {
  id: string;
  patient_id: string | null;
  appointment_id: string | null;
  valor: string | number;
  forma_pagamento: string;
  status: string;
  created_at: string;
  valor_pago?: string | number;
  tipo_origem?: string;
  origem_nome?: string;
  tipo_transacao?: string;
  observacao?: string;
  pagamentos?: Array<{
    id: string;
    valor: string | number;
    forma_pagamento: string;
    created_at: string;
    comprovante_key?: string;
    observacao?: string;
  }>;
};

type FinanceSource = {
  id: string;
  tipo: 'consultorio' | 'empresa';
  nome: string;
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
  createdAt: string;
  tipoOrigem: string;
  origemNome: string;
  valorSinal: string;
  tipoTransacao: string;
  observacao: string;
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
  status: 'pending',
  createdAt: '',
  tipoOrigem: 'paciente',
  origemNome: '',
  valorSinal: '',
  tipoTransacao: 'receita',
  observacao: ''
};

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  cancelled: 'Cancelado'
};

const paymentLabels: Record<string, string> = {
  pix: 'PIX',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto'
};

function getLocalDatetimeString(date = new Date()) {
  const tzoffset = date.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  return localISOTime;
}

function getLocalDateString(date = new Date()) {
  const tzoffset = date.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 10);
  return localISOTime;
}

export function FinanceCenter({ token, onError }: FinanceCenterProps) {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [sources, setSources] = useState<FinanceSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FinanceForm>(emptyForm);
  const [showFormModal, setShowFormModal] = useState(false);

  // Filtro por Período e Busca/Filtros Avançados
  const [periodFilter, setPeriodFilter] = useState('current_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchPatient, setSearchPatient] = useState('');
  const [filterConsultorio, setFilterConsultorio] = useState('TODOS');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all'); // 'all' | 'receita' | 'despesa'

  // Modais e Estados da transação selecionada
  const [selectedTransaction, setSelectedTransaction] = useState<FinanceTransaction | null>(null);
  
  // Modal 1: Registrar Recebimento / Baixa Parcial (Principal)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<{ filename: string; contentType: string; base64: string } | null>(null);
  const [paymentObservation, setPaymentObservation] = useState('');

  // Modal 2: Editar Cadastro do Lançamento (Secundário)
  const [editForm, setEditForm] = useState<FinanceForm>(emptyForm);
  const [showEditModal, setShowEditModal] = useState(false);

  // Modal 3: Adicionar Parceiro Inline (Substituindo prompt)
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceType, setNewSourceType] = useState<'consultorio' | 'empresa'>('consultorio');

  // Modal de Confirmação de Exclusão Customizado (Padrão Ouro UX)
  const [confirmDelete, setConfirmDelete] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Modal de visualização de observação individual
  const [viewObservationText, setViewObservationText] = useState<string | null>(null);

  const patientNameById = useMemo(() => {
    return new Map(patients.map((item) => [item.id, item.nome]));
  }, [patients]);

  // Transações filtradas por data local e filtros avançados
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Filtro por Período
      const date = new Date(t.created_at);
      const now = new Date();
      let matchPeriod = true;

      if (periodFilter === 'current_month') {
        matchPeriod = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      } else if (periodFilter === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        matchPeriod = date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
      } else if (periodFilter === 'last_30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchPeriod = date >= thirtyDaysAgo;
      } else if (periodFilter === 'current_year') {
        matchPeriod = date.getFullYear() === now.getFullYear();
      } else if (periodFilter === 'custom') {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate + 'T00:00:00');
          const end = new Date(customEndDate + 'T23:59:59');
          matchPeriod = date >= start && date <= end;
        }
      }

      if (!matchPeriod) return false;

      // 2. Filtro por Busca de Paciente
      if (searchPatient.trim()) {
        const patientName = patientNameById.get(t.patient_id || '')?.toLowerCase() || '';
        if (!patientName.includes(searchPatient.toLowerCase())) return false;
      }

      // 3. Filtro por Consultório
      if (filterConsultorio !== 'TODOS') {
        const transConsultorio = t.origem_nome || '';
        if (transConsultorio.toLowerCase() !== filterConsultorio.toLowerCase()) return false;
      }

      // 4. Filtro por Situação (Status)
      if (filterStatus !== 'all') {
        if (t.status !== filterStatus) return false;
      }

      // 5. Filtro por Tipo de Lançamento
      if (filterTipo !== 'all') {
        const transTipo = t.tipo_transacao || 'receita';
        if (transTipo !== filterTipo) return false;
      }

      return true;
    });
  }, [transactions, periodFilter, customStartDate, customEndDate, searchPatient, filterConsultorio, filterStatus, filterTipo, patientNameById]);

  const totals = useMemo(() => {
    let paid = 0;       // Recebido (receitas quitadas)
    let pending = 0;    // Pendente (receitas em aberto)
    let expenses = 0;   // Despesas (valores totais de despesas)
    
    filteredTransactions.forEach((t) => {
      const isExpense = t.tipo_transacao === 'despesa';
      const val = typeof t.valor === 'string' ? Number(t.valor) : t.valor;
      const paidVal = typeof t.valor_pago === 'string' ? Number(t.valor_pago) : (t.valor_pago ?? 0);
      
      if (isExpense) {
        expenses += val;
      } else {
        paid += paidVal;
        if (t.status === 'pending') {
          pending += Math.max(0, val - paidVal);
        }
      }
    });
    return { paid, pending, expenses, saldo: paid - expenses };
  }, [filteredTransactions]);

  // Função para exportação em Excel com layout e formatação customizados (Padrão Ouro UX)
  const handleExportExcel = () => {
    const rows = filteredTransactions.map((t) => {
      const dateStr = format(new Date(t.created_at), 'dd/MM/yyyy');
      const consultorio = t.origem_nome || '';
      const paciente = t.tipo_transacao === 'despesa' ? 'Despesa' : (patientNameById.get(t.patient_id || '') || '');
      const tipo = t.tipo_transacao === 'despesa' ? 'Despesa' : 'Receita';
      const forma = paymentLabels[t.forma_pagamento] || t.forma_pagamento;
      const status = t.status === 'paid' ? 'Pago' : (t.status === 'pending' && new Date(t.created_at).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) ? 'Atrasado' : 'Pendente');
      
      const val = typeof t.valor === 'string' ? Number(t.valor) : (t.valor || 0);
      const valSigned = t.tipo_transacao === 'despesa' ? -val : val;
      const paidVal = typeof t.valor_pago === 'string' ? Number(t.valor_pago) : (t.valor_pago ?? 0);
      const paidSigned = t.tipo_transacao === 'despesa' ? -paidVal : paidVal;

      return {
        dateStr,
        consultorio,
        paciente,
        tipo,
        forma,
        status,
        valor: valSigned,
        valorPago: paidSigned
      };
    });

    const xmlTemplate = `<?xml version="1.0" encoding="utf-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>OdontoHub</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#70ad47" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="HeaderRight">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#70ad47" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#e2e8f0"/>
   </Borders>
  </Style>
  <Style ss:ID="DateCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
   </Borders>
  </Style>
  <Style ss:ID="TextCell">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
   </Borders>
  </Style>
  <Style ss:ID="CurrencyCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00;[Red]\-&quot;R$&quot;\ #,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#f1f5f9"/>
   </Borders>
  </Style>
 </Styles>
 <Worksheet ss:Name="Financeiro">
  <Table>
   <Column ss:Width="90"/>
   <Column ss:Width="120"/>
   <Column ss:Width="140"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="90"/>
   <Column ss:Width="100"/>
   <Column ss:Width="100"/>
   <Row ss:Height="24">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Data</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Consultório</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Paciente/Origem</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Forma</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell>
    <Cell ss:StyleID="HeaderRight"><Data ss:Type="String">Valor</Data></Cell>
    <Cell ss:StyleID="HeaderRight"><Data ss:Type="String">Valor Pago</Data></Cell>
   </Row>
   ${rows.map(row => `
   <Row ss:Height="20">
    <Cell ss:StyleID="DateCell"><Data ss:Type="String">${row.dateStr}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${row.consultorio}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${row.paciente}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${row.tipo}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${row.forma}</Data></Cell>
    <Cell ss:StyleID="TextCell"><Data ss:Type="String">${row.status}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${row.valor}</Data></Cell>
    <Cell ss:StyleID="CurrencyCell"><Data ss:Type="Number">${row.valorPago}</Data></Cell>
   </Row>`).join('')}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OdontoHub_Financeiro_${format(new Date(), 'yyyy-MM-dd')}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function loadFinanceData() {
    if (!token) {
      setTransactions([]);
      setPatients([]);
      setSources([]);
      return;
    }

    try {
      setLoading(true);
      setAuthToken(token);

      const [transactionsResponse, patientsResponse, sourcesResponse] = await Promise.all([
        api.get<FinanceTransaction[]>('/finance/transactions'),
        api.get<PatientListItem[]>('/patients'),
        api.get<FinanceSource[]>('/finance/sources')
      ]);

      setTransactions(transactionsResponse.data);
      setPatients(patientsResponse.data);
      setSources(sourcesResponse.data);

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

  // Abre modal inline de parceiros
  function openAddSourceInline(tipo: 'consultorio' | 'empresa') {
    setNewSourceType(tipo);
    setNewSourceName('');
    setShowAddSourceModal(true);
  }

  async function handleAddSourceSave() {
    if (!newSourceName.trim()) return;
    try {
      setAuthToken(token);
      const res = await api.post<FinanceSource>('/finance/sources', {
        tipo: newSourceType,
        nome: newSourceName.trim()
      });
      setSources(prev => [...prev, res.data]);
      if (showFormModal) {
        setForm(prev => ({ ...prev, origemNome: res.data.nome }));
      } else if (showEditModal) {
        setEditForm(prev => ({ ...prev, origemNome: res.data.nome }));
      }
      setShowAddSourceModal(false);
    } catch {
      onError('Falha ao adicionar novo parceiro.');
    }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      onError('Informe o JWT para registrar transação.');
      return;
    }

    if (form.tipoTransacao === 'receita' && !form.patientId) {
      onError('Selecione um paciente.');
      return;
    }

    if (form.tipoTransacao === 'receita' && !form.origemNome.trim()) {
      onError('Selecione ou adicione o consultório.');
      return;
    }

    if (!form.valor || Number(form.valor) <= 0) {
      onError('Informe um valor válido.');
      return;
    }

    try {
      setSubmitting(true);
      setAuthToken(token);

      await api.post('/finance/transactions', {
        patientId: form.tipoTransacao === 'receita' ? form.patientId : null,
        appointmentId: form.appointmentId.trim() || null,
        valor: Number(form.valor),
        formaPagamento: form.tipoTransacao === 'receita' ? form.formaPagamento : 'pix',
        status: form.status,
        createdAt: form.createdAt ? new Date(form.createdAt).toISOString() : new Date().toISOString(),
        tipoOrigem: 'consultorio',
        origemNome: form.tipoTransacao === 'receita' ? form.origemNome : null,
        valorSinal: form.tipoTransacao === 'receita' && form.valorSinal ? Number(form.valorSinal) : 0,
        tipoTransacao: form.tipoTransacao,
        observacao: form.observacao
      });

      setForm((prev) => ({ ...emptyForm, patientId: prev.patientId }));
      await loadFinanceData();
    } catch (err: any) {
      onError(err?.response?.data?.message ?? 'Falha ao registrar transação.');
    } finally {
      setSubmitting(false);
    }
  }

  // Abre Modal 1: Apenas Registrar Pagamento/Recebimento
  function openPaymentModal(transaction: FinanceTransaction) {
    setSelectedTransaction(transaction);
    setPaymentAmount('');
    setPaymentDate(getLocalDateString());
    setPaymentMethod(transaction.forma_pagamento);
    setEditingPaymentId(null);
    setShowPaymentModal(true);
  }

  function openEditDetailsModal() {
    if (!selectedTransaction) return;
    setEditForm({
      patientId: selectedTransaction.patient_id || '',
      appointmentId: selectedTransaction.appointment_id || '',
      valor: String(selectedTransaction.valor),
      formaPagamento: selectedTransaction.forma_pagamento,
      status: selectedTransaction.status,
      createdAt: getLocalDateString(new Date(selectedTransaction.created_at)),
      tipoOrigem: selectedTransaction.tipo_origem || 'paciente',
      origemNome: selectedTransaction.origem_nome || '',
      valorSinal: '',
      tipoTransacao: selectedTransaction.tipo_transacao || 'receita',
      observacao: selectedTransaction.observacao || ''
    });
    setShowPaymentModal(false);
    setShowEditModal(true);
  }

  // Abre o comprovante anexado em uma nova aba de maneira autenticada
  async function handleViewReceipt(key: string) {
    try {
      setAuthToken(token);
      const response = await api.get(`/finance/payments/receipt/${key}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error(err);
      onError('Não foi possível carregar o comprovante.');
    }
  }

  // Aciona a edição de uma parcela no form superior
  function handleStartEditPayment(p: { id: string; valor: string | number; forma_pagamento: string; created_at: string; comprovante_key?: string; observacao?: string }) {
    setEditingPaymentId(p.id);
    setPaymentAmount(String(p.valor));
    setPaymentMethod(p.forma_pagamento);
    setPaymentDate(getLocalDateString(new Date(p.created_at)));
    setReceiptFile(null); // Reseta qualquer anexo pendente do formulário
    setPaymentObservation(p.observacao || '');
  }

  // Cancela a edição de uma parcela e limpa os campos
  function handleCancelEditPayment() {
    setEditingPaymentId(null);
    setPaymentAmount('');
    setPaymentDate(getLocalDateString());
    setPaymentObservation('');
  }

  // Exclui uma parcela do histórico
  function handleDeletePayment(paymentId: string) {
    setConfirmDelete({
      show: true,
      title: 'Excluir Parcela de Pagamento',
      message: 'Esta ação irá remover permanentemente esta parcela de recebimento e recalcular os saldos do lançamento. Deseja continuar?',
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setAuthToken(token);
          await api.delete(`/finance/payments/${paymentId}`);

          await loadFinanceData();
          // Atualiza o estado do modal re-pesquisando a transação atualizada
          const res = await api.get<FinanceTransaction[]>('/finance/transactions');
          const updated = res.data.find(t => t.id === selectedTransaction?.id);
          if (updated) {
            setSelectedTransaction(updated);
          } else {
            setShowPaymentModal(false);
          }
        } catch {
          onError('Falha ao excluir parcela de pagamento.');
        } finally {
          setSubmitting(false);
          setConfirmDelete((prev) => ({ ...prev, show: false }));
        }
      }
    });
  }

  // Envia ou atualiza pagamento a partir do Modal 1
  async function handleRegisterPayment(event: FormEvent) {
    event.preventDefault();
    if (!token || !selectedTransaction) return;

    const originalValue = Number(selectedTransaction.valor);
    const paidValue = Number(paymentAmount);

    if (paidValue <= 0) {
      onError('Digite um valor de pagamento válido.');
      return;
    }

    try {
      setSubmitting(true);
      setAuthToken(token);

      if (editingPaymentId) {
        // Modo Edição de parcela
        await api.put(`/finance/payments/${editingPaymentId}`, {
          valor: paidValue,
          formaPagamento: paymentMethod,
          createdAt: new Date(paymentDate).toISOString(),
          comprovante: receiptFile,
          observacao: paymentObservation
        });
      } else {
        // Modo Novo pagamento / abatimento
        await api.put(`/finance/transactions/${selectedTransaction.id}`, {
          patientId: selectedTransaction.patient_id,
          appointmentId: selectedTransaction.appointment_id,
          valor: originalValue,
          formaPagamento: selectedTransaction.forma_pagamento,
          status: selectedTransaction.status,
          createdAt: selectedTransaction.created_at,
          valorPago: paidValue,
          paymentMethod: paymentMethod,
          paymentDate: new Date(paymentDate).toISOString(),
          tipoOrigem: selectedTransaction.tipo_origem || 'paciente',
          origemNome: selectedTransaction.origem_nome || null,
          comprovante: receiptFile,
          observacao: paymentObservation,
          tipoTransacao: selectedTransaction.tipo_transacao || 'receita'
        });
      }

      setPaymentAmount('');
      setEditingPaymentId(null);
      setReceiptFile(null); // Limpa o comprovante após salvar
      setPaymentObservation(''); // Limpa a observação após salvar
      await loadFinanceData();
      
      // Atualiza a transação exibida no modal
      const res = await api.get<FinanceTransaction[]>('/finance/transactions');
      const updated = res.data.find(t => t.id === selectedTransaction.id);
      if (updated) {
        setSelectedTransaction(updated);
      }
    } catch (err: any) {
      console.error(err);
      onError(err?.response?.data?.message ?? 'Falha ao processar pagamento.');
    } finally {
      setSubmitting(false);
    }
  }

  // Salva edições principais do Modal 2
  async function handleSaveEditDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedTransaction) return;

    try {
      setSubmitting(true);
      setAuthToken(token);

      await api.put(`/finance/transactions/${selectedTransaction.id}`, {
        patientId: editForm.tipoTransacao === 'receita' ? editForm.patientId : null,
        appointmentId: editForm.appointmentId.trim() || null,
        valor: Number(editForm.valor),
        formaPagamento: editForm.tipoTransacao === 'receita' ? editForm.formaPagamento : 'pix',
        status: editForm.status,
        createdAt: new Date(editForm.createdAt.includes('T') ? editForm.createdAt : editForm.createdAt + 'T00:00:00').toISOString(),
        valorPago: 0,
        tipoOrigem: 'consultorio',
        origemNome: editForm.tipoTransacao === 'receita' ? editForm.origemNome : null,
        tipoTransacao: editForm.tipoTransacao,
        observacao: editForm.observacao
      });

      setShowEditModal(false);
      setSelectedTransaction(null);
      await loadFinanceData();
    } catch (err: any) {
      console.error(err);
      onError(err?.response?.data?.message ?? 'Falha ao atualizar dados do lançamento.');
    } finally {
      setSubmitting(false);
    }
  }

  function deleteTransaction() {
    if (!token || !selectedTransaction) return;

    setConfirmDelete({
      show: true,
      title: 'Excluir Lançamento Financeiro',
      message: 'ATENÇÃO: Esta ação removerá permanentemente este lançamento e todas as suas parcelas/recebimentos vinculados. Esta operação não pode ser desfeita.',
      onConfirm: async () => {
        try {
          setSubmitting(true);
          setAuthToken(token);
          await api.delete(`/finance/transactions/${selectedTransaction.id}`);
          setShowEditModal(false);
          setSelectedTransaction(null);
          await loadFinanceData();
        } catch (err: any) {
          onError(err?.response?.data?.message ?? 'Falha ao excluir transação.');
        } finally {
          setSubmitting(false);
          setConfirmDelete((prev) => ({ ...prev, show: false }));
        }
      }
    });
  }

  useEffect(() => {
    void loadFinanceData();
  }, [token]);

  if (!token) {
    return (
      <div className="patientsPlaceholder">
        <p>Por favor, faça login para acessar a área financeira.</p>
      </div>
    );
  }

  return (
    <section className="patientsPanel" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <header className="patientsHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.5px' }}>Financeiro</h2>
        <button 
          type="button" 
          onClick={() => { setShowFormModal(true); setForm({ ...emptyForm, patientId: patients[0]?.id || '', createdAt: getLocalDatetimeString() }); }}
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
        >
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>+</span> Novo Recebimento
        </button>
      </header>

      <div className="financeSummary" style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div className="summaryCard" style={{ background: '#fff', padding: '16px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Recebido</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>{totals.paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
        <div className="summaryCard" style={{ background: '#fff', padding: '16px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Pendente</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ca8a04' }}>{totals.pending.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
        <div className="summaryCard" style={{ background: '#fff', padding: '16px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Despesas</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>{totals.expenses.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
        <div className="summaryCard" style={{ background: '#fff', padding: '16px', borderRadius: '8px', flex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>Saldo Real</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', color: totals.saldo >= 0 ? '#2563eb' : '#b91c1c' }}>{totals.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
      </div>

      <div className="financeFilters" style={{ 
        display: 'flex', 
        gap: '16px', 
        alignItems: 'center', 
        marginBottom: '24px', 
        flexWrap: 'wrap', 
        background: '#f8fafc', 
        padding: '16px 20px', 
        borderRadius: '12px', 
        border: '1px solid #e2e8f0', 
      }}>
        
        {/* Buscar Paciente */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 220px', position: 'relative' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Buscar Paciente</span>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94a3b8', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="Digitar nome..."
              value={searchPatient}
              onChange={(e) => setSearchPatient(e.target.value)}
              style={{ 
                padding: '8px 12px 8px 32px', 
                borderRadius: '8px', 
                border: '1px solid #cbd5e1', 
                fontSize: '13px', 
                width: '100%', 
                boxSizing: 'border-box', 
                background: '#fff', 
                color: '#0f172a', 
                outline: 'none',
                transition: 'all 0.15s ease' 
              }}
            />
          </div>
        </div>

        {/* Consultório */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px', flex: '1 1 160px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consultório</span>
          <select
            value={filterConsultorio}
            onChange={(e) => setFilterConsultorio(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid #cbd5e1', 
              background: '#fff', 
              fontSize: '13px', 
              color: '#0f172a', 
              cursor: 'pointer', 
              width: '100%', 
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <option value="TODOS">TODOS</option>
            {sources
              .filter((s) => s.tipo === 'consultorio')
              .map((source) => (
                <option key={source.id} value={source.nome}>{source.nome}</option>
              ))}
          </select>
        </div>

        {/* Período */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '150px', flex: '1 1 150px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Período</span>
          <select 
            value={periodFilter} 
            onChange={(e) => setPeriodFilter(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid #cbd5e1', 
              background: '#fff', 
              fontSize: '13px', 
              color: '#0f172a', 
              cursor: 'pointer', 
              width: '100%', 
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <option value="current_month">Mês Atual</option>
            <option value="last_month">Mês Anterior</option>
            <option value="last_30_days">Últimos 30 dias</option>
            <option value="current_year">Ano Atual</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {/* Período Customizado */}
        {periodFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>De</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', outline: 'none' }}
              />
            </div>
            <span style={{ fontSize: '13px', color: '#64748b', paddingBottom: '10px' }}>até</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Até</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#0f172a', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Tipo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: '1 1 130px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</span>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid #cbd5e1', 
              background: '#fff', 
              fontSize: '13px', 
              color: '#0f172a', 
              cursor: 'pointer', 
              width: '100%', 
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <option value="all">Todos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
        </div>

        {/* Situação */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '130px', flex: '1 1 130px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Situação</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid #cbd5e1', 
              background: '#fff', 
              fontSize: '13px', 
              color: '#0f172a', 
              cursor: 'pointer', 
              width: '100%', 
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <option value="all">Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        {/* Botão Limpar */}
        <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-end', height: '36px', marginLeft: '8px' }}>
          {(searchPatient || filterConsultorio !== 'TODOS' || filterStatus !== 'all' || periodFilter !== 'current_month' || filterTipo !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchPatient('');
                setFilterConsultorio('TODOS');
                setFilterStatus('all');
                setFilterTipo('all');
                setPeriodFilter('current_month');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              style={{ 
                padding: '8px 14px', 
                background: 'transparent', 
                color: '#ef4444', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontSize: '13px', 
                fontWeight: '600', 
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              🧹 Limpar Filtros
            </button>
          )}
        </div>

        {/* Botão Exportar Excel */}
        <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-end', height: '36px', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            style={{ 
              padding: '8px 14px', 
              background: '#fff', 
              color: '#475569', 
              border: '1px solid #cbd5e1', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '13px', 
              fontWeight: '600', 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            📥 Exportar Excel
          </button>
        </div>
      </div>

      <div className="patientsTableWrapper" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <table className="patientsTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Data</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Consultório</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Paciente</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Forma</th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: '#64748b' }}>Valor</th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#64748b', width: '100px' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>Nenhum lançamento financeiro para o período selecionado.</td>
              </tr>
            ) : (
              filteredTransactions.map((transaction) => {
                const val = typeof transaction.valor === 'string' ? Number(transaction.valor) : transaction.valor;
                const paidVal = typeof transaction.valor_pago === 'string' ? Number(transaction.valor_pago) : (transaction.valor_pago ?? 0);
                const pendingVal = val - paidVal;
                const isExpense = transaction.tipo_transacao === 'despesa';

                const displayConsultorio = transaction.origem_nome || '-';
                const displayPaciente = isExpense 
                  ? 'Despesa'
                  : (patientNameById.get(transaction.patient_id || '') ?? '-');

                const isOverdue = transaction.status === 'pending' && new Date(transaction.created_at).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);

                return (
                  <tr key={transaction.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#334155' }}>{format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#334155', fontWeight: '500' }}>{displayConsultorio}</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#334155' }}>{displayPaciente}</td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{paymentLabels[transaction.forma_pagamento] ?? transaction.forma_pagamento}</span>
                        {transaction.pagamentos?.some(p => p.comprovante_key) && (
                          <button
                            type="button"
                            title="Ver Comprovantes Anexados"
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setPaymentAmount('');
                              setEditingPaymentId(null);
                              setPaymentMethod(transaction.forma_pagamento);
                              setPaymentDate(getLocalDateString());
                              setReceiptFile(null);
                              setShowPaymentModal(true);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'inline-flex', fontSize: '14px' }}
                          >
                            📎
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '12px',
                        fontWeight: '600',
                        background: transaction.status === 'paid' ? '#dcfce7' : isOverdue ? '#fee2e2' : transaction.status === 'pending' ? '#fef9c3' : '#fee2e2',
                        color: transaction.status === 'paid' ? '#15803d' : isOverdue ? '#b91c1c' : transaction.status === 'pending' ? '#a16207' : '#b91c1c'
                      }}>
                        {transaction.status === 'paid' ? 'Pago' : isOverdue ? 'Atrasado' : statusLabel[transaction.status] ?? transaction.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right' }}>
                      <div style={{ fontWeight: '600', color: isExpense ? '#ef4444' : '#0f172a' }}>
                        {isExpense ? '- ' : ''}{val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      {!isExpense && transaction.status === 'pending' && paidVal > 0 && (
                        <div style={{ fontSize: '11px', color: '#ca8a04', marginTop: '2px', fontWeight: '500' }}>
                          Pendente: {pendingVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button 
                        type="button" 
                        onClick={() => openPaymentModal(transaction)}
                        style={{ padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showFormModal && (
        <div className="scheduleModalOverlay" onClick={() => setShowFormModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="scheduleModal" style={{ maxWidth: '520px', width: '95%', padding: '24px', background: '#fff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} onClick={(e) => e.stopPropagation()}>
            <div className="scheduleModalHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.4px' }}>
                {form.tipoTransacao === 'despesa' ? 'Lançar Despesa' : 'Lançar Receita'}
              </h3>
              <button 
                type="button" 
                className="popoverClose" 
                onClick={() => setShowFormModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={(e) => { createTransaction(e); setShowFormModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Seletor do Tipo de Lançamento */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo de Lançamento *</span>
                <select
                  value={form.tipoTransacao}
                  onChange={(event) => setForm((prev) => ({ ...prev, tipoTransacao: event.target.value }))}
                  required
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                  <option value="receita">Receita (Entrada)</option>
                  <option value="despesa">Despesa (Saída)</option>
                </select>
              </label>

              {/* Paciente (apenas se for Receita) */}
              {form.tipoTransacao === 'receita' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paciente *</span>
                  <select
                    value={form.patientId}
                    onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}
                    required
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <option value="">Selecione</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>{patient.nome}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Consultório (apenas se for Receita) */}
              {form.tipoTransacao === 'receita' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consultório *</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select
                      value={form.origemNome}
                      onChange={(event) => setForm((prev) => ({ ...prev, origemNome: event.target.value }))}
                      required
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      <option value="">Selecione</option>
                      {sources
                        .filter((s) => s.tipo === 'consultorio')
                        .map((source) => (
                          <option key={source.id} value={source.nome}>{source.nome}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openAddSourceInline('consultorio')}
                      style={{
                        padding: '10px 14px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      +
                    </button>
                  </div>
                </label>
              )}

              {/* Valor */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor (R$) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor}
                  onChange={(event) => setForm((prev) => ({ ...prev, valor: event.target.value }))}
                  required
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.15s ease' }}
                />
              </label>

              {/* Valor de Sinal (apenas se for Receita) */}
              {form.tipoTransacao === 'receita' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor de Sinal (R$ - opcional)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.valorSinal}
                    onChange={(event) => setForm((prev) => ({ ...prev, valorSinal: event.target.value }))}
                    placeholder="Deixe em branco se não houver"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.15s ease' }}
                  />
                </label>
              )}

              {/* Data */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data do Lançamento *</span>
                <input
                  type="date"
                  value={form.createdAt ? form.createdAt.substring(0, 10) : ''}
                  onChange={(event) => setForm((prev) => ({ ...prev, createdAt: event.target.value }))}
                  required
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.15s ease' }}
                />
              </label>

              {/* Forma de pagamento (apenas se for Receita) */}
              {form.tipoTransacao === 'receita' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forma de pagamento *</span>
                  <select
                    value={form.formaPagamento}
                    onChange={(event) => setForm((prev) => ({ ...prev, formaPagamento: event.target.value }))}
                    required
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="cartao_debito">Cartão de débito</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </label>
              )}

              {/* Status */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status *</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  required
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>

              {/* Observações / Descrição (apenas se for Despesa) */}
              {form.tipoTransacao === 'despesa' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observação / Descrição</span>
                  <textarea
                    value={form.observacao}
                    onChange={(event) => setForm((prev) => ({ ...prev, observacao: event.target.value }))}
                    placeholder="Escreva detalhes sobre a despesa..."
                    rows={3}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', outline: 'none', transition: 'all 0.15s ease', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button type="button" className="secondary" style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '13px' }} onClick={() => setShowFormModal(false)}>Cancelar</button>
                <button 
                  type="submit" 
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }} 
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Lançar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 1: Registrar Recebimento / Baixa Parcial (Foco em UX Simples) */}
      {showPaymentModal && selectedTransaction && (
        <div className="scheduleModalOverlay" onClick={() => setShowPaymentModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="scheduleModal" style={{ maxWidth: '520px', width: '95%', padding: '24px', background: '#fff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} onClick={(e) => e.stopPropagation()}>
            <div className="scheduleModalHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.4px' }}>
                {editingPaymentId ? 'Editar Parcela' : 'Dar Baixa / Receber Pagamento'}
              </h3>
              <button 
                type="button" 
                className="popoverClose" 
                onClick={() => setShowPaymentModal(false)} 
                style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8', hover: { color: '#475569' } } as any}
              >
                ×
              </button>
            </div>

            {selectedTransaction.status === 'pending' || editingPaymentId ? (
              <form onSubmit={handleRegisterPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#fff', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {editingPaymentId ? 'Editar Abatimento' : 'Registrar Abatimento'}
                    </span>
                    {editingPaymentId && (
                      <button 
                        type="button" 
                        onClick={handleCancelEditPayment}
                        style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Cancelar Edição
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor Pago (R$) *</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Ex: 1500.00"
                        required
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.15s ease' }}
                      />
                    </label>

                    <label style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forma de pagamento *</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        required
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                      >
                        <option value="pix">PIX</option>
                        <option value="cartao_credito">Cartão de crédito</option>
                        <option value="cartao_debito">Cartão de débito</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="boleto">Boleto</option>
                      </select>
                    </label>
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data do Pagamento</span>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.15s ease' }}
                    />
                  </label>

                  {/* Campo de Upload de Comprovante */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Anexo / Comprovante</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        background: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600',
                        border: '1px dashed #cbd5e1',
                        userSelect: 'none',
                        transition: 'all 0.15s ease'
                      }}>
                        📎 Selecionar arquivo
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => {
                                const base64 = (reader.result as string).split(',')[1];
                                setReceiptFile({
                                  filename: file.name,
                                  contentType: file.type,
                                  base64
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                      {receiptFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#059669', background: '#ecfdf5', padding: '6px 10px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                          <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500' }}>
                            {receiptFile.filename}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReceiptFile(null)}
                            style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '0 4px', fontWeight: 'bold' }}
                            title="Remover comprovante"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>Nenhum comprovante selecionado</span>
                      )}
                    </div>
                  </div>

                  {/* Campo de Observação */}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observações / Descrição</span>
                    <textarea
                      value={paymentObservation}
                      onChange={(e) => setPaymentObservation(e.target.value)}
                      placeholder="Informações adicionais da baixa (ex: recebido via Pix de terceiros, desconto negociado, etc.)"
                      rows={3}
                      style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px', outline: 'none', transition: 'all 0.15s ease' }}
                    />
                  </label>
                </div>

                {selectedTransaction.pagamentos && selectedTransaction.pagamentos.length > 0 && (
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <strong style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Histórico de Recebimentos Parciais</strong>
                    <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', color: '#475569', fontWeight: '600' }}>
                            <th style={{ padding: '6px 4px' }}>Data</th>
                            <th style={{ padding: '6px 4px' }}>Forma</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Valor</th>
                            <th style={{ padding: '6px 4px', textAlign: 'center' }}>Obs</th>
                            <th style={{ padding: '6px 4px', textAlign: 'center' }}>Comp.</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTransaction.pagamentos.map((p) => {
                            const pVal = typeof p.valor === 'string' ? Number(p.valor) : p.valor;
                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                                <td style={{ padding: '8px 4px' }}>{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                                <td style={{ padding: '8px 4px' }}>{paymentLabels[p.forma_pagamento] ?? p.forma_pagamento}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>{pVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                  {p.observacao ? (
                                    <button
                                      type="button"
                                      title="Ver Observação"
                                      onClick={() => setViewObservationText(p.observacao!)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}
                                    >
                                      💬
                                    </button>
                                  ) : (
                                    <span style={{ color: '#cbd5e1' }}>-</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                  {p.comprovante_key ? (
                                    <button
                                      type="button"
                                      title="Visualizar Comprovante"
                                      onClick={() => handleViewReceipt(p.comprovante_key!)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#2563eb' }}
                                    >
                                      📎 Ver
                                    </button>
                                  ) : (
                                    <span style={{ color: '#cbd5e1' }}>-</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditPayment(p)}
                                      title="Editar Parcela"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePayment(p.id)}
                                      title="Excluir Parcela"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <button 
                    type="button" 
                    onClick={openEditDetailsModal}
                    style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s ease' }}
                  >
                    ⚙️ Editar Cadastro
                  </button>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="button" className="secondary" style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '13px' }} onClick={() => setShowPaymentModal(false)}>Cancelar</button>
                    <button 
                      type="submit" 
                      style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }} 
                      disabled={submitting}
                    >
                      {submitting ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '14px', textAlign: 'center', fontWeight: '600' }}>
                  🎉 Esta transação já foi totalmente quitada.
                </div>

                {selectedTransaction.pagamentos && selectedTransaction.pagamentos.length > 0 && (
                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <strong style={{ fontSize: '11px', color: '#475569', display: 'block', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Histórico de Recebimentos</strong>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', color: '#475569', fontWeight: '600' }}>
                            <th style={{ padding: '6px 4px' }}>Data</th>
                            <th style={{ padding: '6px 4px' }}>Forma</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Valor</th>
                            <th style={{ padding: '6px 4px', textAlign: 'center' }}>Obs</th>
                            <th style={{ padding: '6px 4px', textAlign: 'center' }}>Comp.</th>
                            <th style={{ padding: '6px 4px', textAlign: 'right' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTransaction.pagamentos.map((p) => {
                            const pVal = typeof p.valor === 'string' ? Number(p.valor) : p.valor;
                            return (
                              <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                                <td style={{ padding: '8px 4px' }}>{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                                <td style={{ padding: '8px 4px' }}>{paymentLabels[p.forma_pagamento] ?? p.forma_pagamento}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>{pVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                  {p.observacao ? (
                                    <button
                                      type="button"
                                      title="Ver Observação"
                                      onClick={() => setViewObservationText(p.observacao!)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px' }}
                                    >
                                      💬
                                    </button>
                                  ) : (
                                    <span style={{ color: '#cbd5e1' }}>-</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                  {p.comprovante_key ? (
                                    <button
                                      type="button"
                                      title="Visualizar Comprovante"
                                      onClick={() => handleViewReceipt(p.comprovante_key!)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', color: '#2563eb' }}
                                    >
                                      📎 Ver
                                    </button>
                                  ) : (
                                    <span style={{ color: '#cbd5e1' }}>-</span>
                                  )}
                                </td>
                                <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditPayment(p)}
                                      title="Editar Parcela"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePayment(p.id)}
                                      title="Excluir Parcela"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <button 
                    type="button" 
                    onClick={openEditDetailsModal}
                    style={{ background: '#fff', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s ease' }}
                  >
                    ⚙️ Editar Cadastro
                  </button>
                  <button type="button" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }} onClick={() => setShowPaymentModal(false)}>Fechar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Editar Cadastro do Lançamento (Dados Principais / Fica oculto por padrão) */}
      {showEditModal && selectedTransaction && (
        <div className="scheduleModalOverlay" onClick={() => setShowEditModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="scheduleModal" style={{ maxWidth: '520px', width: '95%', padding: '24px', background: '#fff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }} onClick={(e) => e.stopPropagation()}>
            <div className="scheduleModalHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.4px' }}>
                {editForm.tipoTransacao === 'despesa' ? 'Editar Despesa' : 'Editar Receita'}
              </h3>
              <button 
                type="button" 
                className="popoverClose" 
                onClick={() => setShowEditModal(false)} 
                style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8', hover: { color: '#475569' } } as any}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEditDetails} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Paciente (apenas se for Receita) */}
              {editForm.tipoTransacao === 'receita' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paciente *</span>
                  <select
                    value={editForm.patientId}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, patientId: event.target.value }))}
                    required
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <option value="">Selecione</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>{patient.nome}</option>
                    ))}
                  </select>
                </label>
              )}

              {/* Consultório (apenas se for Receita) */}
              {editForm.tipoTransacao === 'receita' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consultório *</span>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <select
                      value={editForm.origemNome}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, origemNome: event.target.value }))}
                      required
                      style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      <option value="">Selecione</option>
                      {sources
                        .filter((s) => s.tipo === 'consultorio')
                        .map((source) => (
                          <option key={source.id} value={source.nome}>{source.nome}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openAddSourceInline('consultorio')}
                      style={{
                        padding: '10px 14px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      +
                    </button>
                  </div>
                </label>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor Total (R$) *</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.valor}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, valor: event.target.value }))}
                  required
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.15s ease' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data do Lançamento *</span>
                <input
                  type="date"
                  value={editForm.createdAt}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, createdAt: event.target.value }))}
                  required
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', transition: 'all 0.15s ease' }}
                />
              </label>

              {/* Forma de pagamento (apenas se for Receita) */}
              {editForm.tipoTransacao === 'receita' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forma de pagamento *</span>
                  <select
                    value={editForm.formaPagamento}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, formaPagamento: event.target.value }))}
                    required
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  >
                    <option value="pix">PIX</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="cartao_debito">Cartão de débito</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </label>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status *</span>
                <select
                  value={editForm.status}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, status: event.target.value }))}
                  required
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'all 0.15s ease' }}
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </label>

              {/* Observações / Descrição (apenas se for Despesa) */}
              {editForm.tipoTransacao === 'despesa' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observação / Descrição</span>
                  <textarea
                    value={editForm.observacao}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, observacao: event.target.value }))}
                    placeholder="Escreva detalhes sobre a despesa..."
                    rows={3}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', outline: 'none', transition: 'all 0.15s ease', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  onClick={deleteTransaction}
                  style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'all 0.15s ease' }}
                >
                  Excluir
                </button>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" className="secondary" style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', color: '#64748b', fontWeight: '600', fontSize: '13px' }} onClick={() => { setShowEditModal(false); setShowPaymentModal(true); }}>Voltar</button>
                  <button 
                    type="submit" 
                    style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }} 
                    disabled={submitting}
                  >
                    {submitting ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Adicionar Consultório / Empresa Inline (Evita prompt nativo do navegador) */}
      {showAddSourceModal && (
        <div className="scheduleModalOverlay" onClick={() => setShowAddSourceModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="scheduleModal" style={{ maxWidth: '400px', width: '90%', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <div className="scheduleModalHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <strong>Adicionar {newSourceType === 'consultorio' ? 'Consultório' : 'Empresa'}</strong>
              <button type="button" className="popoverClose" onClick={() => setShowAddSourceModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#475569' }}>
                Nome do(a) {newSourceType === 'consultorio' ? 'Consultório' : 'Empresa'} *
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder={`Ex: ${newSourceType === 'consultorio' ? 'OdontoVila' : 'Bradesco Saúde'}`}
                  style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: '10px' }}>
                <button type="button" className="secondary" style={{ border: '1px solid #cbd5e1', background: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => setShowAddSourceModal(false)}>Cancelar</button>
                <button 
                  type="button" 
                  onClick={handleAddSourceSave} 
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                  disabled={!newSourceName.trim()}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Confirmação de Exclusão Premium (Padrão Ouro UX) */}
      {confirmDelete.show && (
        <div className="scheduleModalOverlay" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="scheduleModal" style={{ maxWidth: '400px', width: '90%', padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
              <div style={{ margin: '0 auto', width: '48px', height: '48px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                ⚠️
              </div>
              <strong style={{ fontSize: '18px', color: '#991b1b' }}>{confirmDelete.title}</strong>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
                {confirmDelete.message}
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmDelete((prev) => ({ ...prev, show: false }))}
                  style={{ flex: 1, border: '1px solid #cbd5e1', background: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#475569' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete.onConfirm}
                  style={{ flex: 1, border: 'none', background: '#ef4444', color: '#fff', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                >
                  Excluir Permanentemente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualização de observação individual */}
      {viewObservationText !== null && (
        <div className="scheduleModalOverlay" onClick={() => setViewObservationText(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="scheduleModal" style={{ maxWidth: '400px', width: '90%', padding: '20px', background: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '12px' }}>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>Observação do Pagamento</strong>
              <button type="button" onClick={() => setViewObservationText(null)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155', minHeight: '80px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
              {viewObservationText || 'Nenhuma observação informada.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button type="button" onClick={() => setViewObservationText(null)} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api, setAuthToken } from './api';

type Patient = {
  id: string;
  nome: string;
  cpf: string | null;
  celular: string | null;
  telefone: string | null;
  email: string | null;
  categoria: string | null;
  data_nascimento: string | null;
  created_at: string;
};

type PatientForm = {
  nome: string;
  celularDdi: string;
  celular: string;
  lembreteCanal: 'whatsapp' | 'sms' | 'none';
  cpf: string;
  rg: string;
  pacienteEstrangeiro: boolean;
  telefone: string;
  // ...removed telefone fixo fields
  email: string;
  comoConheceuClinica: string;
  profissao: string;
  genero: string;
  dataNascimento: string;
  observacoes: string;
  categoria: string;
  contatoEmergenciaNome: string;
  contatoEmergenciaDdi: string;
  contatoEmergenciaTelefone: string;
  enderecoCep: string;
  enderecoLogradouroNumero: string;
  enderecoComplemento: string;
  enderecoBairro: string;
  enderecoCidade: string;
  enderecoEstado: string;
  responsavelNome: string;
  responsavelCpf: string;
  responsavelDataNascimento: string;
  convenioNome: string;
  convenioTitular: string;
  convenioNumeroCarteirinha: string;
  convenioCpfResponsavel: string;
};

interface PatientsCenterProps {
  token: string;
  onError: (message: string) => void;
}

type FormErrors = Partial<Record<keyof PatientForm, string>>;

const emptyForm: PatientForm = {
  nome: '',
  celularDdi: '+55',
  celular: '',
  lembreteCanal: 'whatsapp',
  cpf: '',
  rg: '',
  pacienteEstrangeiro: false,
  telefone: '',
  // ...removed telefone fixo fields
  email: '',
  comoConheceuClinica: '',
  profissao: '',
  genero: '',
  dataNascimento: '',
  observacoes: '',
  categoria: '',
  contatoEmergenciaNome: '',
  contatoEmergenciaDdi: '+55',
  contatoEmergenciaTelefone: '',
  enderecoCep: '',
  enderecoLogradouroNumero: '',
  enderecoComplemento: '',
  enderecoBairro: '',
  enderecoCidade: '',
  enderecoEstado: '',
  responsavelNome: '',
  responsavelCpf: '',
  responsavelDataNascimento: '',
  convenioNome: '',
  convenioTitular: '',
  convenioNumeroCarteirinha: '',
  convenioCpfResponsavel: ''
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function maskCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

function maskZipCode(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

async function lookupCep(cep: string) {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await response.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      cidade: data.localidade ?? '',
      estado: data.uf ?? ''
    };
  } catch {
    return null;
  }
}

export function PatientsCenter({ token, onError }: PatientsCenterProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'aniversariantes' | 'retornos'>('search');
  const [form, setForm] = useState<PatientForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [cepLookupStatus, setCepLookupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cepLookupError, setCepLookupError] = useState<string | null>(null);

  const birthdaysCount = useMemo(() => {
    const month = new Date().getMonth();
    return patients.filter((patient) => {
      if (!patient.data_nascimento) return false;
      return new Date(patient.data_nascimento).getMonth() === month;
    }).length;
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const baseList = patients.filter((patient) => {
      if (activeTab === 'aniversariantes') {
        if (!patient.data_nascimento) return false;
        const birthMonth = new Date(patient.data_nascimento).getMonth();
        return birthMonth === new Date().getMonth();
      }

      if (activeTab === 'retornos') {
        // Placeholder: use same list for now. Later we can filter by next appointment / tags.
        return true;
      }

      return true;
    });

    if (!normalizedQuery) {
      return baseList;
    }

    return baseList.filter((patient) => {
      const name = patient.nome.toLowerCase();
      const phone = patient.celular?.toLowerCase() ?? patient.telefone?.toLowerCase() ?? '';
      const cpf = patient.cpf?.toLowerCase() ?? '';
      return (
        name.includes(normalizedQuery) ||
        phone.includes(normalizedQuery) ||
        cpf.includes(normalizedQuery)
      );
    });
  }, [patients, query, activeTab]);
  async function loadPatients() {
    if (!token) {
      setPatients([]);
      return;
    }

    try {
      setLoading(true);
      setAuthToken(token);
      const response = await api.get<Patient[]>('/patients');
      setPatients(response.data);
    } catch {
      onError('Falha ao carregar pacientes.');
    } finally {
      setLoading(false);
    }
  }

  function getInitials(name: string) {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function formatLastConsultation(patient: Patient) {
    const date = patient.created_at ? new Date(patient.created_at) : null;
    if (!date || Number.isNaN(date.getTime())) return 'Última consulta: N/A';

    const distance = formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    return `Última consulta: ${format(date, 'dd/MM/yyyy', { locale: ptBR })} - aproximadamente ${distance}`;
  }

  function downloadPatientList(formatType: 'csv' | 'excel') {
    const rows = filteredPatients.map((patient) => ({
      Nome: patient.nome,
      CPF: patient.cpf ? maskCpf(patient.cpf) : '',
      Celular: patient.celular ? maskPhone(patient.celular) : '',
      Email: patient.email ?? '',
      Categoria: patient.categoria ?? '',
      'Data de Nascimento': patient.data_nascimento
        ? format(new Date(patient.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })
        : '',
      'Cadastro': format(new Date(patient.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
    }));

    const header = Object.keys(rows[0] ?? {}).join(';');
    const body = rows.map((row) => Object.values(row).map((value) => `${value}`).join(';')).join('\n');
    const csv = [header, body].filter(Boolean).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pacientes.${formatType === 'excel' ? 'xlsx' : 'csv'}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      onError('Informe o JWT para cadastrar paciente.');
      return;
    }

    const errors: FormErrors = {};
    const cpfDigits = onlyDigits(form.cpf);
    const celularDigits = onlyDigits(form.celular);
    const phoneDigits = onlyDigits(form.telefone);
    // telefone fixo removed
    const contatoEmergenciaTelefoneDigits = onlyDigits(form.contatoEmergenciaTelefone);
    const responsavelCpfDigits = onlyDigits(form.responsavelCpf);
    const convenioCpfResponsavelDigits = onlyDigits(form.convenioCpfResponsavel);
    const cepDigits = onlyDigits(form.enderecoCep);

    if (!form.nome.trim()) errors.nome = 'Nome completo é obrigatório.';
    if (!celularDigits || (celularDigits.length !== 10 && celularDigits.length !== 11)) errors.celular = 'Celular deve ter 10 ou 11 dígitos.';
    if (cpfDigits && cpfDigits.length !== 11) errors.cpf = 'CPF deve ter 11 dígitos.';
    if (phoneDigits && phoneDigits.length !== 10 && phoneDigits.length !== 11) errors.telefone = 'Telefone deve ter 10 ou 11 dígitos.';
    // telefone fixo validation removed
    if (contatoEmergenciaTelefoneDigits && contatoEmergenciaTelefoneDigits.length !== 10 && contatoEmergenciaTelefoneDigits.length !== 11) errors.contatoEmergenciaTelefone = 'Telefone de emergência inválido.';
    if (responsavelCpfDigits && responsavelCpfDigits.length !== 11) errors.responsavelCpf = 'CPF do responsável deve ter 11 dígitos.';
    if (convenioCpfResponsavelDigits && convenioCpfResponsavelDigits.length !== 11) errors.convenioCpfResponsavel = 'CPF do responsável do convênio inválido.';
    if (cepDigits && cepDigits.length !== 8) errors.enderecoCep = 'CEP deve ter 8 dígitos.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'E-mail inválido.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      onError('Revise os campos destacados.');
      return;
    }

    try {
      setSubmitting(true);
      setAuthToken(token);
      await api.post('/patients', {
        nome: form.nome.trim(),
        celularDdi: form.celularDdi,
        celular: celularDigits,
        lembretesAutomaticos: form.lembreteCanal !== 'none',
        lembreteCanal: form.lembreteCanal === 'none' ? null : form.lembreteCanal,
        cpf: cpfDigits || null,
        rg: form.rg.trim() || null,
        pacienteEstrangeiro: form.pacienteEstrangeiro,
        telefone: phoneDigits || null,
        // telefone fixo removed from API submission
        email: form.email.trim() || null,
        comoConheceuClinica: form.comoConheceuClinica || null,
        profissao: form.profissao.trim() || null,
        genero: form.genero || null,
        dataNascimento: form.dataNascimento || null,
        observacoes: form.observacoes.trim() || null,
        categoria: form.categoria || null,
        contatoEmergenciaNome: form.contatoEmergenciaNome.trim() || null,
        contatoEmergenciaDdi: form.contatoEmergenciaDdi,
        contatoEmergenciaTelefone: contatoEmergenciaTelefoneDigits || null,
        enderecoCep: cepDigits || null,
        enderecoLogradouroNumero: form.enderecoLogradouroNumero.trim() || null,
        enderecoComplemento: form.enderecoComplemento.trim() || null,
        enderecoBairro: form.enderecoBairro.trim() || null,
        enderecoCidade: form.enderecoCidade.trim() || null,
        enderecoEstado: form.enderecoEstado.trim().toUpperCase() || null,
        responsavelNome: form.responsavelNome.trim() || null,
        responsavelCpf: responsavelCpfDigits || null,
        responsavelDataNascimento: form.responsavelDataNascimento || null,
        convenioNome: form.convenioNome.trim() || null,
        convenioTitular: form.convenioTitular.trim() || null,
        convenioNumeroCarteirinha: form.convenioNumeroCarteirinha.trim() || null,
        convenioCpfResponsavel: convenioCpfResponsavelDigits || null
      });

      setForm(emptyForm);
  setFormErrors({});
      setShowCreateModal(false);
      await loadPatients();
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Falha ao cadastrar paciente.';
      onError(message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadPatients();
  }, [token]);

  if (!token) {
    return <div className="patientsPlaceholder">Informe o JWT e clique em Atualizar para ver os pacientes.</div>;
  }

  return (
    <section className="patientsPanel">
      <header className="patientsHeader">
        <h2>Pacientes</h2>
        <button className="primaryAction" onClick={() => { setShowCreateModal(true); setFormErrors({}); }}>
          Cadastrar paciente
        </button>
      </header>

      <div className="patientsTabs">
        <button
          className={activeTab === 'search' ? 'active' : ''}
          onClick={() => setActiveTab('search')}
        >
          Buscar
        </button>
        <button
          className={activeTab === 'aniversariantes' ? 'active' : ''}
          onClick={() => setActiveTab('aniversariantes')}
        >
          Aniversariantes {birthdaysCount > 0 ? `(${birthdaysCount})` : ''}
        </button>
        <button
          className={activeTab === 'retornos' ? 'active' : ''}
          onClick={() => setActiveTab('retornos')}
        >
          Retornos semestrais
        </button>
      </div>

      <div className="patientsSearchCard">
        <div className="patientsToolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busque por nome, telefone ou CPF"
          />
          <div className="patientsToolbarActions">
            <button type="button" className="secondary" onClick={() => onError('Filtro de categoria ainda não implementado.')}>Filtrar por categoria</button>
            <button onClick={loadPatients} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
          </div>
        </div>

        <div className="patientListWrapper">
          {filteredPatients.length === 0 ? (
            <div className="emptyPatients">Nenhum paciente encontrado.</div>
          ) : (
            <div className="patientList">
              {filteredPatients.map((patient) => (
                <div key={patient.id} className="patientCard">
                  <div className="patientCardMain">
                    <div className="patientAvatar">{getInitials(patient.nome)}</div>
                    <div className="patientCardInfo">
                      <div className="patientName">{patient.nome}</div>
                      <div className="patientSubtitle">{formatLastConsultation(patient)}</div>
                    </div>
                  </div>

                  <div className="patientCardMeta">
                    <div className="metaItem">{patient.cpf ? maskCpf(patient.cpf) : '-'}</div>
                    <div className="metaItem">
                      {patient.celular ? maskPhone(patient.celular) : '-'}
                      {patient.celular ? (
                        <span style={{ marginLeft: 6, opacity: 0.7 }} title="WhatsApp">
                          📱
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="patientsFooter">
          <div>Mostrando {filteredPatients.length} de {patients.length} resultados</div>
          <div className="exportLinks">
            <button type="button" onClick={() => downloadPatientList('excel')}>Excel</button>
            <button type="button" onClick={() => downloadPatientList('csv')}>CSV</button>
          </div>
        </div>
      </div>

      {showCreateModal ? (
        <div className="scheduleModalOverlay" onClick={() => setShowCreateModal(false)}>
          <form className="scheduleModal patientModal" onSubmit={submitPatient} onClick={(event) => event.stopPropagation()}>
            <div className="scheduleModalHeader">
              <strong>Inclusão de paciente</strong>
              <button type="button" className="popoverClose" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <div style={{ marginBottom: 12, color: '#475569', fontSize: 13 }}>
              Campos obrigatórios: <strong>Nome</strong> e <strong>Celular</strong>.
            </div>

            <div className="patientForm">
              <section className="patientSection">
                <h4 className="patientFormSectionTitle">Dados principais</h4>
                <div className="sectionGrid">
                  <label className="fullWidth">
                    Nome completo
                    <input
                      className={formErrors.nome ? 'inputError' : ''}
                      value={form.nome}
                      onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
                      placeholder="Digite o nome completo do paciente"
                      required
                    />
                    {formErrors.nome ? <small className="fieldErrorText">{formErrors.nome}</small> : null}
                  </label>

                  <label>
                    Data de nascimento
                    <input
                      type="date"
                      value={form.dataNascimento}
                      onChange={(event) => setForm((prev) => ({ ...prev, dataNascimento: event.target.value }))}
                    />
                  </label>

                  <label>
                    Gênero
                    <select
                      value={form.genero}
                      onChange={(event) => setForm((prev) => ({ ...prev, genero: event.target.value }))}
                    >
                      <option value="">Selecionar</option>
                      <option value="feminino">Feminino</option>
                      <option value="masculino">Masculino</option>
                      <option value="nao_binario">Não binário</option>
                      <option value="prefere_nao_informar">Prefere não informar</option>
                    </select>
                  </label>

                  <label>
                    CPF
                    <input
                      className={formErrors.cpf ? 'inputError' : ''}
                      value={form.cpf}
                      onChange={(event) => setForm((prev) => ({ ...prev, cpf: maskCpf(event.target.value) }))}
                      placeholder="000.000.000-00"
                    />
                    {formErrors.cpf ? <small className="fieldErrorText">{formErrors.cpf}</small> : null}
                  </label>

                  <label className="checkboxLabel fullWidth">
                    <input
                      type="checkbox"
                      checked={form.pacienteEstrangeiro}
                      onChange={(event) => setForm((prev) => ({ ...prev, pacienteEstrangeiro: event.target.checked }))}
                    />
                    Paciente estrangeiro
                  </label>
                </div>
              </section>

              <section className="patientSection">
                <h4 className="patientFormSectionTitle">Contato</h4>
                <div className="sectionGrid">
                  <label>
                    Celular
                    <div className="phoneInputGroup">
                      <select
                        value={form.celularDdi}
                        onChange={(event) => setForm((prev) => ({ ...prev, celularDdi: event.target.value }))}
                      >
                        <option value="+55">Brasil +55</option>
                        <option value="+1">+1</option>
                        <option value="+351">+351</option>
                      </select>
                      <input
                        className={formErrors.celular ? 'inputError' : ''}
                        value={form.celular}
                        onChange={(event) => setForm((prev) => ({ ...prev, celular: maskPhone(event.target.value) }))}
                        placeholder="(11) 99999-9999"
                        required
                      />
                    </div>
                    {formErrors.celular ? <small className="fieldErrorText">{formErrors.celular}</small> : null}
                  </label>

                  <label>
                    Email
                    <input
                      type="email"
                      className={formErrors.email ? 'inputError' : ''}
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="nome@exemplo.com"
                    />
                    {formErrors.email ? <small className="fieldErrorText">{formErrors.email}</small> : null}
                  </label>

                  <label>
                    {/* Telefone fixo removed */}
                  </label>

                  <label>
                    Lembretes automáticos
                    <select
                      value={form.lembreteCanal}
                      onChange={(event) => setForm((prev) => ({ ...prev, lembreteCanal: event.target.value as PatientForm['lembreteCanal'] }))}
                    >
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="none">Não enviar</option>
                    </select>
                  </label>

                  <label>
                    Contato de emergência (nome)
                    <input
                      value={form.contatoEmergenciaNome}
                      onChange={(event) => setForm((prev) => ({ ...prev, contatoEmergenciaNome: event.target.value }))}
                      placeholder="Nome do contato"
                    />
                  </label>

                  <label>
                    Contato de emergência (telefone)
                    <div className="phoneInputGroup">
                      <select
                        value={form.contatoEmergenciaDdi}
                        onChange={(event) => setForm((prev) => ({ ...prev, contatoEmergenciaDdi: event.target.value }))}
                      >
                        <option value="+55">Brasil +55</option>
                        <option value="+1">+1</option>
                        <option value="+351">+351</option>
                      </select>
                      <input
                        className={formErrors.contatoEmergenciaTelefone ? 'inputError' : ''}
                        value={form.contatoEmergenciaTelefone}
                        onChange={(event) => setForm((prev) => ({ ...prev, contatoEmergenciaTelefone: maskPhone(event.target.value) }))}
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    {formErrors.contatoEmergenciaTelefone ? <small className="fieldErrorText">{formErrors.contatoEmergenciaTelefone}</small> : null}
                  </label>

                  <label>
                    Nome do responsável
                    <input
                      value={form.responsavelNome}
                      onChange={(event) => setForm((prev) => ({ ...prev, responsavelNome: event.target.value }))}
                      placeholder="Nome do responsável"
                    />
                  </label>

                  <label>
                    CPF do responsável
                    <input
                      className={formErrors.responsavelCpf ? 'inputError' : ''}
                      value={form.responsavelCpf}
                      onChange={(event) => setForm((prev) => ({ ...prev, responsavelCpf: maskCpf(event.target.value) }))}
                      placeholder="000.000.000-00"
                    />
                    {formErrors.responsavelCpf ? <small className="fieldErrorText">{formErrors.responsavelCpf}</small> : null}
                  </label>

                  <label>
                    Nascimento do responsável
                    <input
                      type="date"
                      value={form.responsavelDataNascimento}
                      onChange={(event) => setForm((prev) => ({ ...prev, responsavelDataNascimento: event.target.value }))}
                    />
                  </label>
                </div>
              </section>

              <section className="patientSection">
                <h4 className="patientFormSectionTitle">Convênio</h4>
                <div className="sectionGrid">
                  <label>
                    Convênio
                    <input
                      value={form.convenioNome}
                      onChange={(event) => setForm((prev) => ({ ...prev, convenioNome: event.target.value }))}
                      placeholder="Nome do convênio"
                    />
                  </label>

                  <label>
                    Categoria
                    <select
                      value={form.categoria}
                      onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value }))}
                    >
                      <option value="">Selecionar</option>
                      <option value="particular">Particular</option>
                      <option value="convenio">Convênio</option>
                      <option value="vip">VIP</option>
                    </select>
                  </label>

                  <label>
                    Titular do convênio
                    <input
                      value={form.convenioTitular}
                      onChange={(event) => setForm((prev) => ({ ...prev, convenioTitular: event.target.value }))}
                      placeholder="Nome do titular"
                    />
                  </label>

                  <label>
                    Número da carteirinha
                    <input
                      value={form.convenioNumeroCarteirinha}
                      onChange={(event) => setForm((prev) => ({ ...prev, convenioNumeroCarteirinha: event.target.value }))}
                      placeholder="Número da carteirinha"
                    />
                  </label>

                  <label>
                    CPF do responsável
                    <input
                      className={formErrors.convenioCpfResponsavel ? 'inputError' : ''}
                      value={form.convenioCpfResponsavel}
                      onChange={(event) => setForm((prev) => ({ ...prev, convenioCpfResponsavel: maskCpf(event.target.value) }))}
                      placeholder="000.000.000-00"
                    />
                    {formErrors.convenioCpfResponsavel ? <small className="fieldErrorText">{formErrors.convenioCpfResponsavel}</small> : null}
                  </label>
                </div>
              </section>

              <section className="patientSection">
                <h4 className="patientFormSectionTitle">Informações adicionais</h4>
                <div className="sectionGrid">
                  <label>
                    Profissão
                    <input
                      value={form.profissao}
                      onChange={(event) => setForm((prev) => ({ ...prev, profissao: event.target.value }))}
                      placeholder="Ex.: professora"
                    />
                  </label>

                  <label>
                    Como conheceu a clínica
                    <input
                      value={form.comoConheceuClinica}
                      onChange={(event) => setForm((prev) => ({ ...prev, comoConheceuClinica: event.target.value }))}
                      placeholder="Ex.: indicação, Instagram"
                    />
                  </label>

                  <label>
                    CEP
                    <input
                      className={formErrors.enderecoCep ? 'inputError' : ''}
                      value={form.enderecoCep}
                      onChange={(event) => setForm((prev) => ({ ...prev, enderecoCep: maskZipCode(event.target.value) }))}
                      onBlur={async () => {
                        const digits = onlyDigits(form.enderecoCep);
                        if (digits.length !== 8) return;
                        setCepLookupStatus('loading');
                        setCepLookupError(null);
                        const result = await lookupCep(digits);
                        if (!result) {
                          setCepLookupStatus('error');
                          setCepLookupError('Não foi possível buscar o CEP.');
                          return;
                        }
                        setCepLookupStatus('success');
                        setForm((prev) => ({
                          ...prev,
                          enderecoLogradouroNumero: prev.enderecoLogradouroNumero || result.logradouro,
                          enderecoBairro: result.bairro,
                          enderecoCidade: result.cidade,
                          enderecoEstado: result.estado
                        }));
                      }}
                      placeholder="00000-000"
                    />
                    {formErrors.enderecoCep ? <small className="fieldErrorText">{formErrors.enderecoCep}</small> : null}
                    {cepLookupStatus === 'loading' ? <small className="fieldErrorText">Buscando CEP...</small> : null}
                    {cepLookupStatus === 'error' && cepLookupError ? <small className="fieldErrorText">{cepLookupError}</small> : null}
                  </label>

                  <label>
                    Endereço com número
                    <input
                      value={form.enderecoLogradouroNumero}
                      onChange={(event) => setForm((prev) => ({ ...prev, enderecoLogradouroNumero: event.target.value }))}
                      placeholder="Rua, número"
                    />
                  </label>

                  <label>
                    Complemento
                    <input
                      value={form.enderecoComplemento}
                      onChange={(event) => setForm((prev) => ({ ...prev, enderecoComplemento: event.target.value }))}
                      placeholder="Apartamento, bloco..."
                    />
                  </label>

                  <label>
                    Bairro
                    <input
                      value={form.enderecoBairro}
                      onChange={(event) => setForm((prev) => ({ ...prev, enderecoBairro: event.target.value }))}
                      placeholder="Bairro"
                    />
                  </label>

                  <label>
                    Cidade
                    <input
                      value={form.enderecoCidade}
                      onChange={(event) => setForm((prev) => ({ ...prev, enderecoCidade: event.target.value }))}
                      placeholder="Cidade"
                    />
                  </label>

                  <label>
                    UF
                    <input
                      value={form.enderecoEstado}
                      maxLength={2}
                      onChange={(event) => setForm((prev) => ({ ...prev, enderecoEstado: event.target.value.toUpperCase() }))}
                      placeholder="UF"
                    />
                  </label>
                </div>
              </section>

              <section className="patientSection">
                <h4 className="patientFormSectionTitle">Observações</h4>
                <div className="sectionGrid">
                  <label className="fullWidth">
                    Observações do paciente
                    <textarea
                      value={form.observacoes}
                      onChange={(event) => setForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                      placeholder="Adicione observações sobre o paciente"
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="patientFormActions">
            <button type="button" className="ghostAction" onClick={() => setForm(emptyForm)}>Limpar</button>
            <button type="submit" className="primaryAction" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Cadastrar paciente'}
            </button>
          </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}

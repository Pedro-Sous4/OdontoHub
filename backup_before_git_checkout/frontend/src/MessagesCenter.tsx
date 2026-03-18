import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api, setAuthToken } from './api';

type Conversation = {
  patient_id: string;
  patient_name: string;
  phone: string;
  last_message_at: string;
  last_message: string;
  total_messages: number;
};

type ConversationMessage = {
  id: string;
  mensagem: string;
  status_envio: string;
  created_at: string;
};

interface MessagesCenterProps {
  token: string;
  onError: (message: string) => void;
}

export function MessagesCenter({ token, onError }: MessagesCenterProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 900);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.patient_id === selectedConversationId),
    [conversations, selectedConversationId]
  );

  async function loadConversations() {
    if (!token) {
      return;
    }

    try {
      setAuthToken(token);
      const response = await api.get<Conversation[]>('/whatsapp/conversations');
      setConversations(response.data);

      if (!selectedConversationId && response.data[0]) {
        setSelectedConversationId(response.data[0].patient_id);
      }
    } catch {
      onError('Falha ao carregar conversas WhatsApp.');
    }
  }

  async function loadMessages(patientId: string) {
    if (!token || !patientId) {
      return;
    }

    try {
      setAuthToken(token);
      const response = await api.get<ConversationMessage[]>(`/whatsapp/conversations/${patientId}/messages`);
      setMessages(response.data);
    } catch {
      onError('Falha ao carregar mensagens da conversa.');
    }
  }

  async function sendMessage() {
    if (!token || !selectedConversation || !text.trim()) {
      return;
    }

    try {
      setLoading(true);
      setAuthToken(token);
      await api.post('/whatsapp/send', {
        phoneNumber: selectedConversation.phone,
        patientId: selectedConversation.patient_id,
        appointmentId: null,
        message: text.trim()
      });
      setText('');
      await loadMessages(selectedConversation.patient_id);
      await loadConversations();
    } catch {
      onError('Falha ao enviar mensagem para a fila do WhatsApp.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, [token]);

  useEffect(() => {
    if (selectedConversationId) {
      void loadMessages(selectedConversationId);
    }
  }, [selectedConversationId, token]);

  if (!token) {
    return <div className="messagesPlaceholder">Informe o JWT e clique em Atualizar para ver as conversas.</div>;
  }

  return (
    <section className="messagesPanel">
      <header className="messagesHeader">
        <h2>Central de mensagens</h2>
        <div className="messagesTabs">
          <span className="active">Mensagens</span>
          <span>Campanhas automáticas</span>
          <span>Histórico de envio</span>
        </div>
      </header>

      <div className="messagesGrid">
        {(!isMobile || !selectedConversationId) ? (
        <aside className="conversationsList">
          <div className="conversationsTitle">Conversas</div>
          {conversations.length === 0 ? (
            <p className="emptyConversations">Nenhuma conversa enviada pela plataforma.</p>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.patient_id}
                className={conversation.patient_id === selectedConversationId ? 'conversationItem active' : 'conversationItem'}
                onClick={() => setSelectedConversationId(conversation.patient_id)}
              >
                <strong>{conversation.patient_name}</strong>
                <span>{conversation.last_message}</span>
              </button>
            ))
          )}
        </aside>
        ) : null}

        {(!isMobile || selectedConversationId) ? (
        <article className="chatArea">
          {selectedConversation ? (
            <>
              <div className="chatHeader">
                {isMobile ? (
                  <button className="backToList" onClick={() => setSelectedConversationId('')}>← Conversas</button>
                ) : null}
                <strong>{selectedConversation.patient_name}</strong>
                <span>{selectedConversation.phone}</span>
              </div>

              <div className="chatMessages">
                {messages.map((message) => (
                  <div key={message.id} className="messageBubble outbound">
                    <small>{format(new Date(message.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</small>
                    <p>{message.mensagem}</p>
                    <span>{message.status_envio}</span>
                  </div>
                ))}
              </div>

              <div className="chatComposer">
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Responda gratuitamente"
                />
                <button onClick={sendMessage} disabled={loading || !text.trim()}>
                  {loading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </>
          ) : (
            <p className="emptyConversations">Selecione uma conversa.</p>
          )}
        </article>
        ) : null}
      </div>
    </section>
  );
}

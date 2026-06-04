import { Router } from 'express';
import { AuthRequest } from '../../server/common/types.js';
import OpenAI from 'openai';
import axios from 'axios';

export const assistantRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

assistantRouter.post('/', async (req: AuthRequest, res) => {
  try {
    const { message, messages } = req.body;
    const tenantId = req.auth!.tenantId;
    const token = req.headers.authorization;

    console.log(`[ASSISTANT] Mensagem recebida de ${tenantId}: ${message}`);

    const history = messages || [{ role: 'user', content: message }];

    const systemPrompt = `Você é o assistente virtual da OdontoHub, uma clínica odontológica. 
Seu papel é ser prestativo, educado e ajudar os pacientes a agendar consultas.
Regras para agendamento:
1. Sempre pergunte qual procedimento ou tratamento o paciente deseja realizar.
2. Use a ferramenta listar_procedimentos para descobrir a duração (em minutos) do procedimento desejado.
3. Se o usuário perguntar por horários, primeiro descubra qual dentista ele quer.
4. Use a ferramenta verificar_horarios_livres informando a data, o ID do dentista e a duracao (em minutos) obtida.
5. Se não houver horário disponível na data com aquela duração ininterrupta, sugira o próximo dia ou peça outra data.
6. Pergunte o nome completo, telefone e CPF para o cadastro (se já não tiver).
7. Ao finalizar o agendamento, informe ao paciente que a sua vaga foi pré-reservada e que está aguardando a confirmação do dentista. O paciente receberá a confirmação definitiva pelo WhatsApp em breve.
Sempre seja amigável.`;

    try {
      const runner = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "verificar_horarios_livres",
              description: "Retorna os horários livres na agenda de um dentista para uma data específica.",
              parameters: {
                type: "object",
                properties: {
                  dentistId: { type: "string", description: "ID do dentista. Opcional. Se não souber, não envie ou use o padrão." },
                  date: { type: "string", description: "Data desejada no formato YYYY-MM-DD" },
                  duracao: { type: "integer", description: "Duração do procedimento em minutos (obtenha isso usando listar_procedimentos). Se não souber, não envie." }
                },
                required: ["date"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "listar_procedimentos",
              description: "Retorna a lista de procedimentos da clínica com seus tempos de duração média.",
              parameters: {
                type: "object",
                properties: {},
                required: []
              }
            }
          },
          {
            type: "function",
            function: {
              name: "agendar_consulta",
              description: "Agenda uma consulta no OdontoHub",
              parameters: {
                type: "object",
                properties: {
                  dentistId: { type: "string", description: "ID do dentista" },
                  patientName: { type: "string", description: "Nome do paciente" },
                  phone: { type: "string", description: "Telefone do paciente" },
                  date: { type: "string", description: "Data e hora no formato ISO, ex: 2026-05-31T14:00:00.000Z" }
                },
                required: ["dentistId", "patientName", "phone", "date"]
              }
            }
          }
        ],
        tool_choice: "auto"
      });

      const responseMessage = runner.choices[0].message;

      if (responseMessage.tool_calls) {
        // Handle tool calls
        for (const toolCall of responseMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;
          const call = toolCall as any;
          const args = JSON.parse(call.function.arguments);
          
          if (call.function.name === 'verificar_horarios_livres') {
            console.log('[ASSISTANT] Executando tool: verificar_horarios_livres', args);
            // We need to fetch dentists if dentistId is missing
            let dentId = args.dentistId;
            if (!dentId) {
              const dentistsRes = await axios.get('http://agenda-service:3003/dentists', { headers: { Authorization: token } });
              dentId = dentistsRes.data[0]?.id; // Pega o primeiro
            }
            
            try {
               const avail = await axios.get(`http://agenda-service:3003/availability?dentistId=${dentId}&date=${args.date}&duration=${args.duracao || 30}`, { headers: { Authorization: token } });
               
               // To keep it simple, we will feed the result back to another LLM call or just generate a text summary
               // We will just do a recursive call feeding the tool output
               const followUp = await openai.chat.completions.create({
                 model: 'gpt-4o-mini',
                 messages: [
                   { role: 'system', content: systemPrompt },
                   ...history,
                   responseMessage,
                   { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(avail.data.free_slots) }
                 ]
               });
               return res.json({ reply: followUp.choices[0].message.content });
            } catch (e) {
               console.error("Erro ao verificar horarios:", e);
               return res.json({ reply: "Desculpe, não consegui verificar os horários livres no momento." });
            }
          }
          
          if (call.function.name === 'listar_procedimentos') {
            console.log('[ASSISTANT] Executando tool: listar_procedimentos');
            try {
               const procResult = await axios.get('http://auth-service:3001/settings/procedures', { headers: { Authorization: token } });
               const followUp = await openai.chat.completions.create({
                 model: 'gpt-4o-mini',
                 messages: [
                   { role: 'system', content: systemPrompt },
                   ...history,
                   responseMessage,
                   { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(procResult.data) }
                 ]
               });
               return res.json({ reply: followUp.choices[0].message.content });
            } catch (e) {
               return res.json({ reply: "Desculpe, não consegui buscar a lista de procedimentos." });
            }
          }
          
          if (call.function.name === 'agendar_consulta') {
            console.log('[ASSISTANT] Executando tool: agendar_consulta', args);
            // 1. Criar paciente se não existir (ou pegar o existente pelo telefone)
            // Para simplificar, vou criar o paciente diretamente.
            let patientId = '';
            try {
              const pRes = await axios.post('http://patients-service:3002/', { nome: args.patientName, telefone: args.phone }, { headers: { Authorization: token } });
              patientId = pRes.data.id;
            } catch (e: any) {
              // Se der erro, pode ser que já exista. Precisaríamos de um find. Vou usar UUID fake ou falhar amigavelmente
              patientId = e.response?.data?.existingId || 'fake-id'; 
            }

            // 2. Agendar na agenda
            const endTime = new Date(new Date(args.date).getTime() + 30 * 60000).toISOString();
            try {
              await axios.post('http://agenda-service:3003/appointments', {
                patientId,
                dentistId: args.dentistId,
                roomId: '11111111-1111-1111-1111-111111111111', // Fake ou pegar padrao
                startTime: args.date,
                endTime: endTime,
                status: 'pending_confirmation'
              }, { headers: { Authorization: token } });
              
              const followUp = await openai.chat.completions.create({
                 model: 'gpt-4o-mini',
                 messages: [
                   { role: 'system', content: systemPrompt },
                   ...history,
                   responseMessage,
                   { role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ success: true, message: "Pré-agendado com sucesso, aguardando confirmação do dentista." }) }
                 ]
               });
               return res.json({ reply: followUp.choices[0].message.content });
            } catch (e) {
               console.error("Erro ao agendar:", e);
               return res.json({ reply: "Desculpe, deu um erro na hora de salvar o agendamento no sistema. O horário pode ter sido ocupado." });
            }
          }
        }
      }

      return res.json({ reply: responseMessage.content });
    } catch (ollamaError) {
      console.error('[ASSISTANT] Erro na chamada ao OpenAI:', ollamaError);
      return res.json({ 
        reply: 'Desculpe, tive uma falha de conexão.' 
      });
    }
  } catch (error) {
    console.error('[ASSISTANT] Erro geral:', error);
    return res.status(500).json({ message: 'Erro interno no serviço do assistente.' });
  }
});

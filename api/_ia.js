// Gera o rascunho do Mapa da Missão a partir do Raio-X da inscrição.
// Usa ANTHROPIC_API_KEY (preferido) ou OPENAI_API_KEY, configuradas na Vercel.

function provedor() {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return '';
}

const SISTEMA = `Você escreve o "Mapa da Missão" da Studio OpenFrame para uma empresa inscrita no evento Contagem Regressiva (empresários brasileiros do grupo QDN Business, a maioria nos EUA).

A OpenFrame redesenha processos e cria sistemas que executam trabalho todos os dias, para devolver tempo ao dono e à equipe. Princípio: participação por exceção. A operação acontece em segundo plano; a pessoa só é chamada em situações que precisam dela.

Regras de conteúdo:
- Use SOMENTE o que a empresa informou no Raio-X. Não invente números, clientes, ferramentas, tamanho de equipe ou fatos. Quando faltar informação, seja genérico e prudente.
- Fale do trabalho assumido e do benefício, não de tecnologia. Cite tecnologia só quando ajudar a entender (ex.: "um atendente no WhatsApp").
- Nunca prometa empresa totalmente autônoma, eliminação de supervisão, resultados garantidos ou percentuais.
- Autonomia de cada tarefa: "sozinho" (rotina dentro de regras aprovadas), "autoriza" (sistema prepara e pede autorização), "voce" (decisão reservada a uma pessoa: preço fora da tabela, exceções, temas sensíveis). Use pelo menos uma tarefa que não seja "sozinho".
- Estimativa de horas que podem voltar por semana: conservadora, no máximo cerca de 40% do limite superior da faixa informada. Ex.: "10 a 20" → min 3, max 7. "Mais de 40" → no máximo 16.
- O "dia" é uma simulação ilustrativa de 6 a 7 eventos com horários, usando os tipos: concluido, andamento, decisao, bloqueado, nao_verificado (inclua pelo menos um decisao e um nao_verificado ou bloqueado).
- Red flags: 2 ou 3 situações realistas para o ramo, cada uma com exemplo concreto e para quem vai primeiro (um papel, ex.: "Dono", "Gerente", "Atendimento").
- Português do Brasil, frases curtas, tom claro, calmo e responsável. Trate o dono pelo primeiro nome no resumo, em terceira pessoa.

Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, neste formato:
{"resumo": "3 a 4 frases: o que a empresa faz, onde o tempo se perde hoje e o que o mapa propõe",
 "tarefas": [{"titulo": "até 6 palavras", "hoje": "como é feito hoje, 1 frase", "como": "como passa a acontecer, 1 a 2 frases", "autonomia": "sozinho|autoriza|voce"}],
 "dia": [{"hora": "HH:MM", "texto": "até 14 palavras", "tipo": "concluido|andamento|decisao|bloqueado|nao_verificado"}],
 "red_flags": [{"titulo": "até 8 palavras", "exemplo": "1 a 2 frases", "para": "papel"}],
 "estimativa_horas": {"min": número, "max": número},
 "indicadores": ["3 a 4 indicadores mensuráveis do dia a dia da empresa"],
 "primeiro_passo": "1 a 2 frases: uma conversa de diagnóstico e qual trabalho seria assumido primeiro"}
Entre 3 e 5 tarefas, baseadas nas tarefas que a empresa citou.`;

function raioX(w, orientacao) {
  const linhas = [
    `Empresa: ${w.empresa}`, `Responsável: ${w.nome}`, `Ramo: ${w.ramo}`,
    w.site ? `Site: ${w.site}` : (w.sem_site ? 'Site: ainda não tem site' : ''),
    w.instagram ? `Instagram: ${w.instagram}` : '',
    `O que a empresa faz: ${w.faz}`,
    `As tarefas que mais tomam tempo: ${w.tarefas}`,
    `Horas por semana em tarefas repetitivas: ${w.horas}`,
    w.ferramentas ? `Ferramentas que usa: ${w.ferramentas}` : '',
    (w.perdas || []).length ? `Onde sente que perde tempo ou dinheiro: ${w.perdas.join('; ')}` : ''
  ].filter(Boolean);
  if (orientacao) linhas.push('', `Orientação do Alexandre para este mapa (siga com prioridade): ${orientacao}`);
  return 'Raio-X da Operação:\n' + linhas.join('\n');
}

function extrairJSON(txt) {
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('ia sem json');
  return JSON.parse(txt.slice(a, b + 1));
}

async function gerarMapa(w, orientacao) {
  const p = provedor();
  if (!p) throw Object.assign(new Error('ia_setup'), { code: 'ia_setup' });
  const user = raioX(w, orientacao);
  let txt = '';
  if (p === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 3000, system: SISTEMA, messages: [{ role: 'user', content: user }] })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('anthropic ' + r.status + ' ' + ((d.error && d.error.message) || '').slice(0, 160));
    txt = (d.content || []).map(c => c.text || '').join('');
  } else {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: user }] })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('openai ' + r.status + ' ' + ((d.error && d.error.message) || '').slice(0, 160));
    txt = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }
  const m = extrairJSON(txt);
  // dados que vêm da inscrição, não da IA
  return Object.assign(m, {
    empresa: w.empresa, contato_nome: String(w.nome || '').split(' ')[0], ramo: w.ramo, cidade: '',
    horas_semana_atual: w.horas, ferramentas: w.ferramentas || ''
  });
}

module.exports = { provedor, gerarMapa };

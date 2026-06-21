// ================================================================
//  CONFIGURAÇÃO GROQ (CHAVE INSERIDA)
// ================================================================
// ⚠️ ATENÇÃO: Esta chave está exposta. Restrinja-a por domínio no console da Groq!
// 🔑 Se você compartilhou essa chave publicamente, revogue-a e crie uma nova.
const GROQ_API_KEY = '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';

// ================================================================
//  UTILITÁRIOS
// ================================================================
const LS = {
    get(k, def = null) {
        try { return JSON.parse(localStorage.getItem(k)) || def; } catch { return def; }
    },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

function hoje() { return new Date().toISOString().split('T')[0]; }
function formatarTempo(seg) {
    const m = String(Math.floor(seg / 60)).padStart(2, '0');
    const s = String(seg % 60).padStart(2, '0');
    return `${m}:${s}`;
}

// ================================================================
//  ESTADO GLOBAL
// ================================================================
const state = {
    estudando: false,
    segundos: 0,
    timerInterval: null,
    materiaAtual: 'Matemática'
};

// ================================================================
//  NAVEGAÇÃO
// ================================================================
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        if (tab === 'flashcards') carregarFlashcards();
        if (tab === 'grupo') carregarRanking();
        if (tab === 'relatorios') carregarRelatorios();
    });
});

// ================================================================
//  FUNÇÃO CHAMAR GROQ (MODELO ATUALIZADO)
// ================================================================
async function chamarGroq(prompt, modelo = 'llama3-70b-8192') {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const payload = {
        model: modelo,
        messages: [
            { role: 'system', content: 'Você é um assistente de estudos útil e didático.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048
    };

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!resp.ok) {
        const erro = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${erro}`);
    }

    const data = await resp.json();
    const texto = data.choices?.[0]?.message?.content;
    if (!texto) throw new Error('Resposta vazia da IA');
    return texto;
}

// ================================================================
//  CHAT COM IA
// ================================================================
const chatMensagens = document.getElementById('chat-mensagens');
const chatInput = document.getElementById('chat-input');
const btnChat = document.getElementById('btn-chat-enviar');

function adicionarMensagem(texto, tipo) {
    const div = document.createElement('div');
    div.className = `mensagem ${tipo}`;
    div.textContent = texto;
    chatMensagens.appendChild(div);
    chatMensagens.scrollTop = chatMensagens.scrollHeight;
}

async function enviarPergunta(pergunta) {
    if (!pergunta.trim()) return;
    adicionarMensagem(pergunta, 'usuario');
    chatInput.value = '';

    try {
        const prompt = `Responda de forma clara e didática: ${pergunta}`;
        const resp = await chamarGroq(prompt);
        adicionarMensagem(resp, 'ia');
    } catch (e) {
        adicionarMensagem('Erro ao obter resposta. Verifique sua chave e console (F12).', 'ia');
        console.error(e);
    }
}

btnChat.addEventListener('click', () => enviarPergunta(chatInput.value));
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarPergunta(chatInput.value);
});

// ================================================================
//  CRONÔMETRO
// ================================================================
const timerDisplay = document.getElementById('timer');
const progressFill = document.getElementById('timer-progress');

document.getElementById('btn-iniciar').addEventListener('click', () => {
    if (state.estudando) return;
    state.estudando = true;
    state.segundos = 0;
    state.materiaAtual = document.getElementById('materia-select').value;
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.segundos++;
        timerDisplay.textContent = formatarTempo(state.segundos);
        const prog = Math.min(state.segundos / 3600, 1);
        progressFill.style.width = `${prog * 100}%`;
    }, 1000);
    document.getElementById('pos-estudo-area').style.display = 'none';
});

document.getElementById('btn-finalizar').addEventListener('click', () => {
    if (!state.estudando) return;
    clearInterval(state.timerInterval);
    state.estudando = false;
    document.getElementById('pos-estudo-area').style.display = 'block';
});

// ================================================================
//  PÓS-ESTUDO
// ================================================================
document.getElementById('btn-gerar-pos').addEventListener('click', async () => {
    const descricao = document.getElementById('descricao-estudo').value;
    if (!descricao) { alert('Descreva o que você estudou!'); return; }
    const duracao = Math.floor(state.segundos / 60);
    const materia = state.materiaAtual;

    const btn = document.getElementById('btn-gerar-pos');
    btn.textContent = '⏳ Gerando...';
    btn.disabled = true;

    try {
        const prompt = `
        O aluno estudou "${materia}" por ${duracao} minutos. Descrição: "${descricao}".
        Gere um JSON com:
        1. "resumo": resumo curto (máx 3 linhas).
        2. "flashcards": lista de 5 strings no formato "Pergunta|Resposta".
        3. "quiz": lista de 3 objetos com "pergunta", "opcoes" (array de 4), "resposta_correta" e "explicacao".
        Retorne APENAS o JSON.
        `;
        const texto = await chamarGroq(prompt);
        console.log('🔍 RESPOSTA BRUTA (Pós-estudo):', texto);

        let resultado = {};
        try {
            const limpo = texto.replace(/```json|```/g, '').trim();
            resultado = JSON.parse(limpo);
        } catch (e) {
            console.warn('⚠️ JSON inválido. Usando fallback.');
            resultado = {
                resumo: texto.substring(0, 500),
                flashcards: ['Erro ao gerar flashcards|Tente novamente'],
                quiz: [{ pergunta: 'Não foi possível gerar quiz.', opcoes: ['A) Tente', 'B) Novamente'], resposta_correta: 'A', explicacao: 'Verifique o console' }]
            };
        }

        // Salvar sessão
        const sessoes = LS.get('sessoes', []);
        sessoes.push({ materia, duracao, descricao, data: hoje() });
        LS.set('sessoes', sessoes);

        // Salvar flashcards
        const flashcards = LS.get('flashcards', []);
        const cards = resultado.flashcards || [];
        cards.forEach(c => {
            const partes = c.split('|');
            flashcards.push({
                pergunta: partes[0] || c,
                resposta: partes[1] || 'Clique para ver',
                materia,
                proxima_revisao: hoje(),
                criado: hoje()
            });
        });
        LS.set('flashcards', flashcards);

        // Exibir resultado
        const div = document.getElementById('resultado-pos');
        let html = `<h4>📌 Resumo</h4><p>${resultado.resumo || 'Estudo registrado!'}</p>`;
        html += `<h4>🃏 Flashcards</h4>`;
        if (cards.length > 0) {
            cards.forEach((c, i) => {
                const partes = c.split('|');
                const p = partes[0] || c;
                const r = partes[1] || 'Clique para ver';
                html += `<div class="flashcard-item" onclick="this.classList.toggle('aberto')">
                    <div class="pergunta">${i+1}. ${p}</div>
                    <div class="resposta">${r}</div>
                </div>`;
            });
        } else {
            html += `<p style="color:#A1A1AA;">Nenhum flashcard gerado.</p>`;
        }

        html += `<h4>📝 Quiz</h4>`;
        const quiz = resultado.quiz || [];
        if (quiz.length > 0) {
            quiz.forEach(q => {
                html += `<div class="questao-item"><strong>${q.pergunta}</strong><br>`;
                (q.opcoes || []).forEach(o => { html += `▪ ${o} `; });
                html += `<br><span style="color:#7C3AED;">✅ ${q.resposta_correta}</span> <span style="color:#A1A1AA;">${q.explicacao || ''}</span></div>`;
            });
        } else {
            html += `<p style="color:#A1A1AA;">Nenhum quiz gerado.</p>`;
        }
        div.innerHTML = html;

        alert(`✅ Estudo finalizado! ${duracao} min em ${materia}.`);

    } catch (e) {
        alert('Erro ao chamar a Groq. Verifique sua chave no console (F12).');
        console.error(e);
    }
    btn.textContent = '📝 Gerar Flashcards e Quiz';
    btn.disabled = false;
});

// ================================================================
//  RANKING
// ================================================================
function carregarRanking() {
    const ranking = LS.get('ranking', []);
    const div = document.getElementById('ranking-lista');
    if (!ranking.length) {
        div.innerHTML = '<p style="color:#A1A1AA;">Ninguém registrou hoje. Adicione seus minutos!</p>';
        return;
    }
    const ordenado = [...ranking].sort((a, b) => b.minutos - a.minutos);
    let html = '';
    ordenado.forEach((item, i) => {
        const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`;
        html += `<div class="ranking-item"><span class="pos">${medalha}</span><span>${item.nome}</span><span>${item.minutos} min</span></div>`;
    });
    div.innerHTML = html;
}

document.getElementById('btn-add-ranking').addEventListener('click', () => {
    const nome = document.getElementById('ranking-nome').value.trim() || 'Anônimo';
    const minutos = parseInt(document.getElementById('ranking-minutos').value) || 0;
    if (minutos <= 0) { alert('Insira minutos válidos'); return; }
    const ranking = LS.get('ranking', []);
    const hojeStr = hoje();
    const existente = ranking.find(r => r.nome === nome && r.data === hojeStr);
    if (existente) {
        existente.minutos += minutos;
    } else {
        ranking.push({ nome, minutos, data: hojeStr });
    }
    LS.set('ranking', ranking);
    carregarRanking();
    alert(`✅ ${nome} adicionou ${minutos} min ao ranking!`);
});

// ================================================================
//  FLASHCARDS
// ================================================================
function carregarFlashcards() {
    const todos = LS.get('flashcards', []);
    const hojeStr = hoje();
    const pendentes = todos.filter(f => f.proxima_revisao <= hojeStr);
    const div = document.getElementById('flashcards-lista');
    if (!pendentes.length) {
        div.innerHTML = '<p style="color:#A1A1AA;">🎉 Nenhum flashcard para revisar hoje!</p>';
        return;
    }
    let html = '';
    pendentes.forEach((f, idx) => {
        html += `<div class="flashcard-item" onclick="this.classList.toggle('aberto')">
            <div class="pergunta">📌 ${f.pergunta}</div>
            <div class="resposta">${f.resposta}</div>
            <button style="margin-top:10px; padding:4px 12px; font-size:12px; background:#2D2F3A;" onclick="event.stopPropagation(); revisarFlashcard(${idx})">✅ Já revisei</button>
        </div>`;
    });
    div.innerHTML = html;
}

function revisarFlashcard(idx) {
    const todos = LS.get('flashcards', []);
    const hojeStr = hoje();
    const pendentes = todos.filter(f => f.proxima_revisao <= hojeStr);
    if (!pendentes[idx]) return;
    const card = pendentes[idx];
    const originalIndex = todos.findIndex(f => f.pergunta === card.pergunta && f.criado === card.criado);
    if (originalIndex !== -1) {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        todos[originalIndex].proxima_revisao = d.toISOString().split('T')[0];
        LS.set('flashcards', todos);
    }
    carregarFlashcards();
    alert('✅ Flashcard revisado! Próxima revisão em 3 dias.');
}

// ================================================================
//  REDAÇÃO
// ================================================================
document.getElementById('btn-corrigir-redacao').addEventListener('click', async () => {
    const texto = document.getElementById('texto-redacao').value;
    if (!texto) { alert('Escreva a redação primeiro!'); return; }
    const btn = document.getElementById('btn-corrigir-redacao');
    btn.textContent = '⏳ Corrigindo...';
    btn.disabled = true;

    try {
        const prompt = `
        Corrija a redação abaixo como se fosse o ENEM:
        ${texto}
        Dê: Nota (0-1000), análise de estrutura (introdução/desenvolvimento/conclusão), erros gramaticais, 3 sugestões de melhoria e um trecho reescrito.
        `;
        const resultado = await chamarGroq(prompt);
        document.getElementById('resultado-redacao').innerHTML = `<div class="card">${resultado.replace(/\n/g, '<br>')}</div>`;
    } catch (e) {
        alert('Erro na correção. Veja o console (F12).');
        console.error(e);
    }
    btn.textContent = '📝 Corrigir Redação';
    btn.disabled = false;
});

// ================================================================
//  VESTIBULINHO
// ================================================================
let questoesAtuais = [];
let respostasVest = {};

document.getElementById('btn-gerar-vest').addEventListener('click', async () => {
    const btn = document.getElementById('btn-gerar-vest');
    btn.textContent = '⏳ Gerando 45 questões...';
    btn.disabled = true;

    try {
        const prompt = `
        Gere um simulado com 45 questões de múltipla escolha (5 alternativas A-E) para ensino médio.
        Retorne APENAS um JSON com uma lista de 45 objetos. Cada objeto: 
        {"id":1, "enunciado":"...", "opcoes":["A) ...", "B) ...", "C) ...", "D) ...", "E) ..."], "gabarito":"A", "explicacao":"..."}.
        `;
        const texto = await chamarGroq(prompt);
        console.log('🔍 RESPOSTA BRUTA (Vestibulinho):', texto);
        try {
            const limpo = texto.replace(/```json|```/g, '').trim();
            questoesAtuais = JSON.parse(limpo);
        } catch (e) {
            console.warn('⚠️ JSON do vestibulinho inválido. Usando fallback.');
            questoesAtuais = [];
        }
        respostasVest = {};
        renderizarVestibulinho();
    } catch (e) {
        alert('Erro ao gerar simulado. Veja o console.');
        console.error(e);
    }
    btn.textContent = '🔄 Gerar Simulado';
    btn.disabled = false;
});

function renderizarVestibulinho() {
    const container = document.getElementById('vestibulinho-container');
    if (!questoesAtuais.length) {
        container.innerHTML = '<p>⚠️ Não foi possível gerar as questões. Clique em "Gerar" novamente ou veja o console (F12).</p>';
        return;
    }
    let html = `<p style="color:#A1A1AA;">${Object.keys(respostasVest).length} / 45 respondidas</p>`;
    questoesAtuais.slice(0, 45).forEach((q, idx) => {
        html += `<div class="questao-item">
            <strong>Q${idx+1}. ${q.enunciado}</strong>
            <div>`;
        q.opcoes.forEach(op => {
            const letra = op.charAt(0);
            const checked = respostasVest[idx] === letra ? 'checked' : '';
            html += `<label><input type="radio" name="vest_${idx}" value="${letra}" ${checked} onchange="marcarVest(${idx}, '${letra}')"> ${op}</label>`;
        });
        html += `</div></div>`;
    });
    html += `<button id="btn-finalizar-vest">📊 Finalizar e Ver Resultado</button>`;
    container.innerHTML = html;

    document.getElementById('btn-finalizar-vest').addEventListener('click', finalizarVestibulinho);
}

function marcarVest(idx, letra) {
    respostasVest[idx] = letra;
    renderizarVestibulinho();
}

function finalizarVestibulinho() {
    let acertos = 0;
    questoesAtuais.slice(0, 45).forEach((q, idx) => {
        if (respostasVest[idx] === q.gabarito) acertos++;
    });
    const nota = ((acertos / 45) * 100).toFixed(1);
    alert(`🎯 NOTA: ${nota}% (Acertou ${acertos} de 45)`);
    const historico = LS.get('vestibulinho_historico', []);
    historico.push({ nota, data: hoje(), acertos, total: 45 });
    LS.set('vestibulinho_historico', historico);
    carregarRelatorios();
}

// ================================================================
//  RELATÓRIOS
// ================================================================
function carregarRelatorios() {
    const sessoes = LS.get('sessoes', []);
    const flashcards = LS.get('flashcards', []);
    const totalMin = sessoes.reduce((acc, s) => acc + (s.duracao || 0), 0);
    document.getElementById('rel-total').textContent = totalMin;
    document.getElementById('rel-sessoes').textContent = sessoes.length;
    document.getElementById('rel-flashcards').textContent = flashcards.length;

    const dias = [...new Set(sessoes.map(s => s.data))].sort();
    let racha = 0;
    if (dias.length) {
        let atual = new Date();
        let count = 0;
        for (let i = dias.length - 1; i >= 0; i--) {
            const d = new Date(dias[i]);
            const diff = (atual - d) / (1000 * 60 * 60 * 24);
            if (diff < 1) { count++; } else break;
        }
        racha = count;
    }
    document.getElementById('racha-display').textContent = `🔥 ${racha} dias`;
}

// ================================================================
//  INICIALIZAÇÃO
// ================================================================
carregarRanking();
carregarFlashcards();
carregarRelatorios();

console.log('🚀 My Study IA rodando com GROQ (modelo llama3-70b-8192)!');
console.log('⚠️ Chave API inserida. Restrinja por domínio no console da Groq.');

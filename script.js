// ================================================================
//  CONFIGURAÇÃO GROQ (CHAVE INSERIDA)
// ================================================================
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
//  FUNÇÃO CHAMAR GROQ (MODELO CORRETO: openai/gpt-oss-120b)
// ================================================================
async function chamarGroq(prompt, modelo = 'openai/gpt-oss-120b') {
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
//  FORMATADOR DE MARKDOWN PARA HTML (para chat e resumo)
// ================================================================
function formatarMarkdown(texto) {
    if (!texto) return '';
    let html = texto;
    
    // Títulos ## e ###
    html = html.replace(/^### (.*)/gm, '<h5>$1</h5>');
    html = html.replace(/^## (.*)/gm, '<h4>$1</h4>');
    
    // Negrito **
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Itálico *
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Listas não ordenadas (* item)
    html = html.replace(/^\* (.*)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Listas ordenadas (1. item)
    html = html.replace(/^\d+\. (.*)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        // Só converte se não for dentro de um <ul> já existente
        if (!match.includes('<ul>')) {
            return `<ol>${match}</ol>`;
        }
        return match;
    });
    
    // Tabelas (simples: linhas com |)
    const tableRegex = /^\|.*\|$/gm;
    let tableMatch;
    let tables = [];
    while ((tableMatch = tableRegex.exec(html)) !== null) {
        tables.push(tableMatch[0]);
    }
    tables.forEach((t, i) => {
        const rows = t.split('\n').filter(r => r.trim().startsWith('|'));
        if (rows.length < 2) return;
        let tableHtml = '<table>';
        rows.forEach((row, ri) => {
            const cells = row.split('|').filter(c => c.trim() !== '');
            // Pula linha de separação (|---|)
            if (cells.every(c => /^-+$/.test(c.trim()))) return;
            tableHtml += '<tr>';
            cells.forEach(cell => {
                const tag = ri === 0 ? 'th' : 'td';
                tableHtml += `<${tag}>${cell.trim()}</${tag}>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</table>';
        html = html.replace(t, tableHtml);
    });
    
    // Linhas com --- para <hr>
    html = html.replace(/^---$/gm, '<hr>');
    
    // Código inline (backticks)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Blocos de código (```)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Quebras de linha duplas para parágrafos
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    
    // Envolve em <p> se não tiver tags de bloco
    if (!html.startsWith('<') && !html.startsWith('</')) {
        html = `<p>${html}</p>`;
    }
    
    return html;
}

// ================================================================
//  CHAT COM IA (COM INDICADOR DE "PENSANDO")
// ================================================================
const chatMensagens = document.getElementById('chat-mensagens');
const chatInput = document.getElementById('chat-input');
const btnChat = document.getElementById('btn-chat-enviar');

function adicionarMensagem(texto, tipo, formatado = false) {
    const div = document.createElement('div');
    div.className = `mensagem ${tipo}`;
    if (formatado) {
        div.innerHTML = formatarMarkdown(texto);
    } else {
        div.textContent = texto;
    }
    chatMensagens.appendChild(div);
    chatMensagens.scrollTop = chatMensagens.scrollHeight;
    return div;
}

async function enviarPergunta(pergunta) {
    if (!pergunta.trim()) return;
    adicionarMensagem(pergunta, 'usuario');
    chatInput.value = '';

    // --- Adiciona indicador de "pensando" ---
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'mensagem ia';
    loadingDiv.innerHTML = '⏳ <em>Pensando...</em>';
    chatMensagens.appendChild(loadingDiv);
    chatMensagens.scrollTop = chatMensagens.scrollHeight;
    btnChat.disabled = true;

    try {
        const prompt = `Responda de forma clara e didática. Use markdown para organizar a resposta (títulos ##, negrito **, listas com *, tabelas com |). ${pergunta}`;
        const resp = await chamarGroq(prompt);
        
        // Remove o indicador de "pensando"
        loadingDiv.remove();
        
        // Adiciona a resposta formatada
        adicionarMensagem(resp, 'ia', true);
    } catch (e) {
        loadingDiv.innerHTML = '❌ <em>Erro ao obter resposta. Verifique sua chave e console (F12).</em>';
        loadingDiv.style.borderLeftColor = '#F87171';
        console.error(e);
    }
    btnChat.disabled = false;
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
//  PÓS-ESTUDO (RESUMO FORMATADO + FLASHCARDS PALAVRAS-CHAVE + QUIZ INTERATIVO)
// ================================================================
document.getElementById('btn-gerar-pos').addEventListener('click', async () => {
    const descricao = document.getElementById('descricao-estudo').value;
    if (!descricao) { alert('Descreva o que você estudou!'); return; }
    const duracao = Math.floor(state.segundos / 60);

    const btn = document.getElementById('btn-gerar-pos');
    btn.textContent = '⏳ Gerando...';
    btn.disabled = true;

    try {
        const prompt = `
        O aluno estudou por ${duracao} minutos. Descrição do conteúdo estudado: "${descricao}".
        Com base APENAS nessa descrição, gere um JSON com:
        1. "resumo": um resumo claro e didático do conteúdo (pode usar títulos, negrito, listas, mas mantenha texto puro, sem formatação especial, apenas markdown simples com ##, ** e *).
        2. "flashcards": lista de 5 strings no formato "Palavra-chave|Explicação breve" – palavras‑chave que ajudem a lembrar do conteúdo.
        3. "quiz": lista de 3 objetos. Cada objeto deve ter:
           - "pergunta": uma pergunta sobre o conteúdo descrito.
           - "opcoes": um array com 5 alternativas (A, B, C, D, E) – cada string deve começar com a letra e um parêntese (ex: "A) ...").
           - "resposta_correta": a letra da alternativa correta (ex: "A").
           - "explicacao": por que essa é a resposta correta.
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
                quiz: [{ 
                    pergunta: 'Não foi possível gerar quiz.', 
                    opcoes: ['A) Tente', 'B) Novamente', 'C) Mais tarde', 'D) OK', 'E) Sair'], 
                    resposta_correta: 'A', 
                    explicacao: 'Verifique o console' 
                }]
            };
        }

        // Salvar sessão
        const sessoes = LS.get('sessoes', []);
        sessoes.push({ materia: 'Geral', duracao, descricao, data: hoje() });
        LS.set('sessoes', sessoes);

        // Salvar flashcards (palavras-chave)
        const flashcards = LS.get('flashcards', []);
        const cards = resultado.flashcards || [];
        cards.forEach(c => {
            const partes = c.split('|');
            flashcards.push({
                pergunta: partes[0] || c,
                resposta: partes[1] || 'Clique para ver',
                materia: 'Geral',
                proxima_revisao: hoje(),
                criado: hoje()
            });
        });
        LS.set('flashcards', flashcards);

        // --- EXIBIR RESULTADO ---
        const div = document.getElementById('resultado-pos');
        let html = '';

        // 1. Resumo formatado
        html += `<div class="resumo-formatado"><h4>📌 Resumo</h4>${formatarMarkdown(resultado.resumo || 'Estudo registrado!')}</div>`;

        // 2. Flashcards (palavras-chave)
        html += `<h4>🔑 Palavras‑chave (Flashcards)</h4>`;
        if (cards.length > 0) {
            cards.forEach((c, i) => {
                const partes = c.split('|');
                const palavra = partes[0] || c;
                const explicacao = partes[1] || 'Clique para ver';
                html += `<div class="flashcard-item" onclick="this.classList.toggle('aberto')">
                    <div class="pergunta">${i+1}. ${palavra}</div>
                    <div class="resposta">${explicacao}</div>
                </div>`;
            });
        } else {
            html += `<p style="color:#A1A1AA;">Nenhum flashcard gerado.</p>`;
        }

        // 3. Quiz interativo (5 alternativas)
        html += `<h4>📝 Quiz (clique em uma alternativa)</h4>`;
        const quiz = resultado.quiz || [];
        if (quiz.length > 0) {
            quiz.forEach((q, idx) => {
                html += `
                <div class="questao-item" id="quiz-${idx}">
                    <strong>${idx+1}. ${q.pergunta}</strong>
                    <div style="margin-top:8px;">`;
                if (q.opcoes && q.opcoes.length === 5) {
                    q.opcoes.forEach((op, oi) => {
                        const letra = String.fromCharCode(65 + oi); // A, B, C, D, E
                        html += `
                        <div class="opcao" data-idx="${idx}" data-letra="${letra}" data-correta="${q.resposta_correta}" data-explicacao="${q.explicacao || ''}">
                            ${op}
                        </div>`;
                    });
                } else {
                    html += `▪ A) Opção 1<br>▪ B) Opção 2<br>▪ C) Opção 3<br>▪ D) Opção 4<br>▪ E) Opção 5`;
                }
                html += `
                    </div>
                    <div id="feedback-${idx}" style="margin-top:8px; display:none;"></div>
                </div>`;
            });
        } else {
            html += `<p style="color:#A1A1AA;">Nenhum quiz gerado.</p>`;
        }

        div.innerHTML = html;

        // Adicionar eventos de clique nas opções do quiz
        document.querySelectorAll('.opcao').forEach(el => {
            el.addEventListener('click', function() {
                const idx = this.dataset.idx;
                const letraEscolhida = this.dataset.letra;
                const correta = this.dataset.correta;
                const explicacao = this.dataset.explicacao;
                const feedback = document.getElementById(`feedback-${idx}`);
                const parent = this.closest('.questao-item');
                
                parent.querySelectorAll('.opcao').forEach(opt => {
                    opt.classList.remove('selecionada', 'correta', 'errada');
                });
                
                this.classList.add('selecionada');
                
                feedback.style.display = 'block';
                if (letraEscolhida === correta) {
                    this.classList.add('correta');
                    feedback.innerHTML = `<span style="color:#4ADE80;">✅ Correta! ${explicacao}</span>`;
                } else {
                    this.classList.add('errada');
                    parent.querySelectorAll('.opcao').forEach(opt => {
                        if (opt.dataset.letra === correta) {
                            opt.classList.add('correta');
                        }
                    });
                    feedback.innerHTML = `<span style="color:#F87171;">❌ Errada. A correta é ${correta}. ${explicacao}</span>`;
                }
            });
        });

        alert(`✅ Estudo finalizado! ${duracao} min. Flashcards e quiz gerados a partir da sua descrição.`);

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
//  FLASHCARDS (REVISÃO ESPAÇADA)
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
            <div class="pergunta">🔑 ${f.pergunta}</div>
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
//  VESTIBULINHO (COM VALIDAÇÃO ROBUSTA)
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
        As questões devem cobrir diversas áreas: matemática, português, história, geografia, física, química, biologia, inglês e conhecimentos gerais.
        Retorne APENAS um JSON com uma lista de 45 objetos. Cada objeto deve ter os campos:
        "id" (número), "enunciado" (string), "opcoes" (array com 5 strings, cada uma começando com "A) ", "B) ", etc.), "gabarito" (string com a letra correta), "explicacao" (string com a justificativa).
        Certifique-se de que o JSON seja 100% válido e que todas as 45 questões estejam completas.
        `;
        const texto = await chamarGroq(prompt);
        console.log('🔍 RESPOSTA BRUTA (Vestibulinho):', texto);
        
        let dados = [];
        try {
            const limpo = texto.replace(/```json|```/g, '').trim();
            dados = JSON.parse(limpo);
        } catch (e) {
            console.warn('⚠️ JSON do vestibulinho inválido. Tentando extrair array manualmente...');
            const match = texto.match(/\[\s*\{.*\}\s*\]/s);
            if (match) {
                try {
                    dados = JSON.parse(match[0]);
                } catch (e2) {
                    dados = [];
                }
            } else {
                dados = [];
            }
        }

        if (!Array.isArray(dados) || dados.length === 0) {
            throw new Error('A IA não retornou um array válido de questões.');
        }

        questoesAtuais = dados.filter(q => q.enunciado && q.opcoes && q.opcoes.length === 5 && q.gabarito);
        
        if (questoesAtuais.length < 10) {
            throw new Error(`Apenas ${questoesAtuais.length} questões válidas foram geradas. Tente novamente.`);
        }

        questoesAtuais = questoesAtuais.slice(0, 45);
        respostasVest = {};
        renderizarVestibulinho();

    } catch (e) {
        alert(`❌ Erro: ${e.message || 'Não foi possível gerar o simulado. Tente novamente.'}`);
        console.error(e);
        document.getElementById('vestibulinho-container').innerHTML = `
            <p style="color:#F87171;">❌ Não foi possível gerar as questões. Verifique o console (F12) para mais detalhes.</p>
            <button onclick="document.getElementById('btn-gerar-vest').click()" style="margin-top:12px;">🔄 Tentar Novamente</button>
        `;
    }
    btn.textContent = '🔄 Gerar Simulado';
    btn.disabled = false;
});

function renderizarVestibulinho() {
    const container = document.getElementById('vestibulinho-container');
    if (!questoesAtuais || questoesAtuais.length === 0) {
        container.innerHTML = '<p style="color:#F87171;">⚠️ Nenhuma questão disponível. Clique em "Gerar" novamente.</p>';
        return;
    }
    let html = `<p style="color:#A1A1AA;">${Object.keys(respostasVest).length} / ${questoesAtuais.length} respondidas</p>`;
    questoesAtuais.forEach((q, idx) => {
        html += `<div class="questao-item" id="vest-${idx}">
            <strong>Q${idx+1}. ${q.enunciado}</strong>
            <div style="margin-top:8px;">`;
        q.opcoes.forEach(op => {
            const letra = op.charAt(0);
            const checked = respostasVest[idx] === letra ? 'checked' : '';
            html += `<label style="display:block; padding:4px 8px; margin:4px 0; border-radius:6px; cursor:pointer;">
                <input type="radio" name="vest_${idx}" value="${letra}" ${checked} onchange="marcarVest(${idx}, '${letra}')" style="accent-color:#7C3AED; margin-right:10px;">
                ${op}
            </label>`;
        });
        html += `</div></div>`;
    });
    html += `<button id="btn-finalizar-vest">📊 Finalizar e Ver Resultado</button>`;
    container.innerHTML = html;

    document.getElementById('btn-finalizar-vest').addEventListener('click', finalizarVestibulinho);
}

function marcarVest(idx, letra) {
    respostasVest[idx] = letra;
    const container = document.getElementById('vestibulinho-container');
    const p = container.querySelector('p');
    if (p) p.textContent = `${Object.keys(respostasVest).length} / ${questoesAtuais.length} respondidas`;
}

function finalizarVestibulinho() {
    if (Object.keys(respostasVest).length < questoesAtuais.length) {
        const confirmar = confirm(`Você respondeu ${Object.keys(respostasVest).length} de ${questoesAtuais.length} questões. Deseja finalizar mesmo assim?`);
        if (!confirmar) return;
    }
    let acertos = 0;
    questoesAtuais.forEach((q, idx) => {
        if (respostasVest[idx] === q.gabarito) acertos++;
    });
    const nota = ((acertos / questoesAtuais.length) * 100).toFixed(1);
    alert(`🎯 NOTA: ${nota}% (Acertou ${acertos} de ${questoesAtuais.length})`);
    const historico = LS.get('vestibulinho_historico', []);
    historico.push({ nota, data: hoje(), acertos, total: questoesAtuais.length });
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

console.log('🚀 My Study IA rodando com GROQ (modelo openai/gpt-oss-120b)');
console.log('✅ Chat com formatação markdown e indicador de "pensando"');

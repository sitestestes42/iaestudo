// ================================================================
//  CONFIGURAÇÃO SUPABASE
// ================================================================
const SUPABASE_URL = 'https://vpihrpqvzrmixxdrqwbj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ucBzmjp0Xbwi7Z-RHsk4Yg_LydKnMMZ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================================
//  CONFIGURAÇÃO GROQ – CHAVE INSERIDA
// ================================================================
const GROQ_API_KEY = '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';

// ================================================================
//  E-MAIL ADMIN
// ================================================================
const adminEmail = 'ruasflavio29@gmail.com';

// ================================================================
//  UTILITÁRIOS
// ================================================================
function hoje() { return new Date().toISOString().split('T')[0]; }
function formatarTempo(seg) {
    const m = String(Math.floor(seg / 60)).padStart(2, '0');
    const s = String(seg % 60).padStart(2, '0');
    return `${m}:${s}`;
}

let usuarioAtual = null;
let grupoAtual = null;
let chatGrupoSubscription = null;
let conversaAtual = null;
let conversas = [];
let usuarioNomeExibicao = '';

// ================================================================
//  LOGIN / AUTENTICAÇÃO
// ================================================================
const telaLogin = document.getElementById('tela-login');
const appPrincipal = document.getElementById('app-principal');
const loginEmail = document.getElementById('login-email');
const loginSenha = document.getElementById('login-senha');
const loginBtn = document.getElementById('login-btn');
const loginGoogleBtn = document.getElementById('login-google-btn');
const loginMsg = document.getElementById('login-mensagem');
const mostrarCadastro = document.getElementById('mostrar-cadastro');
const mostrarRecuperar = document.getElementById('mostrar-recuperar');
const saudacaoTopo = document.getElementById('saudacao-topo');
const drawerUsuario = document.getElementById('drawer-usuario');
const btnSair = document.getElementById('btn-sair');

let modoLogin = 'entrar';

mostrarCadastro.addEventListener('click', (e) => {
    e.preventDefault();
    modoLogin = 'cadastrar';
    loginBtn.textContent = '📝 Cadastrar';
    loginMsg.textContent = 'Crie sua conta com e-mail e senha.';
});

mostrarRecuperar.addEventListener('click', (e) => {
    e.preventDefault();
    modoLogin = 'recuperar';
    loginBtn.textContent = '📧 Recuperar Senha';
    loginMsg.textContent = 'Digite seu e-mail para receber o link de recuperação.';
});

loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const senha = loginSenha.value.trim();
    if (!email || !senha) {
        loginMsg.textContent = '⚠️ Preencha todos os campos.';
        loginMsg.style.color = '#F87171';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '⏳ Carregando...';

    try {
        let result;
        if (modoLogin === 'entrar') {
            result = await supabaseClient.auth.signInWithPassword({ email, password: senha });
        } else if (modoLogin === 'cadastrar') {
            result = await supabaseClient.auth.signUp({ email, password: senha });
            if (result.error && result.error.message.includes('already registered')) {
                loginMsg.textContent = '⚠️ Este e-mail já está cadastrado. Faça login.';
                loginMsg.style.color = '#F87171';
                loginBtn.disabled = false;
                loginBtn.textContent = '🚀 Entrar';
                return;
            }
            if (!result.error) {
                loginMsg.textContent = '✅ Conta criada! Verifique seu e-mail para confirmar.';
                loginMsg.style.color = '#4ADE80';
                loginBtn.disabled = false;
                loginBtn.textContent = '🚀 Entrar';
                return;
            }
        } else if (modoLogin === 'recuperar') {
            result = await supabaseClient.auth.resetPasswordForEmail(email);
            if (!result.error) {
                loginMsg.textContent = '📧 Link de recuperação enviado para seu e-mail.';
                loginMsg.style.color = '#4ADE80';
                loginBtn.disabled = false;
                loginBtn.textContent = '📧 Enviado';
                return;
            }
        }

        if (result.error) throw result.error;

        usuarioAtual = result.data.user;
        loginMsg.textContent = '✅ Login realizado com sucesso!';
        loginMsg.style.color = '#4ADE80';
        entrarNoApp(usuarioAtual);
    } catch (err) {
        console.error(err);
        loginMsg.textContent = `❌ ${err.message || 'Erro ao autenticar.'}`;
        loginMsg.style.color = '#F87171';
    }
    loginBtn.disabled = false;
    loginBtn.textContent = '🚀 Entrar';
});

loginGoogleBtn.addEventListener('click', async () => {
    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
    } catch (err) {
        console.error(err);
        loginMsg.textContent = `❌ ${err.message}`;
        loginMsg.style.color = '#F87171';
    }
});

supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) {
        usuarioAtual = data.session.user;
        entrarNoApp(usuarioAtual);
    }
});

btnSair.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    usuarioAtual = null;
    grupoAtual = null;
    if (chatGrupoSubscription) {
        chatGrupoSubscription.unsubscribe();
        chatGrupoSubscription = null;
    }
    localStorage.clear();
    telaLogin.style.display = 'flex';
    appPrincipal.style.display = 'none';
});

// ================================================================
//  ENTRAR NO APP
// ================================================================
async function entrarNoApp(user) {
    telaLogin.style.display = 'none';
    appPrincipal.style.display = 'block';

    // Buscar nome personalizado
    try {
        const { data, error } = await supabaseClient
            .from('usuarios')
            .select('nome_exibicao')
            .eq('id', user.id)
            .single();
        if (!error && data?.nome_exibicao) {
            usuarioNomeExibicao = data.nome_exibicao;
        } else {
            usuarioNomeExibicao = user.email.split('@')[0];
            await supabaseClient.from('usuarios').upsert({
                id: user.id,
                nome_exibicao: usuarioNomeExibicao
            });
        }
    } catch (e) {
        usuarioNomeExibicao = user.email.split('@')[0];
    }

    saudacaoTopo.innerHTML = `Olá, <strong>${usuarioNomeExibicao}</strong> 🌟`;
    drawerUsuario.textContent = usuarioNomeExibicao;
    window.usuarioNomeExibicao = usuarioNomeExibicao;

    if (user.email === adminEmail) {
        document.getElementById('admin-aulas').style.display = 'block';
    }

    adicionarBotaoEditarNome();

    carregarDadosUsuario();
    carregarConversas();
    carregarGrupoDoUsuario(); // Carrega o grupo ao logar
    carregarAulas();
}

function adicionarBotaoEditarNome() {
    const topBarRight = document.querySelector('.top-bar-right');
    const btnEditar = document.createElement('button');
    btnEditar.textContent = '✏️ Nome';
    btnEditar.className = 'btn-sair';
    btnEditar.style.marginRight = '8px';
    btnEditar.addEventListener('click', criarModalNome);
    topBarRight.insertBefore(btnEditar, topBarRight.firstChild);
}

// ================================================================
//  PERSONALIZAR NOME
// ================================================================
function criarModalNome() {
    const overlay = document.createElement('div');
    overlay.id = 'modal-nome';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
        z-index: 9999; backdrop-filter: blur(4px);
    `;
    overlay.innerHTML = `
        <div style="background: #1A1F2E; border-radius: 20px; padding: 32px; max-width: 400px; width: 90%; border: 1px solid #2D3448; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <h3 style="margin-bottom: 8px; color: #F1F5F9;">✏️ Editar Nome</h3>
            <p style="color: #94A3B8; font-size: 14px; margin-bottom: 16px;">Como você quer ser chamado?</p>
            <input type="text" id="input-novo-nome" placeholder="Digite seu novo nome" value="${usuarioNomeExibicao}" style="width: 100%; padding: 12px 16px; background: #0B0E14; border: 1px solid #2D3448; border-radius: 12px; color: #F1F5F9; font-size: 16px; margin-bottom: 16px;">
            <div style="display: flex; gap: 10px;">
                <button onclick="salvarNomeUsuario()" style="flex:1; background: #7C3AED; color: white; border: none; padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer;">💾 Salvar</button>
                <button onclick="fecharModalNome()" style="flex:1; background: #2D3448; color: #94A3B8; border: none; padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer;">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('input-novo-nome').focus();
}

window.fecharModalNome = function() {
    const modal = document.getElementById('modal-nome');
    if (modal) modal.remove();
};

window.salvarNomeUsuario = async function() {
    const input = document.getElementById('input-novo-nome');
    const nome = input.value.trim();
    if (!nome) { alert('Digite um nome válido.'); return; }

    try {
        const { error } = await supabaseClient
            .from('usuarios')
            .upsert({ id: usuarioAtual.id, nome_exibicao: nome });
        if (error) throw error;

        usuarioNomeExibicao = nome;
        window.usuarioNomeExibicao = nome;
        saudacaoTopo.innerHTML = `Olá, <strong>${nome}</strong> 🌟`;
        drawerUsuario.textContent = nome;
        fecharModalNome();
        alert('✅ Nome atualizado com sucesso!');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar nome.');
    }
};

// ================================================================
//  SISTEMA DE CONVERSAS
// ================================================================
async function carregarConversas() {
    if (!usuarioAtual) return;
    try {
        const { data, error } = await supabaseClient
            .from('conversas')
            .select('id, titulo, created_at')
            .eq('usuario_id', usuarioAtual.id)
            .order('updated_at', { ascending: false });
        if (error) throw error;
        conversas = data || [];
        if (conversas.length === 0) {
            await criarNovaConversa('Nova conversa');
        } else {
            conversaAtual = conversas[0];
            renderizarListaConversas();
            carregarMensagensConversa(conversaAtual.id);
        }
    } catch (e) {
        console.error('Erro ao carregar conversas:', e);
    }
}

async function criarNovaConversa(titulo = 'Nova conversa') {
    if (!usuarioAtual) return;
    try {
        const { data, error } = await supabaseClient
            .from('conversas')
            .insert({
                usuario_id: usuarioAtual.id,
                titulo: titulo,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();
        if (error) throw error;
        conversas.unshift(data);
        conversaAtual = data;
        renderizarListaConversas();
        document.getElementById('chat-mensagens').innerHTML = '';
    } catch (e) {
        console.error('Erro ao criar conversa:', e);
    }
}

async function gerarTituloConversa(primeiraMensagem) {
    if (!primeiraMensagem || primeiraMensagem.length < 5) return 'Nova conversa';
    try {
        const prompt = `Gere um título curto (máx 5 palavras) para uma conversa que começa com: "${primeiraMensagem}". Retorne apenas o título, sem aspas.`;
        const titulo = await chamarGroq(prompt);
        return titulo.trim().substring(0, 50);
    } catch (e) {
        const palavras = primeiraMensagem.split(' ').slice(0, 4).join(' ');
        return palavras.length > 5 ? palavras : 'Nova conversa';
    }
}

async function atualizarTituloConversa(conversaId, novoTitulo) {
    if (!conversaId || !novoTitulo) return;
    try {
        await supabaseClient
            .from('conversas')
            .update({ titulo: novoTitulo, updated_at: new Date().toISOString() })
            .eq('id', conversaId);
        const conv = conversas.find(c => c.id === conversaId);
        if (conv) conv.titulo = novoTitulo;
        renderizarListaConversas();
    } catch (e) { console.error('Erro ao atualizar título:', e); }
}

async function deletarConversa(id) {
    if (!confirm('Deseja deletar esta conversa?')) return;
    try {
        await supabaseClient
            .from('conversas')
            .delete()
            .eq('id', id)
            .eq('usuario_id', usuarioAtual.id);
        conversas = conversas.filter(c => c.id !== id);
        if (conversaAtual && conversaAtual.id === id) {
            conversaAtual = conversas[0] || null;
            if (conversaAtual) {
                carregarMensagensConversa(conversaAtual.id);
            } else {
                await criarNovaConversa();
            }
        }
        renderizarListaConversas();
    } catch (e) {
        console.error('Erro ao deletar conversa:', e);
    }
}

async function alternarConversa(id) {
    const conv = conversas.find(c => c.id === id);
    if (!conv) return;
    conversaAtual = conv;
    renderizarListaConversas();
    carregarMensagensConversa(id);
}

function renderizarListaConversas() {
    const container = document.getElementById('lista-conversas');
    if (!container) return;
    if (conversas.length === 0) {
        container.innerHTML = '<p style="color:#475569; font-size:13px;">Nenhuma conversa</p>';
        return;
    }
    let html = '';
    conversas.forEach(c => {
        const active = conversaAtual && conversaAtual.id === c.id ? 'active' : '';
        html += `
            <div class="conversa-item ${active}" onclick="alternarConversa('${c.id}')">
                <span>💬 ${c.titulo || 'Conversa'}</span>
                <button class="btn-delete-conversa" onclick="event.stopPropagation(); deletarConversa('${c.id}')">✕</button>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function carregarMensagensConversa(conversaId) {
    if (!conversaId) return;
    try {
        const { data, error } = await supabaseClient
            .from('mensagens')
            .select('*')
            .eq('conversa_id', conversaId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        const chatMsg = document.getElementById('chat-mensagens');
        chatMsg.innerHTML = '';
        if (!data || data.length === 0) return;
        data.forEach(msg => {
            const div = document.createElement('div');
            div.className = `mensagem ${msg.tipo}`;
            if (msg.tipo === 'ia') {
                div.innerHTML = formatarMarkdown(msg.texto);
            } else {
                div.textContent = msg.texto;
            }
            chatMsg.appendChild(div);
        });
        chatMsg.scrollTop = chatMsg.scrollHeight;
    } catch (e) {
        console.error('Erro ao carregar mensagens:', e);
    }
}

async function salvarMensagem(conversaId, texto, tipo) {
    if (!conversaId || !usuarioAtual) return;
    try {
        await supabaseClient
            .from('mensagens')
            .insert({
                conversa_id: conversaId,
                usuario_id: usuarioAtual.id,
                texto: texto,
                tipo: tipo,
                created_at: new Date().toISOString()
            });
        await supabaseClient
            .from('conversas')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversaId);
    } catch (e) {
        console.error('Erro ao salvar mensagem:', e);
    }
}

// ================================================================
//  CHAT PRINCIPAL
// ================================================================
const chatInput = document.getElementById('chat-input');
const btnChat = document.getElementById('btn-chat-enviar');

window.enviarPergunta = async function(pergunta) {
    if (!pergunta.trim() || !conversaAtual) return;
    adicionarMensagemLocal(pergunta, 'usuario');
    chatInput.value = '';
    await salvarMensagem(conversaAtual.id, pergunta, 'usuario');

    // Gerar título automático
    const { count } = await supabaseClient
        .from('mensagens')
        .select('*', { count: 'exact', head: true })
        .eq('conversa_id', conversaAtual.id);
    if (count === 1) {
        const novoTitulo = await gerarTituloConversa(pergunta);
        await atualizarTituloConversa(conversaAtual.id, novoTitulo);
    }

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'mensagem ia';
    loadingDiv.innerHTML = '⏳ <em>Pensando...</em>';
    document.getElementById('chat-mensagens').appendChild(loadingDiv);
    btnChat.disabled = true;

    try {
        const prompt = `Responda de forma clara e didática. Use markdown (##, **, *). ${pergunta}`;
        const resp = await chamarGroq(prompt);
        loadingDiv.remove();
        await adicionarMensagemStreaming(resp, 'ia');
        await salvarMensagem(conversaAtual.id, resp, 'ia');
    } catch (e) {
        loadingDiv.innerHTML = '❌ <em>Erro ao obter resposta. Verifique sua chave.</em>';
        loadingDiv.style.borderLeftColor = '#F87171';
        console.error(e);
    }
    btnChat.disabled = false;
};

function adicionarMensagemLocal(texto, tipo) {
    const chatMsg = document.getElementById('chat-mensagens');
    const div = document.createElement('div');
    div.className = `mensagem ${tipo}`;
    div.textContent = texto;
    chatMsg.appendChild(div);
    chatMsg.scrollTop = chatMsg.scrollHeight;
}

async function adicionarMensagemStreaming(texto, tipo) {
    const chatMsg = document.getElementById('chat-mensagens');
    const div = document.createElement('div');
    div.className = `mensagem ${tipo}`;
    chatMsg.appendChild(div);
    chatMsg.scrollTop = chatMsg.scrollHeight;

    const palavras = texto.split(' ');
    let html = '';
    for (let i = 0; i < palavras.length; i++) {
        html += palavras[i] + ' ';
        div.innerHTML = formatarMarkdown(html);
        chatMsg.scrollTop = chatMsg.scrollHeight;
        await new Promise(r => setTimeout(r, 60));
    }
}

btnChat.addEventListener('click', () => enviarPergunta(chatInput.value));
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarPergunta(chatInput.value);
});

document.getElementById('btn-nova-conversa').addEventListener('click', async () => {
    await criarNovaConversa('Nova conversa');
});

document.getElementById('btn-nova-conversa-drawer').addEventListener('click', async () => {
    await criarNovaConversa('Nova conversa');
});

// ================================================================
//  MARKDOWN
// ================================================================
function formatarMarkdown(texto) {
    if (!texto) return '';
    let html = texto;
    html = html.replace(/^### (.*)/gm, '<h5>$1</h5>');
    html = html.replace(/^## (.*)/gm, '<h4>$1</h4>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^\* (.*)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/^\d+\. (.*)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        if (!match.includes('<ul>')) return `<ol>${match}</ol>`;
        return match;
    });
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    if (!html.startsWith('<') && !html.startsWith('</')) {
        html = `<p>${html}</p>`;
    }
    return html;
}

// ================================================================
//  GROQ
// ================================================================
async function chamarGroq(prompt, modelo = 'openai/gpt-oss-120b') {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const payload = {
        model: modelo,
        messages: [
            { role: 'system', content: 'Você é o iStudy, uma IA de estudos útil, didática e motivacional.' },
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
    if (!texto) throw new Error('Resposta vazia');
    return texto;
}

// ================================================================
//  CRONÔMETRO
// ================================================================
let estadoEstudo = {
    estudando: false,
    segundos: 0,
    timerInterval: null
};

const timerDisplay = document.getElementById('timer');
const progressFill = document.getElementById('timer-progress');

document.getElementById('btn-iniciar').addEventListener('click', () => {
    if (estadoEstudo.estudando) return;
    estadoEstudo.estudando = true;
    estadoEstudo.segundos = 0;
    clearInterval(estadoEstudo.timerInterval);
    estadoEstudo.timerInterval = setInterval(() => {
        estadoEstudo.segundos++;
        timerDisplay.textContent = formatarTempo(estadoEstudo.segundos);
        const prog = Math.min(estadoEstudo.segundos / 3600, 1);
        progressFill.style.width = `${prog * 100}%`;
    }, 1000);
    document.getElementById('pos-estudo-area').style.display = 'none';
});

document.getElementById('btn-finalizar').addEventListener('click', () => {
    if (!estadoEstudo.estudando) return;
    clearInterval(estadoEstudo.timerInterval);
    estadoEstudo.estudando = false;
    document.getElementById('pos-estudo-area').style.display = 'block';
});

document.getElementById('btn-gerar-pos').addEventListener('click', async () => {
    const descricao = document.getElementById('descricao-estudo').value;
    if (!descricao) { alert('Descreva o que você estudou!'); return; }
    const duracao = Math.floor(estadoEstudo.segundos / 60);

    const btn = document.getElementById('btn-gerar-pos');
    btn.textContent = '⏳ Gerando...';
    btn.disabled = true;

    try {
        const prompt = `
        O aluno estudou por ${duracao} minutos. Descrição: "${descricao}".
        Gere um JSON com:
        1. "resumo": resumo curto (use markdown).
        2. "flashcards": lista de 5 strings "Palavra-chave|Explicação".
        3. "quiz": lista de 3 objetos com "pergunta", "opcoes" (5 alternativas), "resposta_correta", "explicacao".
        Retorne APENAS o JSON.
        `;
        const texto = await chamarGroq(prompt);
        let resultado = {};
        try {
            const limpo = texto.replace(/```json|```/g, '').trim();
            resultado = JSON.parse(limpo);
        } catch (e) {
            resultado = {
                resumo: texto.substring(0, 500),
                flashcards: ['Erro|Tente novamente'],
                quiz: [{ pergunta: 'Erro', opcoes: ['A', 'B', 'C', 'D', 'E'], resposta_correta: 'A', explicacao: '' }]
            };
        }

        await supabaseClient.from('sessoes').insert({
            usuario_id: usuarioAtual.id,
            duracao: duracao,
            descricao: descricao,
            data: hoje(),
            grupo_id: grupoAtual?.id || null
        });

        if (resultado.flashcards) {
            for (const card of resultado.flashcards) {
                const partes = card.split('|');
                await supabaseClient.from('flashcards').insert({
                    usuario_id: usuarioAtual.id,
                    pergunta: partes[0] || card,
                    resposta: partes[1] || '',
                    materia: 'Geral',
                    proxima_revisao: hoje()
                });
            }
        }

        const div = document.getElementById('resultado-pos');
        let html = `<h4>📌 Resumo</h4><div>${formatarMarkdown(resultado.resumo || '')}</div>`;
        html += `<h4>🔑 Flashcards</h4>`;
        if (resultado.flashcards) {
            resultado.flashcards.forEach((c, i) => {
                const partes = c.split('|');
                html += `<div class="flashcard-item" onclick="this.classList.toggle('aberto')">
                    <div class="pergunta">${i+1}. ${partes[0] || c}</div>
                    <div class="resposta">${partes[1] || ''}</div>
                </div>`;
            });
        }
        html += `<h4>📝 Quiz</h4>`;
        if (resultado.quiz) {
            resultado.quiz.forEach((q, idx) => {
                html += `<div class="questao-item"><strong>${q.pergunta}</strong><br>`;
                (q.opcoes || []).forEach(o => { html += `▪ ${o}<br>`; });
                html += `<span style="color:#7C3AED;">✅ ${q.resposta_correta}</span><br>`;
                html += `<span style="color:#94A3B8;">${q.explicacao || ''}</span></div>`;
            });
        }
        div.innerHTML = html;
        alert(`✅ Estudo finalizado! ${duracao} min.`);

    } catch (e) {
        alert('Erro ao processar estudo.');
        console.error(e);
    }
    btn.textContent = '📝 Gerar Flashcards e Quiz';
    btn.disabled = false;
});

// ================================================================
//  VESTIBULINHO
// ================================================================
let questoesVest = [];
let respostasVest = {};

document.getElementById('btn-gerar-vest').addEventListener('click', async () => {
    const btn = document.getElementById('btn-gerar-vest');
    btn.textContent = '⏳ Gerando 20 questões...';
    btn.disabled = true;

    try {
        const prompt = `
        Gere um simulado com 20 questões de múltipla escolha (5 alternativas A-E) para ensino médio, abrangendo conhecimentos gerais (matemática, português, história, geografia, física, química, biologia, inglês).
        Para cada questão, além do enunciado, opções e gabarito, forneça:
        - "explicacao_correta": explicação detalhada de por que a resposta está certa.
        - "explicacoes_erradas": um objeto com cada alternativa errada (A, B, C, D, E) e a explicação de por que ela está errada.
        Retorne APENAS um JSON com uma lista de 20 objetos.
        `;
        const texto = await chamarGroq(prompt);
        let dados = [];
        try {
            const limpo = texto.replace(/```json|```/g, '').trim();
            dados = JSON.parse(limpo);
        } catch (e) {
            dados = [];
        }
        if (!Array.isArray(dados) || dados.length < 5) {
            throw new Error('Não foi possível gerar questões suficientes.');
        }
        questoesVest = dados.slice(0, 20);
        respostasVest = {};
        renderizarVestibulinho();
    } catch (e) {
        alert('Erro ao gerar simulado.');
        console.error(e);
    }
    btn.textContent = '🔄 Gerar Simulado';
    btn.disabled = false;
});

function renderizarVestibulinho() {
    const container = document.getElementById('vestibulinho-container');
    if (!questoesVest || questoesVest.length === 0) {
        container.innerHTML = '<p>Clique em "Gerar Simulado" para começar.</p>';
        return;
    }
    let html = `<p style="color:#94A3B8;">${Object.keys(respostasVest).length} / ${questoesVest.length} respondidas</p>`;
    questoesVest.forEach((q, idx) => {
        html += `<div class="questao-item" id="vest-${idx}">
            <strong>Q${idx+1}. ${q.enunciado}</strong>
            <div style="margin-top:8px;">`;
        (q.opcoes || []).forEach(op => {
            const letra = op.charAt(0);
            const checked = respostasVest[idx] === letra ? 'checked' : '';
            html += `<label style="display:block; padding:6px 8px; margin:4px 0; border-radius:6px; cursor:pointer; background:#0B0E14; border:1px solid #2D3448;">
                <input type="radio" name="vest_${idx}" value="${letra}" ${checked} onchange="marcarVest(${idx}, '${letra}')" style="accent-color:#7C3AED; margin-right:10px;">
                ${op}
            </label>`;
        });
        html += `</div></div>`;
    });
    html += `<button id="btn-finalizar-vest" class="btn-primary" style="margin-top:12px;">📊 Finalizar e Ver Resultado</button>`;
    container.innerHTML = html;
    document.getElementById('btn-finalizar-vest').addEventListener('click', finalizarVestibulinho);
}

function marcarVest(idx, letra) {
    respostasVest[idx] = letra;
    renderizarVestibulinho();
}

function finalizarVestibulinho() {
    let acertos = 0;
    let detalhes = [];
    questoesVest.forEach((q, idx) => {
        const escolhida = respostasVest[idx] || 'N/A';
        const acertou = escolhida === q.gabarito;
        if (acertou) acertos++;
        let explicacaoErradas = '';
        if (q.explicacoes_erradas) {
            for (const [letra, texto] of Object.entries(q.explicacoes_erradas)) {
                if (letra !== q.gabarito) {
                    explicacaoErradas += `<br>❌ ${letra}: ${texto}`;
                }
            }
        }
        detalhes.push({
            pergunta: q.enunciado,
            escolhida,
            correta: q.gabarito,
            acertou,
            explicacaoCorreta: q.explicacao_correta || q.explicacao || '',
            explicacaoErradas
        });
    });

    const nota = ((acertos / questoesVest.length) * 100).toFixed(1);
    let html = `<div class="card" style="border-color:#7C3AED;">
        <h4>📊 Resultado</h4>
        <div class="metric-grid">
            <div class="metric"><div class="value" style="color:#7C3AED;">${nota}%</div><div class="label">Nota</div></div>
            <div class="metric"><div class="value" style="color:#4ADE80;">${acertos}</div><div class="label">Acertos</div></div>
            <div class="metric"><div class="value" style="color:#F87171;">${questoesVest.length - acertos}</div><div class="label">Erros</div></div>
        </div>
        <hr style="border-color:#2D3448; margin:16px 0;">
        <h5>📝 Detalhamento</h5>`;
    detalhes.forEach((d, i) => {
        html += `<div class="questao-item" style="border-left: 4px solid ${d.acertou ? '#4ADE80' : '#F87171'};">
            <strong>Q${i+1}. ${d.pergunta}</strong>
            <p>Sua resposta: ${d.escolhida} ${d.acertou ? '✅' : '❌'} (Correta: ${d.correta})</p>
            <p style="color:#4ADE80;">✅ ${d.explicacaoCorreta}</p>
            ${d.explicacaoErradas ? `<p style="color:#F87171;">${d.explicacaoErradas}</p>` : ''}
        </div>`;
    });
    html += `<button onclick="document.getElementById('btn-gerar-vest').click()" class="btn-primary" style="margin-top:12px;">🔄 Novo Simulado</button>
    </div>`;
    document.getElementById('vestibulinho-container').innerHTML = html;
}

// ================================================================
//  GRUPOS – COMPLETO E CORRIGIDO (com persistência)
// ================================================================
async function carregarGrupoDoUsuario() {
    if (!usuarioAtual) return;
    try {
        // Tenta buscar do banco
        const { data, error } = await supabaseClient
            .from('membros_grupo')
            .select('grupo_id, grupos(*)')
            .eq('usuario_id', usuarioAtual.id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
            grupoAtual = data.grupos;
            // Salva no localStorage para persistir
            localStorage.setItem('grupoAtual', JSON.stringify(grupoAtual));
            mostrarGrupoAtual(grupoAtual);
        } else {
            // Se não encontrou no banco, tenta recuperar do localStorage
            const salvo = localStorage.getItem('grupoAtual');
            if (salvo) {
                const grupoSalvo = JSON.parse(salvo);
                // Verifica se o usuário ainda é membro
                const { data: membro } = await supabaseClient
                    .from('membros_grupo')
                    .select('*')
                    .eq('grupo_id', grupoSalvo.id)
                    .eq('usuario_id', usuarioAtual.id)
                    .single();
                if (membro) {
                    grupoAtual = grupoSalvo;
                    mostrarGrupoAtual(grupoAtual);
                } else {
                    localStorage.removeItem('grupoAtual');
                }
            }
        }
    } catch (e) {
        console.error('Erro ao carregar grupo:', e);
        // Fallback: tenta recuperar do localStorage
        const salvo = localStorage.getItem('grupoAtual');
        if (salvo) {
            grupoAtual = JSON.parse(salvo);
            mostrarGrupoAtual(grupoAtual);
        }
    }
}

function mostrarGrupoAtual(grupo) {
    const div = document.getElementById('meu-grupo-info');
    if (!div) return;
    div.style.display = 'block';
    document.getElementById('grupo-nome-exibido').textContent = `📌 ${grupo.nome}`;
    document.getElementById('grupo-desc-exibido').textContent = grupo.descricao || 'Sem descrição';
    document.getElementById('grupo-codigo-exibido').textContent = grupo.codigo_convite;

    // Criar container para membros se não existir
    let containerMembros = document.getElementById('membros-grupo-lista');
    if (!containerMembros) {
        const newContainer = document.createElement('div');
        newContainer.id = 'membros-grupo-lista';
        newContainer.style.marginTop = '8px';
        newContainer.innerHTML = '<p style="color:#94A3B8;">Carregando membros...</p>';
        div.insertBefore(newContainer, div.querySelector('hr'));
    }

    carregarMembrosGrupo(grupo.id);
    carregarRankingGrupo(grupo.id, 'semanal');
    carregarChatGrupo(grupo.id);
}

async function carregarMembrosGrupo(grupoId) {
    try {
        const { data: membros, error } = await supabaseClient
            .from('membros_grupo')
            .select('usuario_id')
            .eq('grupo_id', grupoId);
        if (error) throw error;

        const container = document.getElementById('membros-grupo-lista');
        if (!membros || membros.length === 0) {
            container.innerHTML = '<p style="color:#94A3B8;">Nenhum membro.</p>';
            return;
        }

        const userIds = membros.map(m => m.usuario_id);
        const { data: usuarios, error: err2 } = await supabaseClient
            .from('usuarios')
            .select('id, nome_exibicao')
            .in('id', userIds);
        if (err2) throw err2;

        const nomeMap = {};
        usuarios.forEach(u => {
            nomeMap[u.id] = u.nome_exibicao || 'Usuário';
        });

        let html = '<div style="display:flex; flex-wrap:wrap; gap:8px;">';
        membros.forEach(m => {
            const nome = nomeMap[m.usuario_id] || 'Usuário';
            html += `<span style="background:#1A1F2E; padding:4px 12px; border-radius:20px; border:1px solid #2D3448; font-size:13px;">👤 ${nome}</span>`;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        console.error('Erro ao carregar membros:', e);
        const container = document.getElementById('membros-grupo-lista');
        if (container) container.innerHTML = '<p style="color:#F87171;">Erro ao carregar membros.</p>';
    }
}

document.getElementById('btn-criar-grupo').addEventListener('click', async () => {
    const nome = document.getElementById('grupo-nome').value.trim();
    const descricao = document.getElementById('grupo-descricao').value.trim();
    if (!nome) { alert('Digite um nome para o grupo.'); return; }
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
        const { data, error } = await supabaseClient.from('grupos').insert({
            nome, descricao, codigo_convite: codigo, criador_id: usuarioAtual.id
        }).select().single();
        if (error) throw error;
        await supabaseClient.from('membros_grupo').insert({
            grupo_id: data.id, usuario_id: usuarioAtual.id
        });
        grupoAtual = data;
        localStorage.setItem('grupoAtual', JSON.stringify(grupoAtual));
        mostrarGrupoAtual(data);
        alert(`✅ Grupo "${nome}" criado! Código: ${codigo}`);
    } catch (e) {
        alert('Erro ao criar grupo.');
        console.error(e);
    }
});

document.getElementById('btn-entrar-grupo').addEventListener('click', async () => {
    const codigo = document.getElementById('grupo-convite').value.trim().toUpperCase();
    if (!codigo) { alert('Digite o código de convite.'); return; }
    try {
        const { data, error } = await supabaseClient
            .from('grupos')
            .select('*')
            .eq('codigo_convite', codigo)
            .single();
        if (error) throw error;
        await supabaseClient.from('membros_grupo').insert({
            grupo_id: data.id, usuario_id: usuarioAtual.id
        });
        grupoAtual = data;
        localStorage.setItem('grupoAtual', JSON.stringify(grupoAtual));
        mostrarGrupoAtual(data);
        alert(`✅ Entrou no grupo "${data.nome}"!`);
    } catch (e) {
        alert('Código inválido ou grupo não encontrado.');
        console.error(e);
    }
});

document.getElementById('btn-sair-grupo').addEventListener('click', async () => {
    if (!grupoAtual || !usuarioAtual) return;
    if (!confirm(`Sair do grupo "${grupoAtual.nome}"?`)) return;
    try {
        await supabaseClient
            .from('membros_grupo')
            .delete()
            .eq('grupo_id', grupoAtual.id)
            .eq('usuario_id', usuarioAtual.id);
        localStorage.removeItem('grupoAtual');
        grupoAtual = null;
        document.getElementById('meu-grupo-info').style.display = 'none';
        alert('Você saiu do grupo.');
    } catch (e) {
        alert('Erro ao sair do grupo.');
        console.error(e);
    }
});

let rankingPeriodo = 'semanal';

document.getElementById('btn-ranking-semanal').addEventListener('click', () => {
    rankingPeriodo = 'semanal';
    if (grupoAtual) carregarRankingGrupo(grupoAtual.id, 'semanal');
});

document.getElementById('btn-ranking-mensal').addEventListener('click', () => {
    rankingPeriodo = 'mensal';
    if (grupoAtual) carregarRankingGrupo(grupoAtual.id, 'mensal');
});

async function carregarRankingGrupo(grupoId, periodo) {
    if (!grupoId) return;
    try {
        const dataInicio = new Date();
        if (periodo === 'semanal') {
            dataInicio.setDate(dataInicio.getDate() - 7);
        } else {
            dataInicio.setMonth(dataInicio.getMonth() - 1);
        }
        const inicioStr = dataInicio.toISOString();

        const { data: sessoes, error } = await supabaseClient
            .from('sessoes')
            .select('usuario_id, duracao')
            .eq('grupo_id', grupoId)
            .gte('created_at', inicioStr);
        if (error) throw error;

        const rankingMap = {};
        sessoes.forEach(s => {
            const uid = s.usuario_id;
            if (!rankingMap[uid]) rankingMap[uid] = 0;
            rankingMap[uid] += s.duracao || 0;
        });

        const userIds = Object.keys(rankingMap);
        const div = document.getElementById('ranking-grupo-lista');
        if (userIds.length === 0) {
            div.innerHTML = '<p style="color:#94A3B8;">Nenhum estudo registrado neste período.</p>';
            return;
        }

        const { data: usuarios, error: err2 } = await supabaseClient
            .from('usuarios')
            .select('id, nome_exibicao')
            .in('id', userIds);
        if (err2) throw err2;

        const nomeMap = {};
        usuarios.forEach(u => {
            nomeMap[u.id] = u.nome_exibicao || 'Usuário';
        });

        const ranking = userIds.map(uid => ({
            nome: nomeMap[uid] || 'Usuário',
            total: rankingMap[uid]
        }));
        ranking.sort((a, b) => b.total - a.total);

        let html = '';
        ranking.forEach((item, i) => {
            const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`;
            html += `<div class="ranking-item"><span class="pos">${medalha}</span><span class="nome">${item.nome}</span><span class="min">${item.total} min</span></div>`;
        });
        div.innerHTML = html;
    } catch (e) {
        console.error('Erro ao carregar ranking:', e);
        const div = document.getElementById('ranking-grupo-lista');
        if (div) div.innerHTML = '<p style="color:#F87171;">Erro ao carregar ranking.</p>';
    }
}

// ================================================================
//  CHAT DO GRUPO – CORRIGIDO
// ================================================================
async function carregarChatGrupo(grupoId) {
    const container = document.getElementById('chat-grupo-mensagens');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('mensagens_grupo')
            .select('*')
            .eq('grupo_id', grupoId)
            .order('created_at', { ascending: true })
            .limit(50);
        if (error) throw error;
        container.innerHTML = '';
        data.forEach(msg => {
            const div = document.createElement('div');
            div.className = 'msg-grupo';
            div.innerHTML = `<strong>${msg.usuario_email || 'Usuário'}</strong>: ${msg.texto} <span class="time">${new Date(msg.created_at).toLocaleTimeString()}</span>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    } catch (e) {
        console.error('Erro ao carregar mensagens do grupo:', e);
    }

    if (chatGrupoSubscription) {
        chatGrupoSubscription.unsubscribe();
        chatGrupoSubscription = null;
    }

    chatGrupoSubscription = supabaseClient
        .channel('mensagens_grupo')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'mensagens_grupo',
            filter: `grupo_id=eq.${grupoId}`
        }, (payload) => {
            const msg = payload.new;
            const div = document.createElement('div');
            div.className = 'msg-grupo';
            div.innerHTML = `<strong>${msg.usuario_email || 'Usuário'}</strong>: ${msg.texto} <span class="time">${new Date(msg.created_at).toLocaleTimeString()}</span>`;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        })
        .subscribe();

    const btnEnviar = document.getElementById('btn-chat-grupo-enviar');
    const input = document.getElementById('chat-grupo-input');
    
    const novoBtn = btnEnviar.cloneNode(true);
    btnEnviar.parentNode.replaceChild(novoBtn, btnEnviar);
    const novoInput = input.cloneNode(true);
    input.parentNode.replaceChild(novoInput, input);

    novoBtn.onclick = async () => {
        const texto = novoInput.value.trim();
        if (!texto || !grupoAtual || !usuarioAtual) return;
        try {
            const { error } = await supabaseClient.from('mensagens_grupo').insert({
                grupo_id: grupoAtual.id,
                usuario_id: usuarioAtual.id,
                usuario_email: usuarioNomeExibicao || usuarioAtual.email.split('@')[0],
                texto: texto,
                created_at: new Date().toISOString()
            });
            if (error) throw error;
            novoInput.value = '';
        } catch (e) {
            console.error('Erro ao enviar mensagem:', e);
            alert('Erro ao enviar mensagem.');
        }
    };
    novoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') novoBtn.click();
    });
}

// ================================================================
//  AULAS
// ================================================================
async function carregarAulas() {
    try {
        const { data, error } = await supabaseClient
            .from('aulas')
            .select('*')
            .order('categoria', { ascending: true });
        if (error) throw error;
        const container = document.getElementById('aulas-lista');
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color:#94A3B8;">Nenhuma aula adicionada ainda.</p>';
            return;
        }
        let html = '';
        data.forEach(aula => {
            const thumb = aula.link.includes('watch?v=') 
                ? `https://img.youtube.com/vi/${aula.link.split('v=')[1].split('&')[0]}/mqdefault.jpg`
                : '';
            html += `
            <div class="aula-item">
                <div class="thumb">${thumb ? `<img src="${thumb}" alt="Thumb" />` : '🎬'}</div>
                <div class="info">
                    <div class="titulo">${aula.titulo}</div>
                    <div class="categoria">📂 ${aula.categoria}</div>
                    <a href="${aula.link}" target="_blank" class="link">▶️ Assistir no YouTube</a>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) { console.error('Erro ao carregar aulas:', e); }
}

document.getElementById('btn-add-aula').addEventListener('click', async () => {
    const categoria = document.getElementById('aula-categoria').value.trim();
    const titulo = document.getElementById('aula-titulo').value.trim();
    const link = document.getElementById('aula-link').value.trim();
    if (!categoria || !titulo || !link) { alert('Preencha todos os campos.'); return; }
    try {
        await supabaseClient.from('aulas').insert({ categoria, titulo, link });
        alert('✅ Aula adicionada!');
        document.getElementById('aula-categoria').value = '';
        document.getElementById('aula-titulo').value = '';
        document.getElementById('aula-link').value = '';
        carregarAulas();
    } catch (e) {
        alert('Erro ao adicionar aula.');
        console.error(e);
    }
});

// ================================================================
//  DADOS DO USUÁRIO
// ================================================================
async function carregarDadosUsuario() {
    if (!usuarioAtual) return;
    carregarFlashcards();
    carregarRelatorios();
}

// ================================================================
//  FLASHCARDS
// ================================================================
async function carregarFlashcards() {
    if (!usuarioAtual) return;
    try {
        const { data, error } = await supabaseClient
            .from('flashcards')
            .select('*')
            .eq('usuario_id', usuarioAtual.id)
            .lte('proxima_revisao', hoje());
        if (error) throw error;
        const div = document.getElementById('flashcards-lista');
        if (!data || data.length === 0) {
            div.innerHTML = '<p style="color:#94A3B8;">🎉 Nenhum flashcard para revisar hoje!</p>';
            return;
        }
        let html = '';
        data.forEach((f, idx) => {
            html += `<div class="flashcard-item" onclick="this.classList.toggle('aberto')">
                <div class="pergunta">🔑 ${f.pergunta}</div>
                <div class="resposta">${f.resposta}</div>
                <button style="margin-top:10px; padding:4px 12px; font-size:12px; background:#2D3448; border:none; border-radius:8px; color:white; cursor:pointer;" onclick="event.stopPropagation(); revisarFlashcard('${f.id}')">✅ Já revisei</button>
            </div>`;
        });
        div.innerHTML = html;
    } catch (e) { console.error('Erro ao carregar flashcards:', e); }
}

async function revisarFlashcard(id) {
    try {
        const novaData = new Date();
        novaData.setDate(novaData.getDate() + 3);
        await supabaseClient
            .from('flashcards')
            .update({ proxima_revisao: novaData.toISOString().split('T')[0] })
            .eq('id', id);
        carregarFlashcards();
        alert('✅ Revisado! Próxima revisão em 3 dias.');
    } catch (e) { console.error('Erro ao revisar:', e); }
}

// ================================================================
//  RELATÓRIOS
// ================================================================
async function carregarRelatorios() {
    if (!usuarioAtual) return;
    try {
        const { data: sessoes, error } = await supabaseClient
            .from('sessoes')
            .select('duracao')
            .eq('usuario_id', usuarioAtual.id);
        if (error) throw error;
        const totalMin = sessoes.reduce((acc, s) => acc + (s.duracao || 0), 0);
        document.getElementById('rel-total').textContent = totalMin;
        document.getElementById('rel-sessoes').textContent = sessoes.length;

        const { data: flashcards } = await supabaseClient
            .from('flashcards')
            .select('id')
            .eq('usuario_id', usuarioAtual.id);
        document.getElementById('rel-flashcards').textContent = flashcards?.length || 0;

        document.getElementById('rel-racha').textContent = '0';
    } catch (e) { console.error('Erro ao carregar relatórios:', e); }
}

// ================================================================
//  DRAWER
// ================================================================
const drawer = document.getElementById('drawer');
const overlay = document.getElementById('drawer-overlay');

document.getElementById('btn-menu-toggle').addEventListener('click', () => {
    drawer.classList.add('open');
    overlay.classList.add('show');
});

document.getElementById('btn-close-drawer').addEventListener('click', () => {
    drawer.classList.remove('open');
    overlay.classList.remove('show');
});

overlay.addEventListener('click', () => {
    drawer.classList.remove('open');
    overlay.classList.remove('show');
});

document.querySelectorAll('.drawer-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.drawer-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        drawer.classList.remove('open');
        overlay.classList.remove('show');
        if (tab === 'flashcards') carregarFlashcards();
        if (tab === 'relatorios') carregarRelatorios();
        if (tab === 'chat') {
            if (!conversaAtual && conversas.length === 0) {
                criarNovaConversa();
            }
        }
    });
});

// ================================================================
//  INICIALIZAÇÃO
// ================================================================
console.log('🚀 StudyAI v2.0 carregado!');
console.log('✅ Conversas | Títulos automáticos | Grupos com membros | Chat corrigido');

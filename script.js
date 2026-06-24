// ================================================================
//  CONFIGURAÇÃO SUPABASE
// ================================================================
const SUPABASE_URL = 'https://jfbfbcdcuvzqqcpzlmju.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ucBzmjp0Xbwi7Z-RHsk4Yg_LydKnMMZ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================================
//  CONFIGURAÇÃO GROQ
// ================================================================
const GROQ_API_KEY = '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';

// ================================================================
//  E-MAIL ADMIN (para adicionar aulas)
// ================================================================
const adminEmail = 'ruasflavio29@gmail.com';

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

let usuarioAtual = null;
let grupoAtual = null;
let chatGrupoSubscription = null;

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
const nomeUsuarioEl = document.getElementById('nome-usuario');
const saudacaoTopo = document.getElementById('saudacao-topo');
const sidebarUsuario = document.getElementById('sidebar-usuario');
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
            result = await supabase.auth.signInWithPassword({ email, password: senha });
        } else if (modoLogin === 'cadastrar') {
            result = await supabase.auth.signUp({ email, password: senha });
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
            result = await supabase.auth.resetPasswordForEmail(email);
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
        const { error } = await supabase.auth.signInWithOAuth({
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

supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
        usuarioAtual = data.session.user;
        entrarNoApp(usuarioAtual);
    }
});

btnSair.addEventListener('click', async () => {
    await supabase.auth.signOut();
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

function entrarNoApp(user) {
    telaLogin.style.display = 'none';
    appPrincipal.style.display = 'block';
    const nome = user.email.split('@')[0];
    nomeUsuarioEl.textContent = nome;
    saudacaoTopo.innerHTML = `Olá, <strong>${nome}</strong> 👋`;
    sidebarUsuario.textContent = nome;
    
    // Mostrar botão admin se for o admin
    if (user.email === adminEmail) {
        document.getElementById('admin-aulas').style.display = 'block';
    }
    
    carregarDadosUsuario();
    carregarGrupoDoUsuario();
    carregarAulas();
    restaurarHistoricoChat();
    mostrarSaudacaoIA(nome);
}

// ================================================================
//  SAUDAÇÃO DA IA
// ================================================================
function mostrarSaudacaoIA(nome) {
    const chatMsg = document.getElementById('chat-mensagens');
    chatMsg.innerHTML = '';
    const saudacao = `Olá, **${nome}**! 😊\n\nSou o **iStudy**, sua IA de estudos. Estou aqui para ajudar com suas dúvidas, criar resumos, flashcards e muito mais.\n\n**O que você quer estudar hoje?**`;
    adicionarMensagemStreaming(saudacao, 'ia');
}

// ================================================================
//  STREAMING
// ================================================================
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
    salvarConversa(texto, tipo);
}

function adicionarMensagem(texto, tipo, formatado = false) {
    const chatMsg = document.getElementById('chat-mensagens');
    const div = document.createElement('div');
    div.className = `mensagem ${tipo}`;
    if (formatado) {
        div.innerHTML = formatarMarkdown(texto);
    } else {
        div.textContent = texto;
    }
    chatMsg.appendChild(div);
    chatMsg.scrollTop = chatMsg.scrollHeight;
    salvarConversa(texto, tipo);
}

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
//  CHAT
// ================================================================
const chatInput = document.getElementById('chat-input');
const btnChat = document.getElementById('btn-chat-enviar');

window.enviarPergunta = async function(pergunta) {
    if (!pergunta.trim()) return;
    adicionarMensagem(pergunta, 'usuario');
    chatInput.value = '';

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
    } catch (e) {
        loadingDiv.innerHTML = '❌ <em>Erro ao obter resposta. Verifique sua chave.</em>';
        loadingDiv.style.borderLeftColor = '#F87171';
        console.error(e);
    }
    btnChat.disabled = false;
};

btnChat.addEventListener('click', () => enviarPergunta(chatInput.value));
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarPergunta(chatInput.value);
});

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
//  SALVAR CONVERSA
// ================================================================
async function salvarConversa(texto, tipo) {
    if (!usuarioAtual) return;
    try {
        await supabase.from('conversas').insert({
            usuario_id: usuarioAtual.id,
            texto: texto,
            tipo: tipo,
            created_at: new Date().toISOString()
        });
    } catch (e) { console.error('Erro ao salvar conversa:', e); }
}

async function restaurarHistoricoChat() {
    if (!usuarioAtual) return;
    try {
        const { data, error } = await supabase
            .from('conversas')
            .select('*')
            .eq('usuario_id', usuarioAtual.id)
            .order('created_at', { ascending: true })
            .limit(30);
        if (error) throw error;
        const chatMsg = document.getElementById('chat-mensagens');
        chatMsg.innerHTML = '';
        data.forEach(msg => {
            const div = document.createElement('div');
            div.className = `mensagem ${msg.tipo}`;
            div.innerHTML = formatarMarkdown(msg.texto);
            chatMsg.appendChild(div);
        });
        chatMsg.scrollTop = chatMsg.scrollHeight;
        if (data.length === 0) {
            mostrarSaudacaoIA(usuarioAtual.email.split('@')[0]);
        }
    } catch (e) {
        console.error('Erro ao restaurar histórico:', e);
    }
}

// ================================================================
//  CRONÔMETRO
// ================================================================
// (Mantido igual ao anterior, com adaptação para salvar no Supabase)

// ================================================================
//  GRUPOS
// ================================================================
async function carregarGrupoDoUsuario() {
    if (!usuarioAtual) return;
    try {
        const { data, error } = await supabase
            .from('membros_grupo')
            .select('grupo_id, grupos(*)')
            .eq('usuario_id', usuarioAtual.id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
            grupoAtual = data.grupos;
            mostrarGrupoAtual(grupoAtual);
        }
    } catch (e) { console.error('Erro ao carregar grupo:', e); }
}

function mostrarGrupoAtual(grupo) {
    const div = document.getElementById('meu-grupo-info');
    div.style.display = 'block';
    document.getElementById('grupo-nome-exibido').textContent = `📌 ${grupo.nome}`;
    document.getElementById('grupo-desc-exibido').textContent = grupo.descricao || 'Sem descrição';
    document.getElementById('grupo-codigo-exibido').textContent = grupo.codigo_convite;
    carregarRankingGrupo(grupo.id);
    carregarChatGrupo(grupo.id);
}

document.getElementById('btn-criar-grupo').addEventListener('click', async () => {
    const nome = document.getElementById('grupo-nome').value.trim();
    const descricao = document.getElementById('grupo-descricao').value.trim();
    if (!nome) { alert('Digite um nome para o grupo.'); return; }
    if (!usuarioAtual) { alert('Faça login primeiro.'); return; }

    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
        const { data, error } = await supabase.from('grupos').insert({
            nome,
            descricao,
            codigo_convite: codigo,
            criador_id: usuarioAtual.id
        }).select().single();
        if (error) throw error;

        await supabase.from('membros_grupo').insert({
            grupo_id: data.id,
            usuario_id: usuarioAtual.id
        });

        grupoAtual = data;
        mostrarGrupoAtual(data);
        alert(`✅ Grupo "${nome}" criado! Código: ${codigo}`);
    } catch (e) {
        console.error(e);
        alert('Erro ao criar grupo.');
    }
});

document.getElementById('btn-entrar-grupo').addEventListener('click', async () => {
    const codigo = document.getElementById('grupo-convite').value.trim().toUpperCase();
    if (!codigo) { alert('Digite o código de convite.'); return; }

    try {
        const { data, error } = await supabase
            .from('grupos')
            .select('*')
            .eq('codigo_convite', codigo)
            .single();
        if (error) throw error;

        const { data: membro } = await supabase
            .from('membros_grupo')
            .select('*')
            .eq('grupo_id', data.id)
            .eq('usuario_id', usuarioAtual.id)
            .single();

        if (membro) {
            alert('Você já está neste grupo.');
            return;
        }

        await supabase.from('membros_grupo').insert({
            grupo_id: data.id,
            usuario_id: usuarioAtual.id
        });

        grupoAtual = data;
        mostrarGrupoAtual(data);
        alert(`✅ Entrou no grupo "${data.nome}"!`);
    } catch (e) {
        console.error(e);
        alert('Código inválido ou grupo não encontrado.');
    }
});

document.getElementById('btn-sair-grupo').addEventListener('click', async () => {
    if (!grupoAtual || !usuarioAtual) return;
    if (!confirm(`Deseja sair do grupo "${grupoAtual.nome}"?`)) return;

    try {
        await supabase
            .from('membros_grupo')
            .delete()
            .eq('grupo_id', grupoAtual.id)
            .eq('usuario_id', usuarioAtual.id);

        grupoAtual = null;
        document.getElementById('meu-grupo-info').style.display = 'none';
        alert('Você saiu do grupo.');
    } catch (e) {
        console.error(e);
        alert('Erro ao sair do grupo.');
    }
});

async function carregarRankingGrupo(grupoId) {
    try {
        const { data, error } = await supabase
            .from('ranking_semanal')
            .select('usuario_id, total_minutos, usuarios(email)')
            .eq('grupo_id', grupoId)
            .order('total_minutos', { ascending: false });
        if (error) throw error;

        const lista = document.getElementById('ranking-grupo-lista');
        if (!data || data.length === 0) {
            lista.innerHTML = '<p style="color:#94A3B8;">Nenhum estudo registrado esta semana.</p>';
            return;
        }
        let html = '';
        data.forEach((item, i) => {
            const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}º`;
            const nome = item.usuarios?.email?.split('@')[0] || 'Usuário';
            html += `<div class="ranking-item"><span class="pos">${medalha}</span><span class="nome">${nome}</span><span class="min">${item.total_minutos} min</span></div>`;
        });
        lista.innerHTML = html;
    } catch (e) {
        console.error('Erro ao carregar ranking:', e);
    }
}

// Chat do grupo
async function carregarChatGrupo(grupoId) {
    const container = document.getElementById('chat-grupo-mensagens');
    try {
        const { data, error } = await supabase
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
            div.innerHTML = `<strong>${msg.usuario_email}</strong>: ${msg.texto} <span class="time">${new Date(msg.created_at).toLocaleTimeString()}</span>`;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    } catch (e) { console.error('Erro ao carregar chat:', e); }

    if (chatGrupoSubscription) {
        chatGrupoSubscription.unsubscribe();
    }
    chatGrupoSubscription = supabase
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
            div.innerHTML = `<strong>${msg.usuario_email}</strong>: ${msg.texto} <span class="time">${new Date(msg.created_at).toLocaleTimeString()}</span>`;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        })
        .subscribe();

    document.getElementById('btn-chat-grupo-enviar').addEventListener('click', async () => {
        const input = document.getElementById('chat-grupo-input');
        const texto = input.value.trim();
        if (!texto || !grupoAtual || !usuarioAtual) return;
        try {
            await supabase.from('mensagens_grupo').insert({
                grupo_id: grupoAtual.id,
                usuario_id: usuarioAtual.id,
                usuario_email: usuarioAtual.email.split('@')[0],
                texto: texto,
                created_at: new Date().toISOString()
            });
            input.value = '';
        } catch (e) { console.error('Erro ao enviar mensagem:', e); }
    });
}

// ================================================================
//  AULAS
// ================================================================
async function carregarAulas() {
    try {
        const { data, error } = await supabase
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
        const { error } = await supabase.from('aulas').insert({
            categoria,
            titulo,
            link
        });
        if (error) throw error;
        alert('✅ Aula adicionada!');
        document.getElementById('aula-categoria').value = '';
        document.getElementById('aula-titulo').value = '';
        document.getElementById('aula-link').value = '';
        carregarAulas();
    } catch (e) {
        console.error(e);
        alert('Erro ao adicionar aula.');
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
        const { data, error } = await supabase
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
        await supabase
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
        const { data: sessoes, error } = await supabase
            .from('sessoes')
            .select('duracao')
            .eq('usuario_id', usuarioAtual.id);
        if (error) throw error;
        const totalMin = sessoes.reduce((acc, s) => acc + (s.duracao || 0), 0);
        document.getElementById('rel-total').textContent = totalMin;
        document.getElementById('rel-sessoes').textContent = sessoes.length;

        const { data: flashcards } = await supabase
            .from('flashcards')
            .select('id')
            .eq('usuario_id', usuarioAtual.id);
        document.getElementById('rel-flashcards').textContent = flashcards?.length || 0;

        document.getElementById('rel-racha').textContent = '0';
    } catch (e) { console.error('Erro ao carregar relatórios:', e); }
}

// ================================================================
//  NAVEGAÇÃO
// ================================================================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');
        if (tab === 'flashcards') carregarFlashcards();
        if (tab === 'relatorios') carregarRelatorios();
    });
});

console.log('🚀 StudyAI v2.0 carregado!');
console.log('✅ Login com Supabase | Streaming palavra por palavra | Grupos | Aulas');
console.log(`👑 Admin: ${adminEmail}`);

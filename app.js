// ============================================================================
// PLACAR FUT 31 – APP.JS v1.2.0
// ============================================================================

const APP_VERSION = 'v1.2.0';

const PlacarApp = (function() {
  // ==========================================================================
  // 1. ESTADO GLOBAL
  // ==========================================================================
  const state = {
    jogadores: JSON.parse(localStorage.getItem("jogadores")) || ['Jogador 1', 'Jogador 2', 'Jogador 3'],
    historicaGols: [], historicaFaltas: [], ultimaAcao: null,
    placar: { A: 0, B: 0 }, faltas: { A: 0, B: 0 },
    partida: null, timer: null, segundos: 0, pausado: false,
    timeAtual: null, timeAtualFalta: null,
    nomeA: "Time A", nomeB: "Time B", timeEditando: null,
    deferredPrompt: null, undoTimer: null, backupTimer: null,
    eventosTimeline: []
  };

  // ==========================================================================
  // 2. FUNÇÕES AUXILIARES
  // ==========================================================================
  const escapeHTML = text => { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; };

  function showToast(msg, type = 'info', dur = 3000) {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    toast.style.cssText = `
      position:fixed; bottom:100px; left:50%; transform:translateX(-50%) translateY(20px);
      background:${type==='success'?'#0fb858':type==='error'?'#ff4757':type==='warning'?'#ffa502':'#3498db'};
      color:white; padding:12px 24px; border-radius:8px; z-index:9999; font-weight:bold;
      box-shadow:0 4px 12px rgba(0,0,0,0.3); opacity:0; transition:all 0.3s ease;
      text-align:center; max-width:80%; word-break:break-word;
    `;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; }, 10);
    if (navigator.vibrate) navigator.vibrate(30);
    setTimeout(() => {
      toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, dur);
    toast.onclick = () => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); };
    return toast;
  }

  const confirmAction = msg => new Promise(resolve => resolve(window.confirm(msg)));

  // ==========================================================================
  // 3. LINHA DO TEMPO
  // ==========================================================================
  function adicionarEventoTimeline(tipo, time = null, jogador = null) {
    if (!state.eventosTimeline) state.eventosTimeline = [];
    const min = Math.floor(state.segundos / 60);
    const seg = state.segundos % 60;
    state.eventosTimeline.push({ tempo: `${min}:${seg.toString().padStart(2,'0')}`, tipo, time, jogador });
    atualizarTimeline();
  }

  function atualizarTimeline() {
    const lista = document.getElementById('listaTimeline');
    if (!lista) return;
    if (!state.eventosTimeline.length) {
      lista.innerHTML = '<li class="timeline-empty">Nenhum evento registrado ainda</li>';
      return;
    }
    lista.innerHTML = state.eventosTimeline.slice(-15).reverse().map(e => {
      const icone = e.tipo==='gol'?'⚽': e.tipo==='falta'?'🟨': e.tipo==='inicio'?'▶️': e.tipo==='fim'?'🏁': e.tipo==='pause'?'⏸️': e.tipo==='resume'?'▶️': e.tipo==='reset'?'🔄':'📝';
      let texto = '', classe = 'event-center';
      if (e.tipo==='gol'||e.tipo==='falta') { texto = e.jogador || `Time ${e.time}`; classe = e.time==='A'?'event-left':'event-right'; }
      else if (e.tipo==='inicio') texto = 'Jogo Iniciado';
      else if (e.tipo==='fim') texto = 'Jogo Finalizado';
      else if (e.tipo==='pause') texto = 'Jogo Pausado';
      else if (e.tipo==='resume') texto = 'Jogo Retomado';
      else if (e.tipo==='reset') texto = 'Jogo Resetado';
      return `<li class="timeline-item ${classe}"><span class="event-time">${e.tempo}'</span><span class="event-icon">${icone}</span><span class="event-text">${texto}</span></li>`;
    }).join('');
  }

  const resetarTimeline = () => { state.eventosTimeline = []; atualizarTimeline(); };

  // ==========================================================================
  // 4. NAVEGAÇÃO ENTRE ABAS
  // ==========================================================================
  function trocarTab(tabId, button) {
    fecharPopup(); fecharPopupFalta(); fecharPopupRemover(); fecharPopupNome();
    document.querySelectorAll("section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".abamento button, nav button, .tabs button").forEach(btn => btn.classList.remove("active"));
    document.getElementById(tabId)?.classList.add("active");
    button.classList.add("active");
    const actions = { 'ranking': () => { state.jogadores = JSON.parse(localStorage.getItem("jogadores")||"[]"); ranking(); }, 'historico': historico, 'stats': estatisticas, 'comparar': carregarComparacao };
    if (actions[tabId]) actions[tabId]();
    if (navigator.vibrate) navigator.vibrate(5);
    console.log(`✅ Aba ativa: ${tabId}`);
  }

  // ==========================================================================
  // 5. JOGADORES – CRUD
  // ==========================================================================
  function addJogador() {
    const input = document.getElementById('novoJogador');
    const nome = input.value.trim();
    if (!nome) return showToast('Digite um nome', 'error');
    if (nome.length>20) return showToast('Máx 20 caracteres', 'error');
    if (!/^[a-zA-ZÀ-ÿ0-9\s]+$/.test(nome)) return showToast('Use letras, números e espaços', 'error');
    if (state.jogadores.includes(nome)) return showToast('Jogador já existe', 'warning');
    state.jogadores.push(nome);
    localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
    input.value = ''; input.blur();
    renderJogadores(); fazerBackupAutomatico();
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`${nome} adicionado!`, 'success');
  }

  async function removerJogador(index) {
    const nome = state.jogadores[index];
    if (await confirmAction(`Remover ${nome}?`)) {
      state.jogadores.splice(index,1);
      localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
      renderJogadores(); fazerBackupAutomatico();
      showToast(`${nome} removido`, 'success');
    }
  }

  async function editarNomeJogador(index) {
    const nomeAtual = state.jogadores[index];
    const novo = prompt(`Editar jogador:\n\nNome atual: ${nomeAtual}\n\nNovo nome:`, nomeAtual)?.trim();
    if (!novo) return;
    if (novo.length>20) return showToast('Máx 20 caracteres','error');
    if (!/^[a-zA-ZÀ-ÿ0-9\s]+$/.test(novo)) return showToast('Use letras, números e espaços','error');
    if (novo!==nomeAtual && state.jogadores.includes(novo)) return showToast('Já existe','warning');
    const nomeAntigo = state.jogadores[index];
    state.jogadores[index] = novo;

    // Atualiza gols/faltas do estado
    if (state.historicaGols) {
      state.historicaGols.forEach(e => { if (e.jogador === nomeAntigo) e.jogador = novo; });
      localStorage.setItem("historicaGols", JSON.stringify(state.historicaGols));
    }
    if (state.historicaFaltas) {
      state.historicaFaltas.forEach(e => { if (e.jogador === nomeAntigo) e.jogador = novo; });
      localStorage.setItem("historicaFaltas", JSON.stringify(state.historicaFaltas));
    }

    // Atualiza histórico completo
    const historicoCompleto = JSON.parse(localStorage.getItem("historico")||"[]");
    let atualizado = false;
    historicoCompleto.forEach(p => {
      if (p.gols) Object.keys(p.gols).forEach(key => {
        if (key.includes(nomeAntigo)) {
          const val = p.gols[key]; delete p.gols[key];
          const match = key.match(/\(\d+\)/);
          p.gols[match ? `${novo} ${match[0]}` : novo] = val;
          atualizado = true;
        }
      });
      if (p.faltas?.jogadores) Object.keys(p.faltas.jogadores).forEach(key => {
        if (key.includes(nomeAntigo)) {
          const val = p.faltas.jogadores[key]; delete p.faltas.jogadores[key];
          const match = key.match(/\(\d+\)/);
          p.faltas.jogadores[match ? `${novo} ${match[0]}` : novo] = val;
          atualizado = true;
        }
      });
      if (p.craque?.includes(nomeAntigo)) {
        const match = p.craque.match(/\(\d+\)/);
        p.craque = match ? `${novo} ${match[0]}` : novo;
        atualizado = true;
      }
    });
    if (atualizado) {
      localStorage.setItem("historico", JSON.stringify(historicoCompleto));
      console.log(`✅ Histórico atualizado: ${nomeAntigo} → ${novo}`);
    }
    localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
    renderJogadores(); fazerBackupAutomatico();
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`Editado: ${nomeAntigo} → ${novo}`, 'success');
  }

  function renderJogadores() {
    const lista = document.getElementById('listaJogadores');
    if (!lista) return;
    lista.innerHTML = '';
    state.jogadores.forEach((nome, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="player-name">${escapeHTML(nome)}</span><div class="player-actions"><button title="Editar nome">✏️</button><button title="Remover jogador">❌</button></div>`;
      li.querySelector('button:first-child').onclick = e => { e.stopPropagation(); editarNomeJogador(i); };
      li.querySelector('button:last-child').onclick = e => { e.stopPropagation(); removerJogador(i); };
      lista.appendChild(li);
    });
  }

  // ==========================================================================
  // 6. NOMES DOS TIMES
  // ==========================================================================
  function editarNomeTime(time) {
    fecharPopup(); fecharPopupFalta(); fecharPopupRemover();
    state.timeEditando = time;
    const titulo = document.getElementById('popupTituloNome');
    if (titulo) titulo.textContent = `✏️ Editar Nome - ${time==='A'?state.nomeA:state.nomeB}`;
    const input = document.getElementById('inputNomeTime');
    if (input) input.value = time==='A'?state.nomeA:state.nomeB;
    document.getElementById('popupNomeTime').classList.add('show');
    setTimeout(() => input?.focus(), 100);
  }

  function salvarNomeTime() {
    const input = document.getElementById('inputNomeTime');
    if (!input) return;
    const nome = input.value.trim();
    if (!nome || nome.length>20) return showToast('Nome inválido (máx 20)','error');
    if (state.timeEditando === 'A') {
      state.nomeA = nome;
      document.getElementById('nomeTimeA').textContent = nome;
      document.getElementById('nomeFaltaA').textContent = nome;
      localStorage.setItem("nomeTimeA", nome);
    } else {
      state.nomeB = nome;
      document.getElementById('nomeTimeB').textContent = nome;
      document.getElementById('nomeFaltaB').textContent = nome;
      localStorage.setItem("nomeTimeB", nome);
    }
    fecharPopupNome(); fazerBackupAutomatico();
    if (navigator.vibrate) navigator.vibrate(10);
    showToast('Nome atualizado!','success');
  }

  function carregarNomesTimes() {
    state.nomeA = localStorage.getItem("nomeTimeA") || "Time A";
    state.nomeB = localStorage.getItem("nomeTimeB") || "Time B";
    const nA = document.getElementById('nomeTimeA'), nB = document.getElementById('nomeTimeB');
    const fA = document.getElementById('nomeFaltaA'), fB = document.getElementById('nomeFaltaB');
    if (nA) nA.textContent = state.nomeA;
    if (nB) nB.textContent = state.nomeB;
    if (fA) fA.textContent = state.nomeA;
    if (fB) fB.textContent = state.nomeB;
  }

  // ==========================================================================
  // 7. CONTROLE DO JOGO
  // ==========================================================================
  async function iniciar() {
    if (state.partida && !await confirmAction("Já existe um jogo. Iniciar novo?")) return;
    const btn = document.getElementById("btnIniciar");
    btn?.classList.add("btn-animating-green"); setTimeout(()=>btn?.classList.remove("btn-animating-green"),600);
    state.placar = {A:0,B:0}; state.faltas = {A:0,B:0}; state.historicaGols = []; state.historicaFaltas = [];
    state.ultimaAcao = null; state.segundos = 0; state.pausado = false;
    document.getElementById('placarA').textContent = '0'; document.getElementById('placarB').textContent = '0';
    document.getElementById('faltasA').textContent = '0'; document.getElementById('faltasB').textContent = '0';
    document.getElementById('listaGols').innerHTML = '';
    document.getElementById('tempo').textContent = '00:00'; document.getElementById('tempo').classList.remove('tempo-pausado');
    document.getElementById('tituloGols')?.classList.remove('hidden');
    state.partida = { data: new Date().toLocaleString("pt-BR"), nomeTimes: { A: state.nomeA, B: state.nomeB } };
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!state.pausado) {
        state.segundos++;
        const min = String(Math.floor(state.segundos/60)).padStart(2,'0');
        const seg = String(state.segundos%60).padStart(2,'0');
        document.getElementById('tempo').textContent = `${min}:${seg}`;
      }
    },1000);
    adicionarEventoTimeline('inicio');
    mostrarOverlay("INÍCIO DE JOGO","⚽",1500);
    if (navigator.vibrate) navigator.vibrate([100,50,100]);
    showToast('Jogo iniciado!','success');
    fazerBackupAutomatico();
  }

  function togglePause() {
    if (!state.partida) return showToast('Inicie o jogo!','error');
    state.pausado = !state.pausado;
    adicionarEventoTimeline(state.pausado?'pause':'resume');
    if (state.pausado) {
      document.getElementById('tempo').classList.add('tempo-pausado');
      showToast('Jogo pausado','warning');
    } else {
      document.getElementById('tempo').classList.remove('tempo-pausado');
      showToast('Jogo retomado','success');
    }
    if (navigator.vibrate) navigator.vibrate(10);
  }

  async function resetar() {
    resetarTimeline();
    if (state.partida && !await confirmAction("Resetar jogo atual? Dados serão perdidos.")) return;
    clearInterval(state.timer); state.timer = null;
    state.placar = {A:0,B:0}; state.faltas = {A:0,B:0}; state.historicaGols = []; state.historicaFaltas = [];
    state.ultimaAcao = null; state.partida = null; state.segundos = 0; state.pausado = false;
    state.nomeA = "Time A"; state.nomeB = "Time B";
    document.getElementById('nomeTimeA').textContent = "Time A"; document.getElementById('nomeTimeB').textContent = "Time B";
    document.getElementById('nomeFaltaA').textContent = "Time A"; document.getElementById('nomeFaltaB').textContent = "Time B";
    localStorage.removeItem("nomeTimeA"); localStorage.removeItem("nomeTimeB");
    document.getElementById('placarA').textContent = '0'; document.getElementById('placarB').textContent = '0';
    document.getElementById('faltasA').textContent = '0'; document.getElementById('faltasB').textContent = '0';
    document.getElementById('listaGols').innerHTML = '';
    document.getElementById('tempo').textContent = '00:00'; document.getElementById('tempo').classList.remove('tempo-pausado');
    document.getElementById('tituloGols')?.classList.add('hidden');
    esconderUndo();
    if (navigator.vibrate) navigator.vibrate(20);
    showToast('Jogo resetado','success');
    fazerBackupAutomatico();
  }

  async function fim() {
    if (!state.partida) return showToast('Inicie o jogo!','error');
    const btn = document.getElementById("btnFim");
    btn?.classList.add("btn-animating-red"); setTimeout(()=>btn?.classList.remove("btn-animating-red"),600);
    clearInterval(state.timer); state.timer = null;
    adicionarEventoTimeline('fim');

    const golsPorJogador = {};
    state.historicaGols.forEach(g => { if(!golsPorJogador[g.jogador]) golsPorJogador[g.jogador]={q:0,t:g.time}; golsPorJogador[g.jogador].q++; });
    const faltasPorJogador = {};
    state.historicaFaltas.forEach(f => { if(!faltasPorJogador[f.jogador]) faltasPorJogador[f.jogador]=0; faltasPorJogador[f.jogador]++; });

    state.partida.placar = [state.placar.A, state.placar.B];
    state.partida.gols = golsPorJogador;
    state.partida.faltas = { A: state.faltas.A, B: state.faltas.B, jogadores: faltasPorJogador };
    state.partida.craque = calcularCraque(golsPorJogador);
    state.partida.duracao = state.segundos;
    state.partida.id = Date.now().toString(36) + Math.random().toString(36).substr(2,5);

    const historico = JSON.parse(localStorage.getItem("historico")||"[]");
    historico.push(state.partida);
    localStorage.setItem("historico", JSON.stringify(historico));

    mostrarOverlay("FIM DE JOGO","🏆",2000,() => {
      alert(`Jogo finalizado!\n\n${state.nomeA} ${state.placar.A} × ${state.placar.B} ${state.nomeB}\n\n🏆 Craque: ${state.partida.craque}\n\n⏱️ Duração: ${Math.floor(state.segundos/60)}:${String(state.segundos%60).padStart(2,'0')}`);
      resetar();
    });
    if (navigator.vibrate) navigator.vibrate([200,100,200]);
    fazerBackupAutomatico();
  }

  function calcularCraque(gols) {
    let craque = null, max = 0;
    Object.entries(gols).forEach(([j,d])=> { if(d.q>max) { max=d.q; craque=j; } });
    return craque ? `${craque} (${max})` : "—";
  }

  // ==========================================================================
  // 8. ANIMAÇÕES
  // ==========================================================================
  function mostrarOverlay(texto, icone, duracao, callback) {
    const overlay = document.getElementById("gameOverlay");
    const txt = document.getElementById("overlayText"), icon = document.getElementById("overlayIcon");
    if (!overlay||!txt||!icon) { if(callback) callback(); return; }
    txt.textContent = texto; icon.textContent = icone;
    overlay.classList.add("show");
    setTimeout(() => { overlay.classList.remove("show"); if(callback) setTimeout(callback,300); }, duracao);
  }

  function animarGol() {
    const div = document.querySelector('.main-scoreboard');
    if (!div) return;
    div.classList.add("gol-animation");
    if (navigator.vibrate) navigator.vibrate([100,50,100,50,100]);
    setTimeout(() => div.classList.remove("gol-animation"),800);
  }

  // ==========================================================================
  // 9. CONTROLE DE GOLS
  // ==========================================================================
  function aumentarGol(time) {
    if (!state.partida) return showToast('Inicie o jogo!','error');
    fecharPopupFalta(); fecharPopupRemover(); fecharPopupNome();
    state.timeAtual = time;
    document.getElementById('popupTitulo')?.setAttribute('textContent', `⚽ Gol do ${time==='A'?state.nomeA:state.nomeB}! Quem fez?`);
    const popup = document.getElementById('popupJogadores');
    popup.innerHTML = '';
    if (!state.jogadores.length) {
      const btn = document.createElement('button');
      btn.textContent = 'Jogador Desconhecido';
      btn.onclick = () => registrarGol('Jogador Desconhecido');
      popup.appendChild(btn);
    } else {
      const rankingGols = obterRankingGeral();
      [...state.jogadores].sort((a,b)=>(rankingGols[b]||0)-(rankingGols[a]||0)||a.localeCompare(b)).forEach(j => {
        const btn = document.createElement('button');
        btn.textContent = j;
        btn.onclick = () => registrarGol(j);
        popup.appendChild(btn);
      });
    }
    document.getElementById('popupJogador').classList.add('show');
  }

  function registrarGol(jogador) {
    if (!state.timeAtual) return;
    state.ultimaAcao = { tipo: "gol", time: state.timeAtual, jogador, index: state.historicaGols.length };
    mostrarUndo();
    if (state.timeAtual==='A') { state.placar.A++; document.getElementById('placarA').textContent = state.placar.A; }
    else { state.placar.B++; document.getElementById('placarB').textContent = state.placar.B; }
    state.historicaGols.push({ time: state.timeAtual, jogador, minuto: Math.floor(state.segundos/60), timestamp: Date.now() });
    adicionarEventoTimeline('gol', state.timeAtual, jogador);
    renderGols(); animarGol(); fecharPopup();
    fazerBackupAutomatico();
    showToast(`Gol de ${jogador}!`,'success');
  }

  function renderGols() {
    const lista = document.getElementById('listaGols');
    if (!lista) return;
    const gols = {};
    state.historicaGols.forEach(g => gols[g.jogador] = (gols[g.jogador]||0)+1);
    lista.innerHTML = Object.entries(gols).sort((a,b)=>b[1]-a[1]).map(([j,q]) => `<li><span>${j} — ${q} gol${q>1?'s':''}</span></li>`).join('');
    const titulo = document.getElementById('tituloGols');
    if (titulo) state.historicaGols.length ? titulo.classList.remove('hidden') : titulo.classList.add('hidden');
  }

  function diminuirGol(time) {
    if (!state.partida) return showToast('Inicie o jogo!','error');
    if ((time==='A'&&state.placar.A===0)||(time==='B'&&state.placar.B===0)) return showToast('Não há gols','warning');
    const ultimos = state.historicaGols.map((g,i)=>({...g,index:i})).filter(g=>g.time===time).slice(-3).reverse();
    if (!ultimos.length) return showToast('Não há gols específicos','warning');
    const popup = document.getElementById('popupGols');
    if (!popup) return;
    fecharPopup(); fecharPopupFalta(); fecharPopupNome();
    popup.innerHTML = '';
    ultimos.forEach(g => {
      const btn = document.createElement('button');
      btn.textContent = `${g.jogador} - ${g.minuto}min`;
      btn.onclick = () => removerGolEspecifico(g.index);
      popup.appendChild(btn);
    });
    document.getElementById('popupRemover').classList.add('show');
  }

  function removerGolEspecifico(index) {
    const gol = state.historicaGols[index];
    if (gol.time==='A') { state.placar.A = Math.max(0, state.placar.A-1); document.getElementById('placarA').textContent = state.placar.A; }
    else { state.placar.B = Math.max(0, state.placar.B-1); document.getElementById('placarB').textContent = state.placar.B; }
    state.historicaGols.splice(index,1);
    renderGols(); fecharPopupRemover(); fazerBackupAutomatico();
    if (navigator.vibrate) navigator.vibrate(15);
    showToast('Gol removido','warning');
  }

  // ==========================================================================
  // 10. CONTROLE DE FALTAS
  // ==========================================================================
  function registrarFalta(time) {
    if (!state.partida) return showToast('Inicie o jogo!','error');
    fecharPopup(); fecharPopupRemover(); fecharPopupNome();
    state.timeAtualFalta = time;
    document.getElementById('popupTituloFalta')?.setAttribute('textContent', `⚠️ Falta do ${time==='A'?state.nomeA:state.nomeB}. Quem fez?`);
    const popup = document.getElementById('popupJogadoresFalta');
    popup.innerHTML = '';
    if (!state.jogadores.length) {
      const btn = document.createElement('button');
      btn.textContent = 'Jogador Desconhecido';
      btn.onclick = () => confirmarFalta('Jogador Desconhecido');
      popup.appendChild(btn);
    } else {
      const historico = JSON.parse(localStorage.getItem("historico")||"[]");
      const rankFaltas = {};
      historico.forEach(p => { if(p.faltas?.jogadores) Object.entries(p.faltas.jogadores).forEach(([j,q])=> rankFaltas[j]=(rankFaltas[j]||0)+q); });
      [...state.jogadores].sort((a,b)=>(rankFaltas[b]||0)-(rankFaltas[a]||0)||a.localeCompare(b)).forEach(j => {
        const btn = document.createElement('button');
        btn.textContent = j;
        btn.onclick = () => confirmarFalta(j);
        popup.appendChild(btn);
      });
    }
    document.getElementById('popupFalta').classList.add('show');
  }

  function confirmarFalta(jogador) {
    if (!state.timeAtualFalta) return;
    state.ultimaAcao = { tipo: "falta", time: state.timeAtualFalta, jogador, index: state.historicaFaltas.length };
    mostrarUndo();
    if (state.timeAtualFalta==='A') { state.faltas.A++; document.getElementById('faltasA').textContent = state.faltas.A; }
    else { state.faltas.B++; document.getElementById('faltasB').textContent = state.faltas.B; }
    state.historicaFaltas.push({ time: state.timeAtualFalta, jogador, minuto: Math.floor(state.segundos/60), timestamp: Date.now() });
    adicionarEventoTimeline('falta', state.timeAtualFalta, jogador);
    fecharPopupFalta(); fazerBackupAutomatico();
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`Falta de ${jogador}`,'warning');
  }

  // ==========================================================================
  // 11. DESFAZER AÇÃO
  // ==========================================================================
  function mostrarUndo() {
    const btn = document.getElementById('undoBtn');
    if (btn) btn.style.display = 'block';
    clearTimeout(state.undoTimer);
    state.undoTimer = setTimeout(esconderUndo, 5000);
  }
  function esconderUndo() { const btn = document.getElementById('undoBtn'); if (btn) btn.style.display = 'none'; state.ultimaAcao = null; }
  function desfazer() {
    if (!state.ultimaAcao) return;
    if (state.ultimaAcao.tipo==="gol") {
      if (state.ultimaAcao.time==='A') { state.placar.A = Math.max(0,state.placar.A-1); document.getElementById('placarA').textContent = state.placar.A; }
      else { state.placar.B = Math.max(0,state.placar.B-1); document.getElementById('placarB').textContent = state.placar.B; }
      state.historicaGols.splice(state.ultimaAcao.index,1);
      renderGols();
    } else if (state.ultimaAcao.tipo==="falta") {
      if (state.ultimaAcao.time==='A') { state.faltas.A = Math.max(0,state.faltas.A-1); document.getElementById('faltasA').textContent = state.faltas.A; }
      else { state.faltas.B = Math.max(0,state.faltas.B-1); document.getElementById('faltasB').textContent = state.faltas.B; }
      state.historicaFaltas.splice(state.ultimaAcao.index,1);
    }
    esconderUndo(); fazerBackupAutomatico();
    if (navigator.vibrate) navigator.vibrate(15);
    showToast('Ação desfeita','success');
  }

  // ==========================================================================
  // 12. POPUPS (MODAIS)
  // ==========================================================================
  const fecharPopup = (e) => { e?.stopPropagation(); document.getElementById('popupJogador')?.classList.remove('show'); state.timeAtual = null; };
  const fecharPopupFalta = (e) => { e?.stopPropagation(); document.getElementById('popupFalta')?.classList.remove('show'); state.timeAtualFalta = null; };
  const fecharPopupRemover = (e) => { e?.stopPropagation(); document.getElementById('popupRemover')?.classList.remove('show'); };
  const fecharPopupNome = (e) => { e?.stopPropagation(); document.getElementById('popupNomeTime')?.classList.remove('show'); state.timeEditando = null; };

  // ==========================================================================
  // 13. RANKINGS
  // ==========================================================================
  function obterRankingGeral() {
    const historico = JSON.parse(localStorage.getItem("historico")||"[]");
    const rank = {};
    historico.forEach(p => Object.entries(p.gols||{}).forEach(([j,d])=> rank[j]=(rank[j]||0)+d.q));
    return rank;
  }

  function ranking() {
    const historico = JSON.parse(localStorage.getItem("historico")||"[]");
    // Ranking geral
    const rankGeral = obterRankingGeral();
    const listaGeral = document.getElementById('listaRankingGeral');
    if (listaGeral) {
      if (!Object.keys(rankGeral).length) listaGeral.innerHTML = '<li>Nenhum gol registrado ainda.</li>';
      else {
        listaGeral.innerHTML = '';
        Object.entries(rankGeral).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([j,g],i)=>{
          const m = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}º`;
          listaGeral.innerHTML += `<li><span>${m} ${j}</span><span>${g} gol${g>1?'s':''}</span></li>`;
        });
      }
    }
    // Ranking mês
    const hoje = new Date(), mesAtual = hoje.getMonth(), anoAtual = hoje.getFullYear();
    const partidasMes = historico.filter(p => {
      try { const d=p.data.split(",")[0].trim().split("/"); return parseInt(d[1],10)-1===mesAtual && parseInt(d[2],10)===anoAtual; } catch(e){ return false; }
    });
    const rankMes = {};
    partidasMes.forEach(p => Object.entries(p.gols||{}).forEach(([j,d])=> rankMes[j]=(rankMes[j]||0)+d.q));
    const listaMes = document.getElementById('listaRankingMes');
    if (listaMes) {
      if (!Object.keys(rankMes).length) listaMes.innerHTML = `<li>Sem partidas em ${mesAtual+1}/${anoAtual}</li>`;
      else {
        listaMes.innerHTML = '';
        Object.entries(rankMes).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([j,g],i)=>{
          const m = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}º`;
          listaMes.innerHTML += `<li><span>${m} ${j}</span><span>${g} gol${g>1?'s':''}</span></li>`;
        });
      }
    }
    // Ranking faltas
    const rankFaltas = {};
    historico.forEach(p => { if(p.faltas?.jogadores) Object.entries(p.faltas.jogadores).forEach(([j,q])=> rankFaltas[j]=(rankFaltas[j]||0)+q); });
    const listaFaltas = document.getElementById('listaRankingFaltas');
    if (listaFaltas) {
      if (!Object.keys(rankFaltas).length) listaFaltas.innerHTML = '<li>Nenhuma falta registrada ainda.</li>';
      else {
        listaFaltas.innerHTML = '';
        Object.entries(rankFaltas).sort((a,b)=>b[1]-a[1]).forEach(([j,f])=> {
          listaFaltas.innerHTML += `<li><span>${j}</span><span>${f} falta${f>1?'s':''}</span></li>`;
        });
      }
    }
  }

  // ==========================================================================
  // 14. HISTÓRICO DE PARTIDAS
  // ==========================================================================
  function historico() {
    const historico = JSON.parse(localStorage.getItem("historico")||"[]");
    const lista = document.getElementById('listaHistorico');
    if (!lista) return;
    if (!historico.length) { lista.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary)">Nenhuma partida registrada ainda</div>'; return; }
    lista.innerHTML = '';
    [...historico].reverse().forEach(p => {
      const times = p.nomeTimes || { A: "Time A", B: "Time B" };
      const craque = p.craque || "—";
      const placar = p.placar || [0,0];
      const golsHTML = p.gols ? Object.entries(p.gols).map(([j,d])=> `<div class="gol-item"><span>${escapeHTML(j)}</span><span>${d.q} gol${d.q>1?'s':''}</span></div>`).join('') : '';
      const faltasHTML = p.faltas?.jogadores ? Object.entries(p.faltas.jogadores).map(([j,q])=> `<div class="gol-item"><span>${escapeHTML(j)}</span><span>${q} falta${q>1?'s':''}</span></div>`).join('') : '';
      const item = document.createElement('div');
      item.className = 'historico-item p-lg';
      item.dataset.partidaId = p.id;
      item.innerHTML = `
        <div class="historico-header">
          <span class="historico-data">${escapeHTML(p.data)}</span>
          <div style="display:flex; align-items:center;">
            <button class="share-card-btn" onclick="PlacarApp.mostrarCardPartida('${p.id}')" title="Compartilhar">📤</button>
            <span class="expand-icon">▼</span>
          </div>
        </div>
        <div class="historico-placar">
          <span>${escapeHTML(times.A)}</span><span>${placar[0]}</span><span class="vs">×</span><span>${placar[1]}</span><span>${escapeHTML(times.B)}</span>
        </div>
        <div class="historico-info"><span class="historico-craque">🏆 <strong>${escapeHTML(craque)}</strong></span></div>
        <div class="historico-details">
          <div class="historico-gols"><h5>⚽ Gols da Partida</h5>${golsHTML||'<div class="gol-item"><span>Nenhum gol</span></div>'}</div>
          ${faltasHTML?`<div class="historico-gols" style="background:rgba(255,165,2,0.05);margin-top:8px;"><h5>⚠️ Faltas</h5>${faltasHTML}</div>`:''}
        </div>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('share-card-btn')||e.target.closest('.share-card-btn')) return;
        item.classList.toggle('expanded');
        if (navigator.vibrate) navigator.vibrate(5);
      });
      lista.appendChild(item);
    });
  }

  async function limparHistorico() {
    if (await confirmAction("Apagar TODO o histórico? Não pode ser desfeito.")) {
      localStorage.removeItem("historico");
      historico(); fazerBackupAutomatico();
      showToast('Histórico apagado!','success');
    }
  }

  // ==========================================================================
  // 15. ESTATÍSTICAS
  // ==========================================================================
  function estatisticas() {
    const historico = JSON.parse(localStorage.getItem("historico")||"[]");
    const totalJogos = historico.length;
    let totalGols = 0, totalFaltas = 0, golsTime = {A:0,B:0}, vitorias = {A:0,B:0,empates:0};
    historico.forEach(p => {
      Object.entries(p.gols||{}).forEach(([j,d])=> { totalGols+=d.q; if(d.t==='A') golsTime.A+=d.q; else if(d.t==='B') golsTime.B+=d.q; });
      if(p.faltas) totalFaltas += (p.faltas.A||0)+(p.faltas.B||0);
      const placar = p.placar||[0,0];
      if(placar[0]>placar[1]) vitorias.A++;
      else if(placar[1]>placar[0]) vitorias.B++;
      else vitorias.empates++;
    });
    const mediaGols = totalJogos ? (totalGols/totalJogos).toFixed(1) : '0';
    const statsGerais = document.getElementById('statsGerais');
    if (statsGerais) statsGerais.innerHTML = `
      <div class="stat-row"><span class="stat-label">Total de Jogos</span><span class="stat-value">${totalJogos}</span></div>
      <div class="stat-row"><span class="stat-label">Total de Gols</span><span class="stat-value">${totalGols}</span></div>
      <div class="stat-row"><span class="stat-label">Média de Gols/Jogo</span><span class="stat-value">${mediaGols}</span></div>
      <div class="stat-row"><span class="stat-label">Total de Faltas</span><span class="stat-value">${totalFaltas}</span></div>
      <div class="stat-row"><span class="stat-label">Vitórias ${state.nomeA}</span><span class="stat-value">${vitorias.A}</span></div>
      <div class="stat-row"><span class="stat-label">Vitórias ${state.nomeB}</span><span class="stat-value">${vitorias.B}</span></div>
      <div class="stat-row"><span class="stat-label">Empates</span><span class="stat-value">${vitorias.empates}</span></div>
    `;
    const statsRecentes = document.getElementById('statsRecentes');
    if (statsRecentes) {
      const ultimas5 = historico.slice(-5).reverse();
      statsRecentes.innerHTML = ultimas5.length ? ultimas5.map(p => {
        const times = p.nomeTimes || {A:'Time A',B:'Time B'};
        const placar = p.placar || [0,0];
        return `<div class="stat-row"><span class="stat-label">${p.data.split(',')[0]}</span><span class="stat-value">${placar[0]}×${placar[1]}</span></div>`;
      }).join('') : '<div style="text-align:center;color:var(--text-secondary);padding:10px;">Sem partidas recentes</div>';
    }
    const statsPorJogador = document.getElementById('statsPorJogador');
    if (statsPorJogador) {
      const top5 = Object.entries(obterRankingGeral()).sort((a,b)=>b[1]-a[1]).slice(0,5);
      statsPorJogador.innerHTML = top5.length ? top5.map(([j,g],i)=> {
        const medalha = i===0?'🥇':i===1?'🥈':i===2?'🥉':'🏅';
        return `<div class="stat-row"><span class="stat-label">${medalha} ${j}</span><span class="stat-value">${g} gol${g>1?'s':''}</span></div>`;
      }).join('') : '<div style="text-align:center;color:var(--text-secondary);padding:10px;">Sem dados de jogadores</div>';
    }
  }

  // ==========================================================================
  // 16. COMPARAÇÃO DE JOGADORES
  // ==========================================================================
  function carregarComparacao() {
    const s1 = document.getElementById('jogador1'), s2 = document.getElementById('jogador2');
    if (!s1||!s2) return;
    s1.innerHTML = '<option value="">Selecione jogador 1</option>';
    s2.innerHTML = '<option value="">Selecione jogador 2</option>';
    state.jogadores.forEach(j => {
      s1.innerHTML += `<option value="${escapeHTML(j)}">${escapeHTML(j)}</option>`;
      s2.innerHTML += `<option value="${escapeHTML(j)}">${escapeHTML(j)}</option>`;
    });
  }

  function calcularComparacao(j1, j2) {
    const historico = JSON.parse(localStorage.getItem("historico")||"[]");
    const stats = (nome) => {
      let gols=0, faltas=0, partidas=0, craque=0;
      historico.forEach(p => {
        if(p.gols && p.gols[nome]) { gols += p.gols[nome].q; partidas++; }
        if(p.faltas?.jogadores && p.faltas.jogadores[nome]) faltas += p.faltas.jogadores[nome];
        if(p.craque && p.craque.includes(nome)) craque++;
      });
      return { gols, faltas, partidas, craque };
    };
    return { jogador1: stats(j1), jogador2: stats(j2) };
  }

  function mostrarComparacao(j1, j2, s) {
    const div = document.getElementById('resultadoComparacao');
    if (!div) return;
    const media1 = s.jogador1.partidas ? (s.jogador1.gols/s.jogador1.partidas).toFixed(2) : '0';
    const media2 = s.jogador2.partidas ? (s.jogador2.gols/s.jogador2.partidas).toFixed(2) : '0';
    const vencedor = s.jogador1.gols>s.jogador2.gols ? `${j1} tem mais gols!` : s.jogador2.gols>s.jogador1.gols ? `${j2} tem mais gols!` : 'Empate em gols!';
    const totalGols = s.jogador1.gols + s.jogador2.gols || 1;
    div.innerHTML = `
      <div class="stats-card p-lg">
        <h3 class="card-title">⚖️ Comparação: ${j1} vs ${j2}</h3>
        <div class="comparison-grid">
          <div class="comparison-player p-lg"><h4>${j1}</h4>
            <div class="comparison-stat"><span class="stat-label">Gols totais:</span><span class="stat-value">${s.jogador1.gols}</span></div>
            <div class="comparison-stat"><span class="stat-label">Média/jogo:</span><span class="stat-value">${media1}</span></div>
            <div class="comparison-stat"><span class="stat-label">Faltas:</span><span class="stat-value">${s.jogador1.faltas}</span></div>
            <div class="comparison-stat"><span class="stat-label">Vezes craque:</span><span class="stat-value">${s.jogador1.craque}</span></div>
            <div class="comparison-stat"><span class="stat-label">Partidas com gol:</span><span class="stat-value">${s.jogador1.partidas}</span></div>
          </div>
          <div class="comparison-player p-lg"><h4>${j2}</h4>
            <div class="comparison-stat"><span class="stat-label">Gols totais:</span><span class="stat-value">${s.jogador2.gols}</span></div>
            <div class="comparison-stat"><span class="stat-label">Média/jogo:</span><span class="stat-value">${media2}</span></div>
            <div class="comparison-stat"><span class="stat-label">Faltas:</span><span class="stat-value">${s.jogador2.faltas}</span></div>
            <div class="comparison-stat"><span class="stat-label">Vezes craque:</span><span class="stat-value">${s.jogador2.craque}</span></div>
            <div class="comparison-stat"><span class="stat-label">Partidas com gol:</span><span class="stat-value">${s.jogador2.partidas}</span></div>
          </div>
        </div>
        <div class="comparison-result">
          <h4>🏆 Resultado: ${vencedor}</h4>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${(s.jogador1.gols/totalGols)*100}%">${j1}: ${s.jogador1.gols} gols</div>
            <div class="progress-fill" style="width:${(s.jogador2.gols/totalGols)*100}%">${j2}: ${s.jogador2.gols} gols</div>
          </div>
        </div>
      </div>
    `;
  }

  function compararJogadores() {
    const j1 = document.getElementById('jogador1').value;
    const j2 = document.getElementById('jogador2').value;
    if (!j1||!j2) return showToast('Selecione dois jogadores','error');
    if (j1===j2) return showToast('Selecione jogadores diferentes','warning');
    const stats = calcularComparacao(j1,j2);
    mostrarComparacao(j1,j2,stats);
    showToast('Comparação realizada!','success');
  }

  // ==========================================================================
  // 17. BACKUP E RESTAURAÇÃO
  // ==========================================================================
  function fazerBackupAutomatico() {
    clearTimeout(state.backupTimer);
    state.backupTimer = setTimeout(() => {
      const backupKey = 'placar_backup_auto';
      const current = {
        jogadores: localStorage.getItem("jogadores"),
        historico: localStorage.getItem("historico"),
        nomes: { timeA: localStorage.getItem("nomeTimeA"), timeB: localStorage.getItem("nomeTimeB") },
        lastBackup: new Date().toISOString(),
        appVersion: APP_VERSION
      };
      try { localStorage.setItem(backupKey, JSON.stringify(current)); console.log('Backup auto:', current.lastBackup); } catch(e) { console.error('Erro backup auto:', e); }
    }, 30000);
  }

  function exportarBackup() {
    const dados = {
      versao: "1.0",
      dataBackup: new Date().toISOString(),
      jogadores: state.jogadores,
      historico: JSON.parse(localStorage.getItem("historico")||"[]"),
      nomeTimeA: state.nomeA,
      nomeTimeB: state.nomeB
    };
    const blob = new Blob([JSON.stringify(dados,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `placar-fut-backup-${new Date().toLocaleDateString('pt-BR')}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Backup exportado!", "success");
  }

  async function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!await confirmAction("Importar dados? Substituirá dados atuais.")) { event.target.value=""; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const dados = JSON.parse(e.target.result);
        if (dados.versao !== "1.0") { showToast("Versão incompatível","error"); return; }
        state.jogadores = dados.jogadores || [];
        localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
        if (dados.historico) localStorage.setItem("historico", JSON.stringify(dados.historico));
        if (dados.nomeTimeA) {
          state.nomeA = dados.nomeTimeA;
          localStorage.setItem("nomeTimeA", dados.nomeTimeA);
          document.getElementById('nomeTimeA').textContent = dados.nomeTimeA;
          document.getElementById('nomeFaltaA').textContent = dados.nomeTimeA;
        }
        if (dados.nomeTimeB) {
          state.nomeB = dados.nomeTimeB;
          localStorage.setItem("nomeTimeB", dados.nomeTimeB);
          document.getElementById('nomeTimeB').textContent = dados.nomeTimeB;
          document.getElementById('nomeFaltaB').textContent = dados.nomeTimeB;
        }
        renderJogadores();
        showToast("Backup importado!","success");
        fazerBackupAutomatico();
      } catch(err) { showToast("Erro ao importar","error"); console.error(err); }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  // ==========================================================================
  // 18. COMPARTILHAMENTO (CARD PROFISSIONAL)
  // ==========================================================================
  const REGEX_PARENTESES = /\s*\([^)]*\)/g;
  function extrairNome(n) {
    if (typeof n !== 'string' || !n.trim() || n==='—') return '—';
    const limpo = n.replace(REGEX_PARENTESES,'').trim();
    return limpo || '—';
  }

  function mostrarCardPartida(partidaId) {
    const historico = JSON.parse(localStorage.getItem("historico")||"[]");
    let p = historico.find(p=>p.id===partidaId) || historico[historico.length-1];
    if (!p) { showToast('Nenhuma partida','error'); return; }
    const times = p.nomeTimes || {A:'Time A',B:'Time B'};
    const placar = p.placar || [0,0];
    const craque = extrairNome(p.craque || '—');
    let maisFaltoso = '—', max = 0;
    Object.entries(p.faltas?.jogadores||{}).forEach(([j,q])=> { if(q>max) { max=q; maisFaltoso = extrairNome(j); } });
    const duracao = p.duracao || 0;
    const tempo = `${Math.floor(duracao/60)}:${String(duracao%60).padStart(2,'0')}`;
    const data = p.data ? p.data.split(',')[0] : new Date().toLocaleDateString('pt-BR');
    document.getElementById('cardPartidaConteudo').innerHTML = `
      <h2>⚽ PLACAR FUT 31</h2>
      <div class="card-placar"><span>${times.A}</span><span>${placar[0]} x ${placar[1]}</span><span>${times.B}</span></div>
      <div class="card-info"><span>🏆 CRAQUE:</span><span>${craque}</span></div>
      <div class="card-info"><span>🟨 MAIS FALTOSO:</span><span>${maisFaltoso}</span></div>
      <div class="card-info"><span>⏱️ DURAÇÃO:</span><span>${tempo}</span></div>
      <div class="card-info"><span>📅 DATA:</span><span>${data}</span></div>
    `;
    document.getElementById('modalCardPartida').classList.add('show');
  }

  function fecharModalCard(e) {
    if (e && e.target.classList.contains('modal-overlay')) document.getElementById('modalCardPartida').classList.remove('show');
    else document.getElementById('modalCardPartida').classList.remove('show');
  }

  // ==========================================================================
  // 19. TUTORIAL LEQUE (SETAS, SWIPE, TECLADO)
  // ==========================================================================
  let lequeIndexAtual = 2, touchStartX = 0, touchEndX = 0, touchMoved = false;

  function posicionarCartasLeque(index) {
    const cartas = document.querySelectorAll('.leque-card');
    if (!cartas.length) return;
    cartas.forEach((carta, i) => {
      carta.classList.remove('card-1','card-2','card-3','card-4','card-5','active');
      const pos = i - index;
      let classe = '';
      if (pos === -2) classe = 'card-1';
      else if (pos === -1) classe = 'card-2';
      else if (pos === 0) { classe = 'card-3'; carta.classList.add('active'); }
      else if (pos === 1) classe = 'card-4';
      else if (pos === 2) classe = 'card-5';
      if (classe) carta.classList.add(classe);
    });
    const dots = document.querySelectorAll('.leque-dots .dot');
    dots.forEach((d,i)=> d.classList.toggle('active', i===index));
  }

  const proximoCarta = () => { if (lequeIndexAtual < 4) { lequeIndexAtual++; posicionarCartasLeque(lequeIndexAtual); } };
  const cartaAnterior = () => { if (lequeIndexAtual > 0) { lequeIndexAtual--; posicionarCartasLeque(lequeIndexAtual); } };
  const irParaCarta = (idx) => { if (idx>=0 && idx<=4) { lequeIndexAtual = idx; posicionarCartasLeque(idx); } };

  function configurarSwipe() {
    const deck = document.getElementById('lequeDeck');
    if (!deck) return;
    deck.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; touchMoved = false; }, { passive: true });
    deck.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });
    deck.addEventListener('touchend', e => {
      if (touchMoved) {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchEndX - touchStartX;
        if (diff > 50) cartaAnterior();
        else if (diff < -50) proximoCarta();
      }
      touchMoved = false;
    }, { passive: true });
  }

  function handleTeclado(e) {
    const modal = document.getElementById('tutorialLeque');
    if (modal?.style.display === 'flex') {
      if (e.key === 'ArrowLeft') { e.preventDefault(); cartaAnterior(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); proximoCarta(); }
    }
  }
  function configurarTeclado() { document.removeEventListener('keydown', handleTeclado); document.addEventListener('keydown', handleTeclado); }

  function initTutorialInterativo() {
    const deck = document.getElementById('lequeDeck');
    if (!deck) return;
    lequeIndexAtual = 2;
    posicionarCartasLeque(2);
    const btnProx = document.getElementById('lequeProximoBtn');
    const btnAnt = document.getElementById('lequeAnteriorBtn');
    if (btnProx) btnProx.onclick = proximoCarta;
    if (btnAnt) btnAnt.onclick = cartaAnterior;
    document.querySelectorAll('.leque-dots .dot').forEach((dot,i)=> { dot.onclick = () => irParaCarta(i); });
    configurarSwipe();
    configurarTeclado();
  }

  function initTutorial() {
    setTimeout(() => {
      if (!localStorage.getItem('placar_tutorial_visto')) {
        const modal = document.getElementById('tutorialLeque');
        if (modal) { modal.style.display = 'flex'; initTutorialInterativo(); }
      }
    }, 1200);
  }

  // ==========================================================================
  // 20. PWA UNIVERSAL
  // ==========================================================================
  function configurarPWA() {
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    console.log(`📱 Plataforma: ${isIOS?'iOS':isAndroid?'Android':'Desktop'} | PWA: ${isStandalone?'Sim ✅':'Não'}`);

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      state.deferredPrompt = e;
      const btn = document.getElementById('installBtn');
      if (btn && !isIOS) {
        setTimeout(() => { btn.style.display = 'block'; setTimeout(()=>{ if(btn.style.display==='block') btn.style.display='none'; },30000); },5000);
      }
    });
    window.addEventListener('appinstalled', () => {
      console.log('📱 PWA instalado!');
      const btn = document.getElementById('installBtn');
      if (btn) btn.style.display = 'none';
      state.deferredPrompt = null;
      showToast('App instalado! ✅','success');
    });
    if (isStandalone) {
      document.getElementById('installBtn')?.style.display = 'none';
      console.log('📱 Rodando como PWA instalado');
      document.body.classList.add('pwa-installed');
    }
    if (isIOS && !isStandalone) {
      setTimeout(() => console.log('💡 iOS: Use "Compartilhar" → "Adicionar à Tela de Início"'), 3000);
    }
  }

  function instalarApp() {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      state.deferredPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') { console.log('📱 Instalação aceita'); showToast('Instalando... ⏳','success'); }
        else { console.log('📱 Instalação recusada'); showToast('Instalação cancelada','info'); }
        state.deferredPrompt = null;
        document.getElementById('installBtn')?.style.display = 'none';
      });
    } else {
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      if (isIOS && !isStandalone) showToast('📲 iOS: Compartilhar → Adicionar à Tela de Início','info',5000);
      else if (isStandalone) showToast('✅ App já instalado!','success');
      else showToast('📱 Seu navegador suporta instalação','info');
    }
  }

  // ==========================================================================
  // 21. INICIALIZAÇÃO E BACKUP AUTOMÁTICO
  // ==========================================================================
  function verificarBackupDados() {
    const backupKey = 'placar_backup_v1';
    try {
      const jog = localStorage.getItem("jogadores"), hist = localStorage.getItem("historico");
      if ((!jog||jog==='[]'||jog==='null') || (!hist||hist==='[]'||hist==='null')) {
        const backup = localStorage.getItem(backupKey);
        if (backup) {
          const p = JSON.parse(backup);
          if (p.jogadores && p.jogadores!=='null' && p.jogadores!=='[]') {
            localStorage.setItem("jogadores", p.jogadores);
            state.jogadores = JSON.parse(p.jogadores);
          }
          if (p.historico && p.historico!=='null' && p.historico!=='[]') localStorage.setItem("historico", p.historico);
          if (p.nomes?.timeA) { localStorage.setItem("nomeTimeA", p.nomes.timeA); state.nomeA = p.nomes.timeA; }
          if (p.nomes?.timeB) { localStorage.setItem("nomeTimeB", p.nomes.timeB); state.nomeB = p.nomes.timeB; }
          console.log('📂 Dados restaurados do backup!');
          showToast('📂 Dados restaurados','success');
        }
      }
      const current = {
        jogadores: localStorage.getItem("jogadores"),
        historico: localStorage.getItem("historico"),
        nomes: { timeA: localStorage.getItem("nomeTimeA"), timeB: localStorage.getItem("nomeTimeB") },
        lastBackup: new Date().toISOString(),
        appVersion: APP_VERSION
      };
      localStorage.setItem(backupKey, JSON.stringify(current));
      console.log('💾 Backup realizado:', current.lastBackup);
    } catch (error) { console.error('❌ Erro no backup:', error); }
  }

  function init() {
    console.log('🚀 Inicializando PlacarApp v' + APP_VERSION + '...');
    carregarNomesTimes();
    renderJogadores();
    esconderUndo();
    verificarBackupDados();
    configurarPWA();
    fazerBackupAutomatico();
    if ('serviceWorker' in navigator) {
      if (navigator.serviceWorker.controller) {
        console.log('✅ Service Worker já está controlando a página');
        console.log('📱 Display Mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone (PWA)' : 'browser');
      } else {
        navigator.serviceWorker.register('sw.js').then(reg => {
          console.log('✅ Service Worker registrado:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            console.log('🔄 Novo SW encontrado:', newWorker.state);
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 Nova versão disponível! Recarregue para atualizar.');
                showToast('🔄 Nova versão disponível!','info');
              }
            });
          });
        }).catch(err => console.error('❌ Erro no SW:', err));
      }
    }
    console.log('🎉 PlacarApp v' + APP_VERSION + ' inicializado com sucesso!');
  }

  // ==========================================================================
  // 22. INTERFACE PÚBLICA
  // ==========================================================================
  return {
    init: function() { if (typeof init === 'function') init(); renderJogadores(); },
    trocarTab, addJogador, removerJogador, editarNomeTime, salvarNomeTime,
    iniciar, togglePause, resetar, fim,
    aumentarGol, diminuirGol, registrarGol, registrarFalta, confirmarFalta,
    desfazer,
    fecharPopup, fecharPopupFalta, fecharPopupRemover, fecharPopupNome,
    limparHistorico, ranking, historico, estatisticas,
    compararJogadores, carregarComparacao,
    exportarBackup, importarBackup,
    instalarApp,
    mostrarCardPartida, fecharModalCard,
    // --- Tutorial Leque ---
    mostrarTutorialLeque: function() {
      if (localStorage.getItem('placar_tutorial_visto') === 'sim') return;
      const modal = document.getElementById('tutorialLeque');
      if (modal) { modal.style.display = 'flex'; initTutorialInterativo(); }
    },
    fecharTutorialLeque: function(permanentemente = true) {
      const modal = document.getElementById('tutorialLeque');
      if (modal) modal.style.display = 'none';
      if (permanentemente) localStorage.setItem('placar_tutorial_visto', 'sim');
      document.removeEventListener('keydown', handleTeclado);
    },
    abrirTutorialManual: function() {
      const modal = document.getElementById('tutorialLeque');
      if (modal) { modal.style.display = 'flex'; initTutorialInterativo(); }
    },
    getState: () => ({ ...state })
  };
})();

// ==========================================================================
// 23. EXIBIÇÃO DE VERSÃO E SPLASH SCREEN
// ==========================================================================
function exibirVersao() {
  const el = document.getElementById('appVersion');
  if (el) { el.textContent = APP_VERSION; console.log('🏷️ Versão exibida:', APP_VERSION); }
}

function iniciarAppComSplash() {
  const atualizarVersaoNaSplash = () => {
    const ver = document.querySelector('.splash-content .version');
    if (ver) ver.textContent = APP_VERSION;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', atualizarVersaoNaSplash);
  else atualizarVersaoNaSplash();

  function esconderSplash() {
    const splash = document.getElementById('splashScreen');
    if (splash) { splash.classList.add('hidden'); setTimeout(() => splash.style.display = 'none', 800); }
  }
  function inicializarAppPrincipal() { PlacarApp.init(); exibirVersao(); }

  const tempoMinimoSplash = new Promise(resolve => setTimeout(resolve, 2000));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      tempoMinimoSplash.then(() => { esconderSplash(); inicializarAppPrincipal(); initTutorial(); });
    });
  } else {
    tempoMinimoSplash.then(() => { esconderSplash(); inicializarAppPrincipal(); initTutorial(); });
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarAppComSplash);
else iniciarAppComSplash();

// ==========================================================================
// 24. FORÇAR PWA NO IOS E VERIFICAÇÕES EXTRAS
// ==========================================================================
(function() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  if (isIOS && isSafari) {
    console.log('📱 iOS Safari detectado');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { scope: './' })
        .then(reg => {
          console.log('✅ SW registrado no iOS:', reg.scope);
          setTimeout(() => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            console.log('📱 Modo atual:', isStandalone ? 'Tela Cheia' : 'Com Barra');
            if (!isStandalone) console.log('⚠️ iOS não está reconhecendo como PWA\n💡 Solução: 1. Limpe cache Safari 2. Reinstale');
          }, 1000);
        })
        .catch(err => console.error('❌ SW falhou no iOS:', err));
    }
    if (window.location.search) {
      console.log('⚠️ Removendo query string para PWA...');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
})();

setTimeout(() => {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  if (isIOS && isSafari) {
    console.log('📱 iOS Safari detectado - Verificando PWA...');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const hasSW = !!navigator.serviceWorker?.controller;
    if (!isStandalone) {
      console.log('⚠️ iOS não está em tela cheia');
      console.log('💡 Use: Compartilhar → "Adicionar à Tela de Início"');
      console.log('🔧 SW ativo:', hasSW ? '✅ Sim' : '❌ Não');
    }
  }
}, 3000);

// ==========================================================================
// 25. EVENTOS DO TUTORIAL LEQUE (BOTÕES ENTENDI / PULAR)
// ==========================================================================
document.addEventListener('DOMContentLoaded', function() {
  const entendiBtn = document.getElementById('entendiTutorialBtn');
  if (entendiBtn) entendiBtn.addEventListener('click', () => PlacarApp.fecharTutorialLeque?.(true));
  const pularBtn = document.getElementById('pularTutorialBtn');
  if (pularBtn) pularBtn.addEventListener('click', () => PlacarApp.fecharTutorialLeque?.(true));
  const overlay = document.getElementById('tutorialLeque');
  if (overlay) overlay.addEventListener('click', function(e) {
    if (e.target === overlay) PlacarApp.fecharTutorialLeque?.(false);
  });
});

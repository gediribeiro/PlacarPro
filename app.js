const APP_VERSION = 'v2026.02.10.2';
const PlacarApp = (function() {
  const state = {
    jogadores: JSON.parse(localStorage.getItem("jogadores")) || ['Jogador 1', 'Jogador 2', 'Jogador 3'],
    historicaGols: [],
    historicaFaltas: [],
    ultimaAcao: null,
    placar: { A: 0, B: 0 },
    faltas: { A: 0, B: 0 },
    partida: null,
    timer: null,
    segundos: 0,
    pausado: false,
    timeAtual: null,
    timeAtualFalta: null,
    nomeA: "Time A",
    nomeB: "Time B",
    timeEditando: null,
    deferredPrompt: null,
    undoTimer: null,
    backupTimer: null,
    eventosTimeline: []
  };

  // ===== FUNÇÕES AUXILIARES =====
  function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type = 'info', duration = 3000) {
    document.querySelectorAll('.toast').forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: ${type === 'success' ? '#0fb858' : type === 'error' ? '#ff4757' : type === 'warning' ? '#ffa502' : '#3498db'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 9999;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      opacity: 0;
      transition: all 0.3s ease;
      text-align: center;
      max-width: 80%;
      word-break: break-word;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    if (navigator.vibrate) navigator.vibrate(30);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, duration);
    
    toast.onclick = () => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    };
    
    return toast;
  }

  function confirmAction(message) {
    return new Promise((resolve) => {
      if (window.confirm(message)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  }

  // ===== LINHA DO TEMPO =====
  function adicionarEventoTimeline(tipo, time = null, jogador = null) {
    if (!state.eventosTimeline) state.eventosTimeline = [];
    
    const min = Math.floor(state.segundos / 60);
    const seg = state.segundos % 60;
    const tempo = `${min}:${seg.toString().padStart(2, '0')}`;
    
    state.eventosTimeline.push({ tempo, tipo, time, jogador });
    atualizarTimeline();
  }

  function atualizarTimeline() {
    const lista = document.getElementById('listaTimeline');
    if (!lista) return;
    
    if (state.eventosTimeline.length === 0) {
      lista.innerHTML = '<li class="timeline-empty">Nenhum evento registrado ainda</li>';
      return;
    }
    
    const eventosParaMostrar = state.eventosTimeline.slice(-15).reverse();
    
    lista.innerHTML = eventosParaMostrar.map(evento => {
      const icone = 
        evento.tipo === 'gol' ? '⚽' :
        evento.tipo === 'falta' ? '🟨' :
        evento.tipo === 'inicio' ? '▶️' :
        evento.tipo === 'fim' ? '🏁' :
        evento.tipo === 'pause' ? '⏸️' :
        evento.tipo === 'resume' ? '▶️' :
        evento.tipo === 'reset' ? '🔄' : '📝';
      
      let texto = '';
      let classe = 'event-center';
      
      switch(evento.tipo) {
        case 'gol':
          texto = evento.jogador ? `${evento.jogador}` : `Time ${evento.time}`;
          classe = evento.time === 'A' ? 'event-left' : 'event-right';
          break;
        case 'falta':
          texto = evento.jogador ? `${evento.jogador}` : `Time ${evento.time}`;
          classe = evento.time === 'A' ? 'event-left' : 'event-right';
          break;
        case 'inicio':
          texto = 'Jogo Iniciado';
          classe = 'event-center';
          break;
        case 'fim':
          texto = 'Jogo Finalizado';
          classe = 'event-center';
          break;
        case 'pause':
          texto = 'Jogo Pausado';
          classe = 'event-center';
          break;
        case 'resume':
          texto = 'Jogo Retomado';
          classe = 'event-center';
          break;
        case 'reset':
          texto = 'Jogo Resetado';
          classe = 'event-center';
          break;
      }
      
      return `<li class="timeline-item ${classe}">
          <span class="event-time">${evento.tempo}'</span>
          <span class="event-icon">${icone}</span>
          <span class="event-text">${texto}</span>
      </li>`;
    }).join('');
  }

  function resetarTimeline() {
    state.eventosTimeline = [];
    atualizarTimeline();
  }

  // ===== NAVEGAÇÃO =====
function trocarTab(tabId, button) {
    // Fecha popups
    fecharPopup(); fecharPopupFalta(); fecharPopupRemover(); fecharPopupNome();
    
    // 1. Remove 'active' de TODAS as seções
    document.querySelectorAll("section").forEach(s => s.classList.remove("active"));
    
    // 2. CORREÇÃO CRÍTICA: Remove 'active' de TODOS os botões
    document.querySelectorAll(".abamento button, nav button, .tabs button").forEach(btn => {
        btn.classList.remove("active");
    });
    
    // 3. Adiciona 'active' nos elementos corretos
    const tabElement = document.getElementById(tabId);
    if (tabElement) tabElement.classList.add("active");
    button.classList.add("active");
    
    // 4. Funções específicas
    const actions = {
        'ranking': ranking,
        'historico': historico,
        'stats': estatisticas,
        'comparar': carregarComparacao
    };
    if (actions[tabId]) actions[tabId]();
    
    // Feedback
    if (navigator.vibrate) navigator.vibrate(5);
    console.log(`✅ Aba ativa: ${tabId}`);
}

  // ===== JOGADORES =====
  function addJogador() {
    const input = document.getElementById('novoJogador');
    const nome = input.value.trim();
    
    if (!nome) {
      showToast('Digite um nome para o jogador', 'error');
      return;
    }
    
    if (nome.length > 20) {
      showToast('Nome muito longo (máx: 20 caracteres)', 'error');
      return;
    }
    
    if (!/^[a-zA-ZÀ-ÿ0-9\s]+$/.test(nome)) {
      showToast('Use apenas letras, números e espaços', 'error');
      return;
    }
    
    if (state.jogadores.includes(nome)) {
      showToast('Jogador já existe!', 'warning');
      return;
    }
    
    state.jogadores.push(nome);
    localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
    
    input.value = '';
    input.blur();
    
    renderJogadores();
    fazerBackupAutomatico();
    
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`${nome} adicionado!`, 'success');
  }

  async function removerJogador(index) {
    const nome = state.jogadores[index];
    
    if (await confirmAction(`Remover ${nome}?`)) {
      state.jogadores.splice(index, 1);
      localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
      renderJogadores();
      fazerBackupAutomatico();
      showToast(`${nome} removido`, 'success');
    }
  }

  function renderJogadores() {
    const lista = document.getElementById('listaJogadores');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    state.jogadores.forEach((jogador, index) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = jogador;
      
      const button = document.createElement('button');
      button.textContent = '❌';
      button.onclick = () => removerJogador(index);
      
      li.appendChild(span);
      li.appendChild(button);
      lista.appendChild(li);
    });
  }

  // ===== NOMES DOS TIMES =====
  function editarNomeTime(time) {
    fecharPopup();
    fecharPopupFalta();
    fecharPopupRemover();
    
    state.timeEditando = time;
    const popupTitulo = document.getElementById('popupTituloNome');
    if (popupTitulo) {
      popupTitulo.textContent = `✏️ Editar Nome - ${time === 'A' ? state.nomeA : state.nomeB}`;
    }
    
    const input = document.getElementById('inputNomeTime');
    if (input) {
      input.value = time === 'A' ? state.nomeA : state.nomeB;
    }
    
    document.getElementById('popupNomeTime').classList.add('show');
    setTimeout(() => {
      if (input) input.focus();
    }, 100);
  }

  function salvarNomeTime() {
    const input = document.getElementById('inputNomeTime');
    if (!input) return;
    
    const nome = input.value.trim();
    
    if (!nome || nome.length > 20) {
      showToast('Nome inválido (máx: 20 caracteres)', 'error');
      return;
    }
    
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
    
    fecharPopupNome();
    fazerBackupAutomatico();
    
    if (navigator.vibrate) navigator.vibrate(10);
    showToast('Nome atualizado!', 'success');
  }

  function carregarNomesTimes() {
    state.nomeA = localStorage.getItem("nomeTimeA") || "Time A";
    state.nomeB = localStorage.getItem("nomeTimeB") || "Time B";
    
    const nomeTimeAElem = document.getElementById('nomeTimeA');
    const nomeTimeBElem = document.getElementById('nomeTimeB');
    const nomeFaltaAElem = document.getElementById('nomeFaltaA');
    const nomeFaltaBElem = document.getElementById('nomeFaltaB');
    
    if (nomeTimeAElem) nomeTimeAElem.textContent = state.nomeA;
    if (nomeTimeBElem) nomeTimeBElem.textContent = state.nomeB;
    if (nomeFaltaAElem) nomeFaltaAElem.textContent = state.nomeA;
    if (nomeFaltaBElem) nomeFaltaBElem.textContent = state.nomeB;
  }

  // ===== CONTROLE DO JOGO =====
  async function iniciar() {
    if (state.partida) {
      if (!await confirmAction("Já existe um jogo em andamento. Deseja iniciar um novo?")) {
        return;
      }
    }
    
    const btn = document.getElementById("btnIniciar");
    if (btn) {
      btn.classList.add("btn-animating-green");
      setTimeout(() => btn.classList.remove("btn-animating-green"), 600);
    }
    
    state.placar = { A: 0, B: 0 };
    state.faltas = { A: 0, B: 0 };
    state.historicaGols = [];
    state.historicaFaltas = [];
    state.ultimaAcao = null;
    state.segundos = 0;
    state.pausado = false;
    
    document.getElementById('placarA').textContent = '0';
    document.getElementById('placarB').textContent = '0';
    document.getElementById('faltasA').textContent = '0';
    document.getElementById('faltasB').textContent = '0';
    document.getElementById('listaGols').innerHTML = '';
    document.getElementById('tempo').textContent = '00:00';
    document.getElementById('tempo').classList.remove('tempo-pausado');
    
    const tituloGols = document.getElementById('tituloGols');
    if (tituloGols) tituloGols.classList.remove('hidden');
    
    state.partida = {
      data: new Date().toLocaleString("pt-BR"),
      nomeTimes: { A: state.nomeA, B: state.nomeB }
    };
    
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!state.pausado) {
        state.segundos++;
        const minutos = String(Math.floor(state.segundos / 60)).padStart(2, "0");
        const segundosStr = String(state.segundos % 60).padStart(2, "0");
        document.getElementById('tempo').textContent = `${minutos}:${segundosStr}`;
      }
    }, 1000);
    
    // TIMELINE ADICIONADA
    adicionarEventoTimeline('inicio');
    
    mostrarOverlay("INÍCIO DE JOGO", "⚽", 1500);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    showToast('Jogo iniciado!', 'success');
    
    fazerBackupAutomatico();
  }

  function togglePause() {
    if (!state.partida) {
      showToast('Inicie um jogo primeiro!', 'error');
      return;
    }
    
    state.pausado = !state.pausado;
    
    // TIMELINE ADICIONADA
    if (state.pausado) {
      adicionarEventoTimeline('pause');
    } else {
      adicionarEventoTimeline('resume');
    }
    
    if (state.pausado) {
      document.getElementById('tempo').classList.add('tempo-pausado');
      showToast('Jogo pausado', 'warning');
    } else {
      document.getElementById('tempo').classList.remove('tempo-pausado');
      showToast('Jogo retomado', 'success');
    }
    
    if (navigator.vibrate) navigator.vibrate(10);
  }

  async function resetar() {
    // TIMELINE ADICIONADA
    resetarTimeline();
    
    if (state.partida) {
      if (!await confirmAction("Resetar jogo atual? Todos os dados serão perdidos.")) {
        return;
      }
    }
    
    clearInterval(state.timer);
    state.timer = null;
    
    state.placar = { A: 0, B: 0 };
    state.faltas = { A: 0, B: 0 };
    state.historicaGols = [];
    state.historicaFaltas = [];
    state.ultimaAcao = null;
    state.partida = null;
    state.segundos = 0;
    state.pausado = false;
    
    state.nomeA = "Time A";
    state.nomeB = "Time B";
    document.getElementById('nomeTimeA').textContent = "Time A";
    document.getElementById('nomeTimeB').textContent = "Time B";
    document.getElementById('nomeFaltaA').textContent = "Time A";
    document.getElementById('nomeFaltaB').textContent = "Time B";
    
    localStorage.removeItem("nomeTimeA");
    localStorage.removeItem("nomeTimeB");
    
    document.getElementById('placarA').textContent = '0';
    document.getElementById('placarB').textContent = '0';
    document.getElementById('faltasA').textContent = '0';
    document.getElementById('faltasB').textContent = '0';
    document.getElementById('listaGols').innerHTML = '';
    document.getElementById('tempo').textContent = '00:00';
    document.getElementById('tempo').classList.remove('tempo-pausado');
    
    const tituloGols = document.getElementById('tituloGols');
    if (tituloGols) tituloGols.classList.add('hidden');
    
    esconderUndo();
    
    if (navigator.vibrate) navigator.vibrate(20);
    showToast('Jogo resetado', 'success');
    
    fazerBackupAutomatico();
  }

  async function fim() {
    if (!state.partida) {
      showToast('Inicie o jogo primeiro!', 'error');
      return;
    }
    
    const btn = document.getElementById("btnFim");
    if (btn) {
      btn.classList.add("btn-animating-red");
      setTimeout(() => btn.classList.remove("btn-animating-red"), 600);
    }
    
    clearInterval(state.timer);
    state.timer = null;
    
    // TIMELINE ADICIONADA
    adicionarEventoTimeline('fim');
    
    const golsPorJogador = {};
    state.historicaGols.forEach(gol => {
      if (!golsPorJogador[gol.jogador]) {
        golsPorJogador[gol.jogador] = { q: 0, t: gol.time };
      }
      golsPorJogador[gol.jogador].q++;
    });
    
    const faltasPorJogador = {};
    state.historicaFaltas.forEach(falta => {
      if (!faltasPorJogador[falta.jogador]) {
        faltasPorJogador[falta.jogador] = 0;
      }
      faltasPorJogador[falta.jogador]++;
    });
    
    state.partida.placar = [state.placar.A, state.placar.B];
    state.partida.gols = golsPorJogador;
    state.partida.faltas = {
      A: state.faltas.A,
      B: state.faltas.B,
      jogadores: faltasPorJogador
    };
    state.partida.craque = calcularCraque(golsPorJogador);
    state.partida.duracao = state.segundos;
    
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    historico.push(state.partida);
    localStorage.setItem("historico", JSON.stringify(historico));
    
    mostrarOverlay("FIM DE JOGO", "🏆", 2000, () => {
      const mensagem = `Jogo finalizado!\n\n${state.nomeA} ${state.placar.A} × ${state.placar.B} ${state.nomeB}\n\n🏆 Craque: ${state.partida.craque}\n\n⏱️ Duração: ${Math.floor(state.segundos / 60)}:${String(state.segundos % 60).padStart(2, '0')}`;
      
      alert(mensagem);
      resetar();
    });
    
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    fazerBackupAutomatico();
  }

  function calcularCraque(gols) {
    let craque = null;
    let maxGols = 0;
    
    Object.entries(gols).forEach(([jogador, dados]) => {
      if (dados.q > maxGols) {
        maxGols = dados.q;
        craque = jogador;
      }
    });
    
    return craque ? `${craque} (${maxGols})` : "—";
  }

  // ===== ANIMAÇÕES =====
  function mostrarOverlay(texto, icone, duracao, callback) {
    const overlay = document.getElementById("gameOverlay");
    const overlayText = document.getElementById("overlayText");
    const overlayIcon = document.getElementById("overlayIcon");
    
    if (!overlay || !overlayText || !overlayIcon) {
      if (callback) callback();
      return;
    }
    
    overlayText.textContent = texto;
    overlayIcon.textContent = icone;
    
    overlay.classList.add("show");
    
    setTimeout(() => {
      overlay.classList.remove("show");
      if (callback) setTimeout(callback, 300);
    }, duracao);
  }

  function animarGol() {
    const placarDiv = document.querySelector('.main-scoreboard');
    if (!placarDiv) return;
    
    placarDiv.classList.add("gol-animation");
    
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    
    setTimeout(() => {
      placarDiv.classList.remove("gol-animation");
    }, 800);
  }
    // ===== CONTROLE DE GOLS =====
  function aumentarGol(time) {
    if (!state.partida) {
      showToast('Inicie o jogo primeiro!', 'error');
      return;
    }
    
    fecharPopupFalta();
    fecharPopupRemover();
    fecharPopupNome();
    
    state.timeAtual = time;
    
    const popupTitulo = document.getElementById('popupTitulo');
    if (popupTitulo) {
      popupTitulo.textContent = `⚽ Gol do ${time === 'A' ? state.nomeA : state.nomeB}! Quem fez?`;
    }
    
    const popup = document.getElementById('popupJogadores');
    if (!popup) return;
    
    popup.innerHTML = '';
    
    if (state.jogadores.length === 0) {
      const button = document.createElement('button');
      button.textContent = 'Jogador Desconhecido';
      button.onclick = () => registrarGol('Jogador Desconhecido');
      popup.appendChild(button);
    } else {
      const ranking = obterRankingGeral();
      
      state.jogadores.forEach(jogador => {
        const button = document.createElement('button');
        button.textContent = jogador;
        button.onclick = () => registrarGol(jogador);
        popup.appendChild(button);
      });
    }
    
    document.getElementById('popupJogador').classList.add('show');
  }

  function registrarGol(jogador) {
    if (!state.timeAtual) return;
    
    state.ultimaAcao = {
      tipo: "gol",
      time: state.timeAtual,
      jogador: jogador,
      index: state.historicaGols.length
    };
    
    mostrarUndo();
    
    if (state.timeAtual === 'A') {
      state.placar.A++;
      document.getElementById('placarA').textContent = state.placar.A;
    } else {
      state.placar.B++;
      document.getElementById('placarB').textContent = state.placar.B;
    }
    
    state.historicaGols.push({
      time: state.timeAtual,
      jogador: jogador,
      minuto: Math.floor(state.segundos / 60),
      timestamp: Date.now()
    });
    
    // TIMELINE ADICIONADA
    adicionarEventoTimeline('gol', state.timeAtual, jogador);
    
    renderGols();
    animarGol();
    fecharPopup();
    
    fazerBackupAutomatico();
    showToast(`Gol de ${jogador}!`, 'success');
  }

  function renderGols() {
    const lista = document.getElementById('listaGols');
    if (!lista) return;
      
    const golsPorJogador = {};
    state.historicaGols.forEach(gol => {
      golsPorJogador[gol.jogador] = (golsPorJogador[gol.jogador] || 0) + 1;
    });
    
    const listaOrdenada = Object.entries(golsPorJogador)
      .sort((a, b) => b[1] - a[1]);
    
    lista.innerHTML = '';
    
    listaOrdenada.forEach(([jogador, quantidade]) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = `${jogador} — ${quantidade} gol${quantidade > 1 ? 's' : ''}`;
      li.appendChild(span);
      lista.appendChild(li);
    });
    
    const tituloGols = document.getElementById('tituloGols');
    if (tituloGols) {
      if (state.historicaGols.length > 0) {
        tituloGols.classList.remove('hidden');
      } else {
        tituloGols.classList.add('hidden');
      }
    }
  }

  function diminuirGol(time) {
    if (!state.partida) {
      showToast('Inicie o jogo primeiro!', 'error');
      return;
    }
    
    if ((time === 'A' && state.placar.A === 0) || (time === 'B' && state.placar.B === 0)) {
      showToast('Não há gols para remover', 'warning');
      return;
    }
    
    const ultimosGols = state.historicaGols
      .map((gol, index) => ({ ...gol, index }))
      .filter(gol => gol.time === time)
      .slice(-3)
      .reverse();
    
    if (ultimosGols.length === 0) {
      showToast('Não há gols específicos para remover', 'warning');
      return;
    }
    
    const popup = document.getElementById('popupGols');
    if (!popup) return;
    
    fecharPopup();
    fecharPopupFalta();
    fecharPopupNome();
    
    popup.innerHTML = '';
    
    ultimosGols.forEach(gol => {
      const button = document.createElement('button');
      button.textContent = `${gol.jogador} - ${gol.minuto}min`;
      button.onclick = () => removerGolEspecifico(gol.index);
      popup.appendChild(button);
    });
    
    document.getElementById('popupRemover').classList.add('show');
  }

  function removerGolEspecifico(index) {
    const gol = state.historicaGols[index];
    
    if (gol.time === 'A') {
      state.placar.A = Math.max(0, state.placar.A - 1);
      document.getElementById('placarA').textContent = state.placar.A;
    } else {
      state.placar.B = Math.max(0, state.placar.B - 1);
      document.getElementById('placarB').textContent = state.placar.B;
    }
    
    state.historicaGols.splice(index, 1);
    renderGols();
    
    fecharPopupRemover();
    fazerBackupAutomatico();
    
    if (navigator.vibrate) navigator.vibrate(15);
    showToast('Gol removido', 'warning');
  }

  // ===== CONTROLE DE FALTAS =====
  function registrarFalta(time) {
    if (!state.partida) {
      showToast('Inicie o jogo primeiro!', 'error');
      return;
    }
    
    fecharPopup();
    fecharPopupRemover();
    fecharPopupNome();
    
    state.timeAtualFalta = time;
    
    const popupTituloFalta = document.getElementById('popupTituloFalta');
    if (popupTituloFalta) {
      popupTituloFalta.textContent = `⚠️ Falta do ${time === 'A' ? state.nomeA : state.nomeB}. Quem fez?`;
    }
    
    const popup = document.getElementById('popupJogadoresFalta');
    if (!popup) return;
    
    popup.innerHTML = '';
    
    if (state.jogadores.length === 0) {
      const button = document.createElement('button');
      button.textContent = 'Jogador Desconhecido';
      button.onclick = () => confirmarFalta('Jogador Desconhecido');
      popup.appendChild(button);
    } else {
      state.jogadores.forEach(jogador => {
        const button = document.createElement('button');
        button.textContent = jogador;
        button.onclick = () => confirmarFalta(jogador);
        popup.appendChild(button);
      });
    }
    
    document.getElementById('popupFalta').classList.add('show');
  }

  function confirmarFalta(jogador) {
    if (!state.timeAtualFalta) return;
    
    state.ultimaAcao = {
      tipo: "falta",
      time: state.timeAtualFalta,
      jogador: jogador,
      index: state.historicaFaltas.length
    };
    
    mostrarUndo();
    
    if (state.timeAtualFalta === 'A') {
      state.faltas.A++;
      document.getElementById('faltasA').textContent = state.faltas.A;
    } else {
      state.faltas.B++;
      document.getElementById('faltasB').textContent = state.faltas.B;
    }
    
    state.historicaFaltas.push({
      time: state.timeAtualFalta,
      jogador: jogador,
      minuto: Math.floor(state.segundos / 60),
      timestamp: Date.now()
    });
    
    // TIMELINE ADICIONADA
    adicionarEventoTimeline('falta', state.timeAtualFalta, jogador);
    
    fecharPopupFalta();
    fazerBackupAutomatico();
    
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`Falta de ${jogador}`, 'warning');
  }

  // ===== DESFAZER AÇÃO =====
  function mostrarUndo() {
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
      undoBtn.style.display = 'block';
    }
    
    clearTimeout(state.undoTimer);
    
    state.undoTimer = setTimeout(() => {
      esconderUndo();
    }, 5000);
  }

  function esconderUndo() {
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
      undoBtn.style.display = 'none';
    }
    state.ultimaAcao = null;
  }

  function desfazer() {
    if (!state.ultimaAcao) return;
    
    if (state.ultimaAcao.tipo === "gol") {
      if (state.ultimaAcao.time === 'A') {
        state.placar.A = Math.max(0, state.placar.A - 1);
        document.getElementById('placarA').textContent = state.placar.A;
      } else {
        state.placar.B = Math.max(0, state.placar.B - 1);
        document.getElementById('placarB').textContent = state.placar.B;
      }
      
      state.historicaGols.splice(state.ultimaAcao.index, 1);
      renderGols();
      
    } else if (state.ultimaAcao.tipo === "falta") {
      if (state.ultimaAcao.time === 'A') {
        state.faltas.A = Math.max(0, state.faltas.A - 1);
        document.getElementById('faltasA').textContent = state.faltas.A;
      } else {
        state.faltas.B = Math.max(0, state.faltas.B - 1);
        document.getElementById('faltasB').textContent = state.faltas.B;
      }
      
      state.historicaFaltas.splice(state.ultimaAcao.index, 1);
    }
    
    esconderUndo();
    fazerBackupAutomatico();
    
    if (navigator.vibrate) navigator.vibrate(15);
    showToast('Ação desfeita', 'success');
  }

  // ===== POPUPS =====
  function fecharPopup(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('popupJogador');
    if (popup) popup.classList.remove('show');
    state.timeAtual = null;
  }

  function fecharPopupFalta(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('popupFalta');
    if (popup) popup.classList.remove('show');
    state.timeAtualFalta = null;
  }

  function fecharPopupRemover(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('popupRemover');
    if (popup) popup.classList.remove('show');
  }

  function fecharPopupNome(event) {
    if (event) event.stopPropagation();
    const popup = document.getElementById('popupNomeTime');
    if (popup) popup.classList.remove('show');
    state.timeEditando = null;
  }

  // ===== RANKING =====
  function obterRankingGeral() {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    const ranking = {};
    
    historico.forEach(partida => {
      Object.entries(partida.gols || {}).forEach(([jogador, dados]) => {
        ranking[jogador] = (ranking[jogador] || 0) + dados.q;
      });
    });
    
    return ranking;
  }

  function ranking() {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    
    const rankingGeral = obterRankingGeral();
    const listaGeral = document.getElementById('listaRankingGeral');
    
    if (listaGeral) {
      if (Object.keys(rankingGeral).length === 0) {
        listaGeral.innerHTML = '<li>Nenhum gol registrado ainda.</li>';
      } else {
        listaGeral.innerHTML = '';
        
        Object.entries(rankingGeral)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([jogador, gols], index) => {
            const li = document.createElement('li');
            const medalha = index === 0 ? '🥇' : 
                           index === 1 ? '🥈' : 
                           index === 2 ? '🥉' : `${index + 1}º`;
            
            const spanNome = document.createElement('span');
            spanNome.textContent = `${medalha} ${jogador}`;
            
            const spanGols = document.createElement('span');
            spanGols.textContent = `${gols} gol${gols > 1 ? 's' : ''}`;
            
            li.appendChild(spanNome);
            li.appendChild(spanGols);
            listaGeral.appendChild(li);
          });
      }
    }
    
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    
    const partidasMes = historico.filter(partida => {
      try {
        const dataStr = partida.data.split(",")[0].trim();
        const partes = dataStr.split("/");
        
        if (partes.length !== 3) return false;
        
        const mes = parseInt(partes[1], 10);
        const ano = parseInt(partes[2], 10);
        
        return (mes - 1) === mesAtual && ano === anoAtual;
      } catch (error) {
        return false;
      }
    });
    
    const rankingMes = {};
    partidasMes.forEach(partida => {
      Object.entries(partida.gols || {}).forEach(([jogador, dados]) => {
        rankingMes[jogador] = (rankingMes[jogador] || 0) + dados.q;
      });
    });
    
    const listaMes = document.getElementById('listaRankingMes');
    if (listaMes) {
      if (Object.keys(rankingMes).length === 0) {
        listaMes.innerHTML = `<li>Sem partidas em ${mesAtual + 1}/${anoAtual}</li>`;
      } else {
        listaMes.innerHTML = '';
        
        Object.entries(rankingMes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .forEach(([jogador, gols], index) => {
            const li = document.createElement('li');
            const medalha = index === 0 ? '🥇' : 
                           index === 1 ? '🥈' : 
                           index === 2 ? '🥉' : `${index + 1}º`;
            
            const spanNome = document.createElement('span');
            spanNome.textContent = `${medalha} ${jogador}`;
            
            const spanGols = document.createElement('span');
            spanGols.textContent = `${gols} gol${gols > 1 ? 's' : ''}`;
            
            li.appendChild(spanNome);
            li.appendChild(spanGols);
            listaMes.appendChild(li);
          });
      }
    }
    
    const rankingFaltas = {};
    historico.forEach(partida => {
      if (partida.faltas && partida.faltas.jogadores) {
        Object.entries(partida.faltas.jogadores).forEach(([jogador, faltas]) => {
          rankingFaltas[jogador] = (rankingFaltas[jogador] || 0) + faltas;
        });
      }
    });
    
    const listaFaltas = document.getElementById('listaRankingFaltas');
    if (listaFaltas) {
      if (Object.keys(rankingFaltas).length === 0) {
        listaFaltas.innerHTML = '<li>Nenhuma falta registrada ainda.</li>';
      } else {
        listaFaltas.innerHTML = '';
        
        Object.entries(rankingFaltas)
          .sort((a, b) => b[1] - a[1])
          .forEach(([jogador, faltas]) => {
            const li = document.createElement('li');
            const spanNome = document.createElement('span');
            spanNome.textContent = jogador;
            
            const spanFaltas = document.createElement('span');
            spanFaltas.textContent = `${faltas} falta${faltas > 1 ? 's' : ''}`;
            
            li.appendChild(spanNome);
            li.appendChild(spanFaltas);
            listaFaltas.appendChild(li);
          });
      }
    }
  }

  // ===== HISTÓRICO =====
  function historico() {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    const lista = document.getElementById('listaHistorico');
    
    if (!lista) return;
    
    if (historico.length === 0) {
      lista.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-secondary)">Nenhuma partida registrada ainda</div>';
      return;
    }
    
    lista.innerHTML = '';
    
    [...historico].reverse().forEach(partida => {
      const times = partida.nomeTimes || { A: "Time A", B: "Time B" };
      const craque = partida.craque || "—";
      const placar = partida.placar || [0, 0];
      
      const item = document.createElement('div');
      item.className = 'historico-item';
      
      let golsHTML = '';
      if (partida.gols) {
        golsHTML = Object.entries(partida.gols)
          .map(([jogador, dados]) => 
            `<div class="gol-item"><span>${escapeHTML(jogador)}</span><span>${dados.q} gol${dados.q > 1 ? 's' : ''}</span></div>`
          )
          .join('');
      }
      
      let faltasHTML = '';
      if (partida.faltas && partida.faltas.jogadores) {
        faltasHTML = Object.entries(partida.faltas.jogadores)
          .map(([jogador, qtd]) => 
            `<div class="gol-item"><span>${escapeHTML(jogador)}</span><span>${qtd} falta${qtd > 1 ? 's' : ''}</span></div>`
          )
          .join('');
      }
      
      item.innerHTML = `
        <div class="historico-header">
          <span class="historico-data">${escapeHTML(partida.data)}</span>
          <span class="expand-icon">▼</span>
        </div>
        <div class="historico-placar">
          <span>${escapeHTML(times.A)}</span>
          <span>${placar[0]}</span>
          <span class="vs">×</span>
          <span>${placar[1]}</span>
          <span>${escapeHTML(times.B)}</span>
        </div>
        <div class="historico-info">
          <span class="historico-craque">🏆 <strong>${escapeHTML(craque)}</strong></span>
        </div>
        <div class="historico-details">
          <div class="historico-gols">
            <h5>⚽ Gols da Partida</h5>
            ${golsHTML || '<div class="gol-item"><span>Nenhum gol registrado</span></div>'}
          </div>
          ${faltasHTML ? `
            <div class="historico-gols" style="background:rgba(255,165,2,0.05);margin-top:8px;">
              <h5>⚠️ Faltas</h5>
              ${faltasHTML}
            </div>
          ` : ''}
        </div>
      `;
      
      item.addEventListener('click', () => {
        item.classList.toggle('expanded');
        if (navigator.vibrate) navigator.vibrate(5);
      });
      
      lista.appendChild(item);
    });
  }

  async function limparHistorico() {
    if (await confirmAction("Apagar TODO o histórico? Esta ação não pode ser desfeita.")) {
      localStorage.removeItem("historico");
      historico();
      fazerBackupAutomatico();
      showToast('Histórico apagado!', 'success');
    }
  }

  // ===== ESTATÍSTICAS =====
  function estatisticas() {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    
    const totalJogos = historico.length;
    let totalGols = 0;
    let totalFaltas = 0;
    let golsPorTime = { A: 0, B: 0 };
    let vitoriasPorTime = { A: 0, B: 0, empates: 0 };
    
    historico.forEach(partida => {
      Object.entries(partida.gols || {}).forEach(([jogador, dados]) => {
        totalGols += dados.q;
        if (dados.t === 'A') golsPorTime.A += dados.q;
        if (dados.t === 'B') golsPorTime.B += dados.q;
      });
      
      if (partida.faltas) {
        totalFaltas += (partida.faltas.A || 0) + (partida.faltas.B || 0);
      }
      
      const placar = partida.placar || [0, 0];
      if (placar[0] > placar[1]) vitoriasPorTime.A++;
      else if (placar[1] > placar[0]) vitoriasPorTime.B++;
      else vitoriasPorTime.empates++;
    });
    
    const mediaGols = totalJogos > 0 ? (totalGols / totalJogos).toFixed(1) : '0';
    
    const statsGerais = document.getElementById('statsGerais');
    if (statsGerais) {
      statsGerais.innerHTML = `
        <div class="stat-row">
          <span class="stat-label">Total de Jogos</span>
          <span class="stat-value">${totalJogos}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total de Gols</span>
          <span class="stat-value">${totalGols}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Média de Gols/Jogo</span>
          <span class="stat-value">${mediaGols}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Total de Faltas</span>
          <span class="stat-value">${totalFaltas}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Vitórias ${state.nomeA}</span>
          <span class="stat-value">${vitoriasPorTime.A}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Vitórias ${state.nomeB}</span>
          <span class="stat-value">${vitoriasPorTime.B}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Empates</span>
          <span class="stat-value">${vitoriasPorTime.empates}</span>
        </div>
      `;
    }
    
    const statsRecentes = document.getElementById('statsRecentes');
    if (statsRecentes) {
      const ultimas5 = historico.slice(-5).reverse();
      let html = '';
      
      if (ultimas5.length === 0) {
        html = '<div style="text-align:center;color:var(--text-secondary);padding:10px;">Sem partidas recentes</div>';
      } else {
        ultimas5.forEach(partida => {
          const times = partida.nomeTimes || { A: "Time A", B: "Time B" };
          const placar = partida.placar || [0, 0];
          const data = partida.data.split(',')[0];
          
          html += `
            <div class="stat-row">
              <span class="stat-label">${data}</span>
              <span class="stat-value">${placar[0]}×${placar[1]}</span>
            </div>
          `;
        });
      }
      
      statsRecentes.innerHTML = html;
    }
    
    const statsPorJogador = document.getElementById('statsPorJogador');
    if (statsPorJogador) {
      const rankingGeral = obterRankingGeral();
      const top5 = Object.entries(rankingGeral)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      let html = '';
      
      if (top5.length === 0) {
        html = '<div style="text-align:center;color:var(--text-secondary);padding:10px;">Sem dados de jogadores</div>';
      } else {
        top5.forEach(([jogador, gols], index) => {
          const medalha = index === 0 ? '🥇' : 
                         index === 1 ? '🥈' : 
                         index === 2 ? '🥉' : '🏅';
          
          html += `
            <div class="stat-row">
              <span class="stat-label">${medalha} ${jogador}</span>
              <span class="stat-value">${gols} gol${gols > 1 ? 's' : ''}</span>
            </div>
          `;
        });
      }
      
      statsPorJogador.innerHTML = html;
    }
  }

  // ===== COMPARAÇÃO DE JOGADORES =====
  function carregarComparacao() {
    const select1 = document.getElementById('jogador1');
    const select2 = document.getElementById('jogador2');
    
    if (!select1 || !select2) return;
    
    select1.innerHTML = '<option value="">Selecione jogador 1</option>';
    select2.innerHTML = '<option value="">Selecione jogador 2</option>';
    
    state.jogadores.forEach(jogador => {
      select1.innerHTML += `<option value="${escapeHTML(jogador)}">${escapeHTML(jogador)}</option>`;
      select2.innerHTML += `<option value="${escapeHTML(jogador)}">${escapeHTML(jogador)}</option>`;
    });
  }

  function calcularComparacao(jogador1, jogador2) {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    
    let statsJ1 = { gols: 0, faltas: 0, partidas: 0, craque: 0 };
    let statsJ2 = { gols: 0, faltas: 0, partidas: 0, craque: 0 };
    
    historico.forEach(partida => {
      if (partida.gols && partida.gols[jogador1]) {
        statsJ1.gols += partida.gols[jogador1].q;
        statsJ1.partidas++;
      }
      if (partida.gols && partida.gols[jogador2]) {
        statsJ2.gols += partida.gols[jogador2].q;
        statsJ2.partidas++;
      }
      
      if (partida.faltas && partida.faltas.jogadores) {
        if (partida.faltas.jogadores[jogador1]) {
          statsJ1.faltas += partida.faltas.jogadores[jogador1];
        }
        if (partida.faltas.jogadores[jogador2]) {
          statsJ2.faltas += partida.faltas.jogadores[jogador2];
        }
      }
      
      if (partida.craque && partida.craque.includes(jogador1)) {
        statsJ1.craque++;
      }
      if (partida.craque && partida.craque.includes(jogador2)) {
        statsJ2.craque++;
      }
    });
    
    return { jogador1: statsJ1, jogador2: statsJ2 };
  }

  function mostrarComparacao(jogador1, jogador2, stats) {
    const resultadoDiv = document.getElementById('resultadoComparacao');
    if (!resultadoDiv) return;
    
    const mediaJ1 = stats.jogador1.partidas > 0 ? (stats.jogador1.gols / stats.jogador1.partidas).toFixed(2) : '0';
    const mediaJ2 = stats.jogador2.partidas > 0 ? (stats.jogador2.gols / stats.jogador2.partidas).toFixed(2) : '0';
    
    let vencedor = '';
    if (stats.jogador1.gols > stats.jogador2.gols) {
      vencedor = `${jogador1} tem mais gols!`;
    } else if (stats.jogador2.gols > stats.jogador1.gols) {
      vencedor = `${jogador2} tem mais gols!`;
    } else {
      vencedor = 'Empate em número de gols!';
    }
    
    resultadoDiv.innerHTML = `
      <div class="stats-card">
        <h3 class="card-title">⚖️ Comparação: ${jogador1} vs ${jogador2}</h3>
        
        <div class="comparison-grid">
          <div class="comparison-player">
            <h4>${jogador1}</h4>
            <div class="comparison-stat">
              <span class="stat-label">Gols totais:</span>
              <span class="stat-value">${stats.jogador1.gols}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Média por jogo:</span>
              <span class="stat-value">${mediaJ1}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Faltas:</span>
              <span class="stat-value">${stats.jogador1.faltas}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Vezes craque:</span>
              <span class="stat-value">${stats.jogador1.craque}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Partidas com gol:</span>
              <span class="stat-value">${stats.jogador1.partidas}</span>
            </div>
          </div>
          
          <div class="comparison-player">
            <h4>${jogador2}</h4>
            <div class="comparison-stat">
              <span class="stat-label">Gols totais:</span>
              <span class="stat-value">${stats.jogador2.gols}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Média por jogo:</span>
              <span class="stat-value">${mediaJ2}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Faltas:</span>
              <span class="stat-value">${stats.jogador2.faltas}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Vezes craque:</span>
              <span class="stat-value">${stats.jogador2.craque}</span>
            </div>
            <div class="comparison-stat">
              <span class="stat-label">Partidas com gol:</span>
              <span class="stat-value">${stats.jogador2.partidas}</span>
            </div>
          </div>
        </div>
        
        <div class="comparison-result">
          <h4>🏆 Resultado: ${vencedor}</h4>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${stats.jogador1.gols + stats.jogador2.gols === 0 ? 50 : (stats.jogador1.gols / (stats.jogador1.gols + stats.jogador2.gols)) * 100}%">
              ${jogador1}: ${stats.jogador1.gols} gols
            </div>
            <div class="progress-fill" style="width: ${stats.jogador1.gols + stats.jogador2.gols === 0 ? 50 : (stats.jogador2.gols / (stats.jogador1.gols + stats.jogador2.gols)) * 100}%">
              ${jogador2}: ${stats.jogador2.gols} gols
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function compararJogadores() {
    const jogador1 = document.getElementById('jogador1').value;
    const jogador2 = document.getElementById('jogador2').value;
    
    if (!jogador1 || !jogador2) {
      showToast('Selecione dois jogadores', 'error');
      return;
    }
    
    if (jogador1 === jogador2) {
      showToast('Selecione jogadores diferentes', 'warning');
      return;
    }
    
    const stats = calcularComparacao(jogador1, jogador2);
    mostrarComparacao(jogador1, jogador2, stats);
    
    showToast('Comparação realizada!', 'success');
  }

  // ===== BACKUP =====
  function fazerBackupAutomatico() {
    if (state.backupTimer) {
      clearTimeout(state.backupTimer);
    }
    
    state.backupTimer = setTimeout(() => {
      const backupKey = 'placar_backup_auto';
      const currentData = {
        jogadores: localStorage.getItem("jogadores"),
        historico: localStorage.getItem("historico"),
        nomes: {
          timeA: localStorage.getItem("nomeTimeA"),
          timeB: localStorage.getItem("nomeTimeB")
        },
        lastBackup: new Date().toISOString()
      };
      
      try {
        localStorage.setItem(backupKey, JSON.stringify(currentData));
        console.log('Backup automático realizado:', currentData.lastBackup);
      } catch (error) {
        console.error('Erro no backup automático:', error);
      }
    }, 30000);
  }

  function exportarBackup() {
    const dados = {
      versao: "1.0",
      dataBackup: new Date().toISOString(),
      jogadores: state.jogadores,
      historico: JSON.parse(localStorage.getItem("historico") || "[]"),
      nomeTimeA: state.nomeA,
      nomeTimeB: state.nomeB
    };
    
    const blob = new Blob([JSON.stringify(dados, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `placar-fut-backup-${new Date().toLocaleDateString('pt-BR')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast("Backup exportado com sucesso!", "success");
  }

  async function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!await confirmAction("Importar dados? Isso substituirá seus dados atuais.")) {
      event.target.value = "";
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const dados = JSON.parse(e.target.result);
        
        if (dados.versao !== "1.0") {
          showToast("Versão do backup incompatível", "error");
          return;
        }
        
        state.jogadores = dados.jogadores || [];
        localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
        
        if (dados.historico) {
          localStorage.setItem("historico", JSON.stringify(dados.historico));
        }
        
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
        showToast("Backup importado com sucesso!", "success");
        
        fazerBackupAutomatico();
        
      } catch (error) {
        showToast("Erro ao importar backup", "error");
        console.error(error);
      }
      event.target.value = "";
    };
    reader.readAsText(file);
  }

  // ===== PWA =====
  function configurarPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      
      const installBtn = document.getElementById('installBtn');
      if (installBtn) {
        setTimeout(() => {
          installBtn.style.display = 'block';
          
          setTimeout(() => {
            if (installBtn.style.display === 'block') {
              installBtn.style.display = 'none';
            }
          }, 30000);
        }, 5000);
      }
    });
    
    window.addEventListener('appinstalled', () => {
      console.log('PWA instalado!');
      const installBtn = document.getElementById('installBtn');
      if (installBtn) installBtn.style.display = 'none';
      state.deferredPrompt = null;
      showToast('App instalado com sucesso!', 'success');
    });
    
    if (window.matchMedia('(display-mode: standalone)').matches) {
      const installBtn = document.getElementById('installBtn');
      if (installBtn) installBtn.style.display = 'none';
      console.log('Rodando como PWA instalado');
    }
  }

  function instalarApp() {
    if (state.deferredPrompt) {
      state.deferredPrompt.prompt();
      
      state.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('Usuário aceitou a instalação');
          showToast('Instalando...', 'success');
        } else {
          console.log('Usuário recusou a instalação');
          showToast('Instalação cancelada', 'info');
        }
        
        state.deferredPrompt = null;
        const installBtn = document.getElementById('installBtn');
        if (installBtn) installBtn.style.display = 'none';
      });
    } else {
      showToast('App já instalado ou navegador não suporta', 'info');
    }
  }

  // ===== INICIALIZAÇÃO =====
  function init() {
    console.log('Inicializando PlacarApp...');
    
    carregarNomesTimes();
    renderJogadores();
    
    esconderUndo();
    
    verificarBackupDados();
    configurarPWA();
    fazerBackupAutomatico();
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registrado!'))
        .catch(err => console.error('Erro no Service Worker:', err));
    }
    
    console.log('PlacarApp inicializado com sucesso!');
  }

  function verificarBackupDados() {
    const backupKey = 'placar_backup_v1';
    
    try {
      const jogadores = localStorage.getItem("jogadores");
      const historico = localStorage.getItem("historico");
      
      if (!jogadores || jogadores === '[]' || jogadores === 'null' || 
          !historico || historico === '[]' || historico === 'null') {
        
        const backup = localStorage.getItem(backupKey);
        if (backup) {
          const parsed = JSON.parse(backup);
          
          if (parsed.jogadores && parsed.jogadores !== 'null' && parsed.jogadores !== '[]') {
            localStorage.setItem("jogadores", parsed.jogadores);
            state.jogadores = JSON.parse(parsed.jogadores);
          }
          
          if (parsed.historico && parsed.historico !== 'null' && parsed.historico !== '[]') {
            localStorage.setItem("historico", parsed.historico);
          }
          
          if (parsed.nomes && parsed.nomes.timeA) {
            localStorage.setItem("nomeTimeA", parsed.nomes.timeA);
            state.nomeA = parsed.nomes.timeA;
          }
          
          if (parsed.nomes && parsed.nomes.timeB) {
            localStorage.setItem("nomeTimeB", parsed.nomes.timeB);
            state.nomeB = parsed.nomes.timeB;
          }
          
          console.log('Dados restaurados do backup!');
          showToast('Dados restaurados do backup automático', 'success');
        }
      }
      
      const currentData = {
        jogadores: localStorage.getItem("jogadores"),
        historico: localStorage.getItem("historico"),
        nomes: {
          timeA: localStorage.getItem("nomeTimeA"),
          timeB: localStorage.getItem("nomeTimeB")
        },
        lastBackup: new Date().toISOString()
      };
      
      localStorage.setItem(backupKey, JSON.stringify(currentData));
      console.log('Backup inicial realizado:', currentData.lastBackup);
      
    } catch (error) {
      console.error('Erro no backup:', error);
    }
  }

  // ===== INTERFACE PÚBLICA =====
  return {
    init: function() {
      if (typeof init === 'function') {
        init();
      }
      
      renderJogadores();
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
          .then(() => console.log('Service Worker registrado!'))
          .catch(err => console.error('Erro no Service Worker:', err));
      }
    },
    trocarTab: trocarTab,
    addJogador: addJogador,
    removerJogador: removerJogador,
    editarNomeTime: editarNomeTime,
    salvarNomeTime: salvarNomeTime,
    iniciar: iniciar,
    togglePause: togglePause,
    resetar: resetar,
    fim: fim,
    aumentarGol: aumentarGol,
    diminuirGol: diminuirGol,
    registrarGol: registrarGol,
    registrarFalta: registrarFalta,
    confirmarFalta: confirmarFalta,
    desfazer: desfazer,
    fecharPopup: fecharPopup,
    fecharPopupFalta: fecharPopupFalta,
    fecharPopupRemover: fecharPopupRemover,
    fecharPopupNome: fecharPopupNome,
    limparHistorico: limparHistorico,
    ranking: ranking,
    historico: historico,
    estatisticas: estatisticas,
    compararJogadores: compararJogadores,
    carregarComparacao: carregarComparacao,
    exportarBackup: exportarBackup,
    importarBackup: importarBackup,
    instalarApp: instalarApp,
    getState: () => ({ ...state })
  };
})();

// ===== EXIBIR VERSÃO NO RODAPÉ ===== 
// Código CORRIGIDO - executa dentro do init para evitar conflitos
function exibirVersao() {
    const versaoEl = document.getElementById('versaoApp');
    if (versaoEl) {
        versaoEl.textContent = APP_VERSION; // 'v2026.02.10.2'
        console.log('Versão exibida:', APP_VERSION);
    }
}

// Inicializar quando a página carregar (VERSÃO CORRIGIDA)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    PlacarApp.init();
    exibirVersao(); // 👈 Executa APÓS o init
  });
} else {
  PlacarApp.init();
  exibirVersao(); // 👈 Executa se DOM já carregado
}
  

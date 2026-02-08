const PlacarApp = (function() {
  const state = {
    jogadores: JSON.parse(localStorage.getItem("jogadores")) || [],
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
    undoTimer: null
  };

  function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
    
    if (navigator.vibrate) navigator.vibrate(30);
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

  function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} ativado`, 'success');
  }

  function carregarTema() {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  function trocarTab(tabId, button) {
    document.querySelectorAll("section").forEach(section => {
      section.classList.remove("active");
    });
    
    document.querySelectorAll(".tabs button").forEach(btn => {
      btn.classList.remove("active");
    });
    
    document.getElementById(tabId).classList.add("active");
    button.classList.add("active");
    
    switch(tabId) {
      case 'ranking':
        ranking();
        break;
      case 'historico':
        historico();
        break;
      case 'stats':
        estatisticas();
        break;
      case 'comparar':
        carregarComparacao();
        break;
    }
    
    if (navigator.vibrate) navigator.vibrate(5);
  }

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
    renderJogadores();
    
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`${nome} adicionado!`, 'success');
  }

  async function removerJogador(index) {
    const nome = state.jogadores[index];
    
    if (await confirmAction(`Remover ${nome}?`)) {
      state.jogadores.splice(index, 1);
      localStorage.setItem("jogadores", JSON.stringify(state.jogadores));
      renderJogadores();
      showToast(`${nome} removido`, 'success');
    }
  }

  function renderJogadores() {
    const lista = document.getElementById('listaJogadores');
    const fragment = document.createDocumentFragment();
    
    state.jogadores.forEach((jogador, index) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = jogador;
      
      const button = document.createElement('button');
      button.textContent = '❌';
      button.onclick = () => removerJogador(index);
      
      li.appendChild(span);
      li.appendChild(button);
      fragment.appendChild(li);
    });
    
    lista.innerHTML = '';
    lista.appendChild(fragment);
  }

  function editarNomeTime(time) {
    state.timeEditando = time;
    document.getElementById('popupTituloNome').textContent = 
      `✏️ Editar Nome - ${time === 'A' ? state.nomeA : state.nomeB}`;
    
    const input = document.getElementById('inputNomeTime');
    input.value = time === 'A' ? state.nomeA : state.nomeB;
    
    document.getElementById('popupNomeTime').classList.add('show');
    setTimeout(() => input.focus(), 100);
  }

  function salvarNomeTime() {
    const input = document.getElementById('inputNomeTime');
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
    if (navigator.vibrate) navigator.vibrate(10);
    showToast('Nome atualizado!', 'success');
  }

  function carregarNomesTimes() {
    state.nomeA = localStorage.getItem("nomeTimeA") || "Time A";
    state.nomeB = localStorage.getItem("nomeTimeB") || "Time B";
    
    document.getElementById('nomeTimeA').textContent = state.nomeA;
    document.getElementById('nomeTimeB').textContent = state.nomeB;
    document.getElementById('nomeFaltaA').textContent = state.nomeA;
    document.getElementById('nomeFaltaB').textContent = state.nomeB;
  }

  async function iniciar() {
    if (state.partida) {
      if (!await confirmAction("Já existe um jogo em andamento. Deseja iniciar um novo?")) {
        return;
      }
    }
    
    const btn = document.getElementById("btnIniciar");
    btn.classList.add("btn-animating-green");
    setTimeout(() => btn.classList.remove("btn-animating-green"), 600);
    
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
    document.getElementById('tituloGols').classList.remove('hidden');
    
    state.partida = {
      data: new Date().toLocaleString("pt-BR"),
      nomeTimes: { A: state.nomeA, B: state.nomeB }
    };
    
    clearInterval(state.timer);
    state.timer = setInterval(() => {
      if (!state.pausado) {
        state.segundos++;
        const minutos = String(Math.floor(state.segundos / 60)).padStart(2, "0");
        const segundos = String(state.segundos % 60).padStart(2, "0");
        document.getElementById('tempo').textContent = `${minutos}:${segundos}`;
      }
    }, 1000);
    
    mostrarOverlay("INÍCIO DE JOGO", "⚽", 1500);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    showToast('Jogo iniciado!', 'success');
  }

  function togglePause() {
    if (!state.partida) {
      showToast('Inicie um jogo primeiro!', 'error');
      return;
    }
    
    state.pausado = !state.pausado;
    
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
    if (state.partida) {
      if (!await confirmAction("Resetar jogo atual? Todos os dados serão perdidos.")) {
        return;
      }
    }
    
    clearInterval(state.timer);
    state.placar = { A: 0, B: 0 };
    state.faltas = { A: 0, B: 0 };
    state.historicaGols = [];
    state.historicaFaltas = [];
    state.ultimaAcao = null;
    state.partida = null;
    state.segundos = 0;
    state.pausado = false;
    
    document.getElementById('placarA').textContent = '0';
    document.getElementById('placarB').textContent = '0';
    document.getElementById('faltasA').textContent = '0';
    document.getElementById('faltasB').textContent = '0';
    document.getElementById('listaGols').innerHTML = '';
    document.getElementById('tempo').textContent = '00:00';
    document.getElementById('tempo').classList.remove('tempo-pausado');
    document.getElementById('tituloGols').classList.add('hidden');
    
    esconderUndo();
    
    if (navigator.vibrate) navigator.vibrate(20);
    showToast('Jogo resetado', 'success');
  }

  async function fim() {
    if (!state.partida) {
      showToast('Inicie o jogo primeiro!', 'error');
      return;
    }
    
    const btn = document.getElementById("btnFim");
    btn.classList.add("btn-animating-red");
    setTimeout(() => btn.classList.remove("btn-animating-red"), 600);
    
    clearInterval(state.timer);
    
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
      const mensagem = `
        Jogo finalizado!
        
        ${state.nomeA} ${state.placar.A} × ${state.placar.B} ${state.nomeB}
        
        🏆 Craque: ${state.partida.craque}
        
        ⏱️ Duração: ${Math.floor(state.segundos / 60)}:${String(state.segundos % 60).padStart(2, '0')}
      `;
      
      alert(mensagem);
      resetar();
    });
    
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function mostrarOverlay(texto, icone, duracao, callback) {
    const overlay = document.getElementById("gameOverlay");
    document.getElementById("overlayText").textContent = texto;
    document.getElementById("overlayIcon").textContent = icone;
    
    overlay.classList.add("show");
    
    setTimeout(() => {
      overlay.classList.remove("show");
      if (callback) callback();
    }, duracao);
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

  function animarGol() {
  const placar = document.querySelector('.placar');
  placar.classList.add("gol-animation");

  if (navigator.vibrate) {
    navigator.vibrate([100, 50, 100, 50, 100]);
  }

  setTimeout(() => {
    placar.classList.remove("gol-animation");
  }, 600);
}


  function aumentarGol(time) {
    if (!state.partida) {
      showToast('Inicie o jogo primeiro!', 'error');
      return;
    }
    
    state.timeAtual = time;
    document.getElementById('popupTitulo').textContent = 
      `⚽ Gol do ${time === 'A' ? state.nomeA : state.nomeB}! Quem fez?`;
    
    const ranking = obterRankingGeral();
    
    const jogadoresOrdenados = state.jogadores
      .map(jogador => ({ nome: jogador, gols: ranking[jogador] || 0 }))
      .sort((a, b) => b.gols - a.gols);
    
    const popup = document.getElementById('popupJogadores');
    popup.innerHTML = '';
    
    jogadoresOrdenados.forEach(jogador => {
      const button = document.createElement('button');
      button.textContent = jogador.nome;
      button.onclick = () => registrarGol(jogador.nome);
      popup.appendChild(button);
    });
    
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
    } else {
      state.placar.B++;
    }
    
    document.getElementById('placarA').textContent = state.placar.A;
    document.getElementById('placarB').textContent = state.placar.B;
    
    state.historicaGols.push({
      time: state.timeAtual,
      jogador: jogador,
      minuto: Math.floor(state.segundos / 60),
      timestamp: Date.now()
    });
    
    renderGols();
    animarGol();
    fecharPopup();
    showToast(`Gol de ${jogador}!`, 'success');
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
      if (time === 'A') {
        state.placar.A = Math.max(0, state.placar.A - 1);
      } else {
        state.placar.B = Math.max(0, state.placar.B - 1);
      }
      
      document.getElementById('placarA').textContent = state.placar.A;
      document.getElementById('placarB').textContent = state.placar.B;
      return;
    }
    
    const popup = document.getElementById('popupGols');
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
    } else {
      state.placar.B = Math.max(0, state.placar.B - 1);
    }
    
    document.getElementById('placarA').textContent = state.placar.A;
    document.getElementById('placarB').textContent = state.placar.B;
    
    state.historicaGols.splice(index, 1);
    renderGols();
    
    fecharPopupRemover();
    if (navigator.vibrate) navigator.vibrate(15);
    showToast('Gol removido', 'warning');
  }

  function renderGols() {
    const lista = document.getElementById('listaGols');
    
    const golsPorJogador = {};
    state.historicaGols.forEach(gol => {
      if (!golsPorJogador[gol.jogador]) {
        golsPorJogador[gol.jogador] = 0;
      }
      golsPorJogador[gol.jogador]++;
    });
    
    const listaOrdenada = Object.entries(golsPorJogador)
      .sort((a, b) => b[1] - a[1]);
    
    const fragment = document.createDocumentFragment();
    
    listaOrdenada.forEach(([jogador, quantidade]) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = `${jogador} — ${quantidade} gol${quantidade > 1 ? 's' : ''}`;
      li.appendChild(span);
      fragment.appendChild(li);
    });
    
    lista.innerHTML = '';
    lista.appendChild(fragment);
  }

  function registrarFalta(time) {
    if (!state.partida) {
      showToast('Inicie o jogo primeiro!', 'error');
      return;
    }
    
    state.timeAtualFalta = time;
    document.getElementById('popupTituloFalta').textContent = 
      `⚠️ Falta do ${time === 'A' ? state.nomeA : state.nomeB}. Quem fez?`;
    
    const ranking = obterRankingGeral();
    
    const jogadoresOrdenados = state.jogadores
      .map(jogador => ({ nome: jogador, gols: ranking[jogador] || 0 }))
      .sort((a, b) => b.gols - a.gols);
    
    const popup = document.getElementById('popupJogadoresFalta');
    popup.innerHTML = '';
    
    jogadoresOrdenados.forEach(jogador => {
      const button = document.createElement('button');
      button.textContent = jogador.nome;
      button.onclick = () => confirmarFalta(jogador.nome);
      popup.appendChild(button);
    });
    
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
    
    fecharPopupFalta();
    if (navigator.vibrate) navigator.vibrate(10);
    showToast(`Falta de ${jogador}`, 'warning');
  }

  function mostrarUndo() {
    const undoBtn = document.getElementById('undoBtn');
    undoBtn.style.display = 'block';
    
    clearTimeout(state.undoTimer);
    state.undoTimer = setTimeout(() => {
      esconderUndo();
    }, 10000);
  }

  function esconderUndo() {
    document.getElementById('undoBtn').style.display = 'none';
    state.ultimaAcao = null;
  }

  function desfazer() {
    if (!state.ultimaAcao) return;
    
    if (state.ultimaAcao.tipo === "gol") {
      if (state.ultimaAcao.time === 'A') {
        state.placar.A = Math.max(0, state.placar.A - 1);
      } else {
        state.placar.B = Math.max(0, state.placar.B - 1);
      }
      
      document.getElementById('placarA').textContent = state.placar.A;
      document.getElementById('placarB').textContent = state.placar.B;
      
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
    if (navigator.vibrate) navigator.vibrate(15);
    showToast('Ação desfeita', 'success');
  }

  function fecharPopup(event) {
    if (event) event.stopPropagation();
    document.getElementById('popupJogador').classList.remove('show');
    state.timeAtual = null;
  }

  function fecharPopupFalta(event) {
    if (event) event.stopPropagation();
    document.getElementById('popupFalta').classList.remove('show');
    state.timeAtualFalta = null;
  }

  function fecharPopupRemover(event) {
    if (event) event.stopPropagation();
    document.getElementById('popupRemover').classList.remove('show');
  }

  function fecharPopupNome(event) {
    if (event) event.stopPropagation();
    document.getElementById('popupNomeTime').classList.remove('show');
    state.timeEditando = null;
  }

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
    
    // Ranking Geral de Gols
    const rankingGeral = obterRankingGeral();
    const listaGeral = document.getElementById('listaRankingGeral');
    
    if (Object.keys(rankingGeral).length === 0) {
      listaGeral.innerHTML = '<li>Nenhum gol registrado ainda.</li>';
    } else {
      const fragment = document.createDocumentFragment();
      const rankingOrdenado = Object.entries(rankingGeral)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      rankingOrdenado.forEach(([jogador, gols], index) => {
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
        fragment.appendChild(li);
      });
      
      listaGeral.innerHTML = '';
      listaGeral.appendChild(fragment);
    }
    
    // Ranking Mensal - CORRIGIDO!
    const hoje = new Date();
    const mesAtual = hoje.getMonth(); // 0-11
    const anoAtual = hoje.getFullYear();
    
    const partidasMes = historico.filter(partida => {
      try {
        // A data está salva como "DD/MM/YYYY, HH:MM:SS"
        const dataStr = partida.data.split(",")[0].trim();
        const partes = dataStr.split("/");
        
        if (partes.length !== 3) return false;
        
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10); // 1-12
        const ano = parseInt(partes[2], 10);
        
        // Comparar mês e ano (subtrair 1 do mês porque getMonth() retorna 0-11)
        return (mes - 1) === mesAtual && ano === anoAtual;
        
      } catch (error) {
        console.log('Erro ao processar data:', error);
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
    
    if (Object.keys(rankingMes).length === 0) {
      listaMes.innerHTML = `<li>Sem partidas em ${mesAtual + 1}/${anoAtual}</li>`;
    } else {
      const fragment = document.createDocumentFragment();
      const rankingOrdenado = Object.entries(rankingMes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      rankingOrdenado.forEach(([jogador, gols], index) => {
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
        fragment.appendChild(li);
      });
      
      listaMes.innerHTML = '';
      listaMes.appendChild(fragment);
    }
    
    // Ranking de Faltas
    const rankingFaltas = {};
    historico.forEach(partida => {
      if (partida.faltas && partida.faltas.jogadores) {
        Object.entries(partida.faltas.jogadores).forEach(([jogador, faltas]) => {
          rankingFaltas[jogador] = (rankingFaltas[jogador] || 0) + faltas;
        });
      }
    });
    
    const listaFaltas = document.getElementById('listaRankingFaltas');
    
    if (Object.keys(rankingFaltas).length === 0) {
      listaFaltas.innerHTML = '<li>Nenhuma falta registrada ainda.</li>';
    } else {
      const fragment = document.createDocumentFragment();
      const rankingOrdenado = Object.entries(rankingFaltas)
        .sort((a, b) => b[1] - a[1]);
      
      rankingOrdenado.forEach(([jogador, faltas]) => {
        const li = document.createElement('li');
        const spanNome = document.createElement('span');
        spanNome.textContent = jogador;
        
        const spanFaltas = document.createElement('span');
        spanFaltas.textContent = `${faltas} falta${faltas > 1 ? 's' : ''}`;
        
        li.appendChild(spanNome);
        li.appendChild(spanFaltas);
        fragment.appendChild(li);
      });
      
      listaFaltas.innerHTML = '';
      listaFaltas.appendChild(fragment);
    }
  }

  function historico() {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    const lista = document.getElementById('listaHistorico');
    
    if (historico.length === 0) {
      lista.innerHTML = '<div class="card text-center"><p style="color:var(--text-sec)">Nenhuma partida registrada ainda</p></div>';
      return;
    }
    
    const historicoOrdenado = [...historico].reverse();
    const fragment = document.createDocumentFragment();
    
    historicoOrdenado.forEach(partida => {
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
      
      fragment.appendChild(item);
    });
    
    lista.innerHTML = '';
    lista.appendChild(fragment);
  }

  async function limparHistorico() {
    if (await confirmAction("Apagar TODO o histórico? Esta ação não pode ser desfeita.")) {
      localStorage.removeItem("historico");
      historico();
      showToast('Histórico apagado!', 'success');
    }
  }

  function estatisticas() {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    
    // Estatísticas Gerais
    const totalJogos = historico.length;
    let totalGols = 0;
    let totalFaltas = 0;
    
    historico.forEach(partida => {
      Object.values(partida.gols || {}).forEach(dados => {
        totalGols += dados.q;
      });
      
      if (partida.faltas) {
        totalFaltas += (partida.faltas.A || 0) + (partida.faltas.B || 0);
      }
    });
    
    const mediaGols = totalJogos > 0 ? (totalGols / totalJogos).toFixed(1) : '0';
    
    const statsGerais = document.getElementById('statsGerais');
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
    `;
    
    // Últimas 5 Partidas
    const ultimas5 = historico.slice(-5).reverse();
    const golsRecentes = {};
    
    ultimas5.forEach(partida => {
      Object.entries(partida.gols || {}).forEach(([jogador, dados]) => {
        golsRecentes[jogador] = (golsRecentes[jogador] || 0) + dados.q;
      });
    });
    
    const statsRecentes = document.getElementById('statsRecentes');
    
    if (Object.keys(golsRecentes).length === 0) {
      statsRecentes.innerHTML = '<p style="color:var(--text-sec);text-align:center">Nenhuma partida recente</p>';
    } else {
      const fragment = document.createDocumentFragment();
      const rankingRecentes = Object.entries(golsRecentes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      
      rankingRecentes.forEach(([jogador, gols]) => {
        const div = document.createElement('div');
        div.className = 'stat-row';
        
        const label = document.createElement('span');
        label.className = 'stat-label';
        label.textContent = jogador;
        
        const value = document.createElement('span');
        value.className = 'stat-value';
        value.innerHTML = `${gols} gol${gols > 1 ? 's' : ''} <span class="badge">🔥</span>`;
        
        div.appendChild(label);
        div.appendChild(value);
        fragment.appendChild(div);
      });
      
      statsRecentes.innerHTML = '';
      statsRecentes.appendChild(fragment);
    }
    
    // Estatísticas por Jogador
    const statsPorJogador = {};
    
    state.jogadores.forEach(jogador => {
      let jogosComGols = 0;
      let totalGolsJogador = 0;
      let totalFaltasJogador = 0;
      let vitorias = 0;
      let derrotas = 0;
      let empates = 0;
      
      historico.forEach(partida => {
        const dadosGol = partida.gols && partida.gols[jogador];
        
        if (dadosGol) {
          jogosComGols++;
          totalGolsJogador += dadosGol.q;
          
          const placar = partida.placar;
          const timeJogador = dadosGol.t;
          const placarTime = placar[timeJogador === 'A' ? 0 : 1];
          const placarAdversario = placar[timeJogador === 'A' ? 1 : 0];
          
          if (placarTime > placarAdversario) {
            vitorias++;
          } else if (placarTime < placarAdversario) {
            derrotas++;
          } else {
            empates++;
          }
        }
        
        if (partida.faltas && partida.faltas.jogadores) {
          totalFaltasJogador += partida.faltas.jogadores[jogador] || 0;
        }
      });
      
      if (jogosComGols > 0) {
        const media = (totalGolsJogador / jogosComGols).toFixed(1);
        const aproveitamento = Math.round((vitorias / jogosComGols) * 100);
        
        statsPorJogador[jogador] = {
          jogos: jogosComGols,
          gols: totalGolsJogador,
          faltas: totalFaltasJogador,
          vitorias: vitorias,
          derrotas: derrotas,
          empates: empates,
          media: media,
          aproveitamento: isNaN(aproveitamento) ? 0 : aproveitamento
        };
      }
    });
    
    const container = document.getElementById('statsPorJogador');
    container.innerHTML = '';
    
    if (Object.keys(statsPorJogador).length === 0) {
      container.innerHTML = '<p style="color:var(--text-sec);text-align:center">Nenhum jogador com estatísticas</p>';
    } else {
      const fragment = document.createDocumentFragment();
      const ranking = Object.entries(statsPorJogador)
        .sort((a, b) => b[1].gols - a[1].gols);
      
      ranking.forEach(([jogador, stats]) => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        
        card.innerHTML = `
          <h4>${escapeHTML(jogador)}</h4>
          <div class="stat-row">
            <span class="stat-label">Jogos</span>
            <span class="stat-value">${stats.jogos}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Gols</span>
            <span class="stat-value">${stats.gols} (${stats.media}/jogo)</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Aproveitamento</span>
            <span class="stat-value">
              ${stats.aproveitamento}% 
              <span class="badge ${stats.aproveitamento >= 60 ? '' : 'warning'}">
                ${stats.vitorias}V ${stats.empates}E ${stats.derrotas}D
              </span>
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${stats.aproveitamento}%"></div>
          </div>
          <div class="stat-row">
            <span class="stat-label">Faltas</span>
            <span class="stat-value">${stats.faltas}</span>
          </div>
        `;
        
        fragment.appendChild(card);
      });
      
      container.appendChild(fragment);
    }
    
    // Gerar gráfico
    gerarGrafico();
  }

  function gerarGrafico() {
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    const container = document.getElementById('graficoEvolucao');
    
    if (historico.length < 2) {
      container.innerHTML = '<p style="color:var(--text-sec);text-align:center">Mínimo de 2 partidas necessário</p>';
      return;
    }
    
    const ranking = obterRankingGeral();
    const top3 = Object.entries(ranking)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (top3.length === 0) {
      container.innerHTML = '<p style="color:var(--text-sec);text-align:center">Sem dados</p>';
      return;
    }
    
    const dados = {};
    top3.forEach(([jogador]) => {
      dados[jogador] = [];
      let acumulado = 0;
      
      historico.forEach(partida => {
        if (partida.gols && partida.gols[jogador]) {
          acumulado += partida.gols[jogador].q;
        }
        dados[jogador].push(acumulado);
      });
    });
    
    const largura = Math.min(600, window.innerWidth - 60);
    const altura = 200;
    const margem = 40;
    const maxValor = Math.max(...Object.values(dados).flat());
    
    const escalaY = (valor) => altura - margem - (valor / maxValor) * (altura - 2 * margem);
    const escalaX = (index, total) => margem + (index / (total - 1)) * (largura - 2 * margem);
    
    const cores = ["#0fb858", "#2196f3", "#ffa502"];
    
    let svg = `<svg width="${largura}" height="${altura}" style="font-family:Arial;font-size:12px">`;
    
    for (let i = 0; i <= maxValor; i += Math.ceil(maxValor / 5)) {
      const y = escalaY(i);
      svg += `<line x1="${margem}" y1="${y}" x2="${largura - 20}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
      svg += `<text x="${margem - 10}" y="${y + 5}" text-anchor="end" fill="var(--text-sec)">${i}</text>`;
    }
    
    top3.forEach(([jogador], index) => {
      const pontos = dados[jogador];
      let path = `M ${escalaX(0, pontos.length)} ${escalaY(pontos[0])}`;
      
      pontos.forEach((valor, idx) => {
        if (idx > 0) {
          path += ` L ${escalaX(idx, pontos.length)} ${escalaY(valor)}`;
        }
      });
      
      svg += `<path d="${path}" stroke="${cores[index]}" stroke-width="2" fill="none"/>`;
      
      pontos.forEach((valor, idx) => {
        svg += `<circle cx="${escalaX(idx, pontos.length)}" cy="${escalaY(valor)}" r="4" fill="${cores[index]}"/>`;
      });
    });
    
    top3.forEach(([jogador], index) => {
      svg += `<rect x="${largura - 150}" y="${20 + 20 * index}" width="15" height="3" fill="${cores[index]}"/>`;
      svg += `<text x="${largura - 130}" y="${25 + 20 * index}" fill="var(--text)">${jogador}</text>`;
    });
    
    svg += `</svg>`;
    container.innerHTML = svg;
  }

  function carregarComparacao() {
    const select1 = document.getElementById('jogador1');
    const select2 = document.getElementById('jogador2');
    
    select1.innerHTML = '<option value="">Selecione jogador 1</option>';
    select2.innerHTML = '<option value="">Selecione jogador 2</option>';
    
    state.jogadores.forEach(jogador => {
      select1.innerHTML += `<option value="${escapeHTML(jogador)}">${escapeHTML(jogador)}</option>`;
      select2.innerHTML += `<option value="${escapeHTML(jogador)}">${escapeHTML(jogador)}</option>`;
    });
  }

  function compararJogadores() {
    const jogador1 = document.getElementById('jogador1').value;
    const jogador2 = document.getElementById('jogador2').value;
    const resultado = document.getElementById('resultadoComparacao');
    
    if (!jogador1 || !jogador2) {
      showToast('Selecione 2 jogadores', 'error');
      return;
    }
    
    if (jogador1 === jogador2) {
      showToast('Selecione jogadores diferentes', 'error');
      return;
    }
    
    const historico = JSON.parse(localStorage.getItem("historico")) || [];
    
    function calcularEstatisticas(nome) {
      let jogos = 0;
      let gols = 0;
      let faltas = 0;
      let vitorias = 0;
      
      historico.forEach(partida => {
        const dadosGol = partida.gols && partida.gols[nome];
        
        if (dadosGol) {
          jogos++;
          gols += dadosGol.q;
          
          const placar = partida.placar;
          const timeJogador = dadosGol.t;
          const placarTime = placar[timeJogador === 'A' ? 0 : 1];
          const placarAdversario = placar[timeJogador === 'A' ? 1 : 0];
          
          if (placarTime > placarAdversario) vitorias++;
        }
        
        if (partida.faltas && partida.faltas.jogadores) {
          faltas += partida.faltas.jogadores[nome] || 0;
        }
      });
      
      return {
        jogos: jogos,
        gols: gols,
        faltas: faltas,
        media: jogos > 0 ? (gols / jogos).toFixed(1) : '0',
        aprov: jogos > 0 ? Math.round((vitorias / jogos) * 100) : 0
      };
    }
    
    const stats1 = calcularEstatisticas(jogador1);
    const stats2 = calcularEstatisticas(jogador2);
    
    resultado.innerHTML = `
      <div class="comparacao-container">
        <div class="jogador-compare">
          <h3>${escapeHTML(jogador1)}</h3>
          <div class="compare-stat">
            <div class="compare-stat-label">Gols</div>
            <div class="compare-stat-value" style="color:${stats1.gols >= stats2.gols ? 'var(--green)' : 'var(--text-sec)'}">
              ${stats1.gols}
            </div>
          </div>
          <div class="compare-stat">
            <div class="compare-stat-label">Média</div>
            <div class="compare-stat-value" style="color:${parseFloat(stats1.media) >= parseFloat(stats2.media) ? 'var(--green)' : 'var(--text-sec)'}">
              ${stats1.media}
            </div>
          </div>
          <div class="compare-stat">
            <div class="compare-stat-label">Aproveitamento</div>
            <div class="compare-stat-value" style="color:${stats1.aprov >= stats2.aprov ? 'var(--green)' : 'var(--text-sec)'}">
              ${stats1.aprov}%
            </div>
          </div>
          <div class="compare-stat">
            <div class="compare-stat-label">Faltas</div>
            <div class="compare-stat-value" style="color:${stats1.faltas <= stats2.faltas ? 'var(--green)' : 'var(--yellow)'}">
              ${stats1.faltas}
            </div>
          </div>
        </div>
        <div class="compare-vs">VS</div>
        <div class="jogador-compare">
          <h3>${escapeHTML(jogador2)}</h3>
          <div class="compare-stat">
            <div class="compare-stat-label">Gols</div>
            <div class="compare-stat-value" style="color:${stats2.gols >= stats1.gols ? 'var(--green)' : 'var(--text-sec)'}">
              ${stats2.gols}
            </div>
          </div>
          <div class="compare-stat">
            <div class="compare-stat-label">Média</div>
            <div class="compare-stat-value" style="color:${parseFloat(stats2.media) >= parseFloat(stats1.media) ? 'var(--green)' : 'var(--text-sec)'}">
              ${stats2.media}
            </div>
          </div>
          <div class="compare-stat">
            <div class="compare-stat-label">Aproveitamento</div>
            <div class="compare-stat-value" style="color:${stats2.aprov >= stats1.aprov ? 'var(--green)' : 'var(--text-sec)'}">
              ${stats2.aprov}%
            </div>
          </div>
          <div class="compare-stat">
            <div class="compare-stat-label">Faltas</div>
            <div class="compare-stat-value" style="color:${stats2.faltas <= stats1.faltas ? 'var(--green)' : 'var(--yellow)'}">
              ${stats2.faltas}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function configurarPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredPrompt = e;
      
      const installBtn = document.getElementById('installBtn');
      installBtn.style.display = 'block';
      
      setTimeout(() => {
        if (installBtn.style.display === 'block') {
          installBtn.style.display = 'none';
        }
      }, 30000);
    });
    
    window.addEventListener('appinstalled', () => {
      console.log('PWA instalado!');
      document.getElementById('installBtn').style.display = 'none';
      state.deferredPrompt = null;
      showToast('App instalado com sucesso!', 'success');
    });
    
    if (window.matchMedia('(display-mode: standalone)').matches) {
      document.getElementById('installBtn').style.display = 'none';
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
        }
        
        state.deferredPrompt = null;
        document.getElementById('installBtn').style.display = 'none';
      });
    } else {
      showToast('App já instalado ou navegador não suporta', 'info');
    }
  }

  function init() {
    carregarTema();
    carregarNomesTimes();
    renderJogadores();
    configurarPWA();
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('Service Worker registrado com sucesso!'))
        .catch(err => console.log('Erro no Service Worker:', err));
    }
    
    console.log('PlacarApp inicializado com sucesso!');
  }

  // === NOVA FUNÇÃO: Backup de dados ===
function verificarBackupDados() {
  const backupKey = 'placar_backup_v1';
  const currentData = {
    jogadores: localStorage.getItem("jogadores"),
    historico: localStorage.getItem("historico"),
    nomes: {
      timeA: localStorage.getItem("nomeTimeA"),
      timeB: localStorage.getItem("nomeTimeB")
    },
    theme: localStorage.getItem("theme"),
    lastBackup: new Date().toISOString()
  };
  
  // Fazer backup
  localStorage.setItem(backupKey, JSON.stringify(currentData));
  console.log('Backup realizado:', currentData.lastBackup);
  
  // Verificar se precisa restaurar
  const mainJogadores = localStorage.getItem("jogadores");
  const mainHistorico = localStorage.getItem("historico");
  
  const precisaRestaurar = 
    !mainJogadores || 
    mainJogadores === '[]' || 
    mainJogadores === 'null' ||
    mainJogadores === '' ||
    (!mainHistorico || mainHistorico === '[]' || mainHistorico === 'null');
  
  if (precisaRestaurar) {
    const backup = localStorage.getItem(backupKey);
    if (backup) {
      try {
        const parsed = JSON.parse(backup);
        let restaurouAlgo = false;
        
        if (parsed.jogadores && parsed.jogadores !== 'null' && parsed.jogadores !== '[]') {
          localStorage.setItem("jogadores", parsed.jogadores);
          restaurouAlgo = true;
        }
        
        if (parsed.historico && parsed.historico !== 'null' && parsed.historico !== '[]') {
          localStorage.setItem("historico", parsed.historico);
          restaurouAlgo = true;
        }
        
        if (parsed.nomes.timeA) {
          localStorage.setItem("nomeTimeA", parsed.nomes.timeA);
        }
        
        if (parsed.nomes.timeB) {
          localStorage.setItem("nomeTimeB", parsed.nomes.timeB);
        }
        
        if (parsed.theme) {
          localStorage.setItem("theme", parsed.theme);
        }
        
        if (restaurouAlgo) {
          console.log('Dados restaurados do backup!');
          showToast('Dados restaurados do backup automático', 'success');
        }
      } catch (e) {
        console.log('Erro ao restaurar backup:', e);
      }
    }
  }
}

// === MODIFICAR a função init() ===
// Encontre a função init() no seu app.js (por volta da linha ~900)
// E adicione a linha de verificação de backup:

function init() {
  carregarTema();
  carregarNomesTimes();
  renderJogadores();
  configurarPWA();
  
  // === NOVO: VERIFICAR BACKUP DE DADOS ===
  verificarBackupDados();
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=3')
      .then(() => console.log('Service Worker v3 registrado!'))
      .catch(err => console.log('Erro no Service Worker:', err));
  }
  
  console.log('PlacarApp inicializado com sucesso!');
}

  return {
    init: init,
    toggleTheme: toggleTheme,
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
    instalarApp: instalarApp,
    getState: () => ({ ...state })
  };
})();

document.addEventListener('DOMContentLoaded', PlacarApp.init);

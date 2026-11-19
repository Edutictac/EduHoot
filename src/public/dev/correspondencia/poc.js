// Prueba de concepto de la pregunta de correspondencia (feature 7, «emparejar»).
// Maqueta independiente: no usa el servidor ni el código de partida.
(function(){
  var BANK = [
    ['Francia','París'],['Italia','Roma'],['Alemania','Berlín'],['Portugal','Lisboa'],
    ['Grecia','Atenas'],['Austria','Viena'],['Suecia','Estocolmo'],['Polonia','Varsovia']
  ];
  var IMPOSTORS = ['Oslo','Praga','Dublín','Bruselas','Ámsterdam','Budapest'];
  var LETTERS = 'ABCDEFGH';
  var PAIR_COLORS = ['--p1','--p2','--p3','--p4','--p5','--p6','--p7','--p8'];
  var TIME = 40;

  var state = { view:'student', pairs:5, imp:2, show:true, blindStyle: 'codes', game:null };

  var selPairs = document.getElementById('opt-pairs');
  var selImp = document.getElementById('opt-imp');
  var selBlind = document.getElementById('opt-blind');
  var chkShow = document.getElementById('opt-show');
  var stage = document.getElementById('stage');
  var notes = document.getElementById('notes');

  for(var i=2;i<=8;i++) selPairs.add(new Option(String(i), String(i)));
  selPairs.value = String(state.pairs);
  function fillImp(){
    var max = 8 - state.pairs; selImp.innerHTML = '';
    for(var i=0;i<=max;i++) selImp.add(new Option(String(i), String(i)));
    if(state.imp > max) state.imp = max;
    selImp.value = String(state.imp);
  }
  fillImp();

  function shuffle(a){ a=a.slice(); for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function pairColor(i){ return 'var(' + PAIR_COLORS[i % PAIR_COLORS.length] + ')'; }

  // Un tablero por móvil: lo que el alumno ha emparejado, lo que tiene seleccionado y su resultado.
  function newBoard(n){ return { answers: Array.from({length:n}, function(){ return null; }), selected:null, sent:null, step:0 }; }

  // Igual que el servidor: izquierda en orden fijo, derecha barajada; solución = índice de la derecha.
  function newGame(){
    var pairs = BANK.slice(0, state.pairs).map(function(p){ return { left:p[0], right:p[1] }; });
    shuffle(IMPOSTORS).slice(0, state.imp).forEach(function(r){ pairs.push({ left:'', right:r }); });
    var domain = pairs.map(function(_, i){ return i; });
    var order = shuffle(domain);
    if(order.every(function(v,i){ return v===i; })) order = domain.slice(1).concat(domain[0]);
    var right = order.map(function(i){ return pairs[i].right; });
    var left = [], solution = [];
    pairs.forEach(function(p, i){ if(!p.left) return; left.push(p.left); solution.push(order.indexOf(i)); });
    var impostor = right.map(function(_, i){ return solution.indexOf(i) === -1; });
    // Clase simulada: 24 alumnos, cada pareja con su propio porcentaje de acierto.
    var rates = solution.map(function(){ return 0.45 + Math.random()*0.5; });
    var students = Array.from({length:24}, function(){ return rates.map(function(p){ return Math.random() < p; }); });
    var classHits = solution.map(function(_, i){ return students.filter(function(s){ return s[i]; }).length / 24; });
    var full = students.filter(function(s){ return s.every(Boolean); }).length;
    var none = students.filter(function(s){ return !s.some(Boolean); }).length;
    state.game = {
      left:left, right:right, solution:solution, impostor:impostor,
      classHits:classHits, classSummary:{ full:full, partial:24 - full - none, none:none },
      student:newBoard(left.length), blind:newBoard(left.length), timeLeft:TIME
    };
  }
  function boardOf(view){ return view === 'blind' ? state.game.blind : state.game.student; }

  // ---------- Emparejar (común a todos los modos) ----------
  // Cada derecha solo puede estar en una pareja: si ya lo estaba, pasa a la nueva.
  function link(b, l, r){
    var prev = b.answers.indexOf(r);
    if(prev !== -1) b.answers[prev] = null;
    b.answers[l] = r; b.selected = null;
  }
  // Toques: izquierda y luego derecha, o al revés. Tocar una pareja hecha la deshace.
  function tap(b, side, idx){
    if(b.sent) return;
    var sel = b.selected;
    if(sel && sel.side !== side){
      if(side === 'left') link(b, idx, sel.idx); else link(b, sel.idx, idx);
      return;
    }
    if(sel && sel.idx === idx){ b.selected = null; return; }
    if(side === 'left' && b.answers[idx] !== null) b.answers[idx] = null;
    if(side === 'right'){ var owner = b.answers.indexOf(idx); if(owner !== -1) b.answers[owner] = null; }
    b.selected = { side:side, idx:idx };
  }
  function nextEmpty(b, from){
    var n = b.answers.length;
    for(var k=1;k<=n;k++){ var i = (from + k) % n; if(b.answers[i] === null) return i; }
    return from;
  }

  function score(answers){
    var g = state.game, hits = 0;
    g.solution.forEach(function(v, i){ if(answers[i] === v) hits++; });
    return { hits:hits, total:g.solution.length, ratio: hits / g.solution.length };
  }

  // ---------- Vistas ----------
  function stats(){
    return '<div class="stats"><span>Marta</span><span>Puntos: 2.350</span></div>' +
      '<div class="timebar" aria-hidden="true"><i style="width:' + (state.game.timeLeft / TIME * 100) + '%"></i></div>';
  }
  function footer(b){
    var done = b.answers.filter(function(a){ return a !== null; }).length;
    return '<div class="footer-bar"><span class="count">' + done + ' de ' + b.answers.length + ' emparejadas</span>' +
      '<button class="send" type="button" data-act="send"' + (done ? '' : ' disabled') + '>Enviar</button></div>';
  }
  function resultView(b){
    var g = state.game, res = b.sent;
    var kind = res.ratio === 1 ? 'correct' : (res.ratio > 0 ? 'partial' : 'incorrect');
    var title = kind === 'correct' ? '¡Correcto!' : (kind === 'partial' ? 'Parcialmente correcta' : 'Incorrecta');
    var pts = Math.round(820 * res.ratio);
    var html = '<div class="result" data-kind="' + kind + '" role="status">' +
      '<p class="big">' + title + '</p>' +
      '<p class="sub">' + res.hits + ' de ' + res.total + ' parejas</p>' +
      '<span class="pts">+' + pts + ' puntos</span>';
    if(state.show && kind !== 'correct'){
      html += '<div class="review">';
      g.left.forEach(function(l, i){
        var a = b.answers[i], ok = a === g.solution[i];
        html += '<div class="row"><span class="mark">' + (ok ? '✓' : '✗') + '</span><span><b>' + esc(l) + '</b> → ' +
          (a === null ? '<i>sin emparejar</i>' : esc(g.right[a])) +
          (ok ? '' : '<span class="fix">Correcta: ' + esc(g.right[g.solution[i]]) + '</span>') + '</span></div>';
      });
      html += '</div>';
    }
    html += '<button class="ghost" type="button" data-act="retry">Volver a la pregunta</button></div>';
    return html;
  }
  function phone(inner, b){
    return '<div class="phone"><div class="phone-inner">' + stats() + inner + footer(b) + '</div>' +
      (b.sent ? resultView(b) : '') + '</div>';
  }

  // Dos columnas de botones. Con `texts`, el texto de cada elemento; sin él, solo los códigos.
  // `attr` distingue el modo normal (data-left/right) del a ciegas (data-bleft/bright).
  function columns(b, texts, attr){
    var g = state.game;
    var html = '<div class="cols' + (texts ? '' : ' codes-only') + '"><div class="col"><h3>' + (texts ? 'Países' : 'Números') + '</h3>';
    g.left.forEach(function(l, i){
      var a = b.answers[i], sel = b.selected && b.selected.side === 'left' && b.selected.idx === i;
      html += '<button type="button" class="item' + (a !== null ? ' paired' : '') + (sel ? ' selected' : '') + '" data-' + attr + 'left="' + i + '"' +
        (a !== null ? ' style="background:' + pairColor(i) + '"' : '') + ' aria-pressed="' + sel + '">' +
        '<span class="code">' + (i+1) + '</span>' + (texts ? '<span class="txt">' + esc(l) + '</span>' : '') +
        (a !== null ? '<span class="tag">' + LETTERS[a] + '</span>' : '') + '</button>';
    });
    html += '</div><div class="col"><h3>' + (texts ? 'Capitales' : 'Letras') + '</h3>';
    g.right.forEach(function(r, j){
      var owner = b.answers.indexOf(j), sel = b.selected && b.selected.side === 'right' && b.selected.idx === j;
      html += '<button type="button" class="item' + (owner !== -1 ? ' paired' : '') + (sel ? ' selected' : '') + '" data-' + attr + 'right="' + j + '"' +
        (owner !== -1 ? ' style="background:' + pairColor(owner) + '"' : '') + ' aria-pressed="' + sel + '">' +
        '<span class="code">' + LETTERS[j] + '</span>' + (texts ? '<span class="txt">' + esc(r) + '</span>' : '') +
        (owner !== -1 ? '<span class="tag">' + (owner+1) + '</span>' : '') + '</button>';
    });
    return html + '</div></div>';
  }

  function studentView(){
    var b = state.game.student;
    return phone('<p class="qtext">Relaciona cada país con su capital</p>' +
      '<p class="hint">Toca un país y después su capital. Toca una pareja para deshacerla.</p>' +
      columns(b, true, ''), b);
  }

  // A ciegas, opción 1: un desplegable de letras por cada número.
  function blindSelect(b){
    var g = state.game;
    var html = '<div class="sel-list">';
    g.left.forEach(function(_, i){
      var a = b.answers[i];
      html += '<label class="sel-row" for="bsel-' + i + '"><span class="num" style="background:' + pairColor(i) + '">' + (i+1) + '</span>' +
        '<select id="bsel-' + i + '" data-bsel="' + i + '"' + (b.sent ? ' disabled' : '') + '><option value="">Elige una letra</option>';
      g.right.forEach(function(_, j){
        var owner = b.answers.indexOf(j);
        var note = owner !== -1 && owner !== i ? ' (ahora en el ' + (owner+1) + ')' : '';
        html += '<option value="' + j + '"' + (a === j ? ' selected' : '') + '>' + LETTERS[j] + note + '</option>';
      });
      html += '</select></label>';
    });
    return html + '</div>';
  }

  // A ciegas, opción 3: un número cada vez y botones grandes de letras; al elegir, pasa al siguiente.
  function blindSteps(b){
    var g = state.game, i = b.step;
    var html = '<div class="steps"><div class="step-now"><span class="num big-num" style="background:' + pairColor(i) + '">' + (i+1) + '</span>' +
      '<span>¿Qué letra va con el <b>' + (i+1) + '</b>?</span></div><div class="letters">';
    g.right.forEach(function(_, j){
      var owner = b.answers.indexOf(j);
      html += '<button type="button" class="letter' + (owner === i ? ' on' : '') + '" data-bstep="' + j + '"' +
        (owner !== -1 ? ' style="background:' + pairColor(owner) + '"' : '') + ' aria-pressed="' + (owner === i) + '">' +
        LETTERS[j] + (owner !== -1 && owner !== i ? '<small>' + (owner+1) + '</small>' : '') + '</button>';
    });
    html += '</div><div class="chips" aria-label="Parejas">';
    g.left.forEach(function(_, k){
      var a = b.answers[k];
      html += '<button type="button" class="chip' + (k === i ? ' current' : '') + '" data-bgo="' + k + '">' + (k+1) + ' → ' + (a === null ? '?' : LETTERS[a]) + '</button>';
    });
    return html + '</div></div>';
  }

  function blindView(){
    var b = state.game.blind, body;
    if(state.blindStyle === 'codes') body = columns(b, false, 'b');
    else if(state.blindStyle === 'steps') body = blindSteps(b);
    else body = blindSelect(b);
    var hint = state.blindStyle === 'codes' ? 'Toca un número y después su letra.'
      : (state.blindStyle === 'steps' ? 'Elige la letra de cada número. Toca abajo una pareja para cambiarla.' : 'Elige en cada número la letra de su pareja.');
    return phone('<p class="qtext">Mira la pregunta en la pantalla</p><p class="hint">' + hint + '</p>' + body, b);
  }

  function projectorView(withResults){
    var g = state.game;
    var html = '<div class="projector"><div class="pj-top"><span>Pregunta 4 de 10</span>' +
      (withResults ? '<span>Resultados</span>' : '<span class="pj-timer">' + g.timeLeft + '</span>') + '</div>' +
      '<p class="pj-q">Relaciona cada país con su capital</p><div class="pj-cols"><div class="pj-col">';
    g.left.forEach(function(l, i){
      if(withResults){
        var pct = Math.round(g.classHits[i] * 100);
        var right = state.show ? ' → ' + LETTERS[g.solution[i]] + ' ' + esc(g.right[g.solution[i]]) : '';
        html += '<div class="pj-item pj-bar"><span class="fill" style="width:' + pct + '%"></span><span class="code">' + (i+1) + '</span><span>' + esc(l) + right + '</span><span class="pct">' + pct + '%</span></div>';
      }else{
        html += '<div class="pj-item"><span class="code">' + (i+1) + '</span><span>' + esc(l) + '</span></div>';
      }
    });
    html += '</div><div class="pj-col">';
    g.right.forEach(function(r, j){
      var imp = withResults && state.show && g.impostor[j];
      html += '<div class="pj-item' + (imp ? ' is-impostor' : '') + '"><span class="code">' + LETTERS[j] + '</span><span>' + esc(r) + (imp ? ' <small>(sin pareja)</small>' : '') + '</span></div>';
    });
    html += '</div></div><div class="pj-foot">' +
      (withResults ? '<span>Todo bien: ' + g.classSummary.full + ' · parcial: ' + g.classSummary.partial + ' · ninguna: ' + g.classSummary.none + ' (de 24)</span><span>Porcentaje de alumnos que aciertan cada pareja</span>'
                   : '<span>Respuestas: 17 de 24</span><span>PIN 482 913</span>') +
      '</div></div>';
    return html;
  }

  var NOTES = {
    student: ['Cada pareja toma un color (nunca verde, naranja ni rojo, que son los del resultado) y además muestra el código de su compañera, para no depender solo del color.',
      'Se puede empezar por cualquiera de las dos columnas. Tocar una pareja hecha la deshace.',
      'Se puede enviar sin completar todas las parejas: puntúan las acertadas.',
      'Resultado: verde si todas están bien, naranja (con texto oscuro, por contraste) si solo algunas, rojo si ninguna. Con «Mostrar respuestas» se ve la corrección.'],
    blind: {
      select: ['Desplegables: una fila por número, con el menú nativo del móvil. Dos toques por pareja y poco espacio en pantalla.',
        'Si eliges una letra que ya estaba en otro número, pasa a este (el menú lo avisa).'],
      codes: ['Toques con códigos: el mismo gesto que con la pregunta visible, pero los botones solo llevan números y letras.',
        'Ventaja: el alumnado aprende un único gesto para los dos modos.'],
      steps: ['Paso a paso: un número cada vez, con botones grandes; al elegir una letra pasa al siguiente número libre.',
        'Las fichas de abajo resumen las parejas y permiten volver a una para cambiarla.']
    },
    projector: ['El proyector numera la izquierda (1–8) y pone letras a la derecha (A–H): los mismos códigos que ve el alumnado.',
      'Con 8 parejas el texto se reduce; las frases largas tendrán que caber en dos líneas.'],
    results: ['Para cada pareja, el porcentaje de la clase que la ha acertado (datos simulados).',
      'Con «Mostrar respuestas» desactivado no se muestra la solución ni se marcan las impostoras.']
  };

  function render(){
    if(state.view === 'student') stage.innerHTML = studentView();
    else if(state.view === 'blind') stage.innerHTML = blindView();
    else stage.innerHTML = projectorView(state.view === 'results');
    var list = state.view === 'blind' ? NOTES.blind[state.blindStyle] : NOTES[state.view];
    notes.innerHTML = '<h2>Qué mirar en esta vista</h2><ul>' + list.map(function(n){ return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
  }

  stage.addEventListener('click', function(e){
    var el = e.target.closest('button'); if(!el) return;
    var d = el.dataset, b;
    if(d.left !== undefined) tap(state.game.student, 'left', Number(d.left));
    else if(d.right !== undefined) tap(state.game.student, 'right', Number(d.right));
    else if(d.bleft !== undefined) tap(state.game.blind, 'left', Number(d.bleft));
    else if(d.bright !== undefined) tap(state.game.blind, 'right', Number(d.bright));
    else if(d.bstep !== undefined){
      b = state.game.blind; if(b.sent) return;
      var j = Number(d.bstep);
      if(b.answers[b.step] === j) b.answers[b.step] = null;
      else { link(b, b.step, j); b.step = nextEmpty(b, b.step); }
    }
    else if(d.bgo !== undefined) state.game.blind.step = Number(d.bgo);
    else if(d.act === 'send'){ b = boardOf(state.view); b.sent = score(b.answers); }
    else if(d.act === 'retry'){ boardOf(state.view).sent = null; }
    else return;
    render();
  });
  stage.addEventListener('change', function(e){
    var el = e.target;
    if(el.dataset.bsel === undefined) return;
    var b = state.game.blind, i = Number(el.dataset.bsel);
    if(el.value === '') b.answers[i] = null; else link(b, i, Number(el.value));
    render();
  });

  document.querySelectorAll('.tab').forEach(function(t){
    t.addEventListener('click', function(){
      state.view = t.dataset.view;
      document.querySelectorAll('.tab').forEach(function(x){ x.setAttribute('aria-selected', String(x === t)); });
      render();
    });
  });
  selPairs.addEventListener('change', function(){ state.pairs = Number(selPairs.value); fillImp(); newGame(); render(); });
  selImp.addEventListener('change', function(){ state.imp = Number(selImp.value); newGame(); render(); });
  selBlind.addEventListener('change', function(){ state.blindStyle = selBlind.value; state.game.blind = newBoard(state.game.left.length); render(); });
  chkShow.addEventListener('change', function(){ state.show = chkShow.checked; render(); });
  document.getElementById('btn-reset').addEventListener('click', function(){ newGame(); render(); });

  // Temporizador decorativo: se reinicia al llegar a 0; no envía nada.
  setInterval(function(){
    var g = state.game; if(!g) return;
    if(state.view !== 'projector' && boardOf(state.view).sent) return;
    g.timeLeft = g.timeLeft > 0 ? g.timeLeft - 1 : TIME;
    var bar = stage.querySelector('.timebar > i'); if(bar) bar.style.width = (g.timeLeft / TIME * 100) + '%';
    var tm = stage.querySelector('.pj-timer'); if(tm) tm.textContent = g.timeLeft;
  }, 1000);

  // Para las pruebas de navegador (test/browser/matching-poc.spec.js).
  window.matchingPoc = { state: state, newGame: function(){ newGame(); render(); } };

  newGame();
  render();
})();

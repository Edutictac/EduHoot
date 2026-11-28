// Prueba de concepto de la pantalla del anfitrión (sala y partida).
// Maqueta independiente: no usa el servidor ni el código de partida. Textos en texts.js.
(function(){
  var i18n = PocI18n(window.ANFITRION_TEXTS);
  var t = i18n.t;
  var ICONS = ['🐱','🦊','🐼','🐸','🦉','🐙','🦄','🐢','🦁','🐧'];
  var NAMES = ['Lluna','Pau','Marta','Biel','Aitana','Hugo','Noa','Jan','Carla','Dídac','Irene','Òscar'];

  var state = { view:'lobby', layout:'a', help:'both', matching:true, width:'desk' };
  var o = defaults();
  function defaults(){ return { randQ:false, randA:true, send:true, scores:true, answers:true, streak:true, names:'typed',
    auto:0, time:'', extra:50, blind:'codes', hostSec:'', playerSec:'', cleanupSec:'', inactMin:'' }; }
  var players = [], kickPending = null, nameSeq = 0, timer = null;
  var game = { q:1, total:12, left:20, paused:false, answered:0 };

  var stage = document.getElementById('stage');
  var notes = document.getElementById('notes');
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  // ----- Ayuda: tooltip nativo (title) y/o icono «?» -----
  function titleAttr(key){ return (state.help !== 'icon') ? ' title="' + esc(t('tip_' + key)) + '"' : ''; }
  function helpIcon(key){
    if(state.help === 'title') return '';
    return '<span class="help"><button type="button" data-help="' + key + '" aria-expanded="false" aria-label="' + esc(t('helpAria')) + '">?</button>' +
      '<span class="pop" role="note" hidden>' + esc(t('tip_' + key)) + '</span></span>';
  }

  // ----- Controles -----
  function chk(key, label){
    return '<label class="opt"' + titleAttr(key) + '><input type="checkbox" data-o="' + key + '"' + (o[key] ? ' checked' : '') + ' id="o-' + key + '"> <span>' + label + '</span>' + helpIcon(key) + '</label>';
  }
  function sel(key, label, options){
    return '<label class="opt"' + titleAttr(key) + '><span>' + label + '</span>' + helpIcon(key) +
      '<select class="grow" data-o="' + key + '" id="o-' + key + '">' + options.map(function(op){
        return '<option value="' + op[0] + '"' + (String(o[key]) === String(op[0]) ? ' selected' : '') + '>' + op[1] + '</option>'; }).join('') + '</select></label>';
  }
  function names(){
    return '<fieldset class="opt" id="o-names"' + titleAttr('names') + '><legend>' + t('optNames') + ' ' + helpIcon('names') + '</legend>' +
      ['typed','random'].map(function(v){ return '<label><input type="radio" name="names" data-o="names" value="' + v + '"' + (o.names === v ? ' checked' : '') + (players.length ? ' disabled' : '') + '> ' + (v === 'typed' ? t('namesTyped') : t('namesRandom')) + '</label>'; }).join('') +
      (players.length ? '<small>' + t('namesLocked') + '</small>' : '') + '</fieldset>';
  }
  function autoOptions(){ var opts = [[0, t('autoManual')]]; for(var n=3;n<=20;n++) opts.push([n, n + ' s']); return opts; }
  function autoSel(){ return sel('auto', t('optAuto'), autoOptions()); }
  function timeInput(){
    return '<div class="opt"' + titleAttr('time') + '><label class="opt" for="o-time"><span>' + t('optTime') + '</span></label>' + helpIcon('time') +
      '<input type="number" min="5" max="120" placeholder="' + esc(t('timeAuto')) + '" id="o-time" data-o="time" value="' + esc(o.time) + '"></div>';
  }
  function extraChoices(){ return [25,50,75,100].map(function(p){ return [p, '+' + p + ' %']; }); }
  function extraSel(){ return state.matching ? sel('extra', t('optExtra'), extraChoices()) : ''; }
  function blindSel(){
    return (state.matching && !o.send) ? sel('blind', t('optBlind'), [['codes', t('blindCodes')], ['select', t('blindSelect')], ['steps', t('blindSteps')]]) : '';
  }
  function advanced(){
    function num(k, label, ph){ return '<label class="opt"><span>' + label + '</span><input type="number" placeholder="' + ph + '" data-o="' + k + '" value="' + esc(o[k]) + '"></label>'; }
    return '<details class="adv"><summary' + titleAttr('advanced') + '>' + t('advanced') + ' ' + helpIcon('advanced') + '</summary>' +
      num('hostSec', t('tHost'), 30) + num('playerSec', t('tPlayer'), 40) + num('cleanupSec', t('tCleanup'), 100) + num('inactMin', t('tInact'), 30) + '</details>';
  }
  function sendCheck(){ return chk('send', t('optSend')); }

  function optionsHTML(){
    if(state.layout === 'a'){
      return '<div class="opts" id="opts">' +
        '<div class="group" role="group" aria-labelledby="g1"><h3 class="group-title" id="g1">' + t('groupChecks') + '</h3>' +
          chk('randQ', t('optRandQ')) + chk('randA', t('optRandA')) + sendCheck() + chk('scores', t('optScores')) + chk('answers', t('optAnswers')) + chk('streak', t('optStreak')) + '</div>' +
        '<div class="group" role="group" aria-labelledby="g2"><h3 class="group-title" id="g2">' + t('groupValues') + '</h3>' +
          names() + autoSel() + timeInput() + extraSel() + blindSel() + '</div>' + advanced() + '</div>';
    }
    return '<div class="opts" id="opts"><div class="cards">' +
      '<section class="card"><h3>👀 ' + t('gCardQ') + '</h3>' + sendCheck() + chk('answers', t('optAnswers')) + blindSel() + '</section>' +
      '<section class="card"><h3>🏆 ' + t('gCardScore') + '</h3>' + chk('scores', t('optScores')) + chk('streak', t('optStreak')) + '</section>' +
      '<section class="card"><h3>❓ ' + t('gCardQuestions') + '</h3>' + chk('randQ', t('optRandQ')) + chk('randA', t('optRandA')) + timeInput() + extraSel() + '</section>' +
      '<section class="card"><h3>👥 ' + t('gCardPace') + '</h3>' + autoSel() + names() + '</section>' +
      '</div>' + advanced() + '</div>';
  }

  // ----- Sala -----
  function lobbyHTML(){
    var pl = players.length ? players.map(function(p, i){
      return '<div class="player"><span class="ico">' + p.icon + '</span><span>' + esc(p.name) + '</span>' +
        '<button type="button" class="kick' + (kickPending === i ? ' is-confirm' : '') + '" data-kick="' + i + '">' + (kickPending === i ? t('kickConfirm') : t('kick')) + '</button></div>'; }).join('')
      : '<p class="empty">' + t('nobody') + '</p>';
    return '<div class="screen" data-w="' + state.width + '">' +
      '<div class="join-cta"><div class="logo" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
        '<div class="join-text"><p class="quiz-name">' + t('quizName') + '</p><h2>' + t('joinTitle') + '</h2>' +
          '<div class="pin"><small>PIN</small><b>48213</b></div></div>' +
        '<div class="qr">' + t('scanQr') + '<div class="code"></div>eduhoot.edutictac.es</div></div>' +
          '<div class="join-url-row"><code class="join-url">' + esc(JOIN_URL) + '</code>' +
          '<button type="button" class="copy-url" id="btn-copy-url" title="' + t('copyUrl') + '" aria-label="' + t('copyUrl') + '"><span class="cu-ico" aria-hidden="true">🔗</span><span class="cu-txt">' + t('copyUrl') + '</span></button></div>' +
      '<div class="players">' + pl + '</div>' +
      '<button type="button" class="ghost btn-sim" id="btn-join">' + t('simJoin') + '</button>' +
      optionsHTML() +
      '<div class="actions"><button type="button" class="btn-cancel">' + t('cancel') + '</button><button type="button" class="btn-start" id="btn-start">' + t('start') + '</button></div></div>';
  }

  // ----- Partida -----
  function gameHTML(){
    var extra = state.matching ? '<label' + titleAttr('extra') + '>' + t('optExtraShort') + ' <select data-o="extra" id="g-extra">' +
      [25,50,75,100].map(function(p){ return '<option value="' + p + '"' + (o.extra === p ? ' selected' : '') + '>+' + p + ' %</option>'; }).join('') + '</select>' + helpIcon('extra') + '</label>' : '';
    var autoOpts = autoOptions().map(function(op){ return '<option value="' + op[0] + '"' + (o.auto === op[0] ? ' selected' : '') + '>' + op[1] + '</option>'; }).join('');
    var answers = [['▲','a1'],['◆','a2'],['●','a3'],['■','a4']].map(function(a){ return '<div class="ans">' + a[0] + ' ' + t(a[1]) + '</div>'; }).join('');
    return '<div class="screen" data-w="' + state.width + '">' +
      '<div class="host-top"><span class="pin-badge">PIN 48213</span><div class="mid"><p>' + t('quizName') + '</p></div><button type="button" class="ghost" aria-label="' + esc(t('fullscreen')) + '">⛶</button></div>' +
      '<h4 class="qnum">' + t('qNum', { n: game.q, total: game.total }) + '</h4>' +
      '<div class="rowc"><label' + titleAttr('auto') + '>' + t('optAuto') + ' <select data-o="auto" id="g-auto">' + autoOpts + '</select>' + helpIcon('auto') + '</label>' + extra +
        '<label class="right"' + titleAttr('scores') + '>' + t('scoresLabel') + ' <input type="checkbox" data-o="scores"' + (o.scores ? ' checked' : '') + '>' + helpIcon('scores') + '</label></div>' +
      '<div class="toprow"><button type="button" class="b-skip">' + t('skip') + '</button><button type="button" class="b-cancel">' + t('cancel') + '</button><button type="button" class="b-next">' + (o.scores ? t('top10') : t('next')) + '</button></div>' +
      '<p class="answered" id="answered">' + t('answered', { n: game.answered, total: Math.max(players.length, 1) }) + '</p>' +
      '<p class="timer">' + t('timeLeft') + ' <b id="tleft">' + game.left + '</b></p>' +
      '<div class="timer-ctl"><button type="button" id="t-pause">' + (game.paused ? t('resume') : t('pause')) + '</button><button type="button" id="t-add">' + t('plus15') + '</button></div>' +
      '<h3 class="question">' + t('question') + '</h3><div class="answers">' + answers + '</div></div>';
  }

  function render(){
    var active = document.activeElement && document.activeElement.id;
    stage.innerHTML = state.view === 'lobby' ? lobbyHTML() : gameHTML();
    if(active){ var el = document.getElementById(active); if(el && el.focus) el.focus(); }
    var lines = state.view === 'lobby' ? ['n1','n2','n3','n4'] : ['g1','g2'];
    notes.innerHTML = '<h2>' + t('notesTitle') + '</h2><ul>' + lines.map(function(k){ return '<li>' + t(k) + '</li>'; }).join('') + '</ul>';
  }

  // ----- Eventos (delegados) -----
  stage.addEventListener('change', function(e){
    var el = e.target, k = el.getAttribute('data-o'); if(!k) return;
    if(el.type === 'checkbox') o[k] = el.checked;
    else if(['auto','extra'].indexOf(k) !== -1) o[k] = parseInt(el.value, 10);
    else o[k] = el.value;
    render();
  });
  stage.addEventListener('click', function(e){
    var el = e.target.closest('button'); if(!el) return;
    if(el.getAttribute('data-help')){ e.preventDefault(); toggleHelp(el); return; }
    if(el.id === 'btn-copy-url'){ copyJoinUrl(el); return; }
    if(el.id === 'btn-join'){ players.push({ name: NAMES[nameSeq % NAMES.length], icon: ICONS[nameSeq % ICONS.length] }); nameSeq++; render(); return; }
    if(el.hasAttribute('data-kick')){
      var i = parseInt(el.getAttribute('data-kick'), 10);
      if(kickPending === i){ players.splice(i, 1); kickPending = null; } else { kickPending = i; setTimeout(function(){ kickPending = null; if(state.view === 'lobby') render(); }, 4000); }
      render(); return; }
    if(el.id === 'btn-start'){ startGame(); return; }
    if(el.id === 't-pause'){ game.paused = !game.paused; render(); return; }
    if(el.id === 't-add'){ game.left += 15; render(); return; }
  });
  var JOIN_URL = 'https://eduhoot.edutictac.es/join.html?pin=48213';
  var copyTimer = null;
  // Icona i text separats: en mòbil i tauleta només es veu la icona; el text queda al títol.
  function setCopyState(btn, done){
    btn.querySelector('.cu-ico').textContent = done ? '✅' : '🔗';
    btn.querySelector('.cu-txt').textContent = done ? t('copyUrlDone') : t('copyUrl');
    btn.title = done ? t('copyUrlDone') : t('copyUrl');
    btn.setAttribute('aria-label', done ? t('copyUrlDone') : t('copyUrl'));
  }
  function copyJoinUrl(btn){
    var done = function(){
      setCopyState(btn, true);
      clearTimeout(copyTimer);
      copyTimer = setTimeout(function(){ setCopyState(btn, false); }, 2000);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(JOIN_URL).then(done, done); } else { done(); }
  }
  function closeHelp(){ stage.querySelectorAll('.help > button[aria-expanded="true"]').forEach(function(b){ b.setAttribute('aria-expanded','false'); b.nextElementSibling.hidden = true; }); }
  function toggleHelp(btn){
    var open = btn.getAttribute('aria-expanded') === 'true'; closeHelp();
    if(!open){ btn.setAttribute('aria-expanded','true'); btn.nextElementSibling.hidden = false; }
  }
  document.addEventListener('click', function(e){ if(!e.target.closest('.help')) closeHelp(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeHelp(); });

  function startGame(){
    state.view = 'game'; game = { q:1, total:12, left:20, paused:false, answered:0 };
    syncTabs(); render(); clearInterval(timer);
    timer = setInterval(function(){
      if(state.view !== 'game' || game.paused) return;
      game.left = Math.max(0, game.left - 1);
      if(game.answered < Math.max(players.length, 1) && Math.random() < 0.5) game.answered++;
      var a = document.getElementById('answered'), l = document.getElementById('tleft');
      if(a) a.textContent = t('answered', { n: game.answered, total: Math.max(players.length, 1) });
      if(l) l.textContent = game.left;
    }, 1000);
  }

  // ----- Controles de la maqueta -----
  function syncTabs(){ document.querySelectorAll('.tab').forEach(function(b){ b.setAttribute('aria-selected', String(b.getAttribute('data-view') === state.view)); }); }
  document.querySelectorAll('.tab').forEach(function(b){ b.addEventListener('click', function(){ state.view = b.getAttribute('data-view'); if(state.view === 'game' && !timer) startGame(); syncTabs(); render(); }); });
  document.getElementById('opt-layout').addEventListener('change', function(e){ state.layout = e.target.value; render(); });
  document.getElementById('opt-help').addEventListener('change', function(e){ state.help = e.target.value; render(); });
  document.getElementById('opt-matching').addEventListener('change', function(e){ state.matching = e.target.checked; render(); });
  document.getElementById('opt-width').addEventListener('change', function(e){ state.width = e.target.value; render(); });
  document.getElementById('btn-reset').addEventListener('click', function(){ o = defaults(); players = []; nameSeq = 0; clearInterval(timer); timer = null; state.view = 'lobby'; syncTabs(); render(); });
  i18n.onChange(render);

  render();
})();

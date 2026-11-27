// Traducciones y selector de idioma de la página de promoción (/promo/).
// Usa EduhootLang (languages.js) para detectar, guardar y pintar los botones.
(function(){
    var TEXTS = {
 "es": {
  "nav_modes": "Modos de juego",
  "nav_types": "Preguntas",
  "nav_teachers": "Para docentes",
  "nav_free": "Software libre",
  "login": "Entrar",
  "play_now": "Jugar ahora",
  "eyebrow": "Aprender jugando",
  "h1": "Que el aula\nno se quede\nsin ganas.",
  "enter_pin": "Entrar con un PIN",
  "t_mc": "Opción múltiple",
  "q_capital": "¿Capital de Francia?",
  "a_paris": "París",
  "t_order": "Ordenar",
  "q_order": "Ordena de menor a mayor",
  "t_tf": "Verdadero / Falso",
  "q_flat": "La Tierra es plana",
  "a_false": "✕ Falso",
  "t_match": "Emparejar",
  "q_match": "Une cada país con su capital",
  "m_h2": "Tanto si das clase como si estudias solo, hay un modo para ti.",
  "m_p": "Crea un cuestionario en minutos, juega con toda la clase desde cualquier dispositivo o déjalo como deberes. Sin cuentas para el alumnado y sin publicidad.",
  "create_quiz": "Crear un cuestionario",
  "tile1": "Jugar en el aula",
  "tile1s": "Con PIN, en directo",
  "tile2": "Jugar solo",
  "tile2s": "A tu ritmo, sin prisa",
  "tile3": "Multijugador",
  "tile3s": "Compite con amistades",
  "s_h3": "Cada pregunta, a su manera",
  "s_p": "Opción múltiple, verdadero o falso, respuesta corta, numérica, emparejar u ordenar. Con imágenes y vídeo, y con el tiempo que quieras darle.",
  "s_link": "Ver el creador →",
  "c_tf": "Verdadero/Falso",
  "c_short": "Respuesta corta",
  "c_num": "Numérica",
  "c_video": "Vídeo",
  "c_img": "Imagen",
  "d1_h3": "Importa lo que ya tienes",
  "d1_p": "Trae tus cuestionarios de Moodle (XML o GIFT) o de CSV y empieza a jugar el mismo día. Exporta cuando quieras.",
  "d1_link": "Importar un fichero →",
  "d2_h3": "Deberes y resultados",
  "d2_p": "Envía un enlace como tarea asíncrona y consulta la clasificación y los aciertos por pregunta de cada partida.",
  "d2_link": "Ver deberes →",
  "quote_p": "«Mi clase pidió repetir la partida. Es la primera vez que me piden repasar.»",
  "quote_who": "Docente de Secundaria",
  "quote_note": "· testimonio de ejemplo, sustitúyelo por uno real",
  "cta_h2": "Libre, gratuito y tuyo",
  "cta_p": "Código abierto bajo AGPL-3.0. Puedes instalarlo en tu centro o usarlo en la web, también como app instalable.",
  "see_code": "Ver el código",
  "f_service": "Un servicio de EduTicTac",
  "f_play": "Jugar",
  "f_solo": "Solo",
  "f_teachers": "Profesorado",
  "f_privacy": "Privacidad",
  "f_cookies": "Cookies",
  "x_h3": "Y además…",
  "x1": "Ranking y podio",
  "x2": "Mano alzada",
  "x3": "Lectura en voz alta",
  "x4": "Resultados por pregunta",
  "x5": "Enlace de entrada con el PIN",
  "x6": "Repaso con tarjetas",
  "f_source": "Código fuente"
 },
 "ca": {
  "nav_modes": "Modes de joc",
  "nav_types": "Preguntes",
  "nav_teachers": "Per a docents",
  "nav_free": "Programari lliure",
  "login": "Entrar",
  "play_now": "Jugar ara",
  "eyebrow": "Aprendre jugant",
  "h1": "Que l'aula\nno es quede\nsense ganes.",
  "enter_pin": "Entrar amb un PIN",
  "t_mc": "Opció múltiple",
  "q_capital": "Capital de França?",
  "a_paris": "París",
  "t_order": "Ordenar",
  "q_order": "Ordena de menor a major",
  "t_tf": "Veritat / Fals",
  "q_flat": "La Terra és plana",
  "a_false": "✕ Fals",
  "t_match": "Emparellar",
  "q_match": "Uneix cada país amb la capital",
  "m_h2": "Tant si fas classe com si estudies sol, hi ha un mode per a tu.",
  "m_p": "Crea un qüestionari en minuts, juga amb tota la classe des de qualsevol dispositiu o deixa'l com a deures. Sense comptes per a l'alumnat i sense publicitat.",
  "create_quiz": "Crear un qüestionari",
  "tile1": "Jugar a l'aula",
  "tile1s": "Amb PIN, en directe",
  "tile2": "Jugar sol",
  "tile2s": "Al teu ritme, sense pressa",
  "tile3": "Multijugador",
  "tile3s": "Competix amb amistats",
  "s_h3": "Cada pregunta, a la seua manera",
  "s_p": "Opció múltiple, vertader o fals, resposta curta, numèrica, emparellar o ordenar. Amb imatges i vídeo, i amb el temps que vulgues donar-hi.",
  "s_link": "Veure el creador →",
  "c_tf": "Veritat/Fals",
  "c_short": "Resposta curta",
  "c_num": "Numèrica",
  "c_video": "Vídeo",
  "c_img": "Imatge",
  "d1_h3": "Importa el que ja tens",
  "d1_p": "Porta els teus qüestionaris de Moodle (XML o GIFT) o de CSV i comença a jugar el mateix dia. Exporta quan vulgues.",
  "d1_link": "Importar un fitxer →",
  "d2_h3": "Deures i resultats",
  "d2_p": "Envia un enllaç com a tasca asíncrona i consulta la classificació i els encerts per pregunta de cada partida.",
  "d2_link": "Veure deures →",
  "quote_p": "«La meua classe va demanar repetir la partida. És la primera vegada que em demanen repassar.»",
  "quote_who": "Docent de Secundària",
  "quote_note": "· testimoni d'exemple, substitueix-lo per un de real",
  "cta_h2": "Lliure, gratuït i teu",
  "cta_p": "Codi obert sota AGPL-3.0. Pots instal·lar-lo al teu centre o usar-lo al web, també com a app instal·lable.",
  "see_code": "Veure el codi",
  "f_service": "Un servei d'EduTicTac",
  "f_play": "Jugar",
  "f_solo": "Sol",
  "f_teachers": "Professorat",
  "f_privacy": "Privacitat",
  "f_cookies": "Galetes",
  "x_h3": "I a més…",
  "x1": "Rànquing i podi",
  "x2": "Mà alçada",
  "x3": "Lectura en veu alta",
  "x4": "Resultats per pregunta",
  "x5": "Enllaç d'entrada amb el PIN",
  "x6": "Repàs amb targetes",
  "f_source": "Codi font"
 },
 "va": {
  "nav_modes": "Modes de joc",
  "nav_types": "Preguntes",
  "nav_teachers": "Per a docents",
  "nav_free": "Programari lliure",
  "login": "Entrar",
  "play_now": "Jugar ara",
  "eyebrow": "Aprendre jugant",
  "h1": "Que l'aula\nno es quede\nsense ganes.",
  "enter_pin": "Entrar amb un PIN",
  "t_mc": "Opció múltiple",
  "q_capital": "Capital de França?",
  "a_paris": "París",
  "t_order": "Ordenar",
  "q_order": "Ordena de menor a major",
  "t_tf": "Veritat / Fals",
  "q_flat": "La Terra és plana",
  "a_false": "✕ Fals",
  "t_match": "Emparellar",
  "q_match": "Uneix cada país amb la capital",
  "m_h2": "Tant si fas classe com si estudies sol, hi ha un mode per a tu.",
  "m_p": "Crea un qüestionari en minuts, juga amb tota la classe des de qualsevol dispositiu o deixa'l com a deures. Sense comptes per a l'alumnat i sense publicitat.",
  "create_quiz": "Crear un qüestionari",
  "tile1": "Jugar a l'aula",
  "tile1s": "Amb PIN, en directe",
  "tile2": "Jugar sol",
  "tile2s": "Al teu ritme, sense pressa",
  "tile3": "Multijugador",
  "tile3s": "Competix amb amistats",
  "s_h3": "Cada pregunta, a la seua manera",
  "s_p": "Opció múltiple, vertader o fals, resposta curta, numèrica, emparellar o ordenar. Amb imatges i vídeo, i amb el temps que vulgues donar-hi.",
  "s_link": "Veure el creador →",
  "c_tf": "Veritat/Fals",
  "c_short": "Resposta curta",
  "c_num": "Numèrica",
  "c_video": "Vídeo",
  "c_img": "Imatge",
  "d1_h3": "Importa el que ja tens",
  "d1_p": "Porta els teus qüestionaris de Moodle (XML o GIFT) o de CSV i comença a jugar el mateix dia. Exporta quan vulgues.",
  "d1_link": "Importar un fitxer →",
  "d2_h3": "Deures i resultats",
  "d2_p": "Envia un enllaç com a tasca asíncrona i consulta la classificació i els encerts per pregunta de cada partida.",
  "d2_link": "Veure deures →",
  "quote_p": "«La meua classe va demanar repetir la partida. És la primera vegada que em demanen repassar.»",
  "quote_who": "Docent de Secundària",
  "quote_note": "· testimoni d'exemple, substituïx-lo per un de real",
  "cta_h2": "Lliure, gratuït i teu",
  "cta_p": "Codi obert sota AGPL-3.0. Pots instal·lar-lo al teu centre o usar-lo al web, també com a app instal·lable.",
  "see_code": "Veure el codi",
  "f_service": "Un servei d'EduTicTac",
  "f_play": "Jugar",
  "f_solo": "Sol",
  "f_teachers": "Professorat",
  "f_privacy": "Privacitat",
  "f_cookies": "Galetes",
  "x_h3": "I a més…",
  "x1": "Rànquing i podi",
  "x2": "Mà alçada",
  "x3": "Lectura en veu alta",
  "x4": "Resultats per pregunta",
  "x5": "Enllaç d'entrada amb el PIN",
  "x6": "Repàs amb targetes",
  "f_source": "Codi font"
 },
 "en": {
  "nav_modes": "Game modes",
  "nav_types": "Questions",
  "nav_teachers": "For teachers",
  "nav_free": "Free software",
  "login": "Log in",
  "play_now": "Play now",
  "eyebrow": "Learn by playing",
  "h1": "Keep your\nclassroom\nfull of energy.",
  "enter_pin": "Join with a PIN",
  "t_mc": "Multiple choice",
  "q_capital": "Capital of France?",
  "a_paris": "Paris",
  "t_order": "Order",
  "q_order": "Sort from smallest to largest",
  "t_tf": "True / False",
  "q_flat": "The Earth is flat",
  "a_false": "✕ False",
  "t_match": "Match",
  "q_match": "Match each country with its capital",
  "m_h2": "Whether you teach a class or study alone, there is a mode for you.",
  "m_p": "Create a quiz in minutes, play with the whole class from any device, or set it as homework. No student accounts and no ads.",
  "create_quiz": "Create a quiz",
  "tile1": "Play in class",
  "tile1s": "With a PIN, live",
  "tile2": "Play solo",
  "tile2s": "At your own pace",
  "tile3": "Multiplayer",
  "tile3s": "Compete with friends",
  "s_h3": "Every question, its own way",
  "s_p": "Multiple choice, true or false, short answer, numeric, matching or ordering. With images and video, and as much time as you want to give.",
  "s_link": "See the creator →",
  "c_tf": "True/False",
  "c_short": "Short answer",
  "c_num": "Numeric",
  "c_video": "Video",
  "c_img": "Image",
  "d1_h3": "Import what you already have",
  "d1_p": "Bring your Moodle (XML or GIFT) or CSV quizzes and start playing the same day. Export whenever you like.",
  "d1_link": "Import a file →",
  "d2_h3": "Homework and results",
  "d2_p": "Send a link as an asynchronous task and check the ranking and correct answers per question for each game.",
  "d2_link": "See homework →",
  "quote_p": "\"My class asked to play again. It's the first time they've asked to review.\"",
  "quote_who": "Secondary school teacher",
  "quote_note": "· sample testimonial, replace it with a real one",
  "cta_h2": "Free, open and yours",
  "cta_p": "Open source under AGPL-3.0. Install it at your school or use it on the web, also as an installable app.",
  "see_code": "View the code",
  "f_service": "A service by EduTicTac",
  "f_play": "Play",
  "f_solo": "Solo",
  "f_teachers": "Teachers",
  "f_privacy": "Privacy",
  "f_cookies": "Cookies",
  "x_h3": "And also…",
  "x1": "Ranking and podium",
  "x2": "Raise a hand",
  "x3": "Read aloud",
  "x4": "Results per question",
  "x5": "Join link with the PIN",
  "x6": "Flashcard review",
  "f_source": "Source code"
 },
 "fr": {
  "nav_modes": "Modes de jeu",
  "nav_types": "Questions",
  "nav_teachers": "Pour les enseignants",
  "nav_free": "Logiciel libre",
  "login": "Se connecter",
  "play_now": "Jouer maintenant",
  "eyebrow": "Apprendre en jouant",
  "h1": "Que la classe\nne manque\njamais d'énergie.",
  "enter_pin": "Entrer avec un PIN",
  "t_mc": "Choix multiple",
  "q_capital": "Capitale de la France ?",
  "a_paris": "Paris",
  "t_order": "Ordre",
  "q_order": "Classe du plus petit au plus grand",
  "t_tf": "Vrai / Faux",
  "q_flat": "La Terre est plate",
  "a_false": "✕ Faux",
  "t_match": "Association",
  "q_match": "Associe chaque pays à sa capitale",
  "m_h2": "Que tu enseignes à une classe ou que tu étudies seul, il y a un mode pour toi.",
  "m_p": "Crée un quiz en quelques minutes, joue avec toute la classe depuis n'importe quel appareil ou donne-le en devoir. Sans compte pour les élèves et sans publicité.",
  "create_quiz": "Créer un quiz",
  "tile1": "Jouer en classe",
  "tile1s": "Avec un PIN, en direct",
  "tile2": "Jouer seul",
  "tile2s": "À ton rythme, sans pression",
  "tile3": "Multijoueur",
  "tile3s": "Affronte tes amis",
  "s_h3": "Chaque question, à sa manière",
  "s_p": "Choix multiple, vrai ou faux, réponse courte, numérique, association ou ordre. Avec images et vidéo, et le temps que tu veux donner.",
  "s_link": "Voir le créateur →",
  "c_tf": "Vrai/Faux",
  "c_short": "Réponse courte",
  "c_num": "Numérique",
  "c_video": "Vidéo",
  "c_img": "Image",
  "d1_h3": "Importe ce que tu as déjà",
  "d1_p": "Apporte tes quiz Moodle (XML ou GIFT) ou CSV et commence à jouer le jour même. Exporte quand tu veux.",
  "d1_link": "Importer un fichier →",
  "d2_h3": "Devoirs et résultats",
  "d2_p": "Envoie un lien comme tâche asynchrone et consulte le classement et les bonnes réponses par question pour chaque partie.",
  "d2_link": "Voir les devoirs →",
  "quote_p": "« Ma classe a demandé à rejouer la partie. C'est la première fois qu'ils demandent à réviser. »",
  "quote_who": "Enseignant de collège",
  "quote_note": "· témoignage d'exemple, remplace-le par un vrai",
  "cta_h2": "Libre, gratuit et à toi",
  "cta_p": "Code ouvert sous AGPL-3.0. Installe-le dans ton établissement ou utilise-le sur le web, aussi comme application installable.",
  "see_code": "Voir le code",
  "f_service": "Un service d'EduTicTac",
  "f_play": "Jouer",
  "f_solo": "Seul",
  "f_teachers": "Enseignants",
  "f_privacy": "Confidentialité",
  "f_cookies": "Cookies",
  "f_source": "Code source",
  "x_h3": "Et aussi…",
  "x1": "Classement et podium",
  "x2": "Main levée",
  "x3": "Lecture à voix haute",
  "x4": "Résultats par question",
  "x5": "Lien d'entrée avec le PIN",
  "x6": "Révision avec des cartes mémoire"
 }
};
    var lang = 'es';

    function apply(){
        var dict = TEXTS[lang] || TEXTS.es;
        document.documentElement.lang = lang === 'va' ? 'ca-valencia' : lang;
        document.querySelectorAll('[data-i18n]').forEach(function(el){
            var v = dict[el.getAttribute('data-i18n')];
            if(v !== undefined) el.textContent = v;
        });
        document.querySelectorAll('#lang-switcher button[data-lang]').forEach(function(b){
            var on = b.getAttribute('data-lang') === lang;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    function set(next){
        lang = TEXTS[next] ? next : 'es';
        if(window.EduhootLang) window.EduhootLang.persist(lang);
        apply();
    }

    if(window.EduhootLang) lang = window.EduhootLang.init({ fallback: 'es' });
    if(!TEXTS[lang]) lang = 'es';
    document.addEventListener('click', function(e){
        var b = e.target.closest && e.target.closest('#lang-switcher button[data-lang]');
        if(b) set(b.getAttribute('data-lang'));
    });
    apply();
})();

// Animaciones al hacer clic: las tarjetas «se responden» y las etiquetas se marcan.
(function(){
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var colors = ['#fdbc4b', '#45a3e5', '#66bf39', '#eb670f', '#ff3355'];
    function burst(x, y){
        if(reduce) return;
        for(var i = 0; i < 14; i++){
            var d = document.createElement('span');
            d.className = 'burst';
            var a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 60;
            d.style.cssText = 'left:' + x + 'px;top:' + y + 'px;background:' + colors[i % colors.length] +
                ';--dx:' + Math.cos(a) * r + 'px;--dy:' + Math.sin(a) * r + 'px;--r:' + (Math.random() * 360) + 'deg';
            document.body.appendChild(d);
            setTimeout(function(el){ el.remove(); }.bind(null, d), 900);
        }
    }
    document.addEventListener('click', function(e){
        var card = e.target.closest && e.target.closest('.card');
        var chip = e.target.closest && e.target.closest('.chips span');
        if(card){
            card.classList.toggle('done');
            if(card.classList.contains('done')) burst(e.clientX, e.clientY);
        }
        if(chip){
            chip.classList.remove('on');
            void chip.offsetWidth;
            chip.classList.toggle('on', !chip.dataset.on);
            chip.dataset.on = chip.dataset.on ? '' : '1';
            if(chip.dataset.on) burst(e.clientX, e.clientY);
        }
    });
    // Las tarjetas decorativas ahora responden al clic: se exponen como botones.
    document.querySelectorAll('.card').forEach(function(c){ c.removeAttribute('aria-hidden'); c.setAttribute('role', 'button'); c.tabIndex = 0;
        c.addEventListener('keydown', function(e){ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); c.click(); } }); });
})();

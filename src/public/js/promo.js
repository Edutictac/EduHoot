// Traducciones y selector de idioma de la página de promoción (portada, /).
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
  "h1": "Que el aula\nno se quede\nsin ganas",
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
  "quote_note": "Testimonios de ejemplo: se sustituirán por reales.",
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
  "f_source": "Código fuente",
  "quick_start": "Inicio rápido",
  "tile4": "Acceso profesorado",
  "tile4s": "Crea y lanza tus cuestionarios",
  "install_app": "Instalar app",
  "q1_p": "«Mi clase pidió repetir la partida. Es la primera vez que me piden repasar.»",
  "q1_w": "Docente de Secundaria",
  "q2_p": "«Importé mis cuestionarios de Moodle en cinco minutos y esa misma tarde jugamos en clase.»",
  "q2_w": "Profesora de Matemáticas",
  "q3_p": "«Me gusta jugar solo para practicar antes del examen. Sé qué preguntas fallo.»",
  "q3_w": "Alumna de 3.º de ESO",
  "carousel_prev": "Anterior",
  "carousel_next": "Siguiente",
  "q4_p": "«Las tarjetas me dejan repasar justo lo que no sé. Con cinco minutos al día noto la diferencia.»",
  "q4_w": "Alumno de 4.º de ESO",
  "q5_p": "«Con las preguntas de ordenar, la línea del tiempo de Historia la ordena el alumnado, no yo.»",
  "q5_w": "Docente de Ciencias Sociales",
  "q6_p": "«Las preguntas de correspondencia me permiten unir conceptos y definiciones sin inventar trucos.»",
  "q6_w": "Profesor de Lengua",
  "hero_solo": "Solo"
 },
 "ca": {
  "nav_modes": "Modes de joc",
  "nav_types": "Preguntes",
  "nav_teachers": "Per a docents",
  "nav_free": "Programari lliure",
  "login": "Entrar",
  "play_now": "Jugar ara",
  "eyebrow": "Aprendre jugant",
  "h1": "Que l'aula\nno es quede\nsense ganes",
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
  "quote_note": "Testimonis d'exemple: se substituiran per reals.",
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
  "f_source": "Codi font",
  "quick_start": "Inici ràpid",
  "tile4": "Accés professorat",
  "tile4s": "Crea i llança els teus qüestionaris",
  "install_app": "Instal·lar app",
  "q1_p": "«La meua classe va demanar repetir la partida. És la primera vegada que em demanen repassar.»",
  "q1_w": "Docent de Secundària",
  "q2_p": "«Vaig importar els meus qüestionaris de Moodle en cinc minuts i eixa mateixa vesprada vam jugar a classe.»",
  "q2_w": "Professora de Matemàtiques",
  "q3_p": "«M'agrada jugar sol per a practicar abans de l'examen. Sé quines preguntes falle.»",
  "q3_w": "Alumna de 3r d'ESO",
  "carousel_prev": "Anterior",
  "carousel_next": "Següent",
  "q4_p": "«Les targetes em deixen repassar just el que no sé. Amb cinc minuts al dia noto la diferència.»",
  "q4_w": "Alumne de 4t d'ESO",
  "q5_p": "«Amb les preguntes d'ordenar, la línia del temps d'Història l'ordena l'alumnat, no jo.»",
  "q5_w": "Docent de Ciències Socials",
  "q6_p": "«Les preguntes de correspondència em permeten unir conceptes i definicions sense inventar trucs.»",
  "q6_w": "Professor de Llengua",
  "hero_solo": "En solitari"
 },
 "va": {
  "nav_modes": "Modes de joc",
  "nav_types": "Preguntes",
  "nav_teachers": "Per a docents",
  "nav_free": "Programari lliure",
  "login": "Entrar",
  "play_now": "Jugar ara",
  "eyebrow": "Aprendre jugant",
  "h1": "Que l'aula\nno es quede\nsense ganes",
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
  "quote_note": "Testimonis d'exemple: se substituiran per reals.",
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
  "f_source": "Codi font",
  "quick_start": "Inici ràpid",
  "tile4": "Accés professorat",
  "tile4s": "Crea i llança els teus qüestionaris",
  "install_app": "Instal·lar app",
  "q1_p": "«La meua classe va demanar repetir la partida. És la primera vegada que em demanen repassar.»",
  "q1_w": "Docent de Secundària",
  "q2_p": "«Vaig importar els meus qüestionaris de Moodle en cinc minuts i eixa mateixa vesprada vam jugar a classe.»",
  "q2_w": "Professora de Matemàtiques",
  "q3_p": "«M'agrada jugar sol per a practicar abans de l'examen. Sé quines preguntes falle.»",
  "q3_w": "Alumna de 3r d'ESO",
  "carousel_prev": "Anterior",
  "carousel_next": "Següent",
  "q4_p": "«Les targetes em deixen repassar just el que no sé. Amb cinc minuts al dia noto la diferència.»",
  "q4_w": "Alumne de 4t d'ESO",
  "q5_p": "«Amb les preguntes d'ordenar, la línia del temps d'Història l'ordena l'alumnat, no jo.»",
  "q5_w": "Docent de Ciències Socials",
  "q6_p": "«Les preguntes de correspondència em permeten unir conceptes i definicions sense inventar trucs.»",
  "q6_w": "Professor de Llengua",
  "hero_solo": "A soles"
 },
 "en": {
  "nav_modes": "Game modes",
  "nav_types": "Questions",
  "nav_teachers": "For teachers",
  "nav_free": "Free software",
  "login": "Log in",
  "play_now": "Play now",
  "eyebrow": "Learn by playing",
  "h1": "Keep your\nclassroom\nfull of energy",
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
  "quote_note": "Sample testimonials: they will be replaced with real ones.",
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
  "f_source": "Source code",
  "quick_start": "Quick start",
  "tile4": "Teacher access",
  "tile4s": "Create and launch your quizzes",
  "install_app": "Install app",
  "q1_p": "\"My class asked to play again. It's the first time they've asked to review.\"",
  "q1_w": "Secondary school teacher",
  "q2_p": "\"I imported my Moodle quizzes in five minutes and we played in class that same afternoon.\"",
  "q2_w": "Maths teacher",
  "q3_p": "\"I like playing solo to practise before the exam. I know which questions I get wrong.\"",
  "q3_w": "3rd-year secondary student",
  "carousel_prev": "Previous",
  "carousel_next": "Next",
  "q4_p": "\"Flashcards let me review exactly what I don't know. With five minutes a day I notice the difference.\"",
  "q4_w": "4th-year secondary student",
  "q5_p": "\"With ordering questions, the students put the History timeline in order, not me.\"",
  "q5_w": "Social studies teacher",
  "q6_p": "\"Matching questions let me pair concepts and definitions without inventing workarounds.\"",
  "q6_w": "Language teacher",
  "hero_solo": "Solo"
 },
 "fr": {
  "nav_modes": "Modes de jeu",
  "nav_types": "Questions",
  "nav_teachers": "Pour les enseignants",
  "nav_free": "Logiciel libre",
  "login": "Se connecter",
  "play_now": "Jouer maintenant",
  "eyebrow": "Apprendre en jouant",
  "h1": "Que la classe\nne manque\njamais d'énergie",
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
  "quote_note": "Témoignages d'exemple : ils seront remplacés par de vrais.",
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
  "x6": "Révision avec des cartes mémoire",
  "quick_start": "Démarrage rapide",
  "tile4": "Accès enseignants",
  "tile4s": "Crée et lance tes quiz",
  "install_app": "Installer l'application",
  "q1_p": "« Ma classe a demandé à rejouer la partie. C'est la première fois qu'ils demandent à réviser. »",
  "q1_w": "Enseignant de collège",
  "q2_p": "« J'ai importé mes quiz Moodle en cinq minutes et nous avons joué en classe le jour même. »",
  "q2_w": "Professeure de mathématiques",
  "q3_p": "« J'aime jouer seule pour m'entraîner avant l'examen. Je sais quelles questions je rate. »",
  "q3_w": "Élève de 4e",
  "carousel_prev": "Précédent",
  "carousel_next": "Suivant",
  "q4_p": "« Les cartes mémoire me font réviser exactement ce que je ne sais pas. Avec cinq minutes par jour, je vois la différence. »",
  "q4_w": "Élève de 3e",
  "q5_p": "« Avec les questions d'ordre, ce sont les élèves qui remettent la frise chronologique d'Histoire dans l'ordre, pas moi. »",
  "q5_w": "Enseignant d'histoire-géographie",
  "q6_p": "« Les questions d'association me permettent de relier notions et définitions sans bricoler. »",
  "q6_w": "Professeur de lettres",
  "hero_solo": "Seul"
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
        document.querySelectorAll('[data-i18n-aria]').forEach(function(el){
            var v = dict[el.getAttribute('data-i18n-aria')];
            if(v !== undefined) el.setAttribute('aria-label', v);
        });
        document.querySelectorAll('#promo-lang button[data-lang]').forEach(function(b){
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
        var b = e.target.closest && e.target.closest('#promo-lang button[data-lang]');
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

// Carrusel de testimonios: automático (se pausa con el ratón o el foco y no se mueve si el sistema reduce el movimiento), con puntos y flechas.
(function(){
    var root = document.querySelector('.quote');
    if(!root) return;
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    var dotsBox = document.getElementById('quote-dots');
    if(slides.length < 2 || !dotsBox) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var current = 0, timer = null, paused = false;

    var dots = slides.map(function(_, i){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'q-dot';
        b.setAttribute('aria-label', (i + 1) + ' / ' + slides.length);
        b.addEventListener('click', function(){ show(i); restart(); });
        dotsBox.appendChild(b);
        return b;
    });

    function show(n){
        current = (n + slides.length) % slides.length;
        slides.forEach(function(s, i){
            var on = i === current;
            s.classList.toggle('is-active', on);
            s.setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        dots.forEach(function(d, i){
            d.classList.toggle('active', i === current);
            if(i === current) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
    }
    function restart(){
        if(timer) clearInterval(timer);
        timer = null;
        if(reduce || paused) return;
        timer = setInterval(function(){ show(current + 1); }, 7000);
    }
    root.querySelector('.q-prev').addEventListener('click', function(){ show(current - 1); restart(); });
    root.querySelector('.q-next').addEventListener('click', function(){ show(current + 1); restart(); });
    ['mouseenter', 'focusin'].forEach(function(ev){ root.addEventListener(ev, function(){ paused = true; restart(); }); });
    ['mouseleave', 'focusout'].forEach(function(ev){ root.addEventListener(ev, function(){ paused = false; restart(); }); });
    show(0);
    restart();
})();

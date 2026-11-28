// Deures asíncrons, lado del docente (feature 1): crear un deber desde un quiz (?quiz=ID), ver los
// suyos y consultar resultados (?code=). La API está en server/routes/homework.js.
var lang = EduhootLang.init({ preferKey: 'lang' });
var params = new URLSearchParams(window.location.search);

var i18n = {
    es: { title: 'Mis deberes', langLabel: 'Idioma', back: 'Biblioteca', backHome: 'Inicio', loading: 'Cargando…', needLogin: 'Inicia sesión para gestionar deberes.', goLogin: 'Ir a iniciar sesión',
        newTitle: 'Nuevo deber', quizLabel: 'Quiz', fTitle: 'Título', fDeadline: 'Fecha límite', fAttempts: 'Intentos por alumno', attempts1: '1 (un solo intento)', attemptsUnlimited: 'Ilimitados', fScoring: 'Puntuación con varios intentos', scoringBest: 'Cuenta el mejor intento', scoringAverage: 'Cuenta la media de los intentos', scoringFirst: 'Cuenta el primer intento', scoringLast: 'Cuenta el último intento', colAvg: 'Puntuación media', colFirst: 'Primer intento', colLast: 'Último intento', myHomeworkLink: 'Mis deberes',
        fTime: 'Tiempo por pregunta', timeQuiz: 'El de cada pregunta', fShowAnswers: 'Mostrar la respuesta correcta tras contestar', fShuffle: 'Barajar las respuestas', create: 'Crear deber',
        createdTitle: 'Deber creado', createdText: 'Comparte este enlace con tu alumnado. Entran con un nombre y reciben un código para continuar desde otro dispositivo.', code: 'Código', copyLink: 'Copiar enlace', copied: '¡Copiado!',
        myHomework: 'Mis deberes', empty: 'Aún no has creado ningún deber. Crea uno desde la biblioteca con el botón 📚.', results: 'Resultados', close: 'Cerrar', reopen: 'Reabrir', reopenOk: 'Reabrir con esta fecha', newDeadline: 'Nueva fecha límite',
        delete: 'Eliminar', deleteConfirm: '¿Seguro? Se borran los resultados', status_open: 'Abierto', status_closed: 'Cerrado', status_expired: 'Vencido', deadlineAt: 'Límite: {d}', studentsN: '{n} alumnos', finishedN: '{n} intentos terminados',
        downloadCsv: 'Descargar CSV', refresh: 'Actualizar', noStudents: 'Todavía no ha entrado nadie.', colName: 'Alumno', colState: 'Estado', colAttempts: 'Intentos', colBest: 'Mejor puntuación', colCorrect: 'Aciertos', byQuestion: 'Por pregunta', colQuestion: 'Pregunta', colOk: 'Aciertos',
        state_finished: 'Terminado', 'state_in-progress': 'En curso', 'state_not-started': 'Sin empezar', state_expired: 'Sin terminar (plazo vencido)',
        err_deadline_too_soon: 'La fecha límite debe ser al menos 1 minuto posterior a ahora.', err_deadline_too_far: 'La fecha límite no puede superar los 30 días.', err_bad_attempts: 'Número de intentos no válido.', err_no_questions: 'Este quiz no tiene preguntas válidas.', err_quiz_not_found: 'No se encuentra el quiz.', err_generic: 'No se ha podido completar la acción.', err_bad_deadline: 'Fecha límite no válida.' },
    ca: { title: 'Els meus deures', langLabel: 'Idioma', back: "Biblioteca", backHome: 'Inici', loading: 'Carregant…', needLogin: 'Inicia sessió per a gestionar deures.', goLogin: 'Anar a iniciar sessió',
        newTitle: 'Nou deure', quizLabel: 'Quiz', fTitle: 'Títol', fDeadline: 'Data límit', fAttempts: 'Intents per alumne', attempts1: '1 (un sol intent)', attemptsUnlimited: 'Il·limitats', fScoring: 'Puntuació amb diversos intents', scoringBest: 'Compta el millor intent', scoringAverage: 'Compta la mitjana dels intents', scoringFirst: 'Compta el primer intent', scoringLast: 'Compta l\'últim intent', colAvg: 'Puntuació mitjana', colFirst: 'Primer intent', colLast: 'Últim intent', myHomeworkLink: 'Els meus deures',
        fTime: 'Temps per pregunta', timeQuiz: 'El de cada pregunta', fShowAnswers: 'Mostrar la resposta correcta després de contestar', fShuffle: 'Barrejar les respostes', create: 'Crear deure',
        createdTitle: 'Deure creat', createdText: 'Comparteix este enllaç amb el teu alumnat. Entren amb un nom i reben un codi per a continuar des d\'un altre dispositiu.', code: 'Codi', copyLink: 'Copiar enllaç', copied: 'Copiat!',
        myHomework: 'Els meus deures', empty: 'Encara no has creat cap deure. Crea\'n un des de la biblioteca amb el botó 📚.', results: 'Resultats', close: 'Tancar', reopen: 'Reobrir', reopenOk: 'Reobrir amb esta data', newDeadline: 'Nova data límit',
        delete: 'Eliminar', deleteConfirm: 'Segur? S\'esborren els resultats', status_open: 'Obert', status_closed: 'Tancat', status_expired: 'Vençut', deadlineAt: 'Límit: {d}', studentsN: '{n} alumnes', finishedN: '{n} intents acabats',
        downloadCsv: 'Descarregar CSV', refresh: 'Actualitzar', noStudents: 'Encara no ha entrat ningú.', colName: 'Alumne', colState: 'Estat', colAttempts: 'Intents', colBest: 'Millor puntuació', colCorrect: 'Encerts', byQuestion: 'Per pregunta', colQuestion: 'Pregunta', colOk: 'Encerts',
        state_finished: 'Acabat', 'state_in-progress': 'En curs', 'state_not-started': 'Sense començar', state_expired: 'Sense acabar (termini vençut)',
        err_deadline_too_soon: 'La data límit ha de ser com a mínim 1 minut posterior a ara.', err_deadline_too_far: 'La data límit no pot superar els 30 dies.', err_bad_attempts: 'Nombre d\'intents no vàlid.', err_no_questions: 'Este quiz no té preguntes vàlides.', err_quiz_not_found: 'No es troba el quiz.', err_generic: 'No s\'ha pogut completar l\'acció.', err_bad_deadline: 'Data límit no vàlida.' },
    en: { title: 'My homework', langLabel: 'Language', back: 'Library', backHome: 'Home', loading: 'Loading…', needLogin: 'Sign in to manage homework.', goLogin: 'Go to sign in',
        newTitle: 'New homework', quizLabel: 'Quiz', fTitle: 'Title', fDeadline: 'Deadline', fAttempts: 'Attempts per student', attempts1: '1 (single attempt)', attemptsUnlimited: 'Unlimited', fScoring: 'Scoring with several attempts', scoringBest: 'Best attempt counts', scoringAverage: 'Average of the attempts counts', scoringFirst: 'First attempt counts', scoringLast: 'Last attempt counts', colAvg: 'Average score', colFirst: 'First attempt', colLast: 'Last attempt', myHomeworkLink: 'My homework',
        fTime: 'Time per question', timeQuiz: 'Each question\'s own', fShowAnswers: 'Show the correct answer after answering', fShuffle: 'Shuffle the answers', create: 'Create homework',
        createdTitle: 'Homework created', createdText: 'Share this link with your students. They join with a name and get a code to continue from another device.', code: 'Code', copyLink: 'Copy link', copied: 'Copied!',
        myHomework: 'My homework', empty: 'You have not created any homework yet. Create one from the library with the 📚 button.', results: 'Results', close: 'Close', reopen: 'Reopen', reopenOk: 'Reopen with this date', newDeadline: 'New deadline',
        delete: 'Delete', deleteConfirm: 'Sure? Results are deleted', status_open: 'Open', status_closed: 'Closed', status_expired: 'Expired', deadlineAt: 'Deadline: {d}', studentsN: '{n} students', finishedN: '{n} finished attempts',
        downloadCsv: 'Download CSV', refresh: 'Refresh', noStudents: 'Nobody has joined yet.', colName: 'Student', colState: 'Status', colAttempts: 'Attempts', colBest: 'Best score', colCorrect: 'Correct', byQuestion: 'By question', colQuestion: 'Question', colOk: 'Correct',
        state_finished: 'Finished', 'state_in-progress': 'In progress', 'state_not-started': 'Not started', state_expired: 'Unfinished (deadline passed)',
        err_deadline_too_soon: 'The deadline must be at least 1 minute from now.', err_deadline_too_far: 'The deadline cannot be more than 30 days away.', err_bad_attempts: 'Invalid number of attempts.', err_no_questions: 'This quiz has no valid questions.', err_quiz_not_found: 'Quiz not found.', err_generic: 'The action could not be completed.', err_bad_deadline: 'Invalid deadline.' },
    de: {
        title: 'Meine Hausaufgaben',
        langLabel: 'Sprache',
        back: 'Bibliothek', backHome: 'Startseite',
        loading: 'Wird geladen…',
        needLogin: 'Melde dich an, um Hausaufgaben zu verwalten.',
        goLogin: 'Zur Anmeldung',
        newTitle: 'Neue Hausaufgabe',
        quizLabel: 'Quiz',
        fTitle: 'Titel',
        fDeadline: 'Frist',
        fAttempts: 'Versuche pro Schüler',
        attempts1: '1 (ein Versuch)',
        attemptsUnlimited: 'Unbegrenzt',
        fScoring: 'Wertung bei mehreren Versuchen',
        scoringBest: 'Der beste Versuch zählt',
        scoringAverage: 'Der Durchschnitt der Versuche zählt',
        scoringFirst: 'Der erste Versuch zählt',
        scoringLast: 'Der letzte Versuch zählt',
        colAvg: 'Durchschnittspunktzahl',
        colFirst: 'Erster Versuch',
        colLast: 'Letzter Versuch',
        myHomeworkLink: 'Meine Hausaufgaben',
        fTime: 'Zeit pro Frage',
        timeQuiz: 'Die jeweils eigene',
        fShowAnswers: 'Richtige Antwort nach dem Antworten zeigen',
        fShuffle: 'Antworten mischen',
        create: 'Hausaufgabe erstellen',
        createdTitle: 'Hausaufgabe erstellt',
        createdText: 'Teile diesen Link mit deinen Schülern. Sie treten mit einem Namen bei und erhalten einen Code, um auf einem anderen Gerät weiterzumachen.',
        code: 'Code',
        copyLink: 'Link kopieren',
        copied: 'Kopiert!',
        myHomework: 'Meine Hausaufgaben',
        empty: 'Du hast noch keine Hausaufgabe erstellt. Erstelle eine in der Bibliothek mit der Schaltfläche 📚.',
        results: 'Ergebnisse',
        close: 'Schließen',
        reopen: 'Wieder öffnen',
        reopenOk: 'Mit diesem Datum öffnen',
        newDeadline: 'Neue Frist',
        delete: 'Löschen',
        deleteConfirm: 'Sicher? Die Ergebnisse werden gelöscht',
        status_open: 'Offen',
        status_closed: 'Geschlossen',
        status_expired: 'Abgelaufen',
        deadlineAt: 'Frist: {d}',
        studentsN: '{n} Schüler',
        finishedN: '{n} abgeschlossene Versuche',
        downloadCsv: 'CSV herunterladen',
        refresh: 'Aktualisieren',
        noStudents: 'Noch niemand ist beigetreten.',
        colName: 'Schüler',
        colState: 'Status',
        colAttempts: 'Versuche',
        colBest: 'Beste Punktzahl',
        colCorrect: 'Richtig',
        byQuestion: 'Nach Frage',
        colQuestion: 'Frage',
        colOk: 'Richtig',
        state_finished: 'Abgeschlossen',
        'state_in-progress': 'In Bearbeitung',
        'state_not-started': 'Nicht begonnen',
        state_expired: 'Unvollständig (Frist abgelaufen)',
        err_deadline_too_soon: 'Die Frist muss mindestens 1 Minute in der Zukunft liegen.',
        err_deadline_too_far: 'Die Frist darf nicht mehr als 30 Tage entfernt sein.',
        err_bad_attempts: 'Ungültige Anzahl an Versuchen.',
        err_no_questions: 'Dieses Quiz hat keine gültigen Fragen.',
        err_quiz_not_found: 'Quiz nicht gefunden.',
        err_generic: 'Die Aktion konnte nicht ausgeführt werden.',
        err_bad_deadline: 'Ungültige Frist.'
    },
    it: {
        title: 'I miei compiti',
        langLabel: 'Lingua',
        back: 'Libreria', backHome: 'Home',
        loading: 'Caricamento…',
        needLogin: 'Accedi per gestire i compiti.',
        goLogin: 'Vai all\'accesso',
        newTitle: 'Nuovo compito',
        quizLabel: 'Quiz',
        fTitle: 'Titolo',
        fDeadline: 'Scadenza',
        fAttempts: 'Tentativi per studente',
        attempts1: '1 (un solo tentativo)',
        attemptsUnlimited: 'Illimitati',
        fScoring: 'Valutazione con più tentativi',
        scoringBest: 'Conta il tentativo migliore',
        scoringAverage: 'Conta la media dei tentativi',
        scoringFirst: 'Conta il primo tentativo',
        scoringLast: 'Conta l\'ultimo tentativo',
        colAvg: 'Punteggio medio',
        colFirst: 'Primo tentativo',
        colLast: 'Ultimo tentativo',
        myHomeworkLink: 'I miei compiti',
        fTime: 'Tempo per domanda',
        timeQuiz: 'Quello di ogni domanda',
        fShowAnswers: 'Mostra la risposta corretta dopo aver risposto',
        fShuffle: 'Mescola le risposte',
        create: 'Crea il compito',
        createdTitle: 'Compito creato',
        createdText: 'Condividi questo link con i tuoi studenti. Entrano con un nome e ricevono un codice per continuare da un altro dispositivo.',
        code: 'Codice',
        copyLink: 'Copia il link',
        copied: 'Copiato!',
        myHomework: 'I miei compiti',
        empty: 'Non hai ancora creato nessun compito. Creane uno dalla libreria con il pulsante 📚.',
        results: 'Risultati',
        close: 'Chiudi',
        reopen: 'Riapri',
        reopenOk: 'Riapri con questa data',
        newDeadline: 'Nuova scadenza',
        delete: 'Elimina',
        deleteConfirm: 'Sicuro? I risultati vengono eliminati',
        status_open: 'Aperto',
        status_closed: 'Chiuso',
        status_expired: 'Scaduto',
        deadlineAt: 'Scadenza: {d}',
        studentsN: '{n} studenti',
        finishedN: '{n} tentativi completati',
        downloadCsv: 'Scarica CSV',
        refresh: 'Aggiorna',
        noStudents: 'Nessuno è ancora entrato.',
        colName: 'Studente',
        colState: 'Stato',
        colAttempts: 'Tentativi',
        colBest: 'Punteggio migliore',
        colCorrect: 'Corrette',
        byQuestion: 'Per domanda',
        colQuestion: 'Domanda',
        colOk: 'Corretta',
        state_finished: 'Terminato',
        'state_in-progress': 'In corso',
        'state_not-started': 'Non iniziato',
        state_expired: 'Non completato (scadenza passata)',
        err_deadline_too_soon: 'La scadenza deve essere almeno tra 1 minuto.',
        err_deadline_too_far: 'La scadenza non può superare i 30 giorni.',
        err_bad_attempts: 'Numero di tentativi non valido.',
        err_no_questions: 'Questo quiz non ha domande valide.',
        err_quiz_not_found: 'Quiz non trovato.',
        err_generic: 'Impossibile completare l\'azione.',
        err_bad_deadline: 'Scadenza non valida.'
    },
    pt: {
        title: 'Os meus trabalhos de casa',
        langLabel: 'Idioma',
        back: 'Biblioteca', backHome: 'Início',
        loading: 'A carregar…',
        needLogin: 'Inicie sessão para gerir os trabalhos de casa.',
        goLogin: 'Ir para o início de sessão',
        newTitle: 'Novo trabalho de casa',
        quizLabel: 'Questionário',
        fTitle: 'Título',
        fDeadline: 'Prazo',
        fAttempts: 'Tentativas por aluno',
        attempts1: '1 (uma só tentativa)',
        attemptsUnlimited: 'Ilimitadas',
        fScoring: 'Pontuação com várias tentativas',
        scoringBest: 'Conta a melhor tentativa',
        scoringAverage: 'Conta a média das tentativas',
        scoringFirst: 'Conta a primeira tentativa',
        scoringLast: 'Conta a última tentativa',
        colAvg: 'Pontuação média',
        colFirst: 'Primeira tentativa',
        colLast: 'Última tentativa',
        myHomeworkLink: 'Os meus trabalhos de casa',
        fTime: 'Tempo por pergunta',
        timeQuiz: 'O próprio de cada pergunta',
        fShowAnswers: 'Mostrar a resposta correta depois de responder',
        fShuffle: 'Misturar as respostas',
        create: 'Criar trabalho de casa',
        createdTitle: 'Trabalho de casa criado',
        createdText: 'Partilhe esta ligação com os seus alunos. Entram com um nome e recebem um código para continuar noutro dispositivo.',
        code: 'Código',
        copyLink: 'Copiar ligação',
        copied: 'Copiado!',
        myHomework: 'Os meus trabalhos de casa',
        empty: 'Ainda não criou nenhum trabalho de casa. Crie um na biblioteca com o botão 📚.',
        results: 'Resultados',
        close: 'Fechar',
        reopen: 'Reabrir',
        reopenOk: 'Reabrir com esta data',
        newDeadline: 'Novo prazo',
        delete: 'Eliminar',
        deleteConfirm: 'Tem a certeza? Os resultados são eliminados',
        status_open: 'Aberto',
        status_closed: 'Fechado',
        status_expired: 'Expirado',
        deadlineAt: 'Prazo: {d}',
        studentsN: '{n} alunos',
        finishedN: '{n} tentativas concluídas',
        downloadCsv: 'Descarregar CSV',
        refresh: 'Atualizar',
        noStudents: 'Ainda ninguém entrou.',
        colName: 'Aluno',
        colState: 'Estado',
        colAttempts: 'Tentativas',
        colBest: 'Melhor pontuação',
        colCorrect: 'Corretas',
        byQuestion: 'Por pergunta',
        colQuestion: 'Pergunta',
        colOk: 'Correta',
        state_finished: 'Terminado',
        'state_in-progress': 'Em curso',
        'state_not-started': 'Não iniciado',
        state_expired: 'Incompleto (prazo terminado)',
        err_deadline_too_soon: 'O prazo deve ser pelo menos daqui a 1 minuto.',
        err_deadline_too_far: 'O prazo não pode estar a mais de 30 dias.',
        err_bad_attempts: 'Número de tentativas inválido.',
        err_no_questions: 'Este questionário não tem perguntas válidas.',
        err_quiz_not_found: 'Questionário não encontrado.',
        err_generic: 'Não foi possível concluir a ação.',
        err_bad_deadline: 'Prazo inválido.'
    },
    bg: {
        title: 'Моите домашни',
        langLabel: 'Език',
        back: 'Библиотека', backHome: 'Начало',
        loading: 'Зареждане…',
        needLogin: 'Влез, за да управляваш домашните.',
        goLogin: 'Към влизането',
        newTitle: 'Нова домашна работа',
        quizLabel: 'Куиз',
        fTitle: 'Заглавие',
        fDeadline: 'Краен срок',
        fAttempts: 'Опити на ученик',
        attempts1: '1 (един опит)',
        attemptsUnlimited: 'Неограничени',
        fScoring: 'Оценяване при няколко опита',
        scoringBest: 'Брои се най-добрият опит',
        scoringAverage: 'Брои се средното от опитите',
        scoringFirst: 'Брои се първият опит',
        scoringLast: 'Брои се последният опит',
        colAvg: 'Среден резултат',
        colFirst: 'Първи опит',
        colLast: 'Последен опит',
        myHomeworkLink: 'Моите домашни',
        fTime: 'Време за въпрос',
        timeQuiz: 'Собственото на всеки въпрос',
        fShowAnswers: 'Показвай верния отговор след отговаряне',
        fShuffle: 'Разбъркай отговорите',
        create: 'Създай домашна работа',
        createdTitle: 'Домашната работа е създадена',
        createdText: 'Сподели тази връзка с учениците си. Те влизат с име и получават код, за да продължат от друго устройство.',
        code: 'Код',
        copyLink: 'Копирай връзката',
        copied: 'Копирано!',
        myHomework: 'Моите домашни',
        empty: 'Още не си създал домашна работа. Създай от библиотеката с бутона 📚.',
        results: 'Резултати',
        close: 'Затвори',
        reopen: 'Отвори отново',
        reopenOk: 'Отвори с тази дата',
        newDeadline: 'Нов краен срок',
        delete: 'Изтрий',
        deleteConfirm: 'Сигурен ли си? Резултатите се изтриват',
        status_open: 'Отворена',
        status_closed: 'Затворена',
        status_expired: 'Изтекла',
        deadlineAt: 'Краен срок: {d}',
        studentsN: '{n} ученици',
        finishedN: '{n} завършени опита',
        downloadCsv: 'Изтегли CSV',
        refresh: 'Обнови',
        noStudents: 'Още никой не се е присъединил.',
        colName: 'Ученик',
        colState: 'Състояние',
        colAttempts: 'Опити',
        colBest: 'Най-добър резултат',
        colCorrect: 'Верни',
        byQuestion: 'По въпрос',
        colQuestion: 'Въпрос',
        colOk: 'Верен',
        state_finished: 'Завършен',
        'state_in-progress': 'В процес',
        'state_not-started': 'Не е започнат',
        state_expired: 'Незавършен (срокът е изтекъл)',
        err_deadline_too_soon: 'Крайният срок трябва да е поне след 1 минута.',
        err_deadline_too_far: 'Крайният срок не може да е над 30 дни.',
        err_bad_attempts: 'Невалиден брой опити.',
        err_no_questions: 'Този куиз няма валидни въпроси.',
        err_quiz_not_found: 'Куизът не е намерен.',
        err_generic: 'Действието не можа да се изпълни.',
        err_bad_deadline: 'Невалиден краен срок.'
    },
    ar: {
        title: 'واجباتي',
        langLabel: 'اللغة',
        back: 'المكتبة', backHome: 'الرئيسية',
        loading: 'جارٍ التحميل…',
        needLogin: 'سجّل الدخول لإدارة الواجبات.',
        goLogin: 'الذهاب إلى تسجيل الدخول',
        newTitle: 'واجب جديد',
        quizLabel: 'الاختبار',
        fTitle: 'العنوان',
        fDeadline: 'الأجل',
        fAttempts: 'محاولات لكل تلميذ',
        attempts1: '1 (محاولة واحدة)',
        attemptsUnlimited: 'غير محدودة',
        fScoring: 'التقييم عند تعدد المحاولات',
        scoringBest: 'تُحتسب أفضل محاولة',
        scoringAverage: 'يُحتسب معدل المحاولات',
        scoringFirst: 'تُحتسب المحاولة الأولى',
        scoringLast: 'تُحتسب المحاولة الأخيرة',
        colAvg: 'متوسط النقاط',
        colFirst: 'المحاولة الأولى',
        colLast: 'المحاولة الأخيرة',
        myHomeworkLink: 'واجباتي',
        fTime: 'الوقت لكل سؤال',
        timeQuiz: 'الخاص بكل سؤال',
        fShowAnswers: 'إظهار الإجابة الصحيحة بعد الإجابة',
        fShuffle: 'خلط الإجابات',
        create: 'إنشاء الواجب',
        createdTitle: 'تم إنشاء الواجب',
        createdText: 'شارك هذا الرابط مع تلاميذك. يدخلون باسم ويحصلون على رمز لمتابعة العمل من جهاز آخر.',
        code: 'الرمز',
        copyLink: 'نسخ الرابط',
        copied: 'تم النسخ!',
        myHomework: 'واجباتي',
        empty: 'لم تنشئ أي واجب بعد. أنشئ واحداً من المكتبة بزر 📚.',
        results: 'النتائج',
        close: 'إغلاق',
        reopen: 'إعادة الفتح',
        reopenOk: 'إعادة الفتح بهذا التاريخ',
        newDeadline: 'أجل جديد',
        delete: 'حذف',
        deleteConfirm: 'هل أنت متأكد؟ ستُحذف النتائج',
        status_open: 'مفتوح',
        status_closed: 'مغلق',
        status_expired: 'منتهٍ',
        deadlineAt: 'الأجل: {d}',
        studentsN: '{n} تلاميذ',
        finishedN: '{n} محاولات منتهية',
        downloadCsv: 'تنزيل CSV',
        refresh: 'تحديث',
        noStudents: 'لم ينضم أحد بعد.',
        colName: 'التلميذ',
        colState: 'الحالة',
        colAttempts: 'المحاولات',
        colBest: 'أفضل نتيجة',
        colCorrect: 'الصحيحة',
        byQuestion: 'حسب السؤال',
        colQuestion: 'السؤال',
        colOk: 'صحيح',
        state_finished: 'منتهٍ',
        'state_in-progress': 'قيد التنفيذ',
        'state_not-started': 'لم يبدأ',
        state_expired: 'غير مكتمل (انتهى الأجل)',
        err_deadline_too_soon: 'يجب أن يكون الأجل بعد دقيقة على الأقل من الآن.',
        err_deadline_too_far: 'لا يمكن أن يتجاوز الأجل 30 يوماً.',
        err_bad_attempts: 'عدد محاولات غير صالح.',
        err_no_questions: 'لا يحتوي هذا الاختبار على أسئلة صالحة.',
        err_quiz_not_found: 'الاختبار غير موجود.',
        err_generic: 'تعذّر إتمام الإجراء.',
        err_bad_deadline: 'أجل غير صالح.'
    },
    fr: {
        title: 'Mes devoirs',
        langLabel: 'Langue',
        back: 'Bibliothèque', backHome: 'Accueil',
        loading: 'Chargement…',
        needLogin: 'Connecte-toi pour gérer les devoirs.',
        goLogin: 'Aller à la connexion',
        newTitle: 'Nouveau devoir',
        quizLabel: 'Quiz',
        fTitle: 'Titre',
        fDeadline: 'Date limite',
        fAttempts: 'Tentatives par élève',
        attempts1: '1 (une seule tentative)',
        attemptsUnlimited: 'Illimitées',
        fScoring: 'Notation avec plusieurs tentatives',
        scoringBest: 'La meilleure tentative compte',
        scoringAverage: 'La moyenne des tentatives compte',
        scoringFirst: 'La première tentative compte',
        scoringLast: 'La dernière tentative compte',
        colAvg: 'Score moyen',
        colFirst: 'Première tentative',
        colLast: 'Dernière tentative',
        myHomeworkLink: 'Mes devoirs',
        fTime: 'Temps par question',
        timeQuiz: 'Celui de chaque question',
        fShowAnswers: 'Afficher la bonne réponse après avoir répondu',
        fShuffle: 'Mélanger les réponses',
        create: 'Créer le devoir',
        createdTitle: 'Devoir créé',
        createdText: 'Partage ce lien avec tes élèves. Ils entrent avec un prénom et reçoivent un code pour continuer depuis un autre appareil.',
        code: 'Code',
        copyLink: 'Copier le lien',
        copied: 'Copié !',
        myHomework: 'Mes devoirs',
        empty: 'Tu n\'as encore créé aucun devoir. Crées-en un depuis la bibliothèque avec le bouton 📚.',
        results: 'Résultats',
        close: 'Fermer',
        reopen: 'Rouvrir',
        reopenOk: 'Rouvrir avec cette date',
        newDeadline: 'Nouvelle date limite',
        delete: 'Supprimer',
        deleteConfirm: 'Sûr ? Les résultats sont supprimés',
        status_open: 'Ouvert',
        status_closed: 'Fermé',
        status_expired: 'Expiré',
        deadlineAt: 'Date limite : {d}',
        studentsN: '{n} élèves',
        finishedN: '{n} tentatives terminées',
        downloadCsv: 'Télécharger le CSV',
        refresh: 'Actualiser',
        noStudents: 'Personne n\'a encore rejoint.',
        colName: 'Élève',
        colState: 'État',
        colAttempts: 'Tentatives',
        colBest: 'Meilleur score',
        colCorrect: 'Correctes',
        byQuestion: 'Par question',
        colQuestion: 'Question',
        colOk: 'Correcte',
        state_finished: 'Terminé',
        'state_in-progress': 'En cours',
        'state_not-started': 'Pas commencé',
        state_expired: 'Inachevé (date limite dépassée)',
        err_deadline_too_soon: 'La date limite doit être dans au moins 1 minute.',
        err_deadline_too_far: 'La date limite ne peut pas dépasser 30 jours.',
        err_bad_attempts: 'Nombre de tentatives invalide.',
        err_no_questions: 'Ce quiz n\'a aucune question valide.',
        err_quiz_not_found: 'Quiz introuvable.',
        err_generic: 'Impossible d\'effectuer l\'action.',
        err_bad_deadline: 'Date limite invalide.'
    }
};
function t(key){
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'en', 'es'];
    for(var i = 0; i < chain.length; i++){
        var d = i18n[chain[i]];
        if(d && d[key]) return d[key];
    }
    return key;
}
// Textos de la llista (vista, paginador i columnes del detall), compartits amb les altres pàgines de llista.
(function(){
    var extra = {
        es: { myGames: 'Mis partidas', viewLabel: 'Vista', viewCards: 'Tarjetas', viewDetail: 'Lista', coverLabel: 'Imagen de fondo', coverNone: 'Sin imagen', cover10: 'Imagen al 10 %', cover20: 'Imagen al 20 %', cover30: 'Imagen al 30 %',
            paginationPrev: 'Anterior', paginationNext: 'Siguiente', paginationPageInfo: 'Página {current} de {total}', pageSizeLabel: 'Por página', pageSizeAuto: 'Ajustar a la ventana',
            colHwTitle: 'Título', colQuiz: 'Quiz', colStatus: 'Estado', colDeadline: 'Límite', colStudentsN: 'Alum', colFinishedN: 'Term' },
        en: { myGames: 'My games', viewLabel: 'View', viewCards: 'Cards', viewDetail: 'List', coverLabel: 'Background image', coverNone: 'No image', cover10: 'Image at 10 %', cover20: 'Image at 20 %', cover30: 'Image at 30 %',
            paginationPrev: 'Previous', paginationNext: 'Next', paginationPageInfo: 'Page {current} of {total}', pageSizeLabel: 'Per page', pageSizeAuto: 'Fit to window',
            colHwTitle: 'Title', colQuiz: 'Quiz', colStatus: 'Status', colDeadline: 'Deadline', colStudentsN: 'Stud', colFinishedN: 'Fin' },
        de: {
            myGames: 'Meine Spiele',
            viewLabel: 'Ansicht',
            viewCards: 'Karten',
            viewDetail: 'Liste',
            coverLabel: 'Hintergrundbild',
            coverNone: 'Kein Bild',
            cover10: 'Bild mit 10 %',
            cover20: 'Bild mit 20 %',
            cover30: 'Bild mit 30 %',
            paginationPrev: 'Zurück',
            paginationNext: 'Weiter',
            paginationPageInfo: 'Seite {current} von {total}',
            pageSizeLabel: 'Pro Seite',
            pageSizeAuto: 'An Fenster anpassen',
            colHwTitle: 'Titel',
            colQuiz: 'Quiz',
            colStatus: 'Status',
            colDeadline: 'Frist',
            colStudentsN: 'Schüler',
            colFinishedN: 'Fertig'
        },
        it: {
            myGames: 'Le mie partite',
            viewLabel: 'Vista',
            viewCards: 'Schede',
            viewDetail: 'Elenco',
            coverLabel: 'Immagine di sfondo',
            coverNone: 'Nessuna immagine',
            cover10: 'Immagine al 10 %',
            cover20: 'Immagine al 20 %',
            cover30: 'Immagine al 30 %',
            paginationPrev: 'Precedente',
            paginationNext: 'Successivo',
            paginationPageInfo: 'Pagina {current} di {total}',
            pageSizeLabel: 'Per pagina',
            pageSizeAuto: 'Adatta alla finestra',
            colHwTitle: 'Titolo',
            colQuiz: 'Quiz',
            colStatus: 'Stato',
            colDeadline: 'Scadenza',
            colStudentsN: 'Stud.',
            colFinishedN: 'Compl.'
        },
        pt: {
            myGames: 'Os meus jogos',
            viewLabel: 'Vista',
            viewCards: 'Cartões',
            viewDetail: 'Lista',
            coverLabel: 'Imagem de fundo',
            coverNone: 'Sem imagem',
            cover10: 'Imagem a 10 %',
            cover20: 'Imagem a 20 %',
            cover30: 'Imagem a 30 %',
            paginationPrev: 'Anterior',
            paginationNext: 'Seguinte',
            paginationPageInfo: 'Página {current} de {total}',
            pageSizeLabel: 'Por página',
            pageSizeAuto: 'Ajustar à janela',
            colHwTitle: 'Título',
            colQuiz: 'Questionário',
            colStatus: 'Estado',
            colDeadline: 'Prazo',
            colStudentsN: 'Alun.',
            colFinishedN: 'Term.'
        },
        bg: {
            myGames: 'Моите игри',
            viewLabel: 'Изглед',
            viewCards: 'Карти',
            viewDetail: 'Списък',
            coverLabel: 'Фоново изображение',
            coverNone: 'Без изображение',
            cover10: 'Изображение 10 %',
            cover20: 'Изображение 20 %',
            cover30: 'Изображение 30 %',
            paginationPrev: 'Назад',
            paginationNext: 'Напред',
            paginationPageInfo: 'Страница {current} от {total}',
            pageSizeLabel: 'На страница',
            pageSizeAuto: 'Побери в прозореца',
            colHwTitle: 'Заглавие',
            colQuiz: 'Куиз',
            colStatus: 'Състояние',
            colDeadline: 'Срок',
            colStudentsN: 'Уч.',
            colFinishedN: 'Зав.'
        },
        ar: {
            myGames: 'ألعابي',
            viewLabel: 'العرض',
            viewCards: 'بطاقات',
            viewDetail: 'قائمة',
            coverLabel: 'صورة الخلفية',
            coverNone: 'بدون صورة',
            cover10: 'صورة بنسبة 10 %',
            cover20: 'صورة بنسبة 20 %',
            cover30: 'صورة بنسبة 30 %',
            paginationPrev: 'السابق',
            paginationNext: 'التالي',
            paginationPageInfo: 'الصفحة {current} من {total}',
            pageSizeLabel: 'لكل صفحة',
            pageSizeAuto: 'ملاءمة النافذة',
            colHwTitle: 'العنوان',
            colQuiz: 'الاختبار',
            colStatus: 'الحالة',
            colDeadline: 'الأجل',
            colStudentsN: 'تلام.',
            colFinishedN: 'منتهٍ'
        },
        fr: {
            myGames: 'Mes parties',
            viewLabel: 'Vue',
            viewCards: 'Cartes',
            viewDetail: 'Liste',
            coverLabel: 'Image de fond',
            coverNone: 'Aucune image',
            cover10: 'Image à 10 %',
            cover20: 'Image à 20 %',
            cover30: 'Image à 30 %',
            paginationPrev: 'Précédent',
            paginationNext: 'Suivant',
            paginationPageInfo: 'Page {current} sur {total}',
            pageSizeLabel: 'Par page',
            pageSizeAuto: 'Adapter à la fenêtre',
            colHwTitle: 'Titre',
            colQuiz: 'Quiz',
            colStatus: 'État',
            colDeadline: 'Limite',
            colStudentsN: 'Élèv.',
            colFinishedN: 'Term.'
        },
        ca: { myGames: 'Les meves partides', viewLabel: 'Vista', viewCards: 'Targetes', viewDetail: 'Llista', coverLabel: 'Imatge de fons', coverNone: 'Sense imatge', cover10: 'Imatge al 10 %', cover20: 'Imatge al 20 %', cover30: 'Imatge al 30 %',
            paginationPrev: 'Anterior', paginationNext: 'Següent', paginationPageInfo: 'Pàgina {current} de {total}', pageSizeLabel: 'Per pàgina', pageSizeAuto: 'Ajustar a la finestra',
            colHwTitle: 'Títol', colQuiz: 'Quiz', colStatus: 'Estat', colDeadline: 'Límit', colStudentsN: 'Alum', colFinishedN: 'Acab' }
    };
    Object.keys(extra).forEach(function(l){ i18n[l] = Object.assign({}, i18n[l] || {}, extra[l]); });
})();

function fmt(key, vars){
    return t(key).replace(/\{(\w+)\}/g, function(_, k){ return String(vars[k]); });
}
document.documentElement.setAttribute('lang', lang);
(function(){ var b = document.getElementById('back'); if(b) b.textContent = t('back'); })();

function pad(n){ return n < 10 ? '0' + n : String(n); }
// Valor de <input type="datetime-local"> a partir de una fecha (hora local, sin segundos).
function toLocalInput(ms){
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function defaultDeadline(){
    var d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    d.setHours(23, 59, 0, 0);
    return toLocalInput(d.getTime());
}
function errKey(code){ return 'err_' + String(code || 'generic').replace(/-/g, '_'); }

var copyTimer = null;
var deleteTimer = null;

var app = Vue.createApp({
    template: '#hw-tpl',
    mixins: [EduhootListMixin],
    data: function(){
        var quizId = params.get('quiz');
        var code = params.get('code');
        return {
            loading: true, user: null, langTick: 0,
            // Llista: vista (tarjetes o detall), preferències compartides amb «Mis partidas» i paginador.
            listKey: 'deberes', listView: eduhootReadView('deberes'), pageSizeChoice: eduhootReadSizeChoice('deberes'), coverLevel: eduhootReadCoverLevel(),
            view: quizId ? 'new' : (code ? 'results' : 'list'),
            quizId: quizId, quizName: '', code: code,
            form: { title: '', deadline: defaultDeadline(), maxAttempts: '1', attemptScoring: 'best', timePerQuestion: '', showCorrectAnswers: true, randomAnswers: true },
            created: null, busy: false, error: '', copied: '',
            list: [], results: null, deleting: '', reopening: '', newDeadline: '',
            sortKey: '', sortDir: 1,
            sortCols: [{ key: 'name', label: 'colName' }, { key: 'state', label: 'colState' }, { key: 'attempts', label: 'colAttempts' }, { key: 'bestScore', label: 'colBest' }, { key: 'correctCount', label: 'colCorrect' }]
        };
    },
    computed: {
        // Orden por columna al pulsar el encabezado (sin orden = el del servidor).
        sortedRows: function(){
            var rows = this.results ? this.results.rows.slice() : [];
            var key = this.sortKey;
            if(!key) return rows;
            var dir = this.sortDir;
            return rows.sort(function(a, b){
                var x = a[key], y = b[key];
                if(typeof x === 'string') return x.localeCompare(y, lang) * dir;
                return ((x || 0) - (y || 0)) * dir;
            });
        }
    },
    mounted: function(){
        var self = this;
        EduhootLang.render();
        window.addEventListener('resize', function(){ self.measure(); });
        fetch('/api/auth/me', { credentials: 'include' })
            .then(function(res){ return res.ok ? res.json() : null; })
            .then(function(user){ self.user = user; return user ? self.load() : null; })
            .catch(function(){ self.user = null; })
            .then(function(){ self.loading = false; self.$nextTick(bindLangSelect); });
    },
    methods: {
        t: function(key){ this.langTick; return t(key); },
        fmt: fmt,
        // La columna de puntuación se llama según lo que cuenta: «Puntuación media», «Primer intento» o «Último intento».
        colLabel: function(c){
            if(c.key !== 'bestScore' || !this.results) return c.label;
            return { average: 'colAvg', first: 'colFirst', last: 'colLast' }[this.results.homework.scoring] || c.label;
        },
        sortBy: function(key){
            if(this.sortKey === key) this.sortDir = -this.sortDir;
            else { this.sortKey = key; this.sortDir = 1; }
        },
        plain: function(html){ var d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, ' '); return d.textContent || ''; },
        linkOf: function(h){ return window.location.origin + '/homework/?code=' + h.code; },
        stateOf: function(h){
            if(h.status === 'closed') return 'closed';
            return h.deadline < Date.now() ? 'expired' : 'open';
        },
        statusText: function(h){ return t('status_' + this.stateOf(h)); },
        deadlineText: function(h){
            return fmt('deadlineAt', { d: this.deadlineValue(h) });
        },
        // Només la data (la taula de detall ja té l'etiqueta de la columna).
        deadlineValue: function(h){
            return new Date(h.deadline).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });
        },
        load: function(){
            if(this.view === 'new') return this.loadQuiz();
            if(this.view === 'results') return this.loadResults();
            return this.loadList();
        },
        loadQuiz: function(){
            var self = this;
            return fetch('/api/quizzes/' + encodeURIComponent(this.quizId), { credentials: 'include' })
                .then(function(res){ return res.ok ? res.json() : null; })
                .then(function(q){ if(q){ self.quizName = q.name || ''; if(!self.form.title) self.form.title = q.name || ''; } });
        },
        loadList: function(){
            var self = this;
            return fetch('/api/homeworks', { credentials: 'include' }).then(function(res){ return res.ok ? res.json() : []; })
                .then(function(list){ self.list = list; })
                .then(function(){ self.$nextTick(function(){ self.measure(); self.observePager(); }); });
        },
        loadResults: function(){
            var self = this;
            return fetch('/api/homeworks/' + encodeURIComponent(this.code) + '/results', { credentials: 'include' })
                .then(function(res){ if(!res.ok) throw new Error('x'); return res.json(); })
                .then(function(r){ self.results = r; self.error = ''; })
                .catch(function(){ self.error = 'err_generic'; self.view = 'list'; return self.loadList(); });
        },
        create: function(){
            var self = this;
            var f = this.form;
            var deadline = new Date(f.deadline).getTime();
            if(!isFinite(deadline)){ this.error = 'err_bad_deadline'; return; }
            this.busy = true;
            this.error = '';
            var options = { showCorrectAnswers: !!f.showCorrectAnswers, randomAnswers: !!f.randomAnswers };
            if(Number(f.maxAttempts) !== 1) options.attemptScoring = ['average', 'first', 'last'].includes(f.attemptScoring) ? f.attemptScoring : 'best';
            if(f.timePerQuestion) options.timePerQuestion = Number(f.timePerQuestion);
            fetch('/api/homeworks', {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizId: this.quizId, title: f.title, deadline: deadline, maxAttempts: Number(f.maxAttempts), options: options })
            }).then(function(res){ return res.json().then(function(b){ return { ok: res.ok, body: b }; }); })
            .then(function(r){
                self.busy = false;
                if(!r.ok){ self.error = errKey(r.body.error); return; }
                self.created = r.body.homework;
            }).catch(function(){ self.busy = false; self.error = 'err_generic'; });
        },
        copy: function(h){
            var self = this;
            var link = this.linkOf(h);
            var done = function(){ self.copied = h.code; clearTimeout(copyTimer); copyTimer = setTimeout(function(){ self.copied = ''; }, 2000); };
            if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(link).then(done, done); }
            else done();
        },
        patch: function(h, body){
            var self = this;
            return fetch('/api/homeworks/' + encodeURIComponent(h.code), {
                method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            }).then(function(res){ return res.json().then(function(b){ return { ok: res.ok, body: b }; }); })
            .then(function(r){ self.error = r.ok ? '' : errKey(r.body.error); return self.loadList(); });
        },
        setStatus: function(h, status){ return this.patch(h, { status: status }); },
        reopen: function(h){
            // Cerrado a mano con plazo vigente: basta reabrir. Vencido: hay que fijar una fecha nueva.
            if(h.deadline > Date.now()) return this.patch(h, { status: 'open' });
            this.reopening = h.code;
            this.newDeadline = defaultDeadline();
        },
        confirmReopen: function(h){
            var ms = new Date(this.newDeadline).getTime();
            this.reopening = '';
            return this.patch(h, { deadline: ms });
        },
        askDelete: function(h){
            var self = this;
            if(this.deleting !== h.code){
                this.deleting = h.code;
                clearTimeout(deleteTimer);
                deleteTimer = setTimeout(function(){ self.deleting = ''; }, 4000);
                return;
            }
            this.deleting = '';
            fetch('/api/homeworks/' + encodeURIComponent(h.code), { method: 'DELETE', credentials: 'include' })
                .then(function(){ return self.loadList(); });
        }
    }
}).mount('#hw-app');

function bindLangSelect(){
    var select = document.getElementById('lang-select');
    if(!select || select.__bound) return;
    select.__bound = true;
    EduhootLang.render();
    select.value = lang;
    select.addEventListener('change', function(){ EduhootLang.persist(select.value); window.location.reload(); });
}

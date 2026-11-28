// Carregat al <head> de /solo/: si la URL ja porta un quiz (?id=…), marca la pàgina abans de la primera
// pintura, perquè no es vegi un instant el catàleg mentre es carrega el quiz (CSS: html.quiz-from-url).
(function(){
    try{
        if(new URLSearchParams(window.location.search || '').get('id')){
            document.documentElement.classList.add('quiz-from-url');
        }
    }catch(e){}
})();

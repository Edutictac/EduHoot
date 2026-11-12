class Players {
    constructor () {
        this.players = [];
        this.tokens = new Map(); // token -> { hostId, playerId }
    }
    addPlayer(hostId, playerId, name, gameData, icon, token){
        var player = {hostId, playerId, name, icon: icon || '', gameData, token: token || ''};
        this.players.push(player);
        if(token){
            this.tokens.set(token, { hostId, playerId });
        }
        return player;
    }
    removePlayer(playerId){
        var player = this.getPlayer(playerId);
        
        if(player){
            if(player.token){
                this.tokens.delete(player.token);
            }
            this.players = this.players.filter((player) => player.playerId !== playerId);
        }
        return player;
    }
    getByToken(token){
        if(!token) return null;
        const link = this.tokens.get(token);
        if(!link) return null;
        return this.getPlayer(link.playerId);
    }
    // Reassigna el playerId (socket.id) d'un jugador ja existent, p. ex.
    // en reconnectar. Cal actualitzar també `tokens`, que guarda el seu
    // propi playerId a banda: si no, una segona reconnexió via token ja
    // no trobaria la fila (issue #23).
    updatePlayerId(player, newPlayerId){
        if(!player) return;
        player.playerId = newPlayerId;
        if(player.token){
            this.tokens.set(player.token, { hostId: player.hostId, playerId: newPlayerId });
        }
    }
    getPlayer(playerId){
        return this.players.filter((player) => player.playerId === playerId)[0]
    }
    getPlayers(hostId){
        return this.players.filter((player) => player.hostId === hostId);
    }
    // Jugador de la partida amb el mateix nom (sense distingir majúscules ni
    // espais repetits), llevat de `exceptPlayerId`. Issue #28: dos alumnes no
    // poden tindre el mateix nom en una partida.
    findByName(hostId, name, exceptPlayerId){
        var key = Players.nameKey(name);
        if(!key) return null;
        return this.getPlayers(hostId).find((player) => player.playerId !== exceptPlayerId && Players.nameKey(player.name) === key) || null;
    }
    static nameKey(name){
        return (name || '').toString().replace(/\s+/g, ' ').trim().toLowerCase();
    }
}

module.exports = {Players};

const crypto = require("crypto");
const {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} = require("unique-names-generator");

class Player {
  game = false;
  score = 0;
  hand = [];
  canAnswer = false;
  canVote = false;

  constructor(socketId, uuid, username) {
    this.socketId = socketId;
    this.uuid = uuid;
    this.username = username;
    this.online = false;
  }

  reset() {
    this.score = 0;
    this.hand = [];
    this.canAnswer = true;
    this.canVote = true;
  }
}

const PlayerManager = {
  players: [],
  getPlayer(id) {
    return this.players.filter((el) => el.uuid == id || el.socketId == id)[0];
  },
  getPlayerIndex(id) {
    let index = -1;
    for (let i = 0; i < this.players.length; i++) {
      if (this.players[i].socketId == id || this.players[i].uuid == id) {
        index = i;
        break;
      }
    }

    return index;
  },
  registerPlayer(uuid, username, socketId) {
    let player = this.getPlayer(uuid);
    if (uuid !== "" && username !== "" && player) {
      player.socketId = socketId;
      player.online = true;
      player.firstConnection = false;
    } else {
      uuid = uuid || crypto.randomUUID() + Date.now();
      username =
        username ||
        uniqueNamesGenerator({
          dictionaries: [adjectives, colors, animals],
        }).split('-').slice(0, 2).join(' ');
      player = new Player(socketId, uuid, username);
      player.online = true;
      player.firstConnection = true;
      this.players.push(player);
    }
    return player;
  },
  getOnlinePlayers(gameId) {
    return this.players.filter((el) => el.game == gameId && el.online);
  },
};

module.exports.Player = Player;
module.exports.PlayerManager = PlayerManager;

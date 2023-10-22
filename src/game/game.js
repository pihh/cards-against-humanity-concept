const crypto = require("crypto");
const CARDS = require("../../constants/cards").filter(
  (el) => el.numAnswers <= 1
);

const { PlayerManager } = require("./player-manager");
const EventEmitter = require("events");

class GameManager extends EventEmitter {
  running = false;
  // state = "starting"; // starting , answer, vote, results, finished

  // Settings
  timeout = 120;

  // Deck cards
  cards = CARDS;
  questions = [];
  answers = [];

  // Management
  playerManager = PlayerManager;

  // Game history and results
  history = [];
  lastEpisodeResult = {};
  episode = {
    question: { text: "question" },
    answers: [],
    player_answers: [],
    player_votes: [],
    timeout: 120,
    state: "starting", // Answer , Vote , Results, End
    result: {
      state: "winner", // "winner","draw","failed"
      winner: {},
      question: {},
      answer: {},
      votes: 0,
    },
  };

  constructor() {
    super(...arguments);
    this.id = crypto.randomUUID();
    this.shuffleDeck();
    this.startEpisode();
  }

  updateUsername(player, username) {
    // console.log('updateUsername',{player: player, username: username});
    if(username && player){

      player = this.playerManager.getPlayer(player.uuid);
      player.username = username;
      this.updatePlayer("update-username", player);
      this.updateGame("update-username");
    }
  }
  join(player) {
    // console.log('join',player)
    player = this.playerManager.getPlayer(player.uuid);
    
    if (player.game === this.id) {
      player.game = this.id;
    } else {
      player.game = this.id;
      player.reset();
    }
    player.canVote = true;
    player.canAnswer = true;
    player.online = true;

    this.updatePlayer("joined", player);
    this.draw(player);
    this.updateGame("player-joined");
  }

  leave(player) {
    player.online = false;
    this.updateEpisodeState();
    this.updateGame("player-left");
  }

  answer(player, id) {
    // console.log(player)
    if (this.episode.state != "answer") return;
    if (!player.canAnswer) return;

    player.canAnswer = false;
    player.canVote = true;

    let answer = player.hand.splice(id, 1)[0];
    answer.player = player;
    answer.count = 0;

    this.episode.player_answers.push(player.uuid);
    this.episode.answers.push(answer);

    this.updatePlayer("answered", player);
    this.updateEpisodeState();
  }

  vote(player, id) {
    if (this.episode.state != "vote") return;
    if (!player.canVote) return;

    player.canAnswer = false;
    player.canVote = false;

    this.episode.player_votes.push(player.uuid);

    this.episode.answers[id].count += 1;

    this.updatePlayer("voted", player);
    this.updateEpisodeState();
  }

  updateEpisodeState() {
    let hasUpdated = false;
    if (this.episode.state == "answer") {
      //console.log('update-episode-state',this.episode.player_answers > 0 , this.episode.player_answers ,this.episode.player_answers.sort().toString() , this.playerManager.getOnlinePlayers(this.id).map(el=> el.uuid).sort().toString())
      if (
        this.episode.player_answers.length > 0 &&
        this.episode.player_answers.sort().toString() ===
          this.playerManager
            .getOnlinePlayers(this.id)
            .map((el) => el.uuid)
            .sort()
            .toString()
      ) {
        // console.log("will step ep");
        this.stepEpisode();
        hasUpdated = true;
      }
    } else if (this.episode.state == "vote") {
      if (
        this.episode.player_votes.length > 0 &&
        this.episode.player_votes.sort().toString() ===
          this.playerManager
            .getOnlinePlayers(this.id)
            .map((el) => el.uuid)
            .sort()
            .toString()
      ) {
        this.stepEpisode();
        hasUpdated = true;
      }
    }
    if (!hasUpdated) {
      // console.log("didnt step ep");
      this.updateGame("update-episode");
    }
  }

  draw(player) {
    let players = this.playerManager.getOnlinePlayers(this.id);
    if (player) {
      players = [player];
    }

    if (
      this.questions.length < players.length ||
      this.answers.length / 10 < players.length
    ) {
      this.episode.state = "ended";
      this.endGame();
      return;
    }
    // Add player cards to the stack
    
    for (let player of players) {
      for (let i = player.hand.length - 1; i >= 0; i--) {
        let card = player.hand.pop(i);
        this.answers.push(card);
      }
    }
    // Shuffle the stack
    this.shuffleDeck(false);

    // Draw 10 new cards 
    for (let player of players) {
      for (let i = 0; i < 10; i++) {
        player.hand.push(this.answers.pop(0));
      }

      player.canAnswer = true;
      player.canVote = true;
      player.update = "draw";

      this.updatePlayer("draw", player);
    }
  }

  endGame() {
    console.log("@TODO");
  }
  getData() {
    const episode = JSON.parse(JSON.stringify(this.episode));
   
    const onlinePlayers = this.playerManager.getOnlinePlayers(this.id)
    let missing_actions_key = ""
    episode.missing_actions = onlinePlayers.map((el)=>el.uuid)
    
    if(episode.state == "answer" || episode.state == "vote"){
      console.log('state ok')
      missing_actions_key = "player_"+episode.state+"s"
      
      for(let completePlayer of episode[missing_actions_key]){
        let idx = episode.missing_actions.indexOf(completePlayer)
        if(idx > -1){
          episode.missing_actions.splice(idx, 1);
        }
      }
    }
    return {
      episode: episode,
      eventUuid: crypto.randomUUID(),
      history: this.history,
      lastEpisodeResult: this.lastEpisodeResult,
      players: onlinePlayers
    };
  }

  updateGame(eventName) {
    const data = this.getData();
    // console.log("updateGame", { eventName, data });

    this.emit("update-game", {
      eventName,
      ...data,
    });
  }

  updatePlayer(eventName, player) {
    const eventUuid = crypto.randomUUID();
    this.emit("update-player", {
      eventName,
      eventUuid,
      player,
    });
  }

  countdown = 120;
  countdownInterval = false;
  startCountdown(seconds = 120) {
    this.countdown = seconds;
    this.episode.timeout = seconds;
    clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      if (this.playerManager.getOnlinePlayers(this.id).length > 0) {
        this.countdown -= 1;
        this.episode.timeout = this.countdown;
        //console.log(this.countdown)
        if (this.countdown == 0) {
          clearInterval(this.countdownInterval);
          this.stepEpisode();
        }
      }
    }, 1000);
    this.updateGame("reset-countdown");
  }

  stepEpisode() {
    // console.log("step episode", this.episode);
    if (this.episode.state === "answer") {
      if (this.episode.player_answers.length > 0) {
        this.episode.state = "vote";
        this.startCountdown(120);
      } else {
        this.episode.state = "no-answers";
        this.startCountdown(5);
      }
    } else if (
      this.episode.state === "no-answers" ||
      this.episode.state === "no-votes"
    ) {
      this.updateEpisodeResult();
      this.startEpisode();
    } else if (this.episode.state === "vote") {
      // this.episode.state = "results"
      if (this.episode.player_votes.length > 0) {
        this.updateEpisodeResult();
        this.episode.state = "results";
        this.startCountdown(5);
      } else {
        this.episode.state = "no-votes";
        this.startCountdown(5);
      }
      this.startCountdown(5);
    } else if (this.episode.state === "results") {
      this.startEpisode();
    } else if (this.episode.state === "ended") {
      this.clearInterval(this.countdownInterval);
      this.updateGame("game-over");
    }
  }

  updateEpisodeResult() {
    let answers = this.episode.answers;
    if (this.episode.state === "vote") {
      try {
        let answers = this.episode.answers.sort((b, a) => {
          if (a.count < b.count) {
            return -1;
          }
          if (a.count > b.count) {
            return 1;
          }
          return 0;
        });
        //let answer = false
        //let answerVotes = 0;
        answers[0].player.score +=1;
        
        this.episode.result = {
          state: "winner", // "winner","draw","failed"
          winner: answers[0].player,
          question: this.episode.question,
          answer: answers[0],
          votes: answers[0].count,
          answers,
        };
      } catch (ex) {
        this.episode.result = {
          ex: ex,
          state: "failed", // "winner","draw","failed"
          winner: { username: "", score: 0 },
          question: this.episode.question,
          answer: { text: "No consensus was reached" },
          votes: 0,
          answers,
        };
      }
    } else {
      this.episode.result = {
        state: "failed", // "winner","draw","failed"
        winner: { username: "", score: 0 },
        question: this.episode.question,
        answer: { text: "No consensus was reached" },
        votes: 0,
        answers,
      };
    }

    this.lastEpisodeResult = this.episode.result;
    this.history.push(this.episode);
  }

  startEpisode() {
    this.episode = {
      question: this.questions.shift(0), //[0],
      answers: [],
      complete: false,
      player_answers: [],
      player_votes: [],
      timeout: 120,
      result: {
        state: "winner", // "winner","draw","failed" , "no-answers"
        winner: {},
        question: {},
        answer: {},
        votes: 0,
      },
      state: "answer",
    };
    this.draw();

    this.startCountdown();
    //this.updateCounter(this.timeout);
  }

  shuffleDeck(initial = true) {
    //this.players = [];
    if (initial) {
      this.cards = CARDS;
      this.score = {};
      this.questions = this.shuffle(
        this.cards.filter((el) => el.cardType === "Q")
      );
      this.answers = this.shuffle(
        this.cards.filter((el) => el.cardType === "A")
      );

      for (let i = 0; i < this.playerManager.players.length; i++) {
        this.playerManager.players[i].reset();
      }
    } else {
      this.answers = this.shuffle(this.answers); //.filter((el) => el.cardType === "A"));
    }
  }
  shuffle(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }

    return array;
  }
}

module.exports = GameManager;

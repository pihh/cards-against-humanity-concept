require("dotenv").config();

/**
 * Module dependencies.
 */

const app = require("./app");
const http = require("http");

/**
 * Get port from environment and store in Express.
 */

const port = normalizePort(process.env.PORT || "3000");
app.set("port", port);

/**
 * Create HTTP server.
 */

const server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  const port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }

  const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  console.log("App started. Listening on " + bind);
}

/**
 * RTC configurations
 */

const io = require("socket.io")(server, {
  cors: { origin: "*" },
});

// const Game = require("./src/game3");
const GameManager = require("./game/game");
const Game = new GameManager();

Game.on("update-player", function (data) {
  // console.log("manager event -> update-player", data);
  try {
   
    // console.log({socketId: data.player.socketId,data})
    io.to(data.player.socketId).emit("update-player", data);
  } catch (ex) {
    // ...
  }
});

Game.on("update-game", function (data) {
  // console.log("manager event -> update-game", data);
  try {
    console.log('update-game',data)
    io.emit("update-game", data);
  } catch (ex) {
    // ...
  }
});

io.on("connection", (socket) => {
  console.log("new connection", socket.id);

  socket.on("handshake", (data) => {
    const player = Game.playerManager.registerPlayer(
      data.uuid,
      data.username,
      socket.id
    );
    // player.gameData= Game.getData()
    // player.gameData.players = []
    console.log("handshake", data);
    // player.game = Game.getData()
    io.to(socket.id).emit("identified", player);
  });

  socket.on("join", (data) => {
    const player = Game.playerManager.getPlayer(socket.id);
 
    Game.join(player);
  });

  socket.on("update-username", (data) => {
    const player = Game.playerManager.getPlayer(socket.id);
    // console.log("update-username", player);

    Game.updateUsername(player, data);
  });

  socket.on("answer", (data) => {
    const player = Game.playerManager.getPlayer(socket.id);
    // console.log("answer", data);
    Game.answer(player, data);
    //io.to(socket.id).emit("identified", player);
  });

  socket.on("vote", (data) => {
    const player = Game.playerManager.getPlayer(socket.id);
    // console.log("vote", data);
    Game.vote(player, data);
  });

  socket.on("voice", function (data) {
    try{
      console.log("voice", data);
      if(data){
        
        // var newData = data.split(";");
        // newData[0] = "data:audio/ogg;";
        // newData = newData[0] + newData[1];
        const player = Game.playerManager.getPlayer(socket.id);
        let onlinePlayers = Game.playerManager.getOnlinePlayers()
        console.log({onlinePlayers})
        for(let onlinePlayer of onlinePlayers){
          if(onlinePlayer.id !== player.id){
            try{

              io.to(onlinePlayer.socketId).emit("voice-message", data);
              
              console.log('')
              console.log('emited voice message')
            }catch(ex){
              
            }
          }

        }
      }
    }catch(ex){
      console.warn("Voice emit error",ex)
    }
  
  });

  socket.on("disconnect", () => {
    console.log("disconnected", socket.id);
    let player = Game.playerManager.getPlayer(socket.id);
    if (player) {
      Game.leave(player); //.online = false;
    }
  });
});

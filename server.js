var express= require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

process.env.PWD = process.cwd()
app.use(express.static(process.env.PWD + '/public'));

app.get('/', function(req, res){
	res.sendfile('index.html');
});

function Player(id, x, y, rotation, color){
	this.id = id;
	this.x = x;
	this.y = y;
	this.rotation = rotation;
	this.color = color;
}

var serverData = {
	'playerList': []
};

io.on('connection', function(client){
	console.log('Connected ID: ' + client.id);
	var player = new Player(client.id);
	serverData.playerList.push(player);
	
	io.emit('server data', serverData);
	
	client.on('disconnect', function(){
		console.log('Disconnected ID: ' + client.id);
		serverData.playerList = serverData.playerList.filter(function(player){
			return player.id != client.id;
		});
	});
	
	client.on('client data', function(clientPlayer){
		player.x = clientPlayer.x;
		player.y = clientPlayer.y;
		player.rotation = clientPlayer.rotation;
		player.color = clientPlayer.color;
		
		updatePlayerList(client.id, player.x, player.y, player.rotation, player.color);
		io.emit('server data', serverData);
	});
});

function updatePlayerList(id, x, y, rotation, color){
	for (player in serverData.playerList){
		if (player.id == id) {
			player.x = x;
			player.y = y;
			player.rotation = rotation;
			player.color = color;
		}
	}
}

http.listen(3000, function(){
	console.log('listening on *:3000');
});
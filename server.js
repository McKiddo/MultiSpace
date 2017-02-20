var express= require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

process.env.PWD = process.cwd()
app.use(express.static(process.env.PWD + '/public'));

app.get('/', function(req, res){
	res.sendfile('index.html');
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});

//Game vars

function Player(id, name, x, y, rotation){
	this.id = id;
	this.name = name;
	this.x = x;
	this.y = y;
	this.rotation = rotation;
	this.hp = 10;
	this.score = 0;
}

function Bullet(id, x, y, sx, sy, rotation){
	this.id = id;
	this.x = x;
	this.y = y;
	this.speedX = sx;
	this.speedY = sy;
	this.rotation = rotation;
}

let planeSize = {
	'x': 1500,
	'y': 1000
}

var serverData = {
	'playerList': [],
	'bulletList': [],
	'planeSize': planeSize
};

io.on('connection', function(client){
	console.log('Connected ID: ' + client.id);
	var player;
	io.emit('server data', serverData);
	
	client.on('disconnect', function(){
		console.log('Disconnected ID: ' + client.id);
		serverData.playerList = serverData.playerList.filter(function(player){
			return player.id != client.id;
		});
	});
	
	client.on('respawn', function(){
		var inList = false;
		
		for (var i = 0; i < serverData.playerList.length; i++){
			if (player === serverData.playerList[i]){
				inList = true;
			}
		}
		
		if (!inList){
			player = new Player(client.id);
			serverData.playerList.push(player);
		} else {
			console.log('Respawn failed ID: ' + player.id);
		}
	});
	
	client.on('client data', function(clientPlayer){
		updatePlayerInList(client.id, clientPlayer.name, clientPlayer.x, clientPlayer.y, clientPlayer.rotation);
		io.emit('server data', serverData);
	});
	
	client.on('shot fired', function(){
		var speedX = 10 * Math.cos(player.rotation - Math.PI / 2);
		var speedY = 10 * Math.sin(player.rotation - Math.PI / 2);
		
		var bullet = new Bullet(player.id, player.x, player.y, speedX, speedY, player.rotation);
		serverData.bulletList.push(bullet);
	});
});

function updatePlayerInList(id, name, x, y, rotation){
	for (var i = 0; i < serverData.playerList.length; i++){
		let player = serverData.playerList[i];
		if (player.id == id){
			player.name = name;
			player.x = x;
			player.y = y;
			player.rotation = rotation;
		}
	}
}

function bulletMove(){
	for (var i = 0; i < serverData.bulletList.length; i++){
		let bullet = serverData.bulletList[i];
		for (var j = 0; j < serverData.playerList.length; j++){
			let player = serverData.playerList[j];
			
			if (player.id == bullet.id) {
				var a = bullet.x - player.x;
				var b = bullet.y - player.y;
				var dist = Math.hypot(a, b);
			
				if (dist > 1000){
					serverData.bulletList.splice(i, 1);
				}
			}
		}
		
		bullet.x += bullet.speedX;
		bullet.y += bullet.speedY;
	}
}

function bulletCollision(){
	for (var i = 0; i < serverData.bulletList.length; i++){
		let bullet = serverData.bulletList[i];
		for (var j = 0; j < serverData.playerList.length; j++){
			let player = serverData.playerList[j];
		
			if (player.id != bullet.id){
				var a = bullet.x - player.x;
				var b = bullet.y - player.y;
				var dist = Math.hypot(a, b);
			
				if (dist < 20){
					serverData.bulletList.splice(i, 1);
					player.hp -= 1;
					
					if (player.hp <= 0){
						io.emit('death', player.id, bullet.id);
						serverData.playerList.splice(j, 1);
						
						var killer = serverData.playerList.filter(function(e){
							return e.id == bullet.id;
						});
						
						if (killer[0] != undefined) {
							killer[0].score += 1;
						}
					}
				}
			}
		}
	}
}

//Compute every 10ms
setInterval(function(){
	bulletMove();
	bulletCollision();
}, 10);
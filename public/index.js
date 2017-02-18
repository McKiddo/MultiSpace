var client = io();
			
var canvas = document.getElementById("mainCanvas");
var context = canvas.getContext("2d");
context.canvas.width = window.innerWidth;
context.canvas.height = window.innerHeight;
			
var playerImg = new Image();
playerImg.src = 'player.png';
var scale = 0.3;

function Player(id, x, y, rotation, color){
	this.id = id;
	this.x = x;
	this.y = y;
	this.speedX = 0;
	this.speedY = 0;
	this.rotation = rotation;
	this.color = color;
}

var thisPlayer = new Player(0, context.canvas.width / 2, context.canvas.height / 2, 0, 0);
var localServerData = {
	'playerList': [0]
};

var move = false;
var mouse = {
	'x': 0,
	'y': 0
};

client.on('connect', function(){
	thisPlayer.id = client.io.engine.id;
});

client.on('server data', function(serverData){
	localServerData = serverData;
});

function sendData() {
	client.emit('client data', thisPlayer);
}

$('#mainCanvas').mousemove(function(e){
	thisPlayer.rotation = Math.atan2(e.pageY - (thisPlayer.y + playerImg.height * scale / 2), e.pageX - (thisPlayer.x + playerImg.width * scale / 2)) + Math.PI / 2;
	mouse.x = e.pageX;
	mouse.y = e.pageY;
});

$('#mainCanvas').mousedown(function(e){
	if (e.which == 1) {
		move = true;
	}
});

$('#mainCanvas').mouseup(function(e){
	if (e.which == 1) {
		move = false;
	}
});

function physic(){
	if (move){
		thisPlayer.speedX += (mouse.x - thisPlayer.x) / 3000;
		thisPlayer.speedY += (mouse.y - thisPlayer.y) / 3000;
	}
	
	thisPlayer.x += thisPlayer.speedX;
	thisPlayer.y += thisPlayer.speedY;
	sendData();
}

function draw(playerList){
	context.clearRect(0, 0, canvas.width, canvas.height);
	for (var i = 0; i < playerList.length; i++){
		var player = playerList[i];
		if (player.id != thisPlayer.id) {
			context.globalAlpha = 0.5;
			context.save();
			context.translate(player.x + playerImg.width * scale / 2, player.y + playerImg.height * scale / 2);
			context.rotate(player.rotation);
			context.translate(-(player.x + playerImg.width * scale / 2), -(player.y + playerImg.height * scale / 2));
			context.drawImage(playerImg, player.x, player.y, playerImg.width * scale, playerImg.height * scale);
			context.restore();
			console.log(player.id);
			console.log(thisPlayer.id);
			console.log('--');
		}
	}
	context.globalAlpha = 1;
	context.save();
	context.translate(thisPlayer.x + playerImg.width * scale / 2, thisPlayer.y + playerImg.height * scale / 2);
	context.rotate(thisPlayer.rotation);
	context.translate(-(thisPlayer.x + playerImg.width * scale / 2), -(thisPlayer.y + playerImg.height * scale / 2));
	context.drawImage(playerImg, thisPlayer.x, thisPlayer.y, playerImg.width * scale, playerImg.height * scale);
	context.restore();
}

window.setInterval(function(){
	physic();
	draw(localServerData.playerList);
}, 10);
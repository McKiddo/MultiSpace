var client = io();
			
//Canvas
var canvas = document.getElementById("mainCanvas");
var context = canvas.getContext("2d");
context.canvas.width = window.innerWidth;
context.canvas.height = window.innerHeight;
			
//Player appearence
var playerImg = new Image();
playerImg.src = 'player.png';
var scale = 0.3;

//Control vars
var gameState = 0;
var move = false;
var mouse = {
	'x': 0,
	'y': 0
};

var name = '';
var killerID = 0;

function Player(id, name, x, y, rotation){
	this.id = id;
	this.name = name;
	this.x = x;
	this.y = y;
	this.speedX = 0;
	this.speedY = 0;
	this.rotation = rotation;
	this.score = 0;
}

var thisPlayer = new Player(0, '', context.canvas.width / 2, context.canvas.height / 2, 0);
var localServerData = {
	'playerList': [0],
	'bulletList': [0]
};

//Client-server interaction
client.on('connect', function(){
	thisPlayer.id = client.io.engine.id;
	client.emit('respawn');
});

client.on('server data', function(serverData){
	localServerData = serverData;
});

client.on('death', function(deathID, bulletID){
	if (thisPlayer.id == deathID){
		killerID = bulletID;
		gameState = 2;
		setTimeout(function(){
			thisPlayer = new Player(client.io.engine.id, name, context.canvas.width / 2, context.canvas.height / 2, 0);
			client.emit('respawn');
			gameState = 1;
		}, 2000);
	}
});

//Client-player interaction
$('#mainCanvas').mousemove(function(e){
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

$(document).keydown(function(e){
	if (e.keyCode == 90) {
		client.emit('shot fired');
	}
});

//Pre-game functions
$('#nameForm').submit(function(e){
	name = $('#textBox').val();
	if (name != '' && name.length <= 10){
		thisPlayer.name = name;
		$('#nameForm').hide();
		$('#mainCanvas').css('display', 'block');
		gameState = 1;
	}
	return false;
});

//Game functions
function sendData() {
	client.emit('client data', thisPlayer);
}

function physic(){
	if (move){
		thisPlayer.speedX += (mouse.x - (thisPlayer.x + playerImg.width * scale / 2)) / 3000;
		thisPlayer.speedY += (mouse.y - (thisPlayer.y + playerImg.height * scale / 2)) / 3000;
	}
	
	thisPlayer.x += thisPlayer.speedX;
	thisPlayer.y += thisPlayer.speedY;
	thisPlayer.rotation = Math.atan2(mouse.y - (thisPlayer.y + playerImg.height * scale / 2), mouse.x - (thisPlayer.x + playerImg.width * scale / 2)) + Math.PI / 2;
	sendData();
}

function drawPlayers(playerList){
	for (var i = 0; i < playerList.length; i++){
		let player = playerList[i];
		if (player.id != thisPlayer.id) {
			context.globalAlpha = 0.6;
			context.save();
			context.translate(player.x + playerImg.width * scale / 2, player.y + playerImg.height * scale / 2);
			context.rotate(player.rotation);
			context.translate(-(player.x + playerImg.width * scale / 2), -(player.y + playerImg.height * scale / 2));
			context.drawImage(playerImg, player.x, player.y, playerImg.width * scale, playerImg.height * scale);
			context.restore();
			
			context.font = '8pt Calibri'
			context.textAlign = 'center';
			context.fillStyle = 'black';
			var displayText = player.name + ' : ' + player.score;
			context.fillText(displayText, player.x + playerImg.width * scale / 2, player.y - 7);
			context.fillRect(player.x + playerImg.width * scale / 2 - 15, player.y - 5, 3 * player.hp, 3);
			context.globalAlpha = 1;
		}
	}
}

function drawSelf(){
	context.save();
	context.translate(thisPlayer.x + playerImg.width * scale / 2, thisPlayer.y + playerImg.height * scale / 2);
	context.rotate(thisPlayer.rotation);
	context.translate(-(thisPlayer.x + playerImg.width * scale / 2), -(thisPlayer.y + playerImg.height * scale / 2));
	context.drawImage(playerImg, thisPlayer.x, thisPlayer.y, playerImg.width * scale, playerImg.height * scale);
	context.restore();
	
	context.font = '8pt Calibri'
	context.textAlign = 'center';
	context.fillStyle = 'black';
	
	var currentPlayer = $.grep(localServerData.playerList, function(e){
		return e.id == thisPlayer.id;
	});
	
	var displayText = thisPlayer.name + ' : ' + currentPlayer[0].score;
	context.fillText(displayText, thisPlayer.x + playerImg.width * scale / 2, thisPlayer.y - 7);
	context.fillRect(thisPlayer.x + playerImg.width * scale / 2 - 15, thisPlayer.y - 5, 3 * currentPlayer[0].hp, 3);
}

function drawBullets(bulletList){
	for (var i = 0; i < bulletList.length; i++){
		let bullet = bulletList[i];
		context.globalAlpha = 1;
		context.save();
		context.translate(bullet.x + playerImg.width * scale / 2, bullet.y + playerImg.height * scale / 2);
		context.rotate(bullet.rotation);
		context.translate(-(bullet.x + playerImg.width * scale / 2), -(bullet.y + playerImg.height * scale / 2));
		context.fillStyle = "grey";
		context.fillRect(bullet.x + playerImg.width * scale / 2, bullet.y + playerImg.height * scale / 2, 2, 10);
		context.restore();
	}
}

//Post-game functions
function drawDead(){
	//context.clearRect(0, 0, canvas.width, canvas.height);
	context.font = '60px Calibri';
	context.fillStyle = 'grey';
	var killer = $.grep(localServerData.playerList, function(e){ return e.id == killerID; });
	var deathMessage = 'Killed by ' + killer[0].name;
	context.fillText(deathMessage, canvas.width/2, canvas.height/2);
}

//Compute every 10ms
window.setInterval(function(){
	if (gameState == 1){
		physic();
	}
	
	context.clearRect(0, 0, canvas.width, canvas.height);
	drawBullets(localServerData.bulletList);
	drawPlayers(localServerData.playerList);
	
	if (gameState == 1){
		drawSelf();
	}
	
	if (gameState == 2){
		drawDead();
	}
}, 10);
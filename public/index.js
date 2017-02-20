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
var fireAllowed = true;
var mouse = {
	'x': 0,
	'y': 0
};
var offset = {
	'x': 0,
	'y': 0
}
var cameraPan = {
	'x': 0,
	'y': 0
}

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
}

var localServerData = {
	'playerList': [0],
	'bulletList': [0],
	'planeSize': {
		'x': 0,
		'y': 0
	}
};
var thisPlayer = new Player();

//Client-server interaction
client.on('connect', function(){
	thisPlayer.id = client.io.engine.id;
});

client.on('server data', function(serverData){
	localServerData = serverData;
});

//Pre-game functions
$('#nameForm').submit(function(e){
	name = $('#textBox').val();
	if (name != '' && name.length <= 10){
		thisPlayer.name = name;
		$('#nameForm').hide();
		$('#mainCanvas').css('display', 'block');
		beginGame();
	}
	return false;
});

//Game functions
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
	if (fireAllowed && e.keyCode == 90) {
		client.emit('shot fired');
		fireAllowed = false;
	}
});

$(document).keyup(function(e){
	if (e.keyCode == 90) {
		fireAllowed = true;
	}
});

$(window).on('resize', function(e){
	context.canvas.width = window.innerWidth;
	context.canvas.height = window.innerHeight;
});

function beginGame(){
	thisPlayer.x = Math.random() * ((localServerData.planeSize.x - 10) - 10) + 10;
	thisPlayer.y = Math.random() * ((localServerData.planeSize.y - 10) - 10) + 10;
	client.emit('respawn');
	gameState = 1;
}

function sendData(){
	client.emit('client data', thisPlayer);
}

function getOffset(){
	offset.x = window.innerWidth / 2 - thisPlayer.x;
	offset.y = window.innerHeight / 2 - thisPlayer.y;
	
	if (localServerData.planeSize.x < window.innerWidth){
		offset.x = (window.innerWidth - localServerData.planeSize.x) / 2;
		cameraPan.x = -(thisPlayer.x - window.innerWidth / 2 + offset.x);
	} else {
		if (offset.x > 20){
			cameraPan.x = offset.x - 20;
			offset.x = 20;
		} else if (offset.x < -localServerData.planeSize.x - 20 + window.innerWidth){
			cameraPan.x = offset.x + localServerData.planeSize.x - window.innerWidth + 20;
			offset.x = -localServerData.planeSize.x - 20 + window.innerWidth;
		} else {
			cameraPan.x = 0;
		}
	}
	
	if (localServerData.planeSize.y < window.innerHeight){
		offset.y = (window.innerHeight - localServerData.planeSize.y) / 2;
		cameraPan.y = -(thisPlayer.y - window.innerHeight / 2 + offset.y);
	} else {
		if (offset.y > 20){
			cameraPan.y = offset.y - 20;
			offset.y = 20;
		} else if (offset.y < -localServerData.planeSize.y - 20 + window.innerHeight){
			cameraPan.y = offset.y + localServerData.planeSize.y - window.innerHeight + 20;
			offset.y = -localServerData.planeSize.y - 20 + window.innerHeight;
		} else {
			cameraPan.y = 0;
		}
	}
}

function physic(){
	if (move){
		thisPlayer.speedX += (mouse.x - (window.innerWidth / 2) + cameraPan.x) / 3000;
		thisPlayer.speedY += (mouse.y - (window.innerHeight / 2) + cameraPan.y) / 3000;
	}
	
	var wallFriction = 3;
	
	if (thisPlayer.x < 0 || thisPlayer.x > localServerData.planeSize.x){
		thisPlayer.speedX = -thisPlayer.speedX;
		thisPlayer.x += thisPlayer.speedX;
		thisPlayer.x += thisPlayer.speedX;
		thisPlayer.speedX = thisPlayer.speedX / wallFriction;
		console.log('x: ' + thisPlayer.x + ' sx: ' + thisPlayer.speedX);
	} else {
		thisPlayer.x += thisPlayer.speedX;
	}
	
	if (thisPlayer.y < 0 || thisPlayer.y > localServerData.planeSize.y){
		thisPlayer.speedY = -thisPlayer.speedY;
		thisPlayer.y += thisPlayer.speedY;
		thisPlayer.y += thisPlayer.speedY;
		thisPlayer.speedY = thisPlayer.speedY / wallFriction;
		console.log('y: ' + thisPlayer.y + ' sy: ' + thisPlayer.speedY);
	} else {
		thisPlayer.y += thisPlayer.speedY;
	}
	
	thisPlayer.rotation = Math.atan2(mouse.y - window.innerHeight / 2 + cameraPan.y, mouse.x - window.innerWidth / 2 + cameraPan.x) + Math.PI / 2;
	sendData();
}

function drawSelf(){
	context.save();
	context.translate(window.innerWidth / 2 - cameraPan.x, window.innerHeight / 2 - cameraPan.y);
	context.rotate(thisPlayer.rotation);
	context.translate(-(window.innerWidth / 2 - cameraPan.x), -(window.innerHeight / 2 - cameraPan.y));
	context.drawImage(playerImg, window.innerWidth / 2 - playerImg.width * scale / 2 - cameraPan.x, window.innerHeight / 2 - playerImg.height * scale / 2 - cameraPan.y, playerImg.width * scale, playerImg.height * scale);
	context.restore();
	
	context.font = '8pt Roboto';
	context.textAlign = 'center';
	context.fillStyle = 'black';
	
	var score = 0;
	var hp = 10;
	var currentPlayer = $.grep(localServerData.playerList, function(e){
		return e.id == thisPlayer.id;
	});
	
	if (currentPlayer[0] != undefined){
		score = currentPlayer[0].score;
		hp = currentPlayer[0].hp;
	}
	
	var displayText = thisPlayer.name + ' : ' + score;
	context.fillText(displayText, window.innerWidth / 2 - cameraPan.x, window.innerHeight / 2 - cameraPan.y - 27);
	context.fillRect(window.innerWidth / 2 - 15 + 1.5 * (10 - hp) - cameraPan.x, window.innerHeight / 2 - cameraPan.y - 25, 3 * hp, 3);
}

function drawPlayers(playerList){
	for (var i = 0; i < playerList.length; i++){
		let player = playerList[i];
		if (player.id != thisPlayer.id) {
			context.globalAlpha = 0.6;
			context.save();
			context.translate(player.x + offset.x, player.y + offset.y);
			context.rotate(player.rotation);
			context.translate(-(player.x + offset.x), -(player.y + offset.y));
			context.drawImage(playerImg, player.x + offset.x - playerImg.width * scale / 2, player.y + offset.y - playerImg.height * scale / 2, playerImg.width * scale, playerImg.height * scale);
			context.restore();
			
			context.font = '8pt Roboto';
			context.textAlign = 'center';
			context.fillStyle = 'black';
			var displayText = player.name + ' : ' + player.score;
			context.fillText(displayText, player.x  + offset.x, player.y + offset.y - 27);
			context.fillRect(player.x + offset.x - 15 + 1.5 * (10 - player.hp), player.y + offset.y - 25, 3 * player.hp, 3);
			context.globalAlpha = 1;
		}
	}
}

function drawBullets(bulletList){
	for (var i = 0; i < bulletList.length; i++){
		let bullet = bulletList[i];
		context.globalAlpha = 1;
		context.save();
		context.translate(bullet.x  + offset.x, bullet.y + offset.y);
		context.rotate(bullet.rotation);
		context.translate(-(bullet.x  + offset.x), -(bullet.y + offset.y));
		context.fillStyle = "grey";
		context.fillRect(bullet.x  + offset.x, bullet.y + offset.y, 2, 10);
		context.restore();
	}
}

function drawBounds(){
	context.fillStyle = '#efefef';
	context.fillRect(0, 0, window.innerWidth, window.innerHeight);
	
	context.fillStyle = '#ffffff';
	context.fillRect(offset.x, offset.y, localServerData.planeSize.x, localServerData.planeSize.y);
	
	context.fillStyle = '#dbdbdb';
	
	var planeMarksScale = 500;
	
	for (var i = 1; i < localServerData.planeSize.x / planeMarksScale; i++){
		context.fillRect(i * planeMarksScale + offset.x, 0 + offset.y, 2, localServerData.planeSize.y);
	}
	
	for (var i = 1; i < localServerData.planeSize.y / planeMarksScale; i++){
		context.fillRect(0 + offset.x, i * planeMarksScale + offset.y, localServerData.planeSize.x, 2);
	}
	
	context.strokeRect(0 + offset.x, 0 + offset.y, localServerData.planeSize.x, localServerData.planeSize.y);
}

function drawScoreboard(playerList){
	var scoreList = playerList.sort(function(a, b){
			var keyA = a.score;
			var keyB = b.score;

			if(keyA > keyB) return -1;
			if(keyA < keyB) return 1;
			return 0;
		});
	
	for (var i = 0; i < scoreList.length; i++){
		var player = scoreList[i];
		
		context.font = '14pt Roboto';
		context.textAlign = 'right';
		context.fillStyle = 'black';
		context.fillText('Players', window.innerWidth - 30, 40);
		var displayText = player.name + ' : ' + player.score;
		context.font = '10pt Roboto';
		context.fillText(displayText, window.innerWidth - 30, 60 + 20 * i);
	}
}

//Post-game functions
client.on('death', function(deathID, bulletID){
	if (thisPlayer.id == deathID){
		killerID = bulletID;
		gameState = 2;
		setTimeout(function(){
			thisPlayer = new Player(client.io.engine.id, name, window.innerHeight / 2, window.innerHeight / 2, 0);
			client.emit('respawn');
			gameState = 1;
		}, 2000);
	}
});

function drawDead(){
	context.textAlign = 'center';
	context.font = '60px Roboto';
	context.fillStyle = 'grey';
	var killer = $.grep(localServerData.playerList, function(e){ return e.id == killerID; });
	var deathMessage = '';
	if (killer[0] != undefined){
		deathMessage = 'Killed by ' + killer[0].name;
	} else {
		deathMessage = 'Killed by a ghost. Spooky.';
	}
	context.fillText(deathMessage, window.innerWidth / 2, window.innerHeight / 2);
}

//Compute every 10ms
window.setInterval(function(){
	getOffset();
	if (gameState == 1){
		physic();
	}
	
	context.clearRect(0, 0, canvas.width, canvas.height);
	drawBounds();
	drawBullets(localServerData.bulletList);
	drawPlayers(localServerData.playerList);
	if (gameState == 1){
		drawSelf();
	}
	drawScoreboard(localServerData.playerList);
	if (gameState == 2){
		drawDead();
	}
}, 10);
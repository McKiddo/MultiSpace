var client = io();
			
//Canvas
var canvas = document.getElementById("mainCanvas");
var context = canvas.getContext("2d");
canvas.style.cursor = "default";
context.canvas.width = window.innerWidth;
context.canvas.height = window.innerHeight;

//Lag compensation
function Buffer(id) {
    this.id = id;
    this.x = -1;
    this.y = -1;
}
var thisBuffer = new Buffer(0);
var bufferList = [];

//Sound
var chatSound = new Audio('chat.wav');

//Player appearance
var playerImg = new Image();
playerImg.src = 'player.png';
var scale = 0.3;

//Control vars
var gameState = 0;
var applyForce = false;
var mouse = {
	'x': 0,
	'y': 0
};
var offset = {
	'x': 0,
	'y': 0
};
var cameraPan = {
	'x': 0,
	'y': 0
};

var killerID = 0;

function Player(){
	this.id = '';
	this.name = '';
	this.x = 0;
	this.y = 0;
	this.speedX = 0;
	this.speedY = 0;
	this.rotation = 0;
    this.force = 0;
    this.hp = 10;
    this.streak = 0;
    this.score = 0;
    this.dead = false;
}

var localServerData = {
	'playerList': [],
	'bulletList': [],
	'planeSize': {
		'x': 0,
		'y': 0},
	'bullet1stk': 1,
    'bullet2stk': 2
};
var thisPlayer = new Player();

var messageList = [];

//Client-server interaction
client.on('connect', function(){
	thisPlayer.id = client.io.engine.id;
});

client.on('server data', function(serverData){
	localServerData = serverData;
	readPlayer();
});

client.on('server message', function(msg){
	if (messageList.length > 10){
		messageList.pop();
	}
	messageList.unshift(msg);
	chatSound.play();
});

//Pre-game functions
$('#nameForm').submit(function(){
	var name = $('#textBox').val();
	if (name != '' && name.length <= 15){
		thisPlayer.name = name;
		$('#nameForm').hide();
		$('#mainCanvas').css('display', 'block');
		$('#chatForm').css('display', 'block');
		beginGame();
	}
	return false;
});

//In-game functions
$('#chatForm').submit(function(){
	var chatBox = $('#chatBox');
	var msg = chatBox.val();
	if (msg != '' && msg.length <= 50){
        chatBox.val('');
		client.emit('client message', msg);
	}
	return false;
});

$('#mainCanvas').on('mousemove', function(e){
	mouse.x = e.pageX;
	mouse.y = e.pageY;
})
				.on('mousedown', function(e){
	if (e.which == 1) {
		applyForce = true;
	}
})
				.on('mouseup', function(e){
	if (e.which == 1) {
		applyForce = false;
	}
});

$(document).on('keydown', function(e){
	if (e.keyCode == 90 && e.target.tagName.toLowerCase() != 'input') {
		client.emit('shot fired');
	}
});

$(window).on('resize', function(){
	context.canvas.width = window.innerWidth;
	context.canvas.height = window.innerHeight;
});

function lagCompStart(){
    if (thisPlayer.x == thisBuffer.x && thisPlayer.y == thisBuffer.y){
        thisPlayer.x += thisPlayer.speedX;
        thisPlayer.y += thisPlayer.speedY;
    }
}

function lagCompEnd() {
    thisBuffer.x = thisPlayer.x;
    thisBuffer.y = thisPlayer.y;
}

function beginGame(){
    client.emit('respawn', thisPlayer.name);
	gameState = 1;
}

function readPlayer() {
	var thisPlayerServer = $.grep(localServerData.playerList, function(e){
        return e.id == thisPlayer.id;
    })[0];

    thisPlayer.x = thisPlayerServer.x;
    thisPlayer.y = thisPlayerServer.y;
    thisPlayer.speedX = thisPlayerServer.speedX;
    thisPlayer.speedY = thisPlayerServer.speedY;
    thisPlayer.hp = thisPlayerServer.hp;
    thisPlayer.score = thisPlayerServer.score;
    thisPlayer.streak = thisPlayerServer.streak;
    thisPlayer.dead = thisPlayerServer.dead;
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

function sendData(){
	if (applyForce){
        var x = mouse.x - window.innerWidth / 2 + cameraPan.x;
        var y = mouse.y - window.innerHeight / 2 + cameraPan.y;

        thisPlayer.force = Math.hypot(x, y);
	} else {
		thisPlayer.force = 0;
	}

	thisPlayer.rotation = Math.atan2(mouse.y - window.innerHeight / 2 + cameraPan.y,
									 mouse.x - window.innerWidth / 2 + cameraPan.x) + Math.PI / 2;

    client.emit('client data', thisPlayer);
}

function drawSelf(){
	if (thisPlayer.dead){
		context.globalAlpha = 0.25;
	} else {
        context.globalAlpha = 1;
	}

	context.save();
	context.translate(window.innerWidth / 2 - cameraPan.x, window.innerHeight / 2 - cameraPan.y);
	context.rotate(thisPlayer.rotation);
	context.translate(-(window.innerWidth / 2 - cameraPan.x), -(window.innerHeight / 2 - cameraPan.y));
	context.drawImage(playerImg, window.innerWidth / 2 - playerImg.width * scale / 2 - cameraPan.x, window.innerHeight / 2 - playerImg.height * scale / 2 - cameraPan.y, playerImg.width * scale, playerImg.height * scale);
	context.restore();

	context.font = '8pt Roboto';
	context.textAlign = 'center';
	context.fillStyle = 'black';

	var type = '';

	if (thisPlayer.streak >= localServerData.bullet1stk){
		type = ' ★'
	}
	if (thisPlayer.streak >= localServerData.bullet2stk){
		type = ' ☢'
	}

	var displayText = thisPlayer.name + type;
	context.fillText(displayText, window.innerWidth / 2 - cameraPan.x, window.innerHeight / 2 - cameraPan.y - 27);
	context.fillRect(window.innerWidth / 2 - 15 + 1.5 * (10 - thisPlayer.hp) - cameraPan.x, window.innerHeight / 2 - cameraPan.y - 25, 3 * thisPlayer.hp, 3);
}

function drawPlayers(playerList){
	for (var i = 0; i < playerList.length; i++){
		let player = playerList[i];
		if (player.id != thisPlayer.id && player.nameSet){
		    var buffer = bufferList.filter(function(e){
                return e.id == player.id;
            });

            if (player.x == buffer.x && player.y == buffer.y){
                player.x += player.speedX;
                player.y += player.speedY;
            }

		    if (!player.dead){
                context.globalAlpha = 0.8;
			} else {
                context.globalAlpha = 0.5;
			}

			context.save();
			context.translate(player.x + offset.x, player.y + offset.y);
			context.rotate(player.rotation);
			context.translate(-(player.x + offset.x), -(player.y + offset.y));
			context.drawImage(playerImg, player.x + offset.x - playerImg.width * scale / 2, player.y + offset.y - playerImg.height * scale / 2, playerImg.width * scale, playerImg.height * scale);
			context.restore();

			context.font = '8pt Roboto';
			context.textAlign = 'center';
			context.fillStyle = 'black';

            var type = '';

            if (player.streak >= localServerData.bullet1stk){
                type = ' ★'
            }
            if (player.streak >= localServerData.bullet2stk){
                type = ' ☢'
            }

			var displayText = player.name + type;
			context.fillText(displayText, player.x  + offset.x, player.y + offset.y - 27);
			context.fillRect(player.x + offset.x - 15 + 1.5 * (10 - player.hp), player.y + offset.y - 25, 3 * player.hp, 3);
			context.globalAlpha = 1;

			buffer.x = player.x;
			buffer.y = player.y;
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
		context.fillStyle = "black";

		var width = 2;
		var height = 10;

		if (bullet.type == 1){
            width = 2;
            height = 25;
		} else if (bullet.type == 2){
            width = 8;
            height = 8;
		}

		context.fillRect(bullet.x + offset.x, bullet.y + offset.y, width, height);
		context.restore();
	}
}

function drawBounds(){
	context.fillStyle = '#ffffff';
	context.fillRect(offset.x, offset.y, localServerData.planeSize.x, localServerData.planeSize.y);

	context.fillStyle = '#dbdbdb';

	var planeMarksScale = 500;

	for (var i = 1; i < localServerData.planeSize.x / planeMarksScale; i++){
		context.fillRect(i * planeMarksScale + offset.x, offset.y, 2, localServerData.planeSize.y);
	}

	for (i = 1; i < localServerData.planeSize.y / planeMarksScale; i++){
		context.fillRect(offset.x, i * planeMarksScale + offset.y, localServerData.planeSize.x, 2);
	}

	context.strokeRect(offset.x, offset.y, localServerData.planeSize.x, localServerData.planeSize.y);
}

function drawScoreboard(playerList){
	var scoreList = playerList.sort(function(a, b){
			var keyA = a.score;
			var keyB = b.score;

			if(keyA > keyB) return -1;
			if(keyA < keyB) return 1;
			return 0;
		});

	context.font = '14pt Roboto';
	context.textAlign = 'right';
	context.fillStyle = 'black';
	context.fillText('Players', window.innerWidth - 30, 40);
	context.font = '10pt Roboto';

	for (var i = 0; i < scoreList.length; i++){
		var player = scoreList[i];
		var displayText = player.name + ' : ' + player.score;
		if (player.name != ''){
            context.fillText(displayText, window.innerWidth - 30, 60 + 20 * i);
		} else {
            context.fillText('Joining...', window.innerWidth - 30, 60 + 20 * i);
		}
	}
}

function drawChat(){
	context.font = '10pt Roboto';
	context.textAlign = 'right';
	context.fillStyle = 'black';

	for (var i = 0; i < messageList.length; i++){
		var message = messageList[i];

		context.fillText(message, window.innerWidth - 30, window.innerHeight - 80 - 20 * i);
	}
}

//Post-game functions
client.on('death', function(deathID, bulletID){
	if (thisPlayer.id == deathID){
		killerID = bulletID;
		gameState = 2;
		setTimeout(function(){
			beginGame()
		}, 2000);
	}
});

function drawDead(){
	context.globalAlpha = 1;
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
        sendData();
	}

	lagCompStart();

	context.clearRect(0, 0, canvas.width, canvas.height);
	drawBounds();
	drawBullets(localServerData.bulletList);
	drawPlayers(localServerData.playerList);
	drawSelf();
	drawScoreboard(localServerData.playerList);
	drawChat();
	if (gameState == 2){
		drawDead();
	}

	lagCompEnd();
}, 10);
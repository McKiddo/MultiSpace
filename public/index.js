var client = io();

//System vars
var drawRate = 10;
var sendRate = 40;

var currentTime;
var deltaTime;
var lastTime = Date.now();
var lastDataTime;
var reconnectionTime = 2000;

var deltaDifference;

//Canvas
var canvas = document.getElementById("mainCanvas");
var context = canvas.getContext("2d");
canvas.style.cursor = "default";
context.canvas.width = window.innerWidth;
context.canvas.height = window.innerHeight;

//Lag compensation
var firstData = true;

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
    this.inGame = false;
}

function PlayerToSend(id, name, rotation, force){
    this.id = id;
    this.name = name;
    this.rotation = rotation;
    this.force = force;
}

var localServerData = {
	'playerList': [],
	'planeSize': {
		'x': 0,
		'y': 0},
    'autoStk': 1,
    'shotgunStk': 2,
    'nukeStk': 3,
	'bulletDecoy': 0,
	'maxBulletDecoy': 0,
    'wallFriction': 3,
	'hitboxRad': 20,
	'deltaTime': 0
};
var thisPlayer = new Player();

var bulletList = [];
var messageList = [];

//Connect to server
client.on('connect', function(){
	thisPlayer.id = client.io.engine.id;
});

//Controls
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

function beginGame(){
    client.emit('respawn', thisPlayer.name);
    gameState = 1;
}

//In-game functions
function lagCompensate(){
    thisPlayer.x += thisPlayer.speedX * deltaDifference;
    thisPlayer.y += thisPlayer.speedY * deltaDifference;

    if (thisPlayer.x < 10 || thisPlayer.x > localServerData.planeSize.x - 10){
        thisPlayer.speedX = -thisPlayer.speedX;
        thisPlayer.x += thisPlayer.speedX * deltaDifference;
        thisPlayer.x += thisPlayer.speedX * deltaDifference;
        thisPlayer.speedX = thisPlayer.speedX / localServerData.wallFriction;
    } else {
        thisPlayer.x += thisPlayer.speedX * deltaDifference;
    }

    if (thisPlayer.y < 10 || thisPlayer.y > localServerData.planeSize.y - 10){
        thisPlayer.speedY = -thisPlayer.speedY;
        thisPlayer.y += thisPlayer.speedY * deltaDifference;
        thisPlayer.y += thisPlayer.speedY * deltaDifference;
        thisPlayer.speedY = thisPlayer.speedY / localServerData.wallFriction;
    } else {
        thisPlayer.y += thisPlayer.speedY * deltaDifference;
    }

    for (var i = 0; i < localServerData.playerList.length; i++){
        let player = localServerData.playerList[i];

        if (player.id != thisPlayer.id && player.inGame) {
            player.x += player.speedX * deltaDifference;
            player.y += player.speedY * deltaDifference;

            if (player.x < 10 || player.x > localServerData.planeSize.x - 10) {
                player.speedX = -player.speedX;
                player.x += player.speedX * deltaDifference;
                player.x += player.speedX * deltaDifference;
                player.speedX = player.speedX / localServerData.wallFriction;
            } else {
                player.x += player.speedX * deltaDifference;
            }

            if (player.y < 10 || player.y > localServerData.planeSize.y - 10) {
                player.speedY = -player.speedY;
                player.y += player.speedY * deltaDifference;
                player.y += player.speedY * deltaDifference;
                player.speedY = player.speedY / localServerData.wallFriction;
            } else {
                player.y += player.speedY * deltaDifference;
            }
        }
	}
}

	//Local bullet creation
client.on('create local bullet', function(currentBulletList){
	for (var i = 0; i < currentBulletList.length; i++){
        bulletList.push(currentBulletList[i]);
	}
});

	//Data management
client.on('server data', function(serverData){
    localServerData = serverData;
    readPlayer();
    lastDataTime = Date.now();

    if (firstData && thisPlayer.inGame){
        firstData = false;
    }
});

client.on('server message', function(msg){
    if (messageList.length > 10){
        messageList.pop();
    }
    messageList.unshift(msg);
    chatSound.play();
});

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
    thisPlayer.inGame = thisPlayerServer.inGame;
}

function sendData(){
    if (applyForce){
        var x = mouse.x - window.innerWidth / 2 + cameraPan.x;
        var y = mouse.y - window.innerHeight / 2 + cameraPan.y;

        thisPlayer.force = Math.hypot(x, y);
    } else {
        thisPlayer.force = 0;
    }

    var playerToSend = new PlayerToSend(thisPlayer.id, thisPlayer.name, thisPlayer.rotation, thisPlayer.force);

    client.emit('client data', playerToSend);
}

function connectionCheck(){
	if (!thisPlayer.inGame || (currentTime - lastDataTime > reconnectionTime)){
		gameState = 3;
	}
}

	//Physics
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

function getRotation(){
    thisPlayer.rotation = Math.atan2(mouse.y - window.innerHeight / 2 + cameraPan.y,
                                     mouse.x - window.innerWidth / 2 + cameraPan.x) + Math.PI / 2;
}

function bulletPhysics(){
    for (var i = 0; i < bulletList.length; i++){
        var bullet = bulletList[i];

        if (bullet.decoy > localServerData.maxBulletDecoy) {
            bulletList.splice(i, 1);
        } else {
            bullet.decoy += localServerData.bulletDecoy / localServerData.deltaTime * deltaTime;

            bullet.x += bullet.speedX * deltaTime;
            bullet.y += bullet.speedY * deltaTime;
        }

        for (var j = 0; j < localServerData.playerList.length; j++){
        	var player = localServerData.playerList[j];

            if (player.id != bullet.id && !player.dead){
                var a = bullet.x - player.x;
                var b = bullet.y - player.y;
                var dist = Math.hypot(a, b);

                if (dist < 20) {
                    bulletList.splice(i, 1);
                }
			}
		}
    }
}

	//Drawing
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

	if (thisPlayer.streak >= localServerData.autoStk){
		type = ' ☆'
	}
	if (thisPlayer.streak >= localServerData.shotgunStk){
		type = ' ★'
	}
    if (thisPlayer.streak >= localServerData.nukeStk){
        type = ' ☢'
    }

	var displayText = thisPlayer.name + type;
	context.fillText(displayText, window.innerWidth / 2 - cameraPan.x, window.innerHeight / 2 - cameraPan.y - 27);
	context.fillRect(window.innerWidth / 2 - 15 + 1.5 * (10 - thisPlayer.hp) - cameraPan.x, window.innerHeight / 2 - cameraPan.y - 25, 3 * thisPlayer.hp, 3);
}

function drawPlayers(playerList){
	for (var i = 0; i < playerList.length; i++){
		var player = playerList[i];
		if (player.id != thisPlayer.id && player.inGame){
		    if (player.dead){
                context.globalAlpha = 0.5;
			} else {
                context.globalAlpha = 0.8;
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

            if (player.streak >= localServerData.autoStk){
                type = ' ☆'
            }
            if (player.streak >= localServerData.shotgunStk){
                type = ' ★'
            }
            if (player.streak >= localServerData.nukeStk){
                type = ' ☢'
            }

			var displayText = player.name + type;
			context.fillText(displayText, player.x  + offset.x, player.y + offset.y - 27);
			context.fillRect(player.x + offset.x - 15 + 1.5 * (10 - player.hp), player.y + offset.y - 25, 3 * player.hp, 3);
			context.globalAlpha = 1;
		}
	}
}

function drawBullets(){
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
            width = 4;
            height = 6;
		} else if (bullet.type == 3){
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
	var killer = $.grep(localServerData.playerList, function(e){
	    return e.id == killerID;
	})[0];
	var deathMessage = '';
	if (killer != undefined){
		deathMessage = 'Killed by ' + killer.name;
	} else {
		deathMessage = 'Killed by a ghost. Spooky.';
	}
	context.fillText(deathMessage, window.innerWidth / 2, window.innerHeight / 2);
}

function drawReconnect(){
    context.globalAlpha = 1;
    context.textAlign = 'center';
    context.fillStyle = 'grey';

    context.font = '60px Roboto';
    context.fillText("CONNECTION INTERRUPTED", window.innerWidth / 2, window.innerHeight / 2);

    context.font = '30px Roboto';
    context.fillText("Reload page to reconnect", window.innerWidth / 2, window.innerHeight / 2 + 50);
}

//Main loops
window.setInterval(function(){
    currentTime = Date.now();
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    deltaDifference = deltaTime / localServerData.deltaTime;

    if (!firstData){
        connectionCheck();
	}

    if (gameState != 0) {
        lagCompensate();

        getOffset();
        getRotation();

        bulletPhysics();

        context.clearRect(0, 0, canvas.width, canvas.height);
        drawBounds();
        drawBullets();
        drawPlayers(localServerData.playerList);
        drawSelf();
        drawScoreboard(localServerData.playerList);
        drawChat();
    }

    if (gameState == 2){
        drawDead();
    }

    if (gameState == 3){
    	drawReconnect();
	}
}, drawRate);

window.setInterval(function () {
    if (gameState == 1){
        sendData();
    }
}, sendRate);
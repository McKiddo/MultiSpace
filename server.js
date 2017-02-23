var express= require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

process.env.PWD = process.cwd();
app.use(express.static(process.env.PWD + '/public'));

app.get('/', function(req, res){
	res.sendfile('index.html');
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});

//Game vars
var deltaTime;
var lastTime = Date.now();
var currentTime;

let maxNameLength = 15;

let wallFriction = 3;
let forceModifier = 15000;
let forceLimit = 500;

let pistolSpeed = 1;
let autoSpeed = 2;
let shotgunSpeed =1;
let nukeSpeed = 0.6;

let shotgunPellets = 5;
let shotgunSpread = 0.1;

var serverData = {
    'playerList': [],
    'bulletList': [],
    'planeSize': {
        'x': 2000,
        'y': 1500},
    'autoStk': 1,
    'shotgunStk': 2,
    'nukeStk': 3
};

function Player(id){
	this.id = id;
	this.name = '';
	this.x = -1;
	this.y = -1;
    this.speedX = 0;
    this.speedY = 0;
	this.rotation = 0;
    this.force = 0;
	this.hp = 10;
	this.streak = 0;
    this.score = 0;
    this.dead = false;
    this.fireAllowed = true;
}

function Bullet(id, x, y, sx, sy, rotation, type){
	this.id = id;
	this.x = x;
	this.y = y;
	this.speedX = sx;
	this.speedY = sy;
	this.rotation = rotation;
	this.type = type;
}

//Per-player functions
io.on('connection', function(client){
	console.log('Connected ID: ' + client.id);

    var player = new Player(client.id);
    serverData.playerList.push(player);

    client.broadcast.emit('player connected', client.id);

	client.on('disconnect', function(){
		console.log('Disconnected ID: ' + client.id);
		serverData.playerList = serverData.playerList.filter(function(player){
			return player.id != client.id;
		});
        client.broadcast.emit('player disconnected', client.id);
	});

    client.on('respawn', function(){
        player.speedX = 0;
        player.speedY = 0;
        player.x = Math.random() * ((serverData.planeSize.x - 20) - 20) + 20;
        player.y = Math.random() * ((serverData.planeSize.y - 20) - 20) + 20;

        if (player.dead){
            player.hp = 10;
            player.streak = 0;
            player.dead = false;
        }
    });

    client.on('client data', function(clientPlayer){
            if (clientPlayer.name.length > maxNameLength){
                clientPlayer.name = clientPlayer.name.substring(0, maxNameLength - 1);
            }
            updatePlayerInList(client.id, clientPlayer.name, clientPlayer.rotation, clientPlayer.force);
            io.emit('server data', serverData);
        });

	client.on('shot fired', function(){
		if (!player.dead && player.fireAllowed) {
		    player.fireAllowed = false;
            createBullet(player);
        }
	});

    client.on('client message', function(msg){
        if (msg.length <= 50) {
            io.emit('server message', msg + ' : ' + player.name);
        }
    });
});

//All players functions
function createBullet(player){
    var type = 0;
    var bulletSpeed = pistolSpeed;
    var timeout = 200;

    if (player.streak >= serverData.autoStk){
        type = 1;
        bulletSpeed = autoSpeed;
        timeout = 100;
    }
    if (player.streak >= serverData.shotgunStk){
        type = 2;
        bulletSpeed = shotgunSpeed;
        timeout = 1000;
    }
    if (player.streak >= serverData.nukeStk){
        type = 3;
        bulletSpeed = nukeSpeed;
        timeout = 2000;
    }

    var speedX = bulletSpeed * Math.cos(player.rotation - Math.PI / 2);
    var speedY = bulletSpeed * Math.sin(player.rotation - Math.PI / 2);

    var bullet;

    if (type == 2){
        for (var i = 0; i < shotgunPellets; i++){
            bullet = new Bullet(player.id, player.x, player.y, speedX + Math.random() * shotgunSpread * 2 - shotgunSpread, speedY + Math.random() * shotgunSpread * 2 - shotgunSpread, player.rotation, type);
            serverData.bulletList.push(bullet);
        }
    } else {
       bullet = new Bullet(player.id, player.x, player.y, speedX, speedY, player.rotation, type);
        serverData.bulletList.push(bullet);
    }

    setTimeout(function(){
        player.fireAllowed = true;
    }, timeout);
}

function updatePlayerInList(id, name, rotation, force){
	for (var i = 0; i < serverData.playerList.length; i++){
		if (serverData.playerList[i].id == id){
            serverData.playerList[i].name = name;
            serverData.playerList[i].rotation = rotation;
            serverData.playerList[i].force = force;
		}
	}
}

function playerPhysics(){
	for (var i = 0; i < serverData.playerList.length; i++){
        var player = serverData.playerList[i];

		for (var j = 0; j < serverData.bulletList.length; j++){
		    var bullet = serverData.bulletList[j];

            if (player.id != bullet.id && !player.dead){
                var a = bullet.x - player.x;
                var b = bullet.y - player.y;
                var dist = Math.hypot(a, b);

                if (dist < 20){
                    serverData.bulletList.splice(j, 1);

                    if (bullet.type == 0) {
                        player.hp -= 1;
                    } else if (bullet.type == 1) {
                        player.hp -= 0.5;
                    } else if (bullet.type == 2) {
                        player.hp -= 1;
                    } else if (bullet.type == 3) {
                        player.hp -= 10;
                    }

                    if (player.hp <= 0){
                        player.hp = 0;
                        io.emit('death', player.id, bullet.id);
                        player.dead = true;

                        var killer = serverData.playerList.filter(function(e){
                            return e.id == bullet.id;
                        });

                        if (killer[0] != undefined) {
                            killer[0].hp += 5;
                            if (killer[0].hp > 10){
                                killer[0].hp = 10;
                            }
                            killer[0].score += 1;
                            killer[0].streak += 1;
                        }
                    }
                }
            }
		}

		if (player.force < 0){
			player.force = 0;
		} else if (player.force > forceLimit) {
			player.force = forceLimit;
		}

        if (!player.dead) {
            player.speedX += Math.sin(player.rotation) * player.force / forceModifier * deltaTime;
            player.speedY -= Math.cos(player.rotation) * player.force / forceModifier * deltaTime;
        }

        player.x += player.speedX;
        player.y += player.speedY;

        if (player.x < 10 || player.x > serverData.planeSize.x - 10){
            player.speedX = -player.speedX;
            player.x += player.speedX;
            player.x += player.speedX;
            player.speedX = player.speedX / wallFriction;
        } else {
            player.x += player.speedX;
        }

        if (player.y < 10 || player.y > serverData.planeSize.y - 10){
            player.speedY = -player.speedY;
            player.y += player.speedY;
            player.y += player.speedY;
            player.speedY = player.speedY / wallFriction;
        } else {
            player.y += player.speedY;
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
			
				if (dist > 2000){
					serverData.bulletList.splice(i, 1);
				}
			}
		}
		
		bullet.x += bullet.speedX * deltaTime;
		bullet.y += bullet.speedY * deltaTime;
	}
}

//Compute every 20ms
setInterval(function(){
    currentTime = Date.now();
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;

	playerPhysics();
	bulletMove();
}, 20);
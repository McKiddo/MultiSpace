const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);


process.env.PWD = process.cwd();
app.use(express.static(process.env.PWD + '/public'));

app.get('/', function(req, res){
	res.sendfile('index.html');
});

server.listen(3000, '0.0.0.0', function() {
    console.log('Listening to port:  ' + 3000);
});

//System vars
var refreshRate = 20;

var deltaTime;
var lastTime = Date.now();
var currentTime;

//Game consts
let maxNameLength = 15;

let forceModifier = 15000;
let forceLimit = 500;

let pistolSpeed = 1;
let autoSpeed = 1.5;
let shotgunSpeed = 1;
let nukeSpeed = 0.6;

let shotgunPellets = 5;
let shotgunSpread = 0.1;

//Server data
var bulletList = [];

var serverData = {
    'playerList': [],
    'planeSize': {
        'x': 2000,
        'y': 1500},
    'autoStk': 1,
    'shotgunStk': 2,
    'nukeStk': 3,
    'bulletDecoy': 1,
    'maxBulletDecoy': 2000,
    'wallFriction': 3,
    'hitboxRad': 19,
    'deltaTime': 0
};

function Player(id){
	this.id = id;
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
    this.fireAllowed = true;
    this.inGame = false;
}

function Bullet(id, x, y, sx, sy, rotation, type){
	this.id = id;
	this.x = x;
	this.y = y;
	this.lastX = 0;
	this.lastY = 0;
	this.speedX = sx;
	this.speedY = sy;
	this.rotation = rotation;
	this.type = type;
	this.decoy = 0;
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
			return player.id !== client.id;
		});
        client.broadcast.emit('player disconnected', client.id);
	});

    client.on('respawn', function(playerName){
        player.speedX = 0;
        player.speedY = 0;
        player.name = playerName;
        player.x = Math.random() * ((serverData.planeSize.x - 20) - 20) + 20;
        player.y = Math.random() * ((serverData.planeSize.y - 20) - 20) + 20;

        if (player.dead){
            player.hp = 10;
            player.streak = 0;
            player.dead = false;
        }
        player.inGame = true;
        updatePlayerInList(client.id, player.name, player.rotation, player.force);

    });

    client.on('client data', function(clientPlayer){
            if (clientPlayer.name.length > maxNameLength){
                clientPlayer.name = clientPlayer.name.substring(0, maxNameLength - 1);
            }
            updatePlayerInList(client.id, clientPlayer.name, clientPlayer.rotation, clientPlayer.force);
        });

	client.on('shot fired', function(){
		if (!player.dead && player.fireAllowed) {
		    player.fireAllowed = false;
            var currentBulletList = createBullet(player);
            io.emit('create local bullet', currentBulletList);
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
    var currentBulletList = [];

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
            bulletList.push(bullet);
            currentBulletList.push(bullet);
        }
    } else {
       bullet = new Bullet(player.id, player.x, player.y, speedX, speedY, player.rotation, type);
        bulletList.push(bullet);
        currentBulletList.push(bullet);
    }

    setTimeout(function(){
        player.fireAllowed = true;
    }, timeout);

    return currentBulletList
}

function updatePlayerInList(id, name, rotation, force){
    const playerToUpdate = serverData.playerList.find(player => player.id === id);

    playerToUpdate.name = name;
    playerToUpdate.rotation = rotation;
    playerToUpdate.force = force;
}

function playerPhysics(){
	for (var i = 0; i < serverData.playerList.length; i++){
        var player = serverData.playerList[i];

		for (var j = 0; j < bulletList.length; j++){
		    var bullet = bulletList[j];

            if (player.id != bullet.id && !player.dead){
                // Unused HitScan detection
                //var a = Math.abs((bullet.lastY - bullet.y) * player.x -
                //                 (bullet.lastX - bullet.x) * player.y +
                //                  bullet.lastX * bullet.y - bullet.lastY * bullet.x);
                //var b = Math.hypot(bullet.lastY - bullet.y, bullet.lastX - bullet.x);
                //var dist = a / b;

                // Basic hit detection
                var dist = Math.hypot(bullet.x - player.x, bullet.y - player.y);

                // Accurate hit detection
                if (serverData.hitboxRad <= refreshRate) {
                    dist = distanceToLineSegment(bullet.lastX, bullet.lastY, bullet.x, bullet.y, player.x, player.y);
                }

                if (dist < serverData.hitboxRad){
                    bulletList.splice(j, 1);

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
            player.speedX = player.speedX / serverData.wallFriction;
        } else {
            player.x += player.speedX;
        }

        if (player.y < 10 || player.y > serverData.planeSize.y - 10){
            player.speedY = -player.speedY;
            player.y += player.speedY;
            player.y += player.speedY;
            player.speedY = player.speedY / serverData.wallFriction;
        } else {
            player.y += player.speedY;
        }
	}
}

function bulletMove(){
	for (var i = 0; i < bulletList.length; i++){
		var bullet = bulletList[i];

		if (bullet.decoy > serverData.maxBulletDecoy) {
            bulletList.splice(i, 1);
        } else {
            bullet.decoy += serverData.bulletDecoy * deltaTime;

            bullet.lastX = bullet.x;
            bullet.lastY = bullet.y;

            bullet.x += bullet.speedX * deltaTime;
            bullet.y += bullet.speedY * deltaTime;
        }
	}
}

//Other functions
function distanceSquaredToLineSegment2(lx1, ly1, ldx, ldy, lineLengthSquared, px, py) {
    var t; // t===0 at line pt 1 and t ===1 at line pt 2
    if (!lineLengthSquared) {
        // 0-length line segment. Any t will return same result
        t = 0;
    }
    else {
        t = ((px - lx1) * ldx + (py - ly1) * ldy) / lineLengthSquared;

        if (t < 0)
            t = 0;
        else if (t > 1)
            t = 1;
    }

    var lx = lx1 + t * ldx,
        ly = ly1 + t * ldy,
        dx = px - lx,
        dy = py - ly;
    return dx*dx + dy*dy;
}

function distanceSquaredToLineSegment(lx1, ly1, lx2, ly2, px, py) {
    var ldx = lx2 - lx1,
        ldy = ly2 - ly1,
        lineLengthSquared = ldx*ldx + ldy*ldy;
    return distanceSquaredToLineSegment2(lx1, ly1, ldx, ldy, lineLengthSquared, px, py);
}

function distanceToLineSegment(lx1, ly1, lx2, ly2, px, py) {
    return Math.sqrt(distanceSquaredToLineSegment(lx1, ly1, lx2, ly2, px, py));
}

//Main loop
setInterval(function(){
    currentTime = Date.now();
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    serverData.deltaTime = deltaTime;

	playerPhysics();
	bulletMove();

    io.emit('server data', serverData);
}, refreshRate);

'use strict';

const Client = require('./client.js');
const User = require('./user/user.js');
const { nanoid } = require('nanoid');
const discord = require('./discord');
const database = require('./database');

const DiepToolManager = async (server) => {
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server });
    await database.setAllOffline();
    return new DiepToolServer(wss);
};

class DiepToolServer {
    constructor(wss) {
        this.users = new Set();

        wss.on('connection', (ws, req) => {
            const ip = req.headers['x-forwarded-for']
                ? req.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
                : req.connection.remoteAddress;

            const client = new Client(ws, ip);
            client.on('error', (err) => {});
            client.on('close', (code, reason) => console.log(code, reason));

            if (!discord.ready && !database.ready) return client.close(4000, 'Server not ready');
            client.once('initial', (content) => this.oninitial(client, content));
        });

        this.connectionLog = [];
        setInterval(() => {
            this.connectionLog.push({ x: Date.now(), y: this.users.size });
            // reset connectionLog at midnight
            if (new Date().getHours() === 0 && new Date().getMinutes() <= 5)
                this.connectionLog = [];
        }, 1000 * 60 * 5);
    }

    async oninitial(client, content) {
        let dbUser;
        if (content.authToken.startsWith('DT_')) {
            dbUser = await database.getUserByToken(content.authToken);
            if (!dbUser) {
                const reason = 'Unknown DT Token';
                client.send('deny', { reason });
                client.close(4000, reason);
                return;
            }
            if (dbUser.online) {
                const reason = 'DT Token is already in use';
                client.send('deny', { reason });
                client.close(4000, reason);
                return;
            }
            // Refresh Token
            const exchange = await discord.refreshToken(dbUser.refresh_token);
            if (exchange.error) {
                const reason = 'Authentication failed';
                client.send('deny', { reason });
                client.close(4000, exchange.error_description);
                return;
            }
            dbUser.refresh_token = exchange.refresh_token;
            await dbUser.save();
        } else {
            const exchange = await discord.exchangeToken(content.authToken);
            if (exchange.error) {
                const reason = 'Discord authentication failed';
                client.send('deny', { reason });
                client.close(4000, exchange.error_description);
                return;
            }
            const discordResult = await discord.apiFetch(exchange);
            dbUser = await database.getUserById(discordResult.id);
            if (dbUser) {
                content.authToken = dbUser.auth_token;
                client.send('authtoken', { authtoken: dbUser.auth_token });
                this.oninitial(client, content);
                return;
            }
            dbUser = {
                auth_token: `DT_${nanoid(32)}`,
                user_id: discordResult.id,
                username: `${discordResult.username}#${discordResult.discriminator}`,
                refresh_token: exchange.refresh_token,
            };

            dbUser = await database.addUser(dbUser);
            client.send('authtoken', { authtoken: dbUser.auth_token });
        }
        if (!discord.isPatreon(dbUser.user_id)) {
            const reason = 'Not a patron';
            client.send('deny', {reason});
            client.close(4000, reason);
        }

        dbUser.online = true;
        await dbUser.save();
        client.on('close', async () => {
            dbUser.online = false;
            await dbUser.save();
        });

        if(discord.isBasic(dbUser.user_id)){
            this.userManager(new User(client, content.version, dbUser, {botsMaximum: 5}));
        }else if(discord.isPremium(dbUser.user_id)){
            this.userManager(new User(client, content.version, dbUser, {botsMaximum: 10}));
        } else if(discord.isDT_PRO(dbUser.user_id)){
            this.userManager(new User(client, content.version, dbUser, {botsMaximum: 10}));
        } else {
            client.send('deny',{reason:'missing roles'});
            client.close(4000, 'missing roles');
        }
    }

    userManager(user) {
        this.users.add(user);
        console.log(
            user.socket.ip,
            'User connected, waiting for User Information:',
            this.users.size
        );
        user.on('close', (code, reason) => {
            this.users.delete(user);
            console.log(user.socket.ip, 'User disconnected reason:', code, reason);
        });
        user.on('ban', (reason) => {
            user.socket.close(4000, `User got banned: ${reason}`);
            this.blacklist.add(user.socket.ip);
        });
    }

    adminManager(admin) {
        console.log('Admin connected');

        admin.send(42, [this.connectionLog]);
        const int = setInterval(() => {
            admin.send(40, [this.users.size]);
            admin.send(41, [Array.from(this.users).map((user) => user.toDataObject())]);
        }, 100);
        admin.on('close', () => {
            clearInterval(int);
        });
        admin.on('command', (id, data) => {
            switch (id) {
                case PACKET_ADMIN_COMMANDS.NOTIFICATION:
                    this.users.forEach((user) => {
                        user.sendNotification(data.message, data.hexcolor, data.time, data.unique);
                    });
                    break;
                case PACKET_ADMIN_COMMANDS.BAN: {
                    const users = Array.from(this.users);
                    console.log('BANNED', data.ip);
                    for (let i = 0; i < users.length; i++) {
                        if (users[i].socket.ip === data.ip) {
                            users[i].ban('you have been banned');
                            break;
                        }
                    }
                    this.blacklist.add(data.ip);
                    break;
                }
            }
        });
    }

    moderatorManager(moderator) {
        console.log('Moderator connected');

        moderator.send(42, [this.connectionLog]);
        const int = setInterval(() => {
            moderator.send(40, [this.users.size]);
            moderator.send(41, [
                Array.from(this.users).map((user) => {
                    user = user.toDataObject();
                    return {
                        name: user.name,
                        link: user.link,
                        gamemode: user.gamemode,
                        time: user.time,
                        latency: user.latency,
                    };
                }),
            ]);
        }, 100);
        moderator.on('close', () => {
            clearInterval(int);
        });
    }
}

module.exports = DiepToolManager;

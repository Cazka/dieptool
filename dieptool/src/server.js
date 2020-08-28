'use strict';

const Client = require('./client.js');
const User = require('./user.js');
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
            client.on('close', (code, reason) => console.log(ip, ' closed', code, reason));

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
                const reason = 'Discord Authentification failed';
                client.send('deny', { reason });
                client.close(4000, exchange.error_description);
                await dbUser.deleteOne(); // not good solution
                return;
            }
            // Use accesstoken to get Userinformation
            const discordResult = await discord.apiFetch(exchange);
            dbUser.username = `${discordResult.username}#${discordResult.discriminator}`;
            dbUser.refresh_token = exchange.refresh_token;
            await dbUser.save();
        } else {
            // Exchange code for accesstoken
            const exchange = await discord.exchangeToken(content.authToken);
            if (exchange.error) {
                const reason = 'Discord authentification failed';
                client.send('deny', { reason });
                client.close(4000, exchange.error_description);
                return;
            }
            // Use accesstoken to get Userinformation
            const discordResult = await discord.apiFetch(exchange);
            // Find user in database.
            dbUser = await database.getUserById(discordResult.id);
            if (!dbUser) {
                dbUser = {
                    auth_token: `DT_${nanoid(32)}`,
                    user_id: discordResult.id,
                    username: `${discordResult.username}#${discordResult.discriminator}`,
                    refresh_token: exchange.refresh_token,
                };
                dbUser = await database.addUser(dbUser);
            }
            content.authToken = dbUser.auth_token;
            client.send('authtoken', { authtoken: dbUser.auth_token });
            this.oninitial(client, content);
            return;
        }
        if (!discord.isInGuild(dbUser.user_id)) {
            const reason = 'Not in Discord Server';
            client.send('deny', { reason });
            client.close(400, reason);
            return;
        }
        /*if (!discord.isPatreon(dbUser.user_id)) {
            const reason = 'Not a patron';
            client.send('deny', { reason });
            client.close(4000, reason);
            return;
        }*/

        client.on('close', async () => {
            dbUser.online = false;
            await dbUser.save();
        });
        dbUser.online = true;
        await dbUser.save();
        this.userManager(new User(client, content.version, dbUser, { botsMaximum: 2 }));
        /*
        if (discord.isBasic(dbUser.user_id)) {
            this.userManager(new User(client, content.version, dbUser, { botsMaximum: 5 }));
        } else if (discord.isPremium(dbUser.user_id)) {
            this.userManager(new User(client, content.version, dbUser, { botsMaximum: 10 }));
        } else if (discord.isDT_PRO(dbUser.user_id)) {
            this.userManager(new User(client, content.version, dbUser, { botsMaximum: 10 }));
        } else {
            client.send('deny', { reason: 'missing roles' });
            client.close(4000, 'missing roles');
        }*/
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
}

module.exports = DiepToolManager;

'use strict';

const EventEmitter = require('events');
const DiepSocket = require('diepsocket');
const Bot = require('./Bot.js');

const PACKET_USER_CLIENTBOUND = {
    AUTHTOKEN: 0,
    ACCEPT: 1,
    HEARTBEAT: 8,
    CUSTOM_SERVERBOUND: 9,
    CUSTOM_CLIENTBOUND: 10,
};
const UPDATE = {
    VERSION: 0,
    NAME: 1,
    WSURL: 2,
    PARTY: 3,
    GAMEMODE: 4,
};
const COMMAND = {
    JOIN_BOTS: 0,
    MULTIBOX: 1,
    AFK: 2,
};
const BOOLEAN = {
    FALSE: 0,
    TRUE: 1,
};

class User extends EventEmitter {
    constructor(socket, authToken, buddies) {
        super();
        // Socket information
        this.socket = socket;
        this.latency = 0;

        // User information
        this.authToken = authToken;
        this.link;

        this.version;
        this.name;
        this.wsURL;
        this.party;
        this.gamemode;

        // Status
        this.timeConnected = Date.now();
        this.status;
        this.statusTimeout;

        // Flags
        this.welcomeMessageSend = false;
        this.rateLimited = false;
        this.rateLimitTime = 100;

        // Bots
        this.buddies = buddies;
        this.bots = new Set();
        this.botsjoining = false;
        this.botsMaximum = 200;
        this.multibox = false;

        // Gameplay
        this.upgradePath = {};
        this.tankPath = [];

        this.socket.send(PACKET_USER_CLIENTBOUND.ACCEPT, []);

        this.socket.on('close', (reason) => {
            super.emit('close', reason);
        });

        this.socket.on('latency', (latency) => (this.latency = latency));
        this.socket.on('update', (id, data) => this.onUpdateHandler(id, data));
        this.socket.on('command', (id, data) => this.onCommandHandler(id, data));

        this.socket.on('serverbound', (data) => this.onServerBoundHandler(data));
        this.socket.on('clientbound', (data) => this.onClientBoundHandler(data));
    }
    /*
     *    E V E N T   H A N D L E R S
     */
    onUpdateHandler(id, data) {
        console.log(`${this.socket.ip} received update id: ${id} -> ${data}`);

        switch (id) {
            case UPDATE.VERSION:
                if (data !== process.env.SERVERVERSION) {
                    this.sendNotification(
                        'Please update Diep.io Tool to the newest Version',
                        color.RED,
                        0
                    );
                    this.socket.close();
                }
                this.version = data;
                break;
            case UPDATE.NAME:
                this.name = data;
                break;
            case UPDATE.WSURL:
                this.wsURL = data;
                this.party = undefined;
                this.link = DiepSocket.getLink(this.wsURL, this.party);
                this.bots.forEach((bot) => bot.close());
                break;
            case UPDATE.PARTY:
                this.party = data;
                this.link = DiepSocket.getLink(this.wsURL, this.party);
                break;
            case UPDATE.GAMEMODE:
                this.gamemode = data;
                break;
            default:
                console.error(`UPDATE NOT RECOGNIZED: ${id} with data ${data}`);
                this.sendNotification('Please reinstall DiepTool', color.red, 0);
                this.socket.close();
                break;
        }
    }
    onServerBoundHandler(data) {
        switch (data[0]) {
            case 0x01:
                if (this.multibox) {
                    this.bots.forEach((bot) => bot.sendBinary(data));
                }
                break;
            case 0x02:
                if (!this.welcomeMessage) {
                    this.welcomeMessage = true;
                    this.sendNotification('Thank you for using Diep.io Tool🔥');
                    this.sendNotification('Made by Cazka', '#f5e042');
                    this.sendNotification(
                        'Bots disconnect sometimes :( But you can now join unlimited bots :)',
                        color.PINK
                    );
                }

                this.upgradePath = {};
                this.tankPath = [];
                break;
            case 0x03:
                const category = data[1];
                const points = data[2];
                if (!this.upgradePath[category]) this.upgradePath[category] = 0;
                if (points === 1) this.upgradePath[category] += 2;
                else this.upgradePath[category] = points;
                break;
            case 0x04:
                this.tankPath.push(data[1]);
                console.log(this.tankPath);
                break;
        }
    }
    onClientBoundHandler(data) {}
    onCommandHandler(id, data) {
        if (this.rateLimited) {
            this.sendNotification('slow down', color.RED);
            return;
        }
        this.rateLimited = true;
        setTimeout(() => (this.rateLimited = false), this.rateLimitTime);

        console.log(`${this.socket.ip} used command: ${id}`);
        switch (id) {
            case COMMAND.JOIN_BOTS:
                if (this.bots.size >= this.botsMaximum) {
                    this.sendNotification(`You cant have more than ${this.botsMaximum} bots`);
                    return;
                }
                if (this.botsJoining) return;
                this.botsJoining = true;
                this.joinBots(data);
                this.sendNotification(`Joining ${data} bots`, color.PINK);
                break;
            case 'multibox':
                if (command.status !== this.multibox) {
                    this.sendNotification(
                        `Multiboxing ${command.status ? 'enabled' : 'disabled'}`,
                        color.PINK
                    );
                    this.multibox = command.status;
                }
                break;
            default:
                this.sendNotification(
                    `This feature will be available in the next update!`,
                    color.GREEN
                );
        }
    }
    /*
     *    C O M M A N D S
     */
    joinBots(amount, i = 0) {
        if (i >= this.buddies.size) {
            this.sendNotification(
                `Not enough Proxies available. You have ${this.bots.size} bots`,
                color.GREEN
            );
            this.botsJoining = false;
            return;
        }
        if (amount === 0 || this.bots.size >= this.botsMaximum) {
            this.sendNotification(
                `Bots joined succesfully. You have ${this.bots.size} bots`,
                color.GREEN
            );
            this.botsJoining = false;
            return;
        }
        // initialize bot
        let bot = new Bot(this.link, Array.from(this.buddies)[i]);
        bot.once('accept', () => {
            this.bots.add(bot);
            console.log(this.socket.ip + ' joined bots ' + (amount - 1) + ' left to join');

            let int = setInterval(() => {
                bot.send(2, `DT ${this.name}`, 0);
                for (let [key, value] of Object.entries(this.upgradePath)) {
                    bot.sendBinary(new Uint8Array([3, key, value]));
                }
                this.tankPath.forEach((upgrade) => bot.sendBinary(new Uint8Array([4, upgrade])));
            }, 1000);

            bot.on('close', () => {
                clearInterval(int);
                this.bots.delete(bot);
            });

            this.socket.on('close', () => bot.close());
            if (this.socket.isClosed()) bot.close();

            bot.removeAllListeners('error');
            this.actionJoinBotsBuddy(--amount, i);
        });
        bot.once('error', () => {
            bot.removeAllListeners('accept');
            this.actionJoinBotsBuddy(amount, ++i);
        });
    }

    /*
     *    H E L P E R   F U N C T I O N S
     */
    sendNotification(message, hexcolor, time) {
        this.socket.send(
            PACKET_USER_CLIENTBOUND.CUSTOM_CLIENTBOUND,
            newNotification(message, hexcolor, time)
        );
        this.updateStatus(message);
    }
    ban(reason) {
        this.sendNotification(reason, color.RED, 0);
        super.emit('ban', this.socket.ip);
        this.socket.close();
    }
    toDataObject() {
        return {
            authKey: this.authKey,
            ip: this.socket.ip,
            version: this.version,
            name: this.name,
            wsURL: this.wsURL,
            party: this.party,
            link: this.link,
            gamemode: this.gamemode,
            status: this.status,
            time: this.timeConnected,
            latency: this.latency,
            bots: this.bots.size,
        };
    }
    updateStatus(message) {
        clearTimeout(this.statusTimeout);
        this.status = message;
        this.statusTimeout = setTimeout(() => (this.status = 'nothing'), 5000);
    }
}

const displayUserInfo = (user) => {
    console.log('ip:', user.ip);
    console.log('version:', user.version);
    console.log('authkey:', user.authKey);
    console.log('name:', user.name);
    console.log('wsURL:', user.wsURL);
    console.log('party:', user.party);
    console.log('link:', user.link);
    console.log('gamemode:', user.gamemode);
};

const color = {
    PINK: '#ff00ff',
    GREEN: '#00ff00',
    RED: '#ff0000',
};

const newNotification = (message, hexcolor = '#000000', time = 5000) => {
    const data = new Uint8Array(512);
    let length = 0;
    data[length++] = 0x03;

    // message
    const messagePacket = new TextEncoder().encode(message);
    data.set(messagePacket, length);
    length += messagePacket.byteLength;
    data[length++] = 0x00;

    // color
    for (let i = hexcolor.length - 2; i >= 0; i -= 2) {
        data.set([parseInt(hexcolor.charAt(i) + hexcolor.charAt(i + 1), 16)], length++);
    }
    data[length++] = 0x00;

    // time
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, time);
    for (let i = view.byteLength - 1; i >= 0; i--) {
        data.set([view.getInt8(i)], length++);
    }
    data[length++] = 0x00;

    return data.slice(0, length);
};

module.exports = User;

'use strict';

const EventEmitter = require('events');
const DiepSocket = require('diepsocket');
const fs = require('fs');
const ipv6pool = fs.readFileSync('./dieptool/ipv6').toString('utf-8').split('\n');
const { Writer, Reader } = require('./coder.js');

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

const color = {
    PINK: '#ff00ff',
    GREEN: '#00ff00',
    RED: '#ff0000',
};

class User extends EventEmitter {
    constructor(socket, authToken) {
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
        this.multibox = false;
        this.afk = false;

        // Flags
        this.welcomeMessageSend = false;
        this.rateLimited = false;
        this.rateLimitTime = 100;

        // Bots
        this.bots = new Set();
        this.botsjoining = false;
        this.botsMaximum = 5;
        this.botname = () => {
            if (Math.random() <= 0.001) {
                return this.name ? `DMC ${this.name}` : 'DMC';
            } else {
                return this.name ? `DT ${this.name}` : 'DT';
            }
        };

        // Gameplay
        this.upgradePath = {};
        this.tankPath = [];

        // AFK
        this.slow = false;
        this.mouseX;
        this.mouseY;
        this.mouseXFixed;
        this.mouseYFixed;

        // Initialize
        this.socket.send(PACKET_USER_CLIENTBOUND.ACCEPT);

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
                this.version = data;
                if (this.version !== process.env.SERVERVERSION) {
                    this.sendNotification(
                        'Please update Diep.io Tool to the newest Version',
                        color.RED,
                        0
                    );
                    this.socket.close();
                }
                break;
            case UPDATE.NAME:
                this.name = data;
                break;
            case UPDATE.WSURL:
                this.wsURL = data;
                this.party = undefined;
                this.gamemode = undefined;
                this.bots.forEach((bot) => bot.close());

                try {
                    this.link = DiepSocket.getLink(this.wsURL, this.party);
                } catch (error) {
                    this.socket.close();
                }
                break;
            case UPDATE.PARTY:
                if (this.party) return;
                this.party = data;
                if (this.wsURL) this.link = DiepSocket.getLink(this.wsURL, this.party);
                break;
            case UPDATE.GAMEMODE:
                if (this.gamemode) return;
                this.gamemode = data;
                if (
                    ![
                        'dom',
                        'ffa',
                        'tag',
                        'maze',
                        'teams',
                        '4teams',
                        'sandbox',
                        'survival',
                    ].includes(this.gamemode)
                )
                    this.socket.close();
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
                this.updatePosition(data);
                if (this.multibox && this.gamemode != 'sandbox') {
                    this.bots.forEach((bot) => bot.sendBinary(data));
                }
                if (this.afk) {
                    data = this.stayAFK(data);
                    this.socket.send(PACKET_USER_CLIENTBOUND.CUSTOM_SERVERBOUND, data);
                }
                break;
            case 0x02:
                if (!this.welcomeMessage) {
                    this.welcomeMessage = true;
                    this.sendNotification(undefined, undefined, 1, 'adblock');
                    this.sendNotification('💎Made by Cazka💎', '#f5e042');
                    this.sendNotification('🔥 Thank you for using Diep.io Tool 🔥', color.GREEN);
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
                break;
        }
    }
    onClientBoundHandler(data) {
        /*switch (data[0]) {
            case 0x02: {
                this.name = new TextDecoder().decode(data.slice(1, data.length - 1));
                break;
            }
            case 0x04: {
                this.gamemode = new TextDecoder()
                    .decode(data.slice(1, data.length))
                    .split('\u0000')[0];
                break;
            }
            case 0x06: {
                let party = '';
                for (let i = 1; i < data.byteLength; i++) {
                    let byte = data[i].toString(16).split('');
                    if (byte.length === 1) {
                        party += byte[0] + '0';
                    } else {
                        party += byte[1] + byte[0];
                    }
                }
                this.party = party;
                break;
            }
        }*/
    }
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
                if (!this.link) return;

                const amount = data;
                this.botsJoining = true;
                this.joinBots(amount);
                this.sendNotification(`Joining ${amount} bots`, color.PINK);
                break;
            case COMMAND.MULTIBOX:
                if (this.gamemode === 'sandbox')
                    return this.sendNotification('disabled in sandbox 🎈');
                if (!!data === this.multibox) return;
                this.sendNotification(`Multiboxing ${!!data ? 'enabled' : 'disabled'}`, color.PINK);
                this.multibox = !!data;
                break;
            case COMMAND.AFK:
                if (!!data === this.afk) return;
                this.sendNotification(`AFK ${!!data ? 'enabled' : 'disabled'}`, color.PINK, 5000, 'afk');
                this.afk = !!data;
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
        if (i >= ipv6pool.length) {
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
        let bot = new DiepSocket(this.link, { ipv6: ipv6pool[i] });
        bot.once('accept', () => {
            this.bots.add(bot);
            let int = setInterval(() => {
                // spawn
                bot.send(2, this.botname(), 0);
                // upgrade path
                for (let [key, value] of Object.entries(this.upgradePath)) {
                    bot.sendBinary(new Uint8Array([3, key, value]));
                }
                // tank path
                this.tankPath.forEach((upgrade) => bot.sendBinary(new Uint8Array([4, upgrade])));
            }, 1000);
            bot.on('close', () => {
                clearInterval(int);
                this.bots.delete(bot);
            });

            if (this.socket.isClosed()) bot.close();
            this.socket.on('close', () => bot.close());
            if (bot.gamemode !== this.gamemode) this.socket.close(); // when someone fakes gamemode this will check.

            bot.removeAllListeners('error');
            this.joinBots(--amount, i);
        });
        bot.once('error', () => {
            bot.removeAllListeners('accept');
            this.joinBots(amount, ++i);
        });
    }
    /*
     *    A F K
     */
    stayAFK(data) {
        if (this.slow) return data;
        this.slow = true;

        // BLOCKWIDTH = 50 units.
        const tolerance = 2 * 50;
        const euclid_distance = Math.sqrt(
            Math.pow(this.mouseX - this.mouseXFixed, 2) +
                Math.pow(this.mouseY - this.mouseYFixed, 2)
        );

        // there is probably a better function to calc the speed relative to the distance from the fixed position. if you have a better one pls tell me.
        let timeout = (-Math.log(euclid_distance - 150) + 5.3) * 100;
        timeout = timeout !== timeout || timeout >= 250 ? 250 : timeout <= 0 ? 0 : timeout;
        setTimeout(() => (this.slow = false), timeout);
        const flags = this.calcFlags();
        if (euclid_distance > tolerance) return changeFlags(data, flags);
        return data;
    }
    calcFlags() {
        let flags = 2048;
        const distanceX = this.mouseX - this.mouseXFixed;
        const distanceY = this.mouseY - this.mouseYFixed;
        if (distanceX > 0) {
            flags += 4; // move west
        } else if (distanceX < 0) {
            flags += 16; //move east
        }
        if (distanceY > 0) {
            flags += 2; // move north
        } else if (distanceY < 0) {
            flags += 8; // move south
        }
        return flags;
    }

    /*
     *    H E L P E R   F U N C T I O N S
     */
    sendNotification(message, hexcolor, time, unique) {
        this.socket.send(
            PACKET_USER_CLIENTBOUND.CUSTOM_CLIENTBOUND,
            newNotification(message, hexcolor, time, unique)
        );
        this.updateStatus(message);
    }
    updatePosition(data) {
        const reader = new Reader(data);
        // skip packet id and flags
        reader.vu();
        reader.vu();

        this.mouseX = reader.vf();
        this.mouseY = reader.vf();

        if (!this.afk) {
            this.mouseXFixed = this.mouseX;
            this.mouseYFixed = this.mouseY;
        }
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

const changeFlags = (data, flags) => {
    const reader = new Reader(data);
    reader.vu();
    flags |= reader.vu();

    const writer = new Writer()
        .vu(0x01) //packet id
        .vu(flags) //flags
        .vf(reader.vf()) //mousex
        .vf(reader.vf()) //mousey
        .vf(reader.vf()) //movementx
        .vf(reader.vf()); //movementy

    return writer.out();
};

const newNotification = (message, hexcolor = '#000000', time = 5000, unique) => {
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

    // unique
    const uniquePacket = new TextEncoder().encode(unique);
    data.set(uniquePacket, length);
    length += uniquePacket.byteLength;

    data[length++] = 0;

    return data.slice(0, length);
};

module.exports = User;

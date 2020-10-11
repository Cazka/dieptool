'use strict';

const EventEmitter = require('events');
const DiepSocket = require('diepsocket');
const DiepParser = DiepSocket.Parser;
const DiepBuilder = DiepSocket.Builder;
const DiepShuffler = DiepSocket.Shuffler;
const DiepUnshuffler = DiepSocket.Unshuffler;

const fs = require('fs');
const ipv6pool = fs
    .readFileSync(__dirname + '/ipv6')
    .toString('utf-8')
    .split('\n');

const CLIENT_VERSION = '4.2.11';
const UPDATE = {
    SERVER: 0,
};
const COMMAND = {
    JOIN_BOTS: 0,
    MULTIBOX: 1,
    AFK: 2,
    CLUMP: 3,
    SPINBOT: 4,
    PUSHBOT: 5,
};
const PERMISSIONS = {
    AFK: 1,
    JOIN_BOTS: 2,
    MULTIBOX: 4,
    CLUMP: 8,
    SPINBOT: 16,
    NO_PREFIX: 32,
    PUSHBOT: 64,
};
const color = {
    PINK: '#ff00ff',
    GREEN: '#00ff00',
    RED: '#ff0000',
    LIGHT_PINK: '#ffcf40',
};

class User extends EventEmitter {
    constructor(socket, version, options) {
        super();
        // Socket information
        this.socket = socket;
        this.latency = 0;

        // User information
        this.permissions = options.permissions;
        this.link;
        this.name;
        this.gamemode;

        // Status
        this.timeConnected = Date.now();
        this.status;
        this.multibox = false;
        this.afk = false;
        this.clump = false;
        this.spinbot = false;
        this.pushbot = false;

        // Flags
        this.welcomeMessageSend = false;
        this.rateLimited = false;
        this.rateLimitTime = 100;

        // Bots
        this.bots = new Set();
        this.botCounter = 0;
        this.parallelJoining = 5;
        this.botsjoining = false;
        this.botsMaximum = options.botsMaximum;
        this.botname = () => {
            if (this.permissions & PERMISSIONS.NO_PREFIX) return this.name;
            if (!this.name) return 'DT';
            return this.name.startsWith('DT') ? this.name : `DT ${this.name}`;
        };

        // Gameplay
        this.upgradeStats = {};
        this.upgradeStatsOrder = [];
        this.upgradeTanks = [];
        this.resetUpgrades = () => {
            this.upgradeStats = {};
            this.upgradeStatsOrder = [];
            this.upgradeTanks = [];
        };

        // AFK
        this.tankXFixed = 0.1;
        this.tankYFixed = 0.1;

        // CLUMP
        this.entityId;
        this.tankX = 0;
        this.tankY = 0;
        this.mouseX = 0;
        this.mouseY = 0;

        // Initialize
        this.diepShuffler = new DiepShuffler();
        this.diepUnshuffler = new DiepUnshuffler();
        this.socket.on('close', (code, reason) => {
            super.emit('close', code, reason);
        });

        if (version !== CLIENT_VERSION) {
            this.socket.send('alert', { message: 'Please update DiepTool to the newest version' });
            this.socket.close(4000, `outdated client expected: ${CLIENT_VERSION}, got: ${version}`);
            return;
        }
        this.socket.send('accept');
        this.socket.on('diep_serverbound', ({ count, buffer }) => this.ondiep_serverbound(count, buffer));
        this.socket.on('diep_clientbound', ({ count, buffer }) => this.ondiep_clientbound(count, buffer));

        this.socket.on('latency', (latency) => (this.latency = latency));
        this.socket.on('update', ({ id, value }) => this.onupdate(id, value));
        this.socket.on('command', ({ id, value }) => this.oncommand(id, value));
        this.socket.on('pow_result', ({ id, result }) => this.onpow_result(id, result));
    }
    /*
     *    E V E N T   H A N D L E R S
     */
    ondiep_serverbound(count, buffer) {
        buffer = this.diepUnshuffler.serverbound(buffer);
        let packet;
        try {
            packet = new DiepParser(buffer).serverbound();
        } catch (error) {
            return;
        }
        switch (packet.type) {
            case 'input': {
                this.mouseX = packet.content.mouseX;
                this.mouseY = packet.content.mouseY;

                if (this.afk) {
                    const deltaX = this.tankXFixed - this.tankX;
                    const deltaY = this.tankYFixed - this.tankY;
                    const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);
                    const tolerance = 2 * 50;
                    if (length > tolerance) {
                        packet.content = {
                            flags: packet.content.flags | DiepSocket.INPUT.gamepad,
                            mouseX: packet.content.mouseX,
                            mouseY: packet.content.mouseY,
                            velocityX: deltaX / length,
                            velocityY: deltaY / length,
                        };
                    }
                }
                if (this.multibox && !this.pushbot) {
                    if (!this.clump) this.bots.forEach((bot) => bot.sendBinary(buffer));
                    else {
                        const tolerance = (4 + this.bots.size / 4) * 50;
                        this.bots.forEach((bot) => {
                            const deltaX = this.tankX - bot.position.x;
                            const deltaY = this.tankY - bot.position.y;
                            const length = Math.sqrt(deltaX ** 2 + deltaY ** 2);

                            if (length > tolerance) {
                                bot.moveTo({ x: this.tankX, y: this.tankY }, packet.content.flags, packet.content.mouseX, packet.content.mouseY);
                            } else {
                                bot.sendBinary(buffer);
                            }
                        });
                    }
                } else if (this.pushbot) {
                    this.bots.forEach((bot) => {
                        const deltaX = this.mouseX - bot.position.x;
                        const deltaY = this.mouseY - bot.position.y;
                        if (packet.content.flags & DiepSocket.INPUT.rightMouse) {
                            bot.moveTo({ x: -deltaX + bot.position.x, y: -deltaY + bot.position.y }, packet.content.flags | DiepSocket.INPUT.leftMouse, deltaX + bot.position.x, deltaY + bot.position.y);
                        } else {
                            bot.moveTo({ x: this.mouseX, y: this.mouseY }, packet.content.flags | DiepSocket.INPUT.leftMouse, -deltaX + bot.position.x, -deltaY + bot.position.y);
                        }
                    });
                }
                if (this.spinbot) {
                    const now = Date.now() / 80;
                    const mx = Math.cos(now) * 1000000;
                    const my = Math.sin(now) * 1000000;
                    if (!(packet.content.flags & 1))
                        packet.content = {
                            flags: packet.content.flags,
                            mouseX: mx,
                            mouseY: my,
                            velocityX: packet.content.velocityX,
                            velocityY: packet.content.velocityY,
                        };
                }
                buffer = new DiepBuilder({ type: 'input', content: packet.content }).serverbound();
                break;
            }
            case 'spawn': {
                if (!this.welcomeMessage) {
                    this.welcomeMessage = true;
                    //this.sendNotification(undefined, undefined, 1, 'adblock');
                    this.sendNotification('🔥 Thank you for using DiepTool 🔥', color.GREEN);
                    if (this.botsMaximum === 1) {
                        setTimeout(() => this.sendNotification('🌌 Please consider becoming a patreon if you enjoy using DiepTool 🌌'), 1000 * 5);
                        const int = setInterval(() => this.sendNotification('🌌 Please consider becoming a patreon if you enjoy using DiepTool 🌌'), 1000 * 60 * 8);
                        this.socket.on('close', () => clearInterval(int));
                    }
                }
                this.resetUpgrades();
                break;
            }
            case 'upgrade_stat': {
                const { id, level } = packet.content;
                if (!this.upgradeStats[id]) {
                    this.upgradeStats[id] = 0;
                    this.upgradeStatsOrder.push(id);
                }
                if (level === -1) this.upgradeStats[id]++;
                else this.upgradeStats[id] = level;
                break;
            }
            case 'upgrade_tank': {
                const { id } = packet.content;
                this.upgradeTanks.push(id);
                break;
            }
        }
        buffer = this.diepShuffler.serverbound(buffer);
        if (this.afk || this.spinbot) {
            this.socket.send('custom_diep_serverbound', { count, buffer });
        }
    }
    ondiep_clientbound(count, buffer) {
        buffer = this.diepUnshuffler.clientbound(buffer);
        let packet;
        try {
            packet = new DiepParser(buffer).clientbound();
        } catch (error) {
            return;
        }

        switch (packet.type) {
            case 'update': {
                if (packet.content.id) this.entityId = packet.content.id;
                else if (packet.content.parse) {
                    const pos = packet.content.parse(this.entityId);
                    this.tankX = pos?.x || this.tankX;
                    this.tankY = pos?.y || this.tankY;
                }
            }
            case 'server_info':
                this.gamemode = packet.content.gamemode;
                break;
            case 'party':
                this.diepShuffler = new DiepShuffler();
                this.diepUnshuffler = new DiepUnshuffler();
                const { id, party } = DiepSocket.linkParse(this.link);
                this.link = DiepSocket.getLink(id, packet.content.party);

                this.gamemode = undefined;
                this.bots.forEach((bot) => bot.close());
                break;
        }
    }
    onupdate(id, value) {
        console.log(`${this.socket.ip} received update id: ${id} -> ${value}`);

        switch (id) {
            case UPDATE.SERVER:
                this.diepShuffler = new DiepShuffler();
                this.diepUnshuffler = new DiepUnshuffler();
                const server = value;
                try {
                    this.link = DiepSocket.getLink(server);
                } catch (error) {
                    console.log(`${this.socket.ip} couldn't update link: ${server},${party}\n${error}`);
                    this.socket.close();
                    return;
                }
                this.gamemode = undefined;
                this.bots.forEach((bot) => bot.close());
                break;
            default:
                this.sendNotification('Please reinstall DiepTool', color.red, 0);
                this.socket.close(4000, `UPDATE NOT RECOGNIZED: ${id} with data ${value}`);
                break;
        }
    }
    oncommand(id, value) {
        if (this.rateLimited) {
            this.sendNotification('slow down', color.RED, 5000, 'slow_down');
            return;
        }
        this.rateLimited = true;
        setTimeout(() => (this.rateLimited = false), this.rateLimitTime);

        console.log(`${this.socket.ip} used command: ${id}`);
        switch (id) {
            case COMMAND.AFK:
                if (!(this.permissions & PERMISSIONS.AFK)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                this.sendNotification('this feature is currently not available.');
                break;
                if (!!value === this.afk) return;
                this.sendNotification(`AFK: ${!!value ? 'ON' : 'OFF'}`, '#e8c100', 5000, 'afk');
                this.afk = !!value;

                if (this.afk) {
                    this.tankXFixed = this.tankX;
                    this.tankYFixed = this.tankY;
                }
                break;
            case COMMAND.JOIN_BOTS:
                if (!(this.permissions & PERMISSIONS.JOIN_BOTS)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                if (this.bots.size >= this.botsMaximum) {
                    this.sendNotification(`You cant have more than ${this.botsMaximum} bots`, undefined, 5000, 'max_bots');
                    return;
                }
                if (this.botsJoining) return;
                if (!this.link) return;

                this.botsJoining = true;
                let amount = value;
                if (amount + this.bots.size > this.botsMaximum) {
                    this.sendNotification(`You can only have ${this.botsMaximum} bots. Become a patron or upgrade your Tier to join more`, '#00FFFF', 10000);
                }
                amount = this.bots.size + amount > this.botsMaximum ? this.botsMaximum - this.bots.size : amount;
                this.sendNotification(`Joining ${amount} bots`, '#e300eb', 5000, 'join_bots');
                this.joinBots(amount);
                break;
            case COMMAND.MULTIBOX:
                if (!(this.permissions & PERMISSIONS.MULTIBOX)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                if (!!value === this.multibox) return;
                this.sendNotification(`Multiboxing: ${!!value ? 'ON' : 'OFF'}`, '#5200eb', 5000, 'multibox');
                this.multibox = !!value;
                break;
            case COMMAND.CLUMP:
                if (!(this.permissions & PERMISSIONS.CLUMP)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                if (!!value === this.clump) return;
                this.sendNotification(`Clump: ${!!value ? 'ON' : 'OFF'}`, '#004aeb', 5000, 'clump');
                this.clump = !!value;
                break;
            case COMMAND.SPINBOT:
                if (!(this.permissions & PERMISSIONS.SPINBOT)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                this.sendNotification('this feature is currently not available.');
                break;
                if (!!value === this.spinbot) return;
                this.sendNotification(`Spinbot: ${!!value ? 'ON' : 'OFF'}`, '#ea6666', 5000, 'spinbot');
                this.spinbot = !!value;
                break;
            case COMMAND.PUSHBOT:
                if (!(this.permissions & PERMISSIONS.PUSHBOT)) {
                    this.sendNotification('Missing Permission', color.RED, 5000, 'no_permission');
                    return;
                }
                if (!!value === this.pushbot) return;
                this.sendNotification(`Pushbot: ${!!value ? 'ON' : 'OFF'}`, '#92ea66', 5000, 'pushbot');
                this.pushbot = !!value;
                break;
            default:
                this.sendNotification(`This feature will be available in the next update!`, color.GREEN, 5000, 'unknown_command');
        }
    }
    /*
     *    C O M M A N D S
     */
    onpow_result(id, result) {
        const bot = Array.from(this.bots).find((bot) => bot.id === id);
        if (bot) setTimeout(() => bot.send('pow_result', { result }), 9000 - (Date.now() - bot.lastPow));
    }
    createBot(ipv6) {
        const bot = new DiepSocket(this.link, { ipv6, forceTeam: true });
        bot.id = this.botCounter++;
        bot.on('open', () => {
            this.bots.add(bot);
            bot.on('close', () => this.bots.delete(bot));
            bot.on('pow_request', ({ difficulty, prefix }) => {
                bot.lastPow = Date.now();
                this.socket.send('pow_request', { id: bot.id, difficulty, prefix });
            });
        });
        return new Promise((resolve, reject) => {
            bot.on('accept', () => resolve(bot));
            setTimeout(() => reject(), 1000 * 30);
            bot.on('error', (err) => reject(err));
        });
    }
    joinBots(amount) {
        let done = 0;
        let joined = 0;
        const cb = (n) => {
            done++;
            joined += n;
            if (joined === amount) {
                this.sendNotification(`Bots joined succesfully. You have ${this.bots.size} bots`, color.GREEN, 5000, 'join_bots_successful');
                this.botsJoining = false;
            } else if (done === this.parallelJoining) {
                this.sendNotification(`Can't join bots because your team is full. You have ${this.bots.size} bots`, color.GREEN);
                this.botsJoining = false;
            }
        };
        const amountPerProcess = ~~(amount / this.parallelJoining);
        for (let i = 0; i < this.parallelJoining; i++) {
            if (i < this.parallelJoining - 1) this.joinBotProcess(amountPerProcess, i, cb);
            else this.joinBotProcess(amountPerProcess + (amount % this.parallelJoining), i, cb);
        }
    }
    async joinBotProcess(amount, ipv6Index, cb) {
        const start = Date.now();
        let joined = 0;
        for (let i = 0; i < amount; ) {
            const elapsed = Date.now() - start;
            if (ipv6Index >= ipv6pool.length) break;
            if (elapsed >= 1000 * 30) break;

            try {
                const bot = await this.createBot(ipv6pool[ipv6Index]);
                bot.spawn(this.botname());
                const upgradeLoop = setInterval(() => {
                    // upgrade path
                    this.upgradeStatsOrder.forEach((id) => {
                        bot.send('upgrade_stat', { id, level: this.upgradeStats[id] });
                    });
                    // tank path
                    this.upgradeTanks.forEach((id) => bot.send('upgrade_tank', { id }));
                }, 1000);
                bot.on('close', () => {
                    this.sendNotification(`Bot disconnected. You have ${this.bots.size} bots.`, '0', 5000, 'bot_close');
                    clearInterval(upgradeLoop);
                });
                bot.on('message', ({ message }) => {
                    if (message.startsWith(`You've killed`)) this.sendNotification(message, color.LIGHT_PINK, 6000);
                });
                bot.on('dead', () => {
                    this.sendNotification('Your bot just died', color.LIGHT_PINK, 5000, 'bot_dead');
                    bot.spawn(this.botname());
                });

                if (this.socket.isClosed()) bot.close();
                this.socket.on('close', () => bot.close());
                if (bot.link !== this.link) {
                    this.socket.close(4000, 'bot link and user link mismatch');
                    return;
                }
                i++;
                joined++;
            } catch (error) {
                ipv6Index += this.parallelJoining;
            }
        }
        cb(joined);
    }

    /*
     *    H E L P E R   F U N C T I O N S
     */
    sendNotification(message, hexcolor = '0', time = 5000, unique = '') {
        const color = hexcolor.startsWith('#') ? parseInt(hexcolor.slice(1), 16) : parseInt(hexcolor, 16);
        const packet = new DiepBuilder({
            type: 'message',
            content: { message, color, time, unique },
        }).clientbound();

        this.socket.send('alert', { message });
        this.updateStatus(message);
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
        this.status = message;
        setTimeout(() => {
            if (this.status === message) this.status = 'nothing';
        }, 5000);
    }
}

module.exports = User;

const EventEmitter = require('events');

const PACKET_BUDDY_CLIENTBOUND = {
    BOT_OPEN: 20,
    BOT_SEND: 21,
    BOT_CLOSE: 22,
};

class Buddy extends EventEmitter {
    constructor(socket) {
        super();
        this.socket = socket;

        this.socket.on('close', (reason) => super.emit('close', reason));

        this.socket.on('Bot accept', (index, link) => super.emit('Bot accept', index, link));
        this.socket.on('Bot message', (index, message) => super.emit('Bot message', index, message));
        this.socket.on('Bot close', (index) => super.emit('Bot close', index));
        this.socket.on('Bot error', (index, link) => super.emit('Bot error', index, link));
    }
    bot_open(link) {
        this.socket.send(PACKET_BUDDY_CLIENTBOUND.BOT_OPEN, [link]);
    }
    bot_send(index, data) {
        this.socket.send(PACKET_BUDDY_CLIENTBOUND.BOT_SEND, [index, data]);
    }
    bot_close(index) {
        this.socket.send(PACKET_BUDDY_CLIENTBOUND.BOT_CLOSE, [index]);
    }
}

module.exports = Buddy;

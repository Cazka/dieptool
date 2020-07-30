'use strict';

const EventEmitter = require('events');
const { Parser, Builder } = require('./protocol');

class Client extends EventEmitter {
    constructor(socket, ip) {
        super();
        this.socket = socket;
        this.ip = ip;
        this.lastPing = Date.now();

        this.socket.on('message', (data) => this.onmessage(data));
        this.socket.on('close', (reason) => super.emit('close', reason));
        this.socket.on('error', (err) => super.emit('error', err));
    }

    onmessage(data) {
        let packet;
        try {
            packet = new Parser(data).serverbound();
        } catch (error) {
            console.log(`${this.ip} sent unparsable message:\n${error}`);
            this.close();
            return;
        }
        
        if (packet.type === 'heartbeat') {
            const now = Date.now();
            super.emit('latency', now - this.lastPing);
            this.send('heartbeat');
            this.lastPing = now;
        } else super.emit(packet.type, packet.content);
    }

    send(type, content) {
        if (this.isClosed()) return;
        const data = new Builder({ type, content }).clientbound();
        this.socket.send(data);
    }

    close() {
        try {
            this.socket.close();
        } catch (error) {
            this.socket.terminate();
        }
    }

    isClosed() {
        return this.socket.readyState !== this.socket.OPEN;
    }
}

module.exports = Client;

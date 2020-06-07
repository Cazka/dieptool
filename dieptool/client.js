'use strict';

const EventEmitter = require('events');
const { Reader, Writer } = require('./coder.js');

class Client extends EventEmitter {
    constructor(socket, ip) {
        this.socket = socket;
        this.ip = ip;
        this.socket.on('message', (data) => this.onMessage(data));
        this.socket.on('close', () => super.emit('close'));
        this.socket.on('error', (err) => super.emit('error', err));
        
    }

    onMessage(data) {
        const read = new Reader(data);
        const id = read.vu();
        switch (id) {
            case 0x00:
                // login
                break;
            case 0x01:
                // init
                break;
            case 0x02:
                // update
                break;
            case 0x03:
                // command
                break;
            case 0x09:
                // diep.io serverbound
                super.emit('clientbound', data);
                break;
            case 0x10:
                // diep.io clientbound
                break;
            default:
                //unkown packet
                console.log('not recognized packet: ', data);
                break;
        }
    }
    onLogin(data){

        super.emit('login', )
    }
}

module.exports = Client;

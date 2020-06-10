const EventEmitter = require('events');

class Bot extends EventEmitter {
    constructor(link, buddy) {
        super();
        this.link = link;
        this.buddy = buddy;
        this.index = -1;

        this.buddy.bot_open(this.link);
        this.buddy.on(
            'Bot accept',
            (this.onaccept = (index, link) => this.onAcceptHandler(index, link))
        );
        this.buddy.on(
            'Bot message',
            (this.onmessage = (index, message) => this.onMessageHandler(index, message))
        );
        this.buddy.on('Bot close', (this.onclose = (index) => this.onCloseHandler(index)));
        this.buddy.on(
            'Bot error',
            (this.onerror = (index, link) => this.onErrorHandler(index, link))
        );

        this.buddy.once('close', () => this.onCloseHandler(this.index));
    }

    onAcceptHandler(index, link) {
        if (this.index !== -1 || this.link !== link) return;
        this.index = index;

        this.buddy.off('Bot accept', this.onaccept);
        this.buddy.off('Bot error', this.onerror);
        super.emit('accept');
    }
    onMessageHandler(index, message) {
        if (index !== this.index) return;
        super.emit('message', message);
    }
    onCloseHandler(index) {
        if (index !== this.index) return;
        this.buddy.off('Bot message', this.onmessage);
        this.buddy.off('Bot close', this.onclose);
        super.emit('close');
    }
    onErrorHandler(index, link) {
        if (this.index !== -1 || this.link === link) return;
        this.index = index;

        this.buddy.off('Bot accept', this.onaccept);
        this.buddy.off('Bot message', this.onmessage);
        this.buddy.off('Bot close', this.onclose);
        this.buddy.off('Bot error', this.onerror);

        super.emit('error');
    }

    send(...args) {
        // from cx
        let data = args.map((r) =>
            typeof r === 'number'
                ? [r]
                : typeof r === 'string'
                ? r.split('').map((r) => r.charCodeAt(0))
                : r
        );
        let u8 = new Uint8Array([].concat(...data));
        this.sendBinary(u8);
    }
    sendBinary(data) {
        this.buddy.bot_send(this.index, data);
    }
    close() {
        this.buddy.bot_close(this.index);
    }
}

module.exports = Bot;

// ==UserScript==
// @name         Diep.io Tool
// @description  made with much love.
// @version      4.2.12
// @author       Cazka#9552
// @match        *://diep.io/*
// @grant        GM_info
// @grant        GM_addStyle
// ==/UserScript==
'use strict';

/*
 *   C O N S T A N T S
 */
const DTTOKEN = 'Cazka_wants_to_be_in_the_source_code';
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
const SERVERS = [
    'wss://amsterdam.s.dieptool.com',
    //'wss://la.s.dieptool.com/',
    //'wss://miami.s.dieptool.com',
    //'wss://singapore.s.dieptool.com',
];
/*
 *   C L A S S E S
 */
class PowWorker {
    constructor() {
        this.worker = new Worker(this._getWorkerPath());
        this.nextJobId = 0;
        this.busy = false;
        this.workerCallbacks = {};
        this.worker.onmessage = (e) => this._onmessage(e);
    }
    _getWorkerPath() {
        return (
            window.location.protocol +
            '//' +
            window.location.hostname +
            window.location.pathname +
            'pow_worker.js'
        );
    }
    _onmessage(e) {
        const data = e.data;
        const id = data[0];
        this.workerCallbacks[id](data.slice(1));
    }
    solve(prefix, difficulty, cb) {
        const id = this.nextJobId++;
        this.worker.postMessage([id, 'solve', prefix, difficulty]);
        this.workerCallbacks[id] = cb;
    }
    terminate() {
        this.worker.terminate();
    }
}
/*
 * This is from @cx88 with little modifications made by me.
 * https://github.com/cx88/diepssect/blob/master/diep-bot/coder.js
 */
const convo = new ArrayBuffer(4);
const u8 = new Uint8Array(convo);
const u16 = new Uint16Array(convo);
const u32 = new Uint32Array(convo);
const float = new Float32Array(convo);
const endianSwap = (val) => ((val & 0xff) << 24) | ((val & 0xff00) << 8) | ((val >> 8) & 0xff00) | ((val >> 24) & 0xff);
class Reader {
    constructor(content) {
        this.at = 0;
        this.buffer = new Uint8Array(content);
    }
    u8() {
        const out = this.buffer[this.at++];
        this.assertNotOOB();
        return out;
    }
    u16() {
        u8.set(this.buffer.subarray(this.at, (this.at += 2)));
        this.assertNotOOB();
        return u16[0];
    }
    u32() {
        u8.set(this.buffer.subarray(this.at, (this.at += 4)));
        this.assertNotOOB();
        return u32[0];
    }
    float() {
        u8.set(this.buffer.subarray(this.at, (this.at += 4)));
        this.assertNotOOB();
        return float[0];
    }
    vu() {
        let out = 0;
        let at = 0;
        while (this.buffer[this.at] & 0x80) {
            out |= (this.buffer[this.at++] & 0x7f) << at;
            at += 7;
        }
        out |= this.buffer[this.at++] << at;
        this.assertNotOOB();
        return out;
    }
    vi() {
        let out = this.vu();
        const sign = out & 1;
        out >>= 1;
        if (sign) out = ~out;
        this.assertNotOOB();
        return out;
    }
    vf() {
        u32[0] = endianSwap(this.vi());
        this.assertNotOOB();
        return float[0];
    }
    string() {
        let out;
        const at = this.at;
        while (this.buffer[this.at]) this.at++;
        out = new TextDecoder().decode(this.buffer.subarray(at, this.at++));
        this.assertNotOOB();
        return out;
    }
    buf() {
        let out;
        const length = this.vu();
        out = this.buffer.slice(this.at, this.at + length);
        this.at += length;
        this.assertNotOOB();
        return out;
    }
    flush() {
        const slice = this.buffer.slice(this.at);
        this.at += slice.length;
        return slice;
    }
    isEOF() {
        return this.at === this.buffer.byteLength;
    }
    assertNotOOB() {
        if (this.at > this.buffer.byteLength) {
            throw new Error(`Error at ${this.at}: Out of Bounds.\n${this.debugStringFullBuffer()}`);
        }
    }
    debugStringFullBuffer() {
        const s = this.buffer.reduce((acc, x, i) => {
            x = x.toString(16).padStart(2, 0).toUpperCase();
            if (this.at === i) x = `>${x}`;
            if (i % 16 === 0) acc = `${acc}\n${x}`;
            else acc = `${acc} ${x}`;
            return acc;
        }, '');
        return s.trim();
    }
}
class Writer {
    constructor() {
        this.length = 0;
        this.buffer = new Uint8Array(16384);
    }
    u8(num) {
        this.buffer[this.length] = num;
        this.length += 1;
        return this;
    }
    u16(num) {
        u16[0] = num;
        this.buffer.set(u8, this.length);
        this.length += 2;
        return this;
    }
    u32(num) {
        u32[0] = num;
        this.buffer.set(u8, this.length);
        this.length += 4;
        return this;
    }
    float(num) {
        float[0] = num;
        this.buffer.set(u8, this.length);
        this.length += 4;
        return this;
    }
    vu(num) {
        do {
            let part = num;
            num >>>= 7;
            if (num) part |= 0x80;
            this.buffer[this.length++] = part;
        } while (num);
        return this;
    }
    vi(num) {
        const sign = (num & 0x80000000) >>> 31;
        if (sign) num = ~num;
        const part = (num << 1) | sign;
        this.vu(part);
        return this;
    }
    vf(num) {
        float[0] = num;
        this.vi(endianSwap(u32[0]));
        return this;
    }
    string(str) {
        const bytes = new TextEncoder().encode(str);
        this.buffer.set(bytes, this.length);
        this.length += bytes.length;
        this.buffer[this.length++] = 0;
        return this;
    }
    buf(buf) {
        const length = buf.byteLength;
        this.vu(length);
        this.buffer.set(buf, this.length);
        this.length += length;
        return this;
    }
    out() {
        return this.buffer.slice(0, this.length);
    }
    dump() {
        return Array.from(this.buffer.subarray(0, this.length))
            .map((r) => r.toString(16).padStart(2, 0))
            .join(' ');
    }
}
class DTSocket {
    constructor() {
        this._socket;
        this._lastPing = Date.now();
        this._pow_workers = [...Array(8)].map((x) => new PowWorker());
        this.accepted = false;
    }

    get region() {
        return new URL(this._socket.url).host.split('.')[0];
    }

    connect(url) {
        this._socket = new WebSocket(url);
        this._socket.binaryType = 'arraybuffer';
        this._socket.onopen = () => {
            this._onopen();
            if (this.onopen) this.onopen();
        };
        this._socket.onmessage = (event) => {
            this._onmessage(event);
            if (this.onmessage) this.onmessage(event);
        };
        this._socket.onclose = (event) => {
            this._onclose(event);
            if (this.onclose) this.onclose(event);
        };
    }
    _onopen() {
        this.send('heartbeat');
        this.send('initial', {
            version: GM_info.script.version,
            authToken: window.localStorage[DTTOKEN],
        });
    }
    _onmessage(event) {
        const reader = new Reader(event.data);
        switch (reader.vu()) {
            case 0: {
                const authToken = reader.string();

                window.localStorage[DTTOKEN] = authToken;
                break;
            }
            case 1: {
                const count = reader.vu();
                const buffer = reader.buf();

                if (this.oncustom_diep_serverbound) this.oncustom_diep_serverbound(count, buffer);
                break;
            }
            case 2: {
                const count = reader.vu();
                const buffer = reader.buf();

                if (this.oncustom_diep_clientbound) this.oncustom_diep_clientbound(count, buffer);
                break;
            }
            case 3: {
                this.accepted = true;
                if (this.onaccept) this.onaccept();
                break;
            }
            case 4: {
                if (this.ondeny) this.ondeny();
                break;
            }
            case 5: {
                const latency = Date.now() - this._lastPing;
                this.send('heartbeat');
                this._lastPing = Date.now();

                if (this.onlatency) this.onlatency(latency);
                break;
            }
            case 6: {
                const id = reader.vu();
                const difficulty = reader.vu();
                const prefix = reader.string();

                console.log(id, difficulty, prefix);
                //look for a worker thats not busy, but definetly take the last one
                for (let i = 0; i < this._pow_workers.length; i++) {
                    if (!this._pow_workers[i].busy || i + 1 === this._pow_workers.length) {
                        this._pow_workers[i].busy = true;
                        this._pow_workers[i].solve(prefix, difficulty, (result) => {
                            console.log(id, result);
                            this._pow_workers[i].busy = false;
                            this.send('pow_result', { id, result: result });
                        });
                        return;
                    }
                }
                break;
            }
            case 7: {
                const message = reader.string();

                if (this.onalert) this.onalert(message);
                break;
            }
        }
    }
    _onclose(event) {}

    send(type, content) {
        if (this.isClosed()) return;
        const writer = new Writer();

        switch (type) {
            case 'initial': {
                const { version, authToken } = content;
                writer.vu(0);
                writer.string(version);
                writer.string(authToken);
                break;
            }
            case 'diep_serverbound': {
                const { count, buffer } = content;
                writer.vu(1);
                writer.vu(count);
                writer.buf(buffer);
                break;
            }
            case 'diep_clientbound': {
                const { count, buffer } = content;
                writer.vu(2);
                writer.vu(count);
                writer.buf(buffer);
                break;
            }
            case 'update': {
                const { id, value } = content;
                writer.vu(3);
                writer.vu(id);
                writer.string(value);
                break;
            }
            case 'command': {
                const { id, value } = content;
                writer.vu(4);
                writer.vu(id);
                writer.vu(value);
                break;
            }
            case 'heartbeat': {
                writer.vu(5);
                break;
            }
            case 'pow_result': {
                const { id, result } = content;
                writer.vu(6);
                writer.vu(id);
                writer.string(result);
                break;
            }
            default:
                console.error('unrecognized packet type:', type);
        }
        //WebSocket_send.call(this._socket, writer.out());
        this._socket.send(writer.out());
    }

    isClosed() {
        if (this._socket) return this._socket.readyState !== WebSocket.OPEN;
        return true;
    }

    static findServerPreference(urls) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => resolve(), 5000);
            for (let i = 0; i < urls.length; i++) {
                const ws = new WebSocket(urls[i]);
                ws.onopen = function () {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(ws.url);
                };
            }
        });
    }
}

/*
 *   H E L P E R   F U N C T I O N S
 */
function UTF8ToString(utf8 = '') {
    return decodeURI(
        utf8
            .split('')
            .map((c) => `%${c.charCodeAt(0).toString(16)}`)
            .join('')
    );
}
function updateInformation(type, data) {
    const updates = {
        [UPDATE.SERVER](url) {
            url = url.match(/(?<=wss:\/\/).[0-9a-z]{3}(?=.s.m28n.net\/)/)[0];
            return url;
        }
    };
    dtSocket.send('update', { id: type, value: updates[type](data) });
}
function addButton(parent, text, onclick, keyCode) {
    let button = document.createElement('button');
    parent.appendChild(button);
    button.innerHTML = text;
    button.keyCode = keyCode;
    button.onclick = onclick;
    button.style['background-color'] = guiColors[guiButtons.length % guiColors.length];
    guiButtons.push(button);
    return button;
}
function enableGui() {
    guiBody.style.display = 'block';
}
function disableGui() {
    guiBody.style.display = 'none';
}
function onBtnHead() {
    if (guiBody.style.display === 'block') {
        this.innerHTML = 'Open DiepTool Menu';
        disableGui();
    } else {
        this.innerHTML = 'Close DiepTool Menu';
        enableGui();
    }
}
function onBtnJoinBots() {
    dtSocket.send('command', {
        id: COMMAND.JOIN_BOTS,
        value: window.prompt('Please enter the amount of bots', 5),
    });
}
function onBtnMultibox() {
    this.active = !this.active;
    if (this.active) {
        this.innerHTML = 'Multiboxing: ON';
        dtSocket.send('command', { id: COMMAND.MULTIBOX, value: 1 });
    } else {
        this.innerHTML = 'Multiboxing: OFF';
        dtSocket.send('command', { id: COMMAND.MULTIBOX, value: 0 });
    }
}
function onBtnAfk() {
    this.active = !this.active;
    if (this.active) {
        //gSendIsBlocked++;
        gSBCountStop = gSBCount;
        this.innerHTML = 'AFK: ON';
        dtSocket.send('command', { id: COMMAND.AFK, value: 1 });
    } else {
        //gSendIsBlocked--;
        this.innerHTML = 'AFK: OFF';
        dtSocket.send('command', { id: COMMAND.AFK, value: 0 });
    }
}
function onBtnClump() {
    this.active = !this.active;
    if (this.active) {
        this.innerHTML = 'Clump: ON';
        dtSocket.send('command', { id: COMMAND.CLUMP, value: 1 });
    } else {
        this.innerHTML = 'Clump: OFF';
        dtSocket.send('command', { id: COMMAND.CLUMP, value: 0 });
    }
}
function onBtnSpinbot() {
    this.active = !this.active;
    if (this.active) {
        //gSendIsBlocked++;
        this.innerHTML = 'Spinbot: ON';
        dtSocket.send('command', { id: COMMAND.SPINBOT, value: 1 });
    } else {
        //gSendIsBlocked--;
        this.innerHTML = 'Spinbot: OFF';
        dtSocket.send('command', { id: COMMAND.SPINBOT, value: 0 });
    }
}
function onBtnPushbot() {
    this.active = !this.active;
    if (this.active) {
        this.innerHTML = 'Pushbot: ON';
        dtSocket.send('command', { id: COMMAND.PUSHBOT, value: 1 });
    } else {
        this.innerHTML = 'Pushbot: OFF';
        dtSocket.send('command', { id: COMMAND.PUSHBOT, value: 0 });
    }
}
function onBtnSettings() {}
function onBtnDiscord() {
    window.open('https://discord.gg/5q2E3Sx');
}
function onBtnPatreon() {
    window.open('https://www.patreon.com/dieptool');
}
function onBtnLogin() {
    window.location.href =
        'https://www.patreon.com/oauth2/authorize?response_type=code&client_id=JYcqUtVs5TqDjR8kUvupwNDBdGNF_QbEOS4anAsJ9hP9rGgdiP5xKehVRGtpPApj&redirect_uri=https://diep.io';
}

function _send(data) {
    gSBCount++;
    dtSocket.send('diep_serverbound', { count: gSBCount, buffer: data });
    if (gSendIsBlocked) return;

    WebSocket_send.call(this, data);
}
function _onmessage(event) {
    const data = new Uint8Array(event.data);
    gCBCount++;
    dtSocket.send('diep_clientbound', { count: gCBCount, buffer: data });

    WebSocket_onmessage.call(this, event);
}
const WebSocket_send = window.WebSocket.prototype.send;
let WebSocket_onmessage;
(function WebSocketHook() {
    const wsInstances = new Set();
    window.WebSocket.prototype.send = function (data) {
        if (this.url.match(/s.m28n.net/) && data instanceof Int8Array) {
            if (!wsInstances.has(this)) {
                wsInstances.add(this);
                gWebSocket = this;
                gSBCount = 0;
                gCBCount = 0;
                updateInformation(UPDATE.SERVER, this.url );

                WebSocket_onmessage = this.onmessage;
                this.onmessage = function (event) {
                    _onmessage.call(this, event);
                };
            }
            _send.call(this, data);
        } else WebSocket_send.call(this, data);
    };
})();
(function enableShortcuts() {
    document.addEventListener('keydown', (event) => {
        if (document.getElementById('textInputContainer').style.display === 'block') return;
        guiButtons.forEach((button) => {
            if (button.keyCode === event.code) button.onclick();
        });
    });
})();
(function freezeMouse() {
    const canvas = document.getElementById('canvas');
    canvas._onmousemove = canvas.onmousemove;
    canvas.onmousemove = function (e) {
        if (!gFreezeMouse) this._onmousemove(e);
    };
})();
(function authCallback() {
    function parseQuery(q) {
        const parsed = {};
        q.substring(1)
            .split('&')
            .forEach((e) => {
                e = e.split('=');
                parsed[e[0]] = e[1];
            });
        return parsed;
    }
    const query = parseQuery(window.location.search);
    if (query.code) {
        window.localStorage[DTTOKEN] = query.code;
        window.history.pushState(null, 'diep.io', 'https://diep.io/');
    } else if (query.error) {
        window.localStorage[DTTOKEN] = '';
        window.history.pushState(null, 'diep.io', 'https://diep.io/');
    }
})();

/*
 *   M A I N
 */
let gWebSocket;
let gFreezeMouse = false;
let gSendIsBlocked = 0;
let gSBCount = 0;
let gCBCount = 0;
let gSBCountStop = 0;
let gCBCountStop = 0;
let dtSocket = new DTSocket();
/*
 *   G U I
 */
GM_addStyle(`
.gui-dieptool button {
	display: block;
	font-family: Ubuntu;
	color: #fff;
	text-shadow: -.1em -.1em 0 #000, 0 -.1em 0 #000, .1em -.1em 0 #000, .1em 0 0 #000, .1em .1em 0 #000, 0 .1em 0 #000, -.1em .1em 0 #000, -.1em 0 0 #000;
	opacity: .8;
	border: 0;
	padding: .3em .5em;
	width: 100%;
	transition: all .15s
}

.gui-dieptool {
	top: 0;
	left: 0;
	position: absolute
}

.gui-dieptool button:active:not([disabled]) {
	filter: brightness(.9)
}

.gui-dieptool button:hover:not([disabled]):not(:active) {
	filter: brightness(1.1)
}

.gui-dieptool-serverinfo {
	display: block;
	font-family: Ubuntu;
	color: #fff;
	text-shadow: -.1em -.1em 0 #000, 0 -.1em 0 #000, .1em -.1em 0 #000, .1em 0 0 #000, .1em .1em 0 #000, 0 .1em 0 #000, -.1em .1em 0 #000, -.1em 0 0 #000;
	opacity: .8;
	position: absolute;
	bottom: .1em;
	right: 2em;
	font-size: .8em;
}
`);
const guiColors = [
    '#E8B18A',
    '#E666EA',
    '#9566EA',
    '#6690EA',
    '#E7D063',
    '#EA6666',
    '#92EA66',
    '#66EAE6',
];
const guiButtons = [];

const guiDiepTool = document.createElement('div');
guiDiepTool.className = 'gui-dieptool';
document.body.appendChild(guiDiepTool);

const guiHead = document.createElement('div');
guiDiepTool.appendChild(guiHead);

const guiBody = document.createElement('div');
guiDiepTool.appendChild(guiBody);

const guiServerInfo = document.createElement('div');
guiServerInfo.className = 'gui-dieptool-serverinfo';
document.body.appendChild(guiServerInfo);
guiServerInfo.innerText = 'DiepTool connecting...';

addButton(guiHead, 'Open DiepTool Menu', onBtnHead);
addButton(guiBody, 'Join Bots', onBtnJoinBots, 'KeyJ');
addButton(guiBody, 'Multiboxing: OFF', onBtnMultibox, 'KeyF');
addButton(guiBody, 'Clump: OFF', onBtnClump, 'KeyX');
addButton(guiBody, 'AFK: OFF', onBtnAfk, 'KeyQ');
addButton(guiBody, 'Spinbot OFF', onBtnSpinbot, 'KeyV');
addButton(guiBody, 'Pushbot OFF', onBtnPushbot, 'KeyP');
addButton(guiBody, 'Settings', onBtnSettings);

if (!window.localStorage[DTTOKEN]) {
    addButton(guiBody, 'Discord Server', onBtnDiscord);
    addButton(guiBody, 'Patreon Page', onBtnPatreon);
    addButton(guiBody, 'Log In with Patreon', onBtnLogin);
}
disableGui();

(async function initializeSocket() {
    const url = await DTSocket.findServerPreference(SERVERS);
    console.log('found server preference', url);
    if (!url) {
        console.log('Please try again later.');
        guiServerInfo.innerText = 'Please try again later';
        return;
    }
    dtSocket.onclose = function () {
        console.log('disconnected from DT server');
        guiServerInfo.innerText = 'Disconnected';
        setTimeout(() => {
            guiServerInfo.innerText = 'Reconnecting...';
            dtSocket.connect(url);
        }, 5000);
    };
    dtSocket.onaccept = function () {
        this.onlatency = (latency) => (guiServerInfo.innerText = `${latency} ms ${this.region} DiepTool`);
    };
    dtSocket.ondeny = function () {
        window.localStorage[DTTOKEN] = '';
        setTimeout(() => window.location.reload(), 3000);
    };
    dtSocket.onalert = function (message) {
        console.log('DiepTool alert:', message);
        const btnAlert = addButton(guiHead, message);
        setTimeout(() => btnAlert.parentNode.removeChild(btnAlert), 5000);
    };
    dtSocket.oncustom_diep_clientbound = function (count, data) {
        WebSocket_onmessage.call(gWebSocket, { data });
    };
    dtSocket.oncustom_diep_serverbound = function (count, data) {
        if(gSendIsBlocked) console.log(count, gSBCountStop);
        if (count >= gSBCountStop) WebSocket_send.call(gWebSocket, data);
    };
    dtSocket.connect(url);
})();

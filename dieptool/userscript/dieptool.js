// ==UserScript==
// @name         Diep.io Tool
// @description  made with much love.
// @version      3.0.9
// @author       Cazka#9552
// @namespace    *://diep.io/
// @match        *://diep.io/
// @grant        GM_info
// @grant        GM_addStyle
// ==/UserScript==
'use strict';

/*
 * E N U M S   A N D   C O N S T A N T S
 */
const PACKET_SERVERBOUND = {
    LOGIN: 0,
    UPDATE: 1,
    COMMAND: 2,
    HEARTBEAT: 8,
    SERVERBOUND: 9,
    CLIENTBOUND: 10,
};
const PACKET_CLIENTBOUND = {
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
const JOIN_BOTS_AMOUNT = 5;
const NODESOCKET_URL = 'wss://8cc8acf75480.eu.ngrok.io';

/*
 *    G L O B A L   V A R I A B L E S
 */
const globalUserInfo = {
    [UPDATE.VERSION]: GM_info.script.version,
    [UPDATE.NAME]: UTF8ToString(window.localStorage.name),
    [UPDATE.WSURL]: null,
    [UPDATE.PARTY]: null,
    [UPDATE.GAMEMODE]: window.localStorage.gamemode,
};
let globalAuthToken = window.localStorage.DTTOKEN || 'user';
let globalWebSocket;
let globalReadyToInitialize = false;
let globalSendBlocked = false;

/*
 *    G U I
 */
// css, ty excigma for making the gui less ugly
GM_addStyle(`
.gui-dieptool button {
display: block;
font-family: 'Ubuntu';
color: white;
text-shadow:
-0.1em -0.1em 0 #000,
0      -0.1em 0 #000,
0.1em  -0.1em 0 #000,
0.1em  0      0 #000,
0.1em  0.1em  0 #000,
0      0.1em  0 #000,
-0.1em 0.1em  0 #000,
-0.1em 0      0 #000;
opacity: 0.8;
border: none;
padding: 0.3em 0.5em;
width: 100%;
transition: all 0.15s;
}
.gui-dieptool {
top: 0px;
left: 0px;
position: absolute;
}
.gui-dieptool button:active:not([disabled]) {
filter: brightness(0.9)
}
.gui-dieptool button:hover:not([disabled]):not(:active) {
filter: brightness(1.1)
}
`);
let guiColors = [
    '#E8B18A',
    '#E666EA',
    '#9566EA',
    '#6690EA',
    '#E7D063',
    '#EA6666',
    '#92EA66',
    '#66EAE6',
];
let guiButtons = [];

let guiDiepTool;
let guiHeader;
let guiBody;

let guiBtnLatency;
let guiBtnJoinBots;
let guiBtnMultibox;
let guiBtnAfk;
let guiBtnUpdate;

let multiboxing = false;
let afk = false;
let updateOpenTab = false;

guiDiepTool = document.createElement('div');
guiDiepTool.className = 'gui-dieptool';
document.body.appendChild(guiDiepTool);

guiHeader = document.createElement('div');
guiHeader.className = 'gui-header';
guiDiepTool.appendChild(guiHeader);

guiBody = document.createElement('div');
guiBody.className = 'gui-body';
guiDiepTool.appendChild(guiBody);

guiBtnLatency = addButton('Not connected', null, onBtnLatency, guiHeader);
guiBtnJoinBots = addButton(`Join ${JOIN_BOTS_AMOUNT} bots`, 'KeyJ', onBtnJoinBots, guiBody);
guiBtnMultibox = addButton('Enable Multiboxing', 'KeyF', onBtnMultibox, guiBody);
guiBtnAfk = addButton('Enable AFK', 'KeyQ', onBtnAfk, guiBody);
guiBtnUpdate = addButton('Check for updates', null, onBtnUpdate, guiBody);

// Enable keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (!document.getElementById('textInput').disabled) return;
    guiButtons.forEach((button) => {
        if (button.keyCode === event.code) button.onclick();
    });
});

disableGUI();

function addButton(text, keyCode, onclick, parent) {
    let button = document.createElement('button');
    parent.appendChild(button);
    button.innerHTML = text;
    button.keyCode = keyCode;
    button.onclick = onclick;
    button.style['background-color'] = guiColors[guiButtons.length % guiColors.length];
    guiButtons.push(button);
    return button;
}

/*
 *    N O D E   W E B S O C K E T
 */
let failedConnections = 0;
let nodeSocket = openSocket();
function openSocket() {
    if (failedConnections > 10) {
        guiBtnLatency.innerHTML = 'please try again later!';
        return;
    }
    failedConnections++;
    guiBtnLatency.innerHTML = 'connecting...';
    let socket = new WebSocket(NODESOCKET_URL);
    socket.binaryType = 'arraybuffer';
    socket.onopen = onOpenHandler;
    socket.onmessage = onMessageHandler;
    socket.onclose = onDisconnectHandler;
    return socket;
}

/*
 *    G U I   E V E N T H A N D L E R S
 */
function updateLatency(latency) {
    guiBtnLatency.innerHTML = `${latency} ms DiepTool`;
}
function onBtnLatency() {
    if (guiBody.style.display === 'block') disableGUI();
    else enableGUI();
}
function onBtnJoinBots() {
    nodeSocket_emit(PACKET_SERVERBOUND.COMMAND, [COMMAND.JOIN_BOTS, JOIN_BOTS_AMOUNT]);
}
function onBtnMultibox() {
    multiboxing = !multiboxing;
    if (multiboxing) {
        guiBtnMultibox.innerHTML = 'Disable Multiboxing';
        nodeSocket_emit(PACKET_SERVERBOUND.COMMAND, [COMMAND.MULTIBOX, BOOLEAN.TRUE]);
    } else {
        guiBtnMultibox.innerHTML = 'Enable Multiboxing';
        nodeSocket_emit(PACKET_SERVERBOUND.COMMAND, [COMMAND.MULTIBOX, BOOLEAN.FALSE]);
    }
}
function onBtnAfk() {
    afk = !afk;
    if (afk) {
        guiBtnAfk.innerHTML = 'Disable AFK';
        nodeSocket_emit(PACKET_SERVERBOUND.COMMAND, [COMMAND.AFK, BOOLEAN.TRUE]);
    } else {
        guiBtnAfk.innerHTML = 'Enable AFK';
        nodeSocket_emit(PACKET_SERVERBOUND.COMMAND, [COMMAND.AFK, BOOLEAN.FALSE]);
    }
}
function onBtnUpdate() {
    if (updateOpenTab) {
        updateOpenTab = false;
        window.open('https://greasyfork.org/scripts/401910-diep-io-tool');
        guiBtnUpdate.innerHTML = 'Check for Updates';
    } else {
        updateOpenTab = true;
        guiBtnUpdate.innerHTML = 'Open in new Tab?';
        setTimeout(() => {
            guiBtnUpdate.innerHTML = 'Check for Updates';
            updateOpenTab = false;
        }, 3000);
    }
}

/*
 *    H I J A C K   S E N D ( )
 */
const wsInstances = new Set();
window.WebSocket.prototype._send = window.WebSocket.prototype.send;
window.WebSocket.prototype.send = function (data) {
    this._send(data);
    if (this.url.match(/s.m28n.net/) && data instanceof Int8Array) {
        nodeSocket_emit(PACKET_SERVERBOUND.SERVERBOUND, data);

        if (!wsInstances.has(this)) {
            wsInstances.add(this);
            globalWebSocket = this;
            update(UPDATE.WSURL, this.url);

            this._onmessage = this.onmessage;
            this.onmessage = function (event) {
                this._onmessage(event);
                const data = new Uint8Array(event.data);
                nodeSocket_emit(PACKET_SERVERBOUND.CLIENTBOUND, data);

                if (data[0] === 4) update(UPDATE.GAMEMODE, data);
                else if (data[0] === 6) update(UPDATE.PARTY, data);
                else if (data[0] === 10) globalReadyToInitialize = true;
            };
        }
        if (data[0] === 2) update(UPDATE.NAME, data);
    }
};

/*
 *    H E L P E R   F U N C T I O N S
 */
function update(type, data) {
    const updates = {
        [UPDATE.NAME](data) {
            let name = new TextDecoder().decode(data.slice(1, data.length - 1));
            return name;
        },
        [UPDATE.WSURL](url) {
            return url;
        },
        [UPDATE.PARTY](data) {
            let party = '';
            for (let i = 1; i < data.byteLength; i++) {
                let byte = data[i].toString(16).split('');
                if (byte.length === 1) {
                    party += byte[0] + '0';
                } else {
                    party += byte[1] + byte[0];
                }
            }
            return party;
        },
        [UPDATE.GAMEMODE](data) {
            let gamemode = new TextDecoder().decode(data.slice(1, data.length)).split('\u0000')[0];
            return gamemode;
        },
    };
    globalUserInfo[type] = updates[type](data);
    nodeSocket_emit(PACKET_SERVERBOUND.UPDATE, [type, globalUserInfo[type]]);
}
function nodeSocket_emit(id, data = []) {
    if (isClosed()) return;

    const writer = new Writer().u8(id);
    switch (id) {
        case PACKET_SERVERBOUND.LOGIN:
            writer.string(data[0]);
            break;
        case PACKET_SERVERBOUND.UPDATE:
            writer.u8(data[0]);
            writer.string(data[1]);
            break;
        case PACKET_SERVERBOUND.COMMAND:
            writer.u8(data[0]);
            writer.u8(data[1]);
            break;
        case PACKET_SERVERBOUND.SERVERBOUND:
            writer.array(data);
            break;
        case PACKET_SERVERBOUND.CLIENTBOUND:
            writer.array(data);
            break;
    }
    nodeSocket.send(writer.out());
}
function isClosed() {
    if (nodeSocket) return nodeSocket.readyState !== WebSocket.OPEN;
    return true;
}
function enableGUI() {
    guiBody.style.display = 'block';
}
function disableGUI() {
    guiBody.style.display = 'none';
}
function UTF8ToString(utf8) {
    return decodeURI(
        utf8
            .split('')
            .map((c) => `%${c.charCodeAt(0).toString(16)}`)
            .join('')
    );
}

/*
 *    N O D E S O C K E T   E V E N T H A N D L E R
 */
function onOpenHandler() {
    console.log('connected to node.js Server');
    nodeSocket_emit(PACKET_SERVERBOUND.LOGIN, [globalAuthToken]);
    nodeSocket_emit(PACKET_SERVERBOUND.HEARTBEAT);
    nodeSocket.lastPing = Date.now();
    failedConnections = 0;
}
function onAcceptHandler() {
    let int = setInterval(() => {
        if (globalReadyToInitialize) {
            clearInterval(int);

            for (let [key, value] of Object.entries(globalUserInfo)) {
                nodeSocket_emit(PACKET_SERVERBOUND.UPDATE, [key, value]);
            }
        }
    });
}
function onMessageHandler(event) {
    const reader = new Reader(event.data);
    switch (reader.u8()) {
        case PACKET_CLIENTBOUND.AUTHTOKEN:
            window.localStorage.DTTOKEN = reader.string();
            globalAuthToken = window.localStorage.DTTOKEN;
            break;
        case PACKET_CLIENTBOUND.ACCEPT:
            onAcceptHandler();
            break;
        case PACKET_CLIENTBOUND.HEARTBEAT:
            updateLatency(Date.now() - nodeSocket.lastPing);
            nodeSocket_emit(PACKET_SERVERBOUND.HEARTBEAT);
            nodeSocket.lastPing = Date.now();
            break;
        case PACKET_CLIENTBOUND.CUSTOM_SERVERBOUND:
            globalWebSocket._send(reader.array());
            break;
        case PACKET_CLIENTBOUND.CUSTOM_CLIENTBOUND:
            globalWebSocket._onmessage({ data: reader.array() });
            break;
    }
}
function onDisconnectHandler(event) {
    console.log('disconnected from node.js Server');
    guiBtnLatency.innerHTML = 'disconnected';
    if (event.code === 1006) nodeSocket = openSocket();
}

/*
 * H E L P E R   C L A S S
 */
const convo = new ArrayBuffer(4);
const u8 = new Uint8Array(convo);
const u16 = new Uint16Array(convo);

class Writer {
    constructor() {
        this.length = 0;
        this.buffer = new Uint8Array(8192);
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
    string(str) {
        let bytes = new TextEncoder().encode(str);
        this.buffer.set(bytes, this.length);
        this.length += bytes.length;
        this.buffer[this.length++] = 0;
        return this;
    }
    array(arr) {
        this.buffer.set(arr, this.length);
        this.length += arr.byteLength;
        return this;
    }
    out() {
        return this.buffer.slice(0, this.length);
    }
}
class Reader {
    constructor(content) {
        this.at = 0;
        this.buffer = new Uint8Array(content);
    }
    u8() {
        return this.buffer[this.at++];
    }
    u16() {
        u8.set(this.buffer.subarray(this.at, (this.at += 2)));
        return u16[0];
    }
    string() {
        let at = this.at;
        while (this.buffer[this.at]) this.at++;
        return new TextDecoder().decode(this.buffer.subarray(at, this.at++));
    }
    array() {
        return this.buffer.slice(this.at);
    }
}

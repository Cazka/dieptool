GM_addStyle(
    `.gui-dieptool button{display:block;font-family:Ubuntu;color:#fff;text-shadow:-.1em -.1em 0 #000,0 -.1em 0 #000,.1em -.1em 0 #000,.1em 0 0 #000,.1em .1em 0 #000,0 .1em 0 #000,-.1em .1em 0 #000,-.1em 0 0 #000;opacity:.8;border:none;padding:.3em .5em;width:100%;transition:all .15s}.gui-dieptool{top:0;left:0;position:absolute}.gui-dieptool button:active:not([disabled]){filter:brightness(.9)}.gui-dieptool button:hover:not([disabled]):not(:active){filter:brightness(1.1)}`
);
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
guiHead.className = 'gui-header';
guiDiepTool.appendChild(guiHead);

const guiBody = document.createElement('div');
guiBody.className = 'gui-body';
guiDiepTool.appendChild(guiBody);

if(!window.localStorage['DTTOKEN']) addButton('Login', null, onBtnLogin, guiHead);
else {
    const guiBtnLatency = addButton('not connected', null, onBtnLatency, guiHead);
    const guiBtnJoinBots = addButton(`Join ${JOIN_BOTS_AMOUNT} bots`, 'KeyJ', onBtnJoinBots, guiBody);
    const guiBtnMultibox = addButton('Enable Multiboxing', 'KeyF', onBtnMultibox, guiBody);
    const guiBtnClump = addButton('Enable Clump', 'KeyX', onBtnClump, guiBody);
    const guiBtnAfk = addButton('Enable AFK', 'KeyQ', onBtnAfk, guiBody);
    const guiBtnSbx = addButton('Join Public Sandbox', null, onBtnSbx, guiBody);
    const guiBtnUpdate = addButton('Check for updates', null, onBtnUpdate, guiBody);
    const guiBtnSupport = addButton('Membership', null, onBtnSupport, guiBody);
}
// Enable keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (document.getElementById('textInputContainer').style['display'] === 'block') return;
    guiButtons.forEach((button) => {
        if (button.keyCode === event.code) button.onclick();
    });
});

disableGUI();

function addButton(text, keyCode, onclick, parent) {
    const button = document.createElement('button');
    parent.appendChild(button);
    button.innerHTML = text;
    button.keyCode = keyCode;
    button.onclick = onclick;
    button.style['background-color'] = guiColors[guiButtons.length % guiColors.length];
    guiButtons.push(button);
    return button;
}

/*
 *    B U T T O N   E V E N T H A N D L E R S
 */
function updateLatency(latency) {
    guiBtnLatency.innerHTML = `${latency} ms DiepTool`;
}
function onBtnLogin() {
    window.location.href = 'https://discord.com/api/oauth2/authorize?client_id=737680273860329553&redirect_uri=https%3A%2F%2Fdiep.io&response_type=code&scope=identify';
}
function onBtnLatency() {
    if (guiBody.style.display === 'block') disableGUI();
    else enableGUI();
}
function onBtnJoinBots() {
    nodeSocket_send('command', { id: COMMAND.JOIN_BOTS, value: JOIN_BOTS_AMOUNT });
    if (!gWorker) gWorker = new PowWorker();
}
function onBtnMultibox() {
    this.state = !this.state;
    if (this.state) {
        this.innerHTML = 'Disable Multiboxing';
        nodeSocket_send('command', { id: COMMAND.MULTIBOX, value: 1 });
    } else {
        this.innerHTML = 'Enable Multiboxing';
        nodeSocket_send('command', { id: COMMAND.MULTIBOX, value: 0 });
    }
}
function onBtnClump() {
    this.state = !this.state;
    if (this.state) {
        guiBtnClump.innerHTML = 'Disable Clump';
        nodeSocket_send('command', { id: COMMAND.CLUMP, value: 1 });
    } else {
        guiBtnClump.innerHTML = 'Enable Clump';
        nodeSocket_send('command', { id: COMMAND.CLUMP, value: 0 });
    }
}
function onBtnAfk() {
    this.state = !this.state;
    if (this.state) {
        gSendIsBlocked = true;
        guiBtnAfk.innerHTML = 'Disable AFK';
        nodeSocket_send('command', { id: COMMAND.AFK, value: 1 });
    } else {
        gSendIsBlocked = false;
        guiBtnAfk.innerHTML = 'Enable AFK';
        nodeSocket_send('command', { id: COMMAND.AFK, value: 0 });
    }
}
async function onBtnSbx() {
    const res = await window.fetch('https://dieptool-sbx.glitch.me');
    window.location.href = (await res.json()).link;
    if (gWebSocket && gWebSocket.readyState === window.WebSocket.OPEN) gWebSocket.close();
    else window.location.reload();
    setTimeout(() => (window.location.hash = ''), 2000);
}
function onBtnUpdate() {
    this.confirm = !this.confirm;
    if (this.confirm) {
        guiBtnUpdate.innerHTML = 'Open in new tab?';
        setTimeout(() => {
            guiBtnUpdate.innerHTML = 'Check for Updates';
            this.confirm = false;
        }, 3000);
    } else {
        window.open('https://greasyfork.org/scripts/401910-diep-io-tool');
        guiBtnUpdate.innerHTML = 'Check for Updates';
    }
}
function onBtnSupport() {
    this.confirm = !this.confirm;
    if (this.confirm) {
        guiBtnSupport.innerHTML = 'Open in new tab?';
        setTimeout(() => {
            guiBtnSupport.innerHTML = 'Membership';
            this.confirm = false;
        }, 3000);
    } else {
        window.open('https://www.patreon.com/dieptool');
        guiBtnSupport.innerHTML = 'Membership';
    }
}
function enableGUI() {
    guiBody.style.display = 'block';
}
function disableGUI() {
    guiBody.style.display = 'none';
}
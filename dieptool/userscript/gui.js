
else {
    const guiBtnUpdate = addButton('Check for updates', null, onBtnUpdate, guiBody);
    const guiBtnSupport = addButton('Membership', null, onBtnSupport, guiBody);
}


/*
 *    B U T T O N   E V E N T H A N D L E R S
 */
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
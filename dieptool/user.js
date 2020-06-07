const EventEmitter = require('events');
const DiepSocket = require('diepsocket');
const Bot = require('./Bot.js');

class User extends EventEmitter {
	constructor(socket, authKey, buddies) {
		super();
		// Socket information
		this.socket = socket;
		this.ip = this.client.ip;
		this.latency = 0;

		// User information
		this.authKey = authKey;
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

		// Flags
		this.welcomeMessageSend = false;
		this.rateLimited = false;
		this.rateLimitTime = 100;

		// Bots
		this.buddies = buddies;
		this.bots = new Set();
		this.botsjoining = false;
		this.botsMaximum = 200;
		this.multibox = false;

		this.socket.on('close', (reason) => {
			super.emit('close', reason);
			this.bots.forEach((bot) => bot.close());
		});
		this.socket.on('latency', (latency) => (this.latency = latency));

		this.socket.emit('info');
		this.socket.on('user info', (userInfo) => this.onUserInfoHandler(userInfo));
	}
	/*
	 *    E V E N T   H A N D L E R S
	 */
	onUserInfoHandler(info) {
		// Update all Informations
		this.onUpdateHandler(info);
		displayUserInfo(this);

		// Check if the Userinformation is right
		if (!(this.version && this.wsURL)) {
			console.error('faulty User Info', info);
			this.sendNotification('Something is wrong with your Client!', color.red, 0);
			this.socket.disconnect();
		} else if (this.version !== process.env.SERVERVERSION) {
			this.sendNotification('Please update Diep.io Tool to the newest Version', color.RED, 0);
			this.socket.disconnect();
		} else if (this.authKey !== 'user') {
			this.ban('Invalid AuthKey, you are being banned!');
		} else this.setEventHandlers();
	}
	onUpdateHandler(data) {
		console.log(`${this.ip} received update`, data);
		this.name = data.name ? data.name : this.name ? this.name : '';
		if (data.wsURL && data.wsURL.match(/(?<=wss:\/\/).*?(?=.s.m28n.net\/)/)) {
			this.wsURL = data.wsURL;
			this.party = data.party ? data.party : '';
		}
		this.party = data.party ? data.party : this.party;
		this.gamemode = data.gamemode ? data.gamemode : this.gamemode;

		this.version = data.version ? data.version : this.version;
		this.link = this.wsURL ? DiepSocket.getLink(this.wsURL, this.party) : this.link;
    
    if(data.wsURL){
      this.bots.forEach((bot) => bot.close());
    }
	}
	onClientBoundHandler(data) {
    if(!(data instanceof Buffer)){
      return;
    }    
  }
	onServerBoundHandler(data) {
    if(!(data instanceof Buffer)){
      return;
    }
		data = new Int8Array(data);
		if (data[0] === 2) {
      if(!this.welcomeMessage){
        this.welcomeMessage = true;
        this.sendNotification('Thank you for using Diep.io Tool');
        this.sendNotification('Made by Cazka', '#f5e042');
        this.sendNotification('Bots disconnect sometimes :( But you can now join unlimited bots :)', color.PINK, 5000); 
      } 
		}
		if (data[0] === 1 && this.multibox) {
			this.bots.forEach((bot) => bot.sendBinary(data));
		}
		if (data[0] === 3 && this.multibox) {
			this.bots.forEach((bot) => bot.sendBinary(data));
		}
		if (data[0] === 4 && this.multibox) {
			this.bots.forEach((bot) => bot.sendBinary(data));
		}
	}
	onCommandHandler(command) {
		// check if rate limited
		if (!this.rateLimited) {
			this.rateLimited = true;
			setTimeout(() => (this.rateLimited = false), this.rateLimitTime);
		} else {
			this.sendNotification('slow down', color.RED);
			return;
		}

		// Start the command
		console.log(`${this.ip} used command: ${command.type}`);
		switch (command.type) {
			case 'joinBots':
				if (this.botsJoining) {
					return;
				}
				if (this.bots.size < this.botsMaximum) {
					this.botsJoining = true;
					this.actionJoinBotsBuddy(command.amount);
					this.sendNotification(`Joining ${command.amount} bots`, color.PINK);
				} else {
					this.sendNotification(`You cant have more than ${this.botsMaximum} bots`);
				}
				break;
			case 'multibox':
				if (command.status !== this.multibox) {
					this.sendNotification(`Multiboxing ${command.status ? 'enabled' : 'disabled'}`, color.PINK);
					this.multibox = command.status;
				}
				break;
			default:
				this.sendNotification(`This feature will be available in the next update!`, color.GREEN);
		}
	}
	/*
	 *    C O M M A N D S
	 */
	actionJoinBotsBuddy(amount, BuddyIndex = 0) {
		if (BuddyIndex >= this.buddies.size) {
			this.sendNotification(`Not enough Proxies available. You have ${this.bots.size} bots`, color.GREEN);
			this.botsJoining = false;
			return;
		} else if (amount === 0 || this.bots.size >= this.botsMaximum) {
			this.sendNotification(`Bots joined succesfully. You have ${this.bots.size} bots`, color.GREEN);
			this.botsJoining = false;
			return;
		}
		// initialize bot
		let bot = new Bot(this.link, Array.from(this.buddies)[BuddyIndex]);
		bot.once('accept', () => {
			this.bots.add(bot);
			console.log(this.ip + ' joined bots ' + (amount - 1) + ' left to join');

			let int = setInterval(() => bot.send(2, 'DT ' + this.name, 0), 100);
			bot.once('close', () => {
				clearInterval(int);
				this.bots.delete(bot);
			});
			if (this.socket.disconnected) bot.close();

			bot.removeAllListeners('error');
			this.actionJoinBotsBuddy(--amount, BuddyIndex);
		});
		bot.once('error', () => {
			bot.removeAllListeners('accept');
			this.actionJoinBotsBuddy(amount, ++BuddyIndex);
		});
  }
  
	/*
	 *    H E L P E R   F U N C T I O N S
	 */
	setEventHandlers() {
		this.socket.on('client bound', (data) => this.onClientBoundHandler(data));
		this.socket.on('server bound', (data) => this.onServerBoundHandler(data));

		this.socket.on('update', (data) => this.onUpdateHandler(data));
		this.socket.on('command', (command) => this.onCommandHandler(command));
	}
	sendNotification(message, hexcolor, time) {
		this.socket.emit('notification', newNotification(message, hexcolor, time));
		this.updateStatus(message);
	}
	ban(reason) {
		this.sendNotification(reason, color.RED, 0);
		super.emit('ban', this.ip);
		this.socket.disconnect();
	}
	toDataObject() {
		return {
			authKey: this.authKey,
			ip: this.ip,
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

const toArray = (...args) => {
	// from cx
	let data = args.map((r) =>
		typeof r === 'number' ? [r] : typeof r === 'string' ? r.split('').map((r) => r.charCodeAt(0)) : r
	);
	return [].concat(...data);
};

const color = {
	PINK: 'ff00ff',
	GREEN: '00ff00',
	RED: 'ff0000',
};

const newNotification = (message, hexcolor = '000000', time = 5000) => {
	let colorPacket = [];
	for (let i = 0; i < hexcolor.length - 1; i += 2) {
		colorPacket.unshift([parseInt(hexcolor.charAt(i) + hexcolor.charAt(i + 1), 16)]);
	}
	let timePacket = [];
	var view = new DataView(new ArrayBuffer(4));
	view.setFloat32(0, time); // Time is in milliseconds
	for (let i = 3; i >= 0; i--) {
		timePacket.push(view.getInt8(i));
	}
	let data = [0x03];
	data = data
		.concat(toArray(message)) //message
		.concat([0x00])
		.concat(colorPacket) //Blue,Green,Red
		.concat([0x00])
		.concat(timePacket) //time
		.concat([0x00]);
	return { data: data };
};

module.exports = User;

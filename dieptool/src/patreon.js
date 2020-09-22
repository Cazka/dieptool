'use strict';
const fetch = require('node-fetch');
const jsonApi = require('jsonapi-parse');

class PatreonClient {
    constructor() {
        this.oAuthResponse = {};
    }

    get access_token() {
        return this.oAuthResponse.access_token;
    }
    get refresh_token() {
        return this.oAuthResponse.refresh_token;
    }

    async _exchangeToken(code) {
        const data = {
            client_id: process.env.PATREON_CLIENT_ID,
            client_secret: process.env.PATREON_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: 'https://diep.io',
        };
        const res = await fetch('https://www.patreon.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }).then((res) => res.json());
        return res;
    }
    async _refreshToken(refresh_token) {
        const data = {
            client_id: process.env.PATREON_CLIENT_ID,
            client_secret: process.env.PATREON_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token,
        };
        const res = await fetch('https://www.patreon.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams(data),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        }).then((res) => res.json());
        return res;
    }
    async login({ code, refresh_token }) {
        if (code) this.oAuthResponse = await this._exchangeToken(code);
        else if (refresh_token) this.oAuthResponse = this._refreshToken(refresh_token);
        console.log(this.oAuthResponse);
    }

    async getUser() {
        const user = {};
        const res = await fetch(
            encodeURI('https://www.patreon.com/api/oauth2/v2/identity?include=memberships,memberships.currently_entitled_tiers&fields[member]=last_charge_date,last_charge_status,pledge_relationship_start&fields[tier]=title,amount_cents'),
            {
                headers: {
                    authorization: `Bearer ${this.access_token}`,
                },
            }
        )
            .then((res) => res.json())
            .then((json) => jsonApi.parse(json));
        user.id = res.data.id;
        user.memberships = res.data.memberships[0];
        return user;
    }
}

module.exports = PatreonClient;

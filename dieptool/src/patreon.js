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

    async login({ code, access_token }) {
        let exchange;
        if (code) exchange = await this._exchangeToken(code);
        else if (access_token) exchange = { access_token };

        if (exchange.error) throw new Error('Failed to Log In');
        this.oAuthResponse = exchange;
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

    async getUser() {
        const user = {};
        const res = await fetch(
            encodeURI(
                'https://www.patreon.com/api/oauth2/v2/identity?include=memberships,memberships.currently_entitled_tiers&fields[member]=last_charge_date,last_charge_status,pledge_relationship_start&fields[tier]=title,amount_cents'
            ),
            {
                headers: {
                    authorization: `Bearer ${this.access_token}`,
                },
            }
        )
            .then((res) => res.json())
            .then((json) => jsonApi.parse(json));
        user.id = res.data.id;
        user.membership = res.data.memberships[0];
        return user;
    }

    get HighestTier() {}
}

module.exports = PatreonClient;

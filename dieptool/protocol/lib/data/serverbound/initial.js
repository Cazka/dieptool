module.exports = {
    id: 0x00,
    type: 'initial',
    parser(parser) {
        const version = parser.string();
        const authToken = parser.string();
        return {
            version,
            authToken,
        };
    },
    builder(builder) {
        const { version, authToken } = builder._packet.content;
        builder.vu(this.id);
        builder.string(version);
        builder.string(authToken);
        return builder.out();
    },
};

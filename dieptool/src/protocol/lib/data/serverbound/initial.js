module.exports = {
    id: 0x00,
    type: 'initial',
    parse(parser) {
        const version = parser.string();
        const authToken = parser.string();
        return {
            version,
            authToken,
        };
    },
    build(builder) {
        const { version, authToken } = builder._packet.content;
        builder.vu(this.id);
        builder.string(version);
        builder.string(authToken);
        return builder.out();
    },
};

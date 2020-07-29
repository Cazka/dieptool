module.exports = {
    id: 0x00,
    type: 'authtoken',
    parse(parser) {
        const authtoken = parser.string();
        return { authtoken };
    },
    build(builder) {
        const { authtoken } = builder._packet.content;
        builder.vu(this.id);
        builder.string(authtoken);
        return builder.out();
    },
};

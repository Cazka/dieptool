module.exports = {
    id: 0x00,
    type: 'authtoken',
    parser(parser) {
        const authtoken = parser.string();
        return { authtoken };
    },
    builder(builder) {
        const { authtoken } = builder._packet.content;
        builder.vu(this.id);
        builder.string(authtoken);
        return builder.out();
    },
};

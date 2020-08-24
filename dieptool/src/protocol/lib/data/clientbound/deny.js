module.exports = {
    id: 0x04,
    type: 'deny',
    parse(parser) {
        const reason = parser.string();
        return { reason };
    },
    build(builder) {
        const { reason } = builder._packet.content;
        builder.vu(this.id);
        builder.string(reason);
        return builder.out();
    },
};

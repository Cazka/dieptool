module.exports = {
    id: 0x01,
    type: 'diep_serverbound',
    parse(parser) {
        const count = parser.vu();
        const buffer = parser.buf();
        return { count, buffer };
    },
    build(builder) {
        const { count, buffer } = builder._packet.content;
        builder.vu(this.id);
        builder.vu(count);
        builder.buf(buffer);
        return builder.out();
    },
};

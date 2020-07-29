module.exports = {
    id: 0x01,
    type: 'diep_serverbound',
    parse(parser) {
        const buffer = parser.buf();
        return {
            buffer,
        };
    },
    build(builder) {
        const { buffer } = builder._packet.content;
        builder.vu(this.id);
        builder.buf(buffer);
        return builder.out();
    },
};

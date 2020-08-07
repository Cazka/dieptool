module.exports = {
    id: 0x02,
    type: 'diep_clientbound',
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

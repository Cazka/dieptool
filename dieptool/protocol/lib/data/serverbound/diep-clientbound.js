module.exports = {
    id: 0x01,
    type: 'diep-clientbound',
    parser(parser) {
        const buffer = parser.buf();
        return {
            buffer,
        };
    },
    builder(builder) {
        const { buffer } = builder._packet.content;
        builder.vu(this.id);
        builder.buf(buffer);
        return builder.out();
    },
};

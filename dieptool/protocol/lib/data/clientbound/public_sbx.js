module.exports = {
    id: 0x00,
    type: 'public_sbx',
    parser(parser) {
        const link = parser.string();
        return { link };
    },
    builder(builder) {
        const { link } = builder._packet.content;
        builder.vu(this.id);
        builder.string(link);
        return builder.out();
    },
};

module.exports = {
    id: 0x04,
    type: 'public_sbx',
    parse(parser) {
        const link = parser.string();
        return { link };
    },
    build(builder) {
        const { link } = builder._packet.content;
        builder.vu(this.id);
        builder.string(link);
        return builder.out();
    },
};

module.exports = {
    id: 0x03,
    type: 'accept',
    parse(parser) {
        return {};
    },
    build(builder) {
        builder.vu(this.id);
        return builder.out();
    },
};

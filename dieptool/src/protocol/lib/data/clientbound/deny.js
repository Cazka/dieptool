module.exports = {
    id: 0x04,
    type: 'deny',
    parse(parser) {
        return {};
    },
    build(builder) {
        builder.vu(this.id);
        return builder.out();
    },
};

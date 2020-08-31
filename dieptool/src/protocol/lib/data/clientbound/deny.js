module.exports = {
    id: 0x04,
    type: 'deny',
    parse(parser) {
    },
    build(builder) {
        builder.vu(this.id);
        return builder.out();
    },
};

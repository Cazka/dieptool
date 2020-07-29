module.exports = {
    id: 0x03,
    type: 'accept',
    parser(parser) {
        return {};
    },
    builder(builder) {
        builder.vu(this.id);
        return builder.out();
    },
};

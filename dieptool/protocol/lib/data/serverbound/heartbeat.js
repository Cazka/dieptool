module.exports = {
    id: 0x05,
    type: 'diep-serverbound',
    parser(parser) {
        return {};
    },
    builder(builder) {
        builder.vu(this.id);
        return builder.out();
    },
};

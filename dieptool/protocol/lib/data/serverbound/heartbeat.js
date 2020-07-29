module.exports = {
    id: 0x05,
    type: 'heartbeat',
    parser(parser) {
        return {};
    },
    builder(builder) {
        builder.vu(this.id);
        return builder.out();
    },
};

module.exports = {
    id: 0x05,
    type: 'heartbeat',
    parse(parser) {
        return {};
    },
    build(builder) {
        builder.vu(this.id);
        return builder.out();
    },
};

module.exports = {
    id: 0x07,
    type: 'alert',
    parse(parser) {
        const message = parser.string();
        return { message };
    },
    build(builder) {
        const { message } = builder._packet.content;
        builder.vu(this.id);
        builder.string(message);
        return builder.out();
    },
};

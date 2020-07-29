module.exports = {
    id: 0x04,
    type: 'command',
    parser(parser) {
        const id = parser.vu();
        const value = parser.vu();
        return {
            id,
            value,
        };
    },
    builder(builder) {
        const { id, value } = builder._packet.content;
        builder.vu(this.id);
        builder.vu(id);
        builder.vu(value);
    },
};

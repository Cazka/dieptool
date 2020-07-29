module.exports = {
    id: 0x03,
    type: 'update',
    parse(parser) {
        const id = parser.vu();
        const value = parser.string();
        return {
            id,
            value,
        };
    },
    build(builder) {
        const { id, value } = builder._packet.content;
        builder.vu(this.id);
        builder.vu(id);
        builder.string(value);
        builder.buf(buffer);
    },
};

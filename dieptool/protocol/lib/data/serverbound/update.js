module.exports = {
    id: 0x03,
    type: 'update',
    parser(parser) {
        const id = parser.vu();
        const value = parser.string();
        return {
            id,
            value,
        };
    },
    builder(builder) {
        const { id, value } = builder._packet.content;
        builder.vu(this.id);
        builder.vu(id);
        builder.string(value);
        builder.buf(buffer);
    },
};

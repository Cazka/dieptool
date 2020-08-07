module.exports = {
    id: 0x06,
    type: 'pow_result',
    parse(parser) {
        const id = parser.vu();
        const result = parser.string();
        return {
            id,
            result,
        };
    },
    build(builder) {
        const { id, result } = builder._packet.content;
        builder.vu(this.id);
        builder.vu(id);
        builder.vu(result);
        return builder.out();
    },
};

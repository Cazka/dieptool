module.exports = {
    id: 0x06,
    type: 'pow_request',
    parse(parser) {
        const id = parser.vu();
        const difficulty = parser.vu();
        const prefix = parser.string();
        return {
            id,
            difficulty,
            prefix,
        };
    },
    build(builder) {
        const { id, difficulty, prefix } = builder._packet.content;
        builder.vu(this.id);
        builder.vu(id);
        builder.vu(difficulty);
        builder.string(prefix);
        return builder.out();
    },
};

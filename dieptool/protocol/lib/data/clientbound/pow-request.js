module.exports = {
    id: 0x06,
    type: 'pow-request',
    parser(parser) {
        const id = parser.vu();
        const prefix = parser.string();
        return {
            id,
            prefix,
        };
    },
    builder(builder) {
        const { id, prefix } = builder._packet.content;
        builder.vu(this.id);
        builder.vu(id);
        builder.vu(prefix);
        return builder.out();
    },
};

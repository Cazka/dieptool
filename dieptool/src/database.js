const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
    dt_token: String,
    patron_id: String,
    access_token: String,
    online: Boolean,
});
const User = mongoose.model('User', userSchema);

class MongoDB {
    constructor() {
        this.db = mongoose.connection;
        this.ready = false;
        this.db.on('error', console.error.bind(console, 'connection error:'));
        this.db.once('open', () => {
            this.ready = true;
            console.log('Database is ready!');
        });
    }

    /**
     * Add a User Object to the database. When there already exists a user with the same user_id the data will be overwritten.
     * @param {Object} user The user that gets added
     */
    async addUser(user) {
        let u;
        const exists = await User.findOne({ user_id: user.user_id });
        u = exists || new User(user);
        if (exists) u.overwrite(user);
        await u.save();
        return u;
    }

    async getUserByToken(dt_token) {
        return await User.findOne({ dt_token });
    }
    async getUserById(patron_id) {
        return await User.findOne({ patron_id });
    }

    async setAllOffline(){
        const res = await User.updateMany({ online: true }, { online: false });
    }
}

module.exports = new MongoDB();

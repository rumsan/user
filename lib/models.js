const Schema = function(mongoose){
    const UserSchema = mongoose.Schema({
        name: {
            first: {type:String, required: true},
            initials: String,
            last: String,
            salutation: String,
            suffix: String
        },
        password: mongoose.Schema.Types.Mixed,
        is_active : {type: Boolean, required:true, default:true},
        extras: mongoose.Schema.Types.Mixed,
        token: String,
        created_by: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
	    updated_by: {type: mongoose.Schema.Types.ObjectId, ref:'User'}
    }, {
        collection: 'users',
        timestamps: {createdAt: 'created_at', updatedAt:'updated_at'},
        toObject: {virtuals: true},
        toJSON: {virtuals: true}
    });

    UserSchema.virtual('name.full')
    .get(function () {
        if(this.name.initials)
            return this.name.first + ' ' + this.name.initials + ' ' + this.name.last;
        else
            return this.name.first + ' ' + this.name.last;
        });

    UserSchema.virtual('comms');
    const UserModel = mongoose.model('User', UserSchema);

    const CommSchema = mongoose.Schema({
        user_id: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User'},
        type: {type:String, required: true},
        address: {type: String, required: true},
        token: String,
        token_expiration: Number,
        is_verified: {type:Boolean, required: true, default: false},
        verified_on: Date,
        created_by: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
	    updated_by: {type: mongoose.Schema.Types.ObjectId, ref:'User'}
    }, {
        collection: 'users_comm',
        timestamps: {createdAt: 'created_at', updatedAt:'updated_at'}
    })
    CommSchema.index({user_id: 1, address:1}, {unique: true});
    const CommModel = mongoose.model('Comm', CommSchema);

    const AuthSchema = mongoose.Schema({
        user_id: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User'},
        type: {type:String, required: true},
        username: {type: String, required: true},
        false_attempts: {type: Number, required: true, default: 0},
        is_locked: {type: Boolean, required: true, default: false},
        locked_on: {type: Date},
        is_active: {type:Boolean, required: true, default: true},
        created_by: {type: mongoose.Schema.Types.ObjectId, ref:'User'},
	    updated_by: {type: mongoose.Schema.Types.ObjectId, ref:'User'}
    }, {
        collection: 'users_auth',
        timestamps: {createdAt: 'created_at', updatedAt:'updated_at'}
    })
    AuthSchema.index({username:1}, {unique: true});
    const AuthModel = mongoose.model('Auth', AuthSchema);

    const AuthLogSchema = mongoose.Schema({
        user_id: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User'},
        auth_id: {type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Auth'},
        ip_address: String,
        is_success: Boolean
    }, {
        collection: 'auth_logs',
        timestamps: {createdAt: 'created_at', updatedAt:'updated_at'}
    })
    const AuthLogModel = mongoose.model('AuthLog', AuthLogSchema);

    return {
        AuthModel,
        AuthSchema,
        CommModel,
        CommSchema,
        UserModel,
        UserSchema,
        AuthLogModel,
        AuthLogSchema
    }
}


module.exports = Schema
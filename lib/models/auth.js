module.exports = function({mongoose, modelConfig}){
    const {ObjectId} = mongoose.Schema.Types;

    const AuthSchema = mongoose.Schema({
        user_id: {type: ObjectId, required: true, ref: modelConfig.User.name},
        type: {type:String, required: true},
        username: {type: String, required: true},
        false_attempts: {type: Number, required: true, default: 0},
        is_locked: {type: Boolean, required: true, default: false},
        locked_on: {type: Date},
        is_active: {type:Boolean, required: true, default: true},
        created_by: {type: ObjectId, ref:modelConfig.User.name},
	    updated_by: {type: ObjectId, ref:modelConfig.User.name}
    }, {
        timestamps: {createdAt: 'created_at', updatedAt:'updated_at'}
    })
    AuthSchema.index({username:1}, {unique: true});

    return AuthSchema;
}
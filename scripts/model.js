let mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  fname: {
    type: String,
    trim: true
  },
  lname: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true
  },
  username: {
   type: String,
    trim: true
  },
  password: {
    type: String,
    trim: true
  },
  tasks: {
    type: Array
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const uri = process.env.URI;
mongoose.connect(uri, { useUnifiedTopology: true, useNewUrlParser: true });

module.export = mongoose.model('User', UserSchema);
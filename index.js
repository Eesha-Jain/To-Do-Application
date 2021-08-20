//REQUIREMENTS
let express = require('express');
let app = express();
let mongoose = require('mongoose');
var crypto = require('crypto');
var jwt = require("jsonwebtoken");

app.use('/css',express.static(__dirname +'/css'));
app.use(express.json());

//ENCRYPTION
const encrypt1 = process.env.ENCRYPT_ONE;
const encrypt2 = process.env.ENCRYPT_TWO;
const passwordEncrypt = process.env.ENCRYPT_STRING;

function encrypting(string) {
  const hasher = crypto.createHmac(encrypt1, passwordEncrypt);
  const hash = hasher.update(string).digest("hex");

  const hasher2 = crypto.createHmac(encrypt2, passwordEncrypt);
  const hash2 = hasher2.update(hash).digest("hex");

  return hash2;
}

//JWT
const jwtKey = process.env.JWT_KEY;
const jwtExpirySeconds = process.env.JWT_SECONDS;

//MONGOOSE
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

const User = mongoose.model('User', UserSchema);

//VERIFICATION
const validate = (req, res, next) => {
  const token = req.body.token;
  if (!token) {
    return res.status(401).send("Invalid");
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_KEY);
    req.user = payload;
    next()
  } catch (err) {
    return res.status(403).send("Invalid");
  }
}

//Redirect to index.html
app.get('/', function (req, res) {
  res.sendFile('/index.html', {root:'.'});
});

app.get('/signUp', function (req, res) {
  message = "";
  res.sendFile('/signup.html', {root:'.'});
});

app.get('/signUpN', function (req, res) {
  res.sendFile('/signup.html', {root:'.'});
});

app.get('/logIn', function (req, res) {
  message = "";
  res.sendFile('/login.html', {root:'.'});
});

app.get('*', function (req, res) { 
  error(res);
});

function error(res) {
  res.sendFile('/error.html', {root: '.'});
}

//Sign-up
app.post('/signUp', async function (req, res) {
  var pass = req.body.password;
  var hashed = encrypting(pass);

  let data = {fname: req.body.fname, lname: req.body.lname, email: req.body.email, username: req.body.username, password: hashed, tasks: []};

  await User.find({username: data["username"]}, async function (err, document) {
    if (err) {
      error(res);
      return;
    }

    if (document.length > 0) {
      return res.status(400).send(JSON.stringify({error: true, message: "Invalid - username already exists"}));
    } else {
      await User.find({email: data["email"]}, async function (err, document) {
        if (err) {
          error(res);
          return;
        }

        if (document.length > 0) {
          return res.status(400).send(JSON.stringify({error: true, message: "Invalid - username already exists"}));
        } else if (!emailValidation(data["email"])) {
          return res.status(400).send(JSON.stringify({error: true, message: "Invalid - not valid username"}));
        } else {
          await passwordValidation(pass).then(async function(result) {
            if (result == false) {
              return res.status(400).send(JSON.stringify({error: true, message: "Invalid - not valid password: at least 5 characters, at least 1 number, at least 1 special character"}));
            } else {
              const newUser = new User(data);
              await newUser.save((err, result) => {
                if (err) {
                  error(res);
                  return;
                }
              });
              
              return res.status(200).send(JSON.stringify({error: false, message: ""}));
            }
          });
        }
      })
    }
  })
});

function emailValidation(email) {
  if (email.includes("@") && email.length >= 6) {
    return true;
  }
  return false;
}

let numValid = false;
function changeN() {
  numValid = true;
}

let escapeValid = false;
function changeE() {
  escapeValid = true;
}

async function passwordValidation(password) {
  if (password.length < 5) {
    return false;
  }

  let nums = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  numValid = false;

  await nums.forEach(function(element) {
    if (password.includes(element)) {
      changeN();
    }
  });

  if (!numValid) {
    return false;
  }

  let escapeCharacters = ["+", "-", "&", "||", "!", "(", ")", "{", "}", "[", "]", "^", "~", "*", "?", ":","\"","\\", "@", "#", "$", "%", "&", ">", "<"];
  escapeValid = false;

  await escapeCharacters.forEach(function(element) {
    if (password.includes(element)) {
      changeE();
    }
  });

  if (!escapeValid) {
    return false;
  }

  return true;
}


function createToken(doc) {
  var user = {
    _id: doc._id,
    fname: doc.fname,
    lname: doc.lname,
    email: doc.email,
    username: doc.username,
    password: doc.password, 
    tasks: doc.tasks 
  }

  //Create token
  var token = jwt.sign(user, jwtKey);
  return token;
}

//Log-in
app.post('/logIn', async function (req, res) {
  let data = {username: req.body.username, password: req.body.password};
  var encrypted = encrypting(data["password"]);

  await User.find({username: data["username"]}, async function (err, document) {
    if (err) {
      error(res);
      return;
    }

    if (document.length > 0 && encrypted == document[0].password) {
      var doc = document[0];
      var token = createToken(doc);
      return res.status(200).send(JSON.stringify({error: false, token: token}));
    } else {
      await User.find({email: data["username"]}, async function (err, document) {
        if (err) {
          error(res);
          return;
        }

        if (document.length > 0 && encrypted == document[0].password) {
          var doc = document[0];
          var token = createToken(doc);
          return res.status(200).send(JSON.stringify({error: false, token: token}));
        } else {
          return res.status(400).send(JSON.stringify({error: true, message: "Invalid - username doesn't exist or incorrect password"}));
        }
      })
    }
  })
});

//getTasks
app.post('/getTasks', async function (req, res) {
  var token = req.body.token;
  var payload = await jwt.verify(token, jwtKey);
  try {
    var text = taskManager(payload.tasks);

    if (payload.tasks.length == 0) {
      return res.status(200).send(JSON.stringify({none: true, text: text}));
    } else {
      return res.status(200).send(JSON.stringify({none: false, text: text}));
    }
  } catch (e) {console.log(e);};
});

//To-Do list
function taskManager(tasks) {
  var list = "<p class='pTitle'>Tasks</p><div class='cards'>";
  for (i = 0; i < tasks.length; i++) {
    if (tasks[i][1] == false) {
      list += "<form class='cardFormOutside'><input name='num' class='cardNum' type='text' value='" + (i + 1) + "' readonly><input name='card' class='card' type='text' value='" + tasks[i][0] + "' readonly><button class='cardSubmit' name='sub' type='submit'>Delete</button></form>";
    } else {
      list += "<form class='cardFormOutside'><input name='num' class='cardNum' type='text' value='" + (i + 1) + "' readonly><input name='card' class='card' style='text-decoration: line-through;' type='text' value='" + tasks[i][0] + "' readonly><button class='cardSubmit' name='sub' type='submit' name='submit'>Delete</button></form>";
    }
  }

  if (tasks.length == 0) {
    list += "<p class='center none'><i class='far fa-folder-open'></i> No tasks <i class='far fa-folder-open'></i></p>"
  }

  list += "</div>";

  return list;
}

//validate,
app.post('/addTask', async function (req, res) {
  var item = req.body.item;
  var token = req.body.token;
  var payload = jwt.verify(token, jwtKey);

  payload.tasks.push([item, false]);
  var t = createToken(payload);

  //Update doc
  var doc = await User.findById(payload._id);

  doc.tasks = payload.tasks;
  await doc.save((err, result) => {
    if (err) {error(res);return;}
  });

  return res.status(200).send(JSON.stringify({token: t}));
});

//deleteTask
app.post('/deleteTask', async function(req, res) {
  try {
    var index = req.body.item;
    var token = req.body.token;
    var payload = jwt.verify(token, jwtKey);
    var tempTasks = payload.tasks;

    tempTasks.splice(index, 1);

    //Update doc
    var doc = await User.findById(payload._id);
    doc.tasks = tempTasks;
    doc.save(function(error, user) {
      if (error) {console.log(error);}
    });

    var t = createToken(doc);
    return res.status(200).send(JSON.stringify({token: t}));
  } catch (e) {
    console.log(e);
  }
})

//Click item
app.post('/clicked', async function(req, res) {
  var index = req.body.submit;
  var token = req.body.token;
  var payload = jwt.verify(token, jwtKey);
  var tempTasks = payload.tasks;

  tempTasks[index][1] = !tempTasks[index][1];

  //Update doc
  var doc = await User.findById(payload._id);
  doc.tasks = tempTasks;
  
  await doc.save((err, result) => {
    if (err) {error(res)};
  })

  var t = createToken(doc);
  return res.status(200).send(JSON.stringify({token: t}));
})

//Sorting - validate, 
app.post('/sortNumberUp', async function (req, res) {
  var token = req.body.token;
  var payload = jwt.verify(token, jwtKey);
  var doc = await User.findById(payload._id);
  var t = createToken(doc);
  return res.status(200).send(JSON.stringify({token: t}));
});

app.post('/sortNumberDown', async function (req, res) {
  var token = req.body.token;
  var payload = jwt.verify(token, jwtKey);
  var doc = await User.findById(payload._id);
  doc.tasks = doc.tasks.reverse();
  var t = createToken(doc);
  return res.status(200).send(JSON.stringify({token: t}));
});

app.post('/sortLetterUp', async function (req, res) {
  var token = req.body.token;
  var payload = jwt.verify(token, jwtKey);
  var doc = await User.findById(payload._id);

  var tempTasks = [...doc.tasks];
  tempTasks = tempTasks.sort((x, y) => {
    return x[0].localeCompare(y[0], 'en', { sensitivity: 'base' });
  });

  doc.tasks = tempTasks;
  var t = createToken(doc);
  return res.status(200).send(JSON.stringify({token: t}));
});

app.post('/sortLetterDown', async function (req, res) {
  var token = req.body.token;
  var payload = jwt.verify(token, jwtKey);
  var doc = await User.findById(payload._id);

  var tempTasks = [...doc.tasks];
  tempTasks = tempTasks.sort((x, y) => {
    return x[0].localeCompare(y[0], 'en', { sensitivity: 'base' });
  });

  doc.tasks = tempTasks.reverse();
  var t = createToken(doc);
  return res.status(200).send(JSON.stringify({token: t}));
});

//Set up the program
const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log("Server ran!") 
});
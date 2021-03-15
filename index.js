//REQUIREMENTS
let express = require('express');
let app = express();
let mongoose = require('mongoose');
let bodyParser = require('body-parser');
let http = require('http').Server(app);
var crypto = require('crypto');
var io = require('socket.io')(http);
var jwt = require("jsonwebtoken");
var cors = require('cors');

//Local storage
var LocalStorage = require('node-localstorage').LocalStorage,
localStorage = new LocalStorage('./scratch');

//CUSTOMIZATION
var message = "";
var navigationBar = "<li><a href='/'>Home</a></li><li id='right'><a href='/signUp'>Sign Up</a></li><li id='right'><a href='/logIn'>Log In</a></li>";
var bodyText = "<p class='center'>Please <a href='/logIn'>Log In</a> or <a href='/signUp'>Sign Up</a> to continue</p>";

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

app.use(express.static("../scripts"));
app.use('/css',express.static(__dirname +'/css'));
app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('views', '.');


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

app.get('/logInN', function (req, res) {
  res.sendFile('/login.html', {root:'.'});
});

app.get('/logOut', function (req, res) { 
  localStorage.removeItem('token');

  updateWithLogIn(null, req);
  res.redirect('http://'+req.hostname);
});

app.get('*', function (req, res) { 
  error(res);
});

function error(res) {
  res.sendFile('/error.html', {root: '.'});
}

//Sign-up
app.post('/signUp', async function (req, res, next) {
  var pass = req.body.password;
  var hashed = encrypting(pass);

  let data = {fname: req.body.fname, lname: req.body.lname, email: req.body.email, username: req.body.username, password: hashed, tasks: []};
  
  await User.find({username: data["username"]}, async function (err, document) {
    if (err) {
      error(res);
      return;
    }

    if (document.length > 0) {
      message = "Invalid - username already exists";
      res.redirect('http://'+req.hostname+"/signUpN");
    } else {
      await User.find({email: data["email"]}, async function (err, document) {
        if (err) {
          error(res);
          return;
        }

        if (document.length > 0) {
          message = "Invalid - username already exists";
          res.redirect('http://'+req.hostname+"/signUpN");
        } else if (!emailValidation(data["email"])) {
          message = "Invalid - not valid email";
          res.redirect('http://'+req.hostname+"/signUpN");
        } else {
          await passwordValidation(pass).then(async function(result) {
            if (result == false) {
              message = "Invalid - not valid password: at least 5 characters, at least 1 number, at least 1 special character";
              res.redirect('http://'+req.hostname+"/signUpN");
            } else {
              const newUser = new User(data);
              await newUser.save((err, result) => {
                if (err) {
                  error(res);
                  return;
                }
              });
              res.redirect('http://'+req.hostname+"/logIn");
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
  localStorage.setItem('token', token);
}

//Log-in
app.post('/logIn', async function (req, res, next) {
  let data = {username: req.body.username, password: req.body.password};
  var encrypted = encrypting(data["password"]);

  await User.find({username: data["username"]}, async function (err, document) {
    if (err) {
      error(res);
      return;
    }

    if (document.length > 0 && encrypted == document[0].password) {
      var doc = document[0];
      createToken(doc);

      //Navigation
      updateWithLogIn(doc.tasks, req);
      res.redirect('http://'+req.hostname);
    } else {
      await User.find({email: data["username"]}, async function (err, document) {
        if (err) {
          error(res);
          return;
        }

        if (document.length > 0 && encrypted == document[0].password) {
          var doc = document[0];
          createToken(doc);

          //Navigation
          updateWithLogIn(doc.tasks, req);
          res.redirect('http://'+req.hostname);
        } else {
          message = "Invalid - username doesn't exist or incorrect password";
          res.redirect('http://'+req.hostname+"/logInN");
        }
      })
    }
  })
});

//Log-in updates
function updateWithLogIn(tasks, req) {
  var token = localStorage.getItem('token');
  
  try {
    var payload = jwt.verify(token, jwtKey);
    navigationBar = "<li><a href='/'>Home</a></li><li id='right'><a href='/logOut'>Log Out</a></li>";
    bodyText = taskManager(tasks);
  } catch(e) {
    navigationBar = "<li><a href='/'>Home</a></li><li id='right'><a href='/signUp'>Sign Up</a></li><li id='right'><a href='/logIn'>Log In</a></li>";
    bodyText = "<p class='center'>Please <a href='/logIn'>Log In</a> or <a href='/signUp'>Sign Up</a> to continue</p>";
  }
}

//To-Do list
function taskManager(tasks) {
  var list = "";

  //Sorting
  list += `<div class='sorting'>
    <form autocomplete='off' method='POST' action='/sortNumberUp'><input type='submit' class='sort' value='0 - &#8734;'></form>
    <form autocomplete='off' method='POST' action='/sortNumberDown'><input type='submit' class='sort' value='&#8734; - 0'></form>
    <form autocomplete='off' method='POST' action='/sortLetterUp'><input type='submit' class='sort' value='A - Z'></form>
    <form autocomplete='off' method='POST' action='/sortLetterDown'><input type='submit' class='sort' value='Z - A'></form>
  </div>`;

  //Add Task
  list += "<p class='pTitle'>Add Task</p><form autocomplete='off' method='POST' action='/addTask'><input type='text' name='addTask' id='addTask' required><input type='submit' class='taskSubmit'></form>";

  list += "<p class='pTitle'>Tasks</p><div class='cards'>";
  for (i = 0; i < tasks.length; i++) {
    if (tasks[i][1] == false) {
      list += "<form action='/deleteTask' method='POST' class='cards'><input name='num' class='cardNum' type='text' value='" + (i + 1) + "' readonly><input name='card' class='card' type='text' value='" + tasks[i][0] + "' readonly><input name='sub' class='cardSubmit' type='submit' value='Delete'></form>";
    } else {
      list += "<form action='/deleteTask' method='POST'><input name='num' class='cardNum' type='text' value='" + (i + 1) + "' readonly><input name='card' class='card' style='text-decoration: line-through;' type='text' value='" + tasks[i][0] + "' readonly><input name='sub' class='cardSubmit' type='submit' value='Delete'></form>";
    }
  }

  if (tasks.length == 0) {
    list += "<p class='center none'><i class='far fa-folder-open'></i>    No tasks    <i class='far fa-folder-open'></i></p>"
  }

  list += "</div>";

  return list;
}

app.post('/addTask', async function (req, res, next) {
  var item = req.body.addTask;

  var token = localStorage.getItem('token');
  var payload = jwt.verify(token, jwtKey);

  payload.tasks.push([item, false]);
  createToken(payload);

  //Update doc
  doc = await User.findById(payload._id);

  doc.tasks = payload.tasks;
  await doc.save((err, result) => {
    if (err) {
      error(res);
      return;
    }
  });
  
  res.redirect('http://'+req.hostname);
  updateWithLogIn(payload.tasks, req);
});

app.post('/deleteTask', async function(req, res, next) {
  var item = req.body.card;
  
  var token = localStorage.getItem('token');
  var payload = jwt.verify(token, jwtKey);

  var tempTasks = payload.tasks;
  var index = 0;

  while(tempTasks[index][0] != item) {
    index++;
  }
    
  tempTasks.splice(index, 1);

  //Update doc
  doc = await User.findById(payload._id, (err, kitten) => {
    if (err) {
      error(res);
      return;
    }
  });

  doc.tasks = tempTasks;
  await doc.save((err, result) => {
    if (err) {
      error(res);
      return;
    }
  });
  
  createToken(payload);

  updateWithLogIn(payload.tasks, req)
  res.redirect('http://'+req.hostname);
})

//Click item
app.post('/clicked', async function(req, res, next) {
  var item = req.body.submit;

  var token = localStorage.getItem('token');
  var payload = jwt.verify(token, jwtKey);
  
  var tempTasks = payload.tasks;
  var index = 0;

  while(tempTasks[index][0] != item) {
    index++;
  }

  tempTasks[index][1] = !tempTasks[index][1];

  //Update doc
  var doc = await User.findById(payload._id, (err, kitten) => {
    if (err) error(res);
  });
  doc.tasks = tempTasks;
  
  await doc.save((err, result) => {
    if (err) error(res);
  })

  createToken(payload)
  updateWithLogIn(tempTasks, req)
  res.redirect('http://'+req.hostname+"/");
})

//Sorting
app.post('/sortNumberUp', async function (req, res, next) {
  var token = localStorage.getItem('token');
  var payload = jwt.verify(token, jwtKey);

  updateWithLogIn(payload.tasks, req)
  res.redirect('http://'+req.hostname);
});

app.post('/sortNumberDown', async function (req, res, next) {
  var token = localStorage.getItem('token');
  var payload = jwt.verify(token, jwtKey);

  var tempTasks = [...payload.tasks];
  updateWithLogIn(tempTasks.reverse(), req)
  res.redirect('http://'+req.hostname);
});

app.post('/sortLetterUp', async function (req, res, next) {
  var token = localStorage.getItem('token');
  var payload = jwt.verify(token, jwtKey);

  var tempTasks = [...payload.tasks];
  tempTasks = tempTasks.sort((x, y) => {
    return x[0].localeCompare(y[0], 'en', { sensitivity: 'base' });
  });

  updateWithLogIn(tempTasks, req)
  res.redirect('http://'+req.hostname);
});

app.post('/sortLetterDown', async function (req, res, next) {
  var token = localStorage.getItem('token');
  var payload = jwt.verify(token, jwtKey);

  var tempTasks = [...payload.tasks];
  tempTasks = tempTasks.sort((x, y) => {
    return x[0].localeCompare(y[0], 'en', { sensitivity: 'base' });
  });
  
  updateWithLogIn(tempTasks.reverse(), req)
  res.redirect('http://'+req.hostname);
});

//Set up the program
app.set('port', process.env.PORT || 5000);
http.listen(app.get('port'), function() {
  console.log('listening on port', app.get('port'));
});

//Change error message
io.on('connection', function(socket) {
  socket.emit('change_message', {
    message: message
  });

  socket.emit('change_login', {
    navigationBar: navigationBar,
    bodyText: bodyText
  });
}); 
//REQUIREMENTS
let express = require('express');
let app = express();
let bodyParser = require('body-parser');
let mongoose = require('mongoose');
let http = require('http').Server(app);
var crypto = require('crypto');
var io = require('socket.io')(http);

//MONGODB
const MongoClient = require('mongodb').MongoClient;
const mongo_username = process.env.MONGO_USERNAME;
const mongo_password = process.env.MONGO_PASSWORD;
const uri = `mongodb+srv://${mongo_username}:${mongo_password}@crm-app.38y5m.mongodb.net/numleaddb?retryWrites=true&w=majority`;

//CUSTOMIZATION
var message = "";
var navigationBar = "<li><a href='/'>Home</a></li><li id='right'><a href='/signUp'>Sign Up</a></li><li id='right'><a href='/logIn'>Log In</a></li>";
var bodyText = "<p class='center'>Please <a href='/logIn'>Log In</a> or <a href='/signUp'>Sign Up</a> to continue</p>"

//MONGODB
var user = null;

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

//APP.USE/ENGINE/SET
app.use('/css',express.static(__dirname +'/css'));
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }));
app.set('views', '.')
app.set('view engine', 'pug')

//Redirect to index.html
app.get('/', function (req, res) {
  res.sendFile('/index.html', {root:'.'});
});

app.get('/signUp', function (req, res) {
  message = "";
  res.sendFile('/signup.html', {root:'.'});
});

app.get('/logIn', function (req, res) {
  message = "";
  res.sendFile('/login.html', {root:'.'});
});

app.get('/logOut', function (req, res) { 
  user = null;
  updateWithLogIn();
  res.redirect('http://'+req.hostname);
});

//Sign-up
app.post('/signUp', function (req, res, next) {
  MongoClient.connect(uri, async function(err, client) {
    const db = client.db("booksWebsite").collection("bookLogin");
    var hashed = encrypting(req.body.password);

    let data = {username: req.body.username, password: hashed, fname: req.body.fname, lname: req.body.lname, tasks: []};

    //Username exists
    var occurs = await db.count({username: data["username"]}, { limit: 1 })

    if (occurs > 0) {
      message = "Invalid - username already exists";
      return;
    }

    insertDocuments(db, data, () => {});

    updateWithLogIn()
    res.redirect('http://'+req.hostname+"/logIn");
  })
});

//Insert into database function
const insertDocuments = (collection, data, callback) => {
  collection.insert([data], (error, result) => {
    if (error) return process.exit(1);
    callback(result);
  });
};

//Log-in
app.post('/logIn', function (req, res, next) {
  MongoClient.connect(uri, async function(err, client) {
    const db = client.db("booksWebsite").collection("bookLogin");
    let data = {username: req.body.username, password: req.body.password};
    var doc = await db.findOne({username: data["username"]});
    var encrypted = encrypting(data["password"]);

    if (doc == null || encrypted != doc.password) {
      message = "Invalid - username doesn't exist or incorrect password";
      return;
    }

    user = doc;

    updateWithLogIn()
    res.redirect('http://'+req.hostname);
  })
});

//Log-in updates
function updateWithLogIn() {
  if (user != null) { //logged in
    navigationBar = "<li><a href='/'>Home</a></li><li id='right'><a href='/logOut'>Log Out</a></li>";
    bodyText = taskManager();
  } else { //not logged in
    navigationBar = "<li><a href='/'>Home</a></li><li id='right'><a href='/signUp'>Sign Up</a></li><li id='right'><a href='/logIn'>Log In</a></li>";
    bodyText = "<p class='center'>Please <a href='/logIn'>Log In</a> or <a href='/signUp'>Sign Up</a> to continue</p>"
  }
}

//To-Do list
function taskManager() {
  var list = "<p style='text-align: center;'>Welcome, " + user.fname + "</p><form autocomplete='off' method='POST' action='/addTask'><input type='text' name='addTask' id='addTask' required><input type='submit' class='taskSubmit'></form><p class='pTitle'>Tasks</p>";

  var tasks = user.tasks;

  list += "<div class='cards'>";
  for (i = 0; i < tasks.length; i++) {
    if (tasks[i][1] == false) {
      list += "<form action='/deleteTask' method='POST'><input name='card' class='card' type='text' value='" + tasks[i][0] + "' readonly><input name='sub' class='cardSubmit' type='submit' value='Delete'></form>";
    } else {
      list += "<form action='/deleteTask' method='POST'><input name='card' class='card' style='text-decoration: line-through;' type='text' value='" + tasks[i][0] + "' readonly><input name='sub' class='cardSubmit' type='submit' value='Delete'></form>";
    }
  }

  list += "</div>";

  return list;
}

app.post('/addTask', function (req, res, next) {
  MongoClient.connect(uri, async function(err, client) {
    const db = client.db("booksWebsite").collection('bookLogin');
    var item = req.body.addTask;
    var tempTasks = user.tasks;
    tempTasks.push([item, false]);

    if (user != null) {
      try {
        db.update(
          {username: user.username}, 
          { $set: {tasks: tempTasks}}
        );
      } catch (e) {
        console.log(e);
      }
    }

    res.redirect('http://'+req.hostname);
    updateWithLogIn();
  })
});

app.post('/deleteTask', function(req, res, next) {
  MongoClient.connect(uri, async function(err, client) {
    const db = client.db("booksWebsite").collection('bookLogin');
    var item = req.body.card;
    var tempTasks = user.tasks;
    var index = 0;

    while(tempTasks[index][0] != item) {
      index++;
    }
    
    tempTasks.splice(index, 1);

    if (user != null) {
      try {
        db.updateOne(
          {username: user.username}, 
          {$set: {tasks: tempTasks}}
        );
      } catch (e) {
        console.log(e);
      }
    }

    updateWithLogIn()
    res.redirect('http://'+req.hostname);
  })
})

//Click item
app.post('/clicked', function(req, res, next) {
  MongoClient.connect(uri, async function(err, client) {
    const db = client.db("booksWebsite").collection('bookLogin');
    console.log("In function");
    
    var item = req.body.submit;
    var tempTasks = user.tasks;
    var index = 0;

    while(tempTasks[index][0] != item) {
      index++;
    }

    tempTasks[index][1] = !tempTasks[index][1];

    if (user != null) {
      try {
        db.updateOne(
          {username: user.username}, 
          {$set: {tasks: tempTasks}}
        );
      } catch (e) {
        console.log(e);
      }
    }

    updateWithLogIn()
    res.redirect('http://'+req.hostname);
  })
})

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
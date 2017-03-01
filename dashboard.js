"use strict"

/* jshint node: true */

var express = require('express');
var fs = require("fs");
var bodyParser = require("body-parser");
var multer = require("multer");
var Twitter = require("twitter"); // Allows access to Twitter API
var twitterAPI = require('node-twitter-api'); // Allows access to user login tokens
var app = express();
var func = require("./js/func"); // Collection of large functions that'd look messy here.
var upload = multer({dest: "./uploads/content/"})
const path = __dirname + "/uploads/content";
app.use(bodyParser.json());

// twitInterface is used for calling REST calls on the twitter API
var twitInterface;
/*
   reqToken & reqTokenSecret store tokens passed to the server from after login and
   are used in the authetication step of the login process
*/
var reqToken;
var reqTokenSecret;

/*
 Create a new local storage instance if one doesn't already exist
*/
if(typeof localStorage === "undefined" || localStorage === null){
  var LocalStorage = require("node-localstorage").LocalStorage;
  var localStorage = new LocalStorage("./uploads/details");
}

/*
  Initalizes up twitter interface if creditentals already exist on the server.
  User tokens are generated from the "twitAuth" object.
*/
if(localStorage.getItem("twitterKey") || localStorage.getItem("twitterSecret") != null){
  twitInterface = new Twitter({
  consumer_key: 'XzVtLi9PgF72L0NuoLunuF1eE',
  consumer_secret: 'j6PrOQ7kie2IUyyDEnb8bYC4yHBeMdvdouplm7UEpzcQ9R7kID',
  access_token_key: localStorage.getItem("twitterKey"),
  access_token_secret: localStorage.getItem("twitterSecret")
});
}
/*
  Initalize twitter authetication API with my API keys.
*/
var twitAuth = new twitterAPI({
  consumerKey: "XzVtLi9PgF72L0NuoLunuF1eE",
  consumerSecret: "j6PrOQ7kie2IUyyDEnb8bYC4yHBeMdvdouplm7UEpzcQ9R7kID",
  callback: "http://127.0.0.1:8080/tweets/auth"
});

/*
  Used to get current time from the servers location.
  Will use details from the twitInterface to get the time from the users location instead of just portsmouth time.
*/
app.get("/time", function (req,res){
  res.status(200).send(func.getTime());
  res.end();
});

/*
  Returns the contents of the todo list to the client.
  The client will use this to put together the todo-list so that users may add or remove further tasks
*/
app.get("/todo", function(req,res){
  // No items, nothing sent.
  if(localStorage.getItem("todoItems") == null){
    res.status(404).send()
  }
  // If we find the file locally, send to the client.
  else{
    res.status(200).send(localStorage.getItem("todoItems"));
  }
})

/*
  Allows users to post changes to the todo-list and update the todo-list server-side.
*/
app.post("/todo", function(req,res){
  localStorage.setItem("todoItems", req.body.list);
  res.status(200).send("POSTED!");
  res.end();
})

/*
  Returns a list of the five most recent tweets from twitInterface's active user.
*/
app.get("/tweets", function(req,res){
  var tweetList = [];
  if(twitInterface == undefined){
    console.log("Need to login to twitter!");
  }
  else{
    twitInterface.get("statuses/home_timeline", {"count": 5}, function(error,tweets,response){
      if(error){
        res.status(204).send("ERROR! Login or tweets have expired");
      }
      //console.log(tweets[0]);
      res.status(200).send(JSON.stringify(tweets));
    });
  }

});

/*
  Authorises the user attempting ot login in by obtaining tokens from twitter
*/
app.get("/tweets/login", function(req,res){
  twitAuth.getRequestToken(function(err, requestToken, requestTokenSecret, results){
    if(err){
      return err;
    }
    else{
      reqToken = requestToken;
      reqTokenSecret = requestTokenSecret;
      res.status(200).send(reqToken);
    }
  });
});

/*
  Intended to be called when a user has just been verified from twitter login page.
  Will assemble an interface of the Twitter api containing the details necessary to peform requests on their API.
*/
app.get("/tweets/auth", function(req,res){
  var oauth_verify = req.query.oauth_verifier;
  twitAuth.getAccessToken(reqToken, reqTokenSecret, oauth_verify, function(error, accessToken, accessTokenSecret, results){
    if(error){
      return err;
    }
    else{
        twitInterface = new Twitter({
        consumer_key: 'XzVtLi9PgF72L0NuoLunuF1eE',
        consumer_secret: 'j6PrOQ7kie2IUyyDEnb8bYC4yHBeMdvdouplm7UEpzcQ9R7kID',
        access_token_key: accessToken,
        access_token_secret: accessTokenSecret
      });
      localStorage.setItem("twitterKey",accessToken);
      localStorage.setItem("twitterSecret", accessTokenSecret);
      res.redirect("/");
    }
  });
});
/*
  Returns a list of files available to the user to download.
  or downloads a file if given a valid file name
  from the /uploads/content directory
*/
app.get("/file", function(req,res){
  if(req.query.file === undefined){
    fs.readdir(path, function(err,items){
      res.status(200).send(items);
    });
  }
  else{ //TODO add validation to file GET
    res.download(__dirname + "/uploads/content/" + req.query.file);
  }
});
/*
  Posting a file here will check for the file and return it
  from the /uploads/content directory
*/
app.post("/file", function(req,res){
  console.log(req.body);
  fs.readdir(path, function(err, items){
    for(var i = 0; items.length > i; i++){
      if(items[i] == req.body.filename){
        console.log("Item " + items[i] + " item found!");
        res.status(200).send("FOUND IT!");
      }
    }
    res.status(404).send("File not found");
  });
});
/*
  Allows clients to rename already existing files on the system.
  Will check to make sure that file exists and also prevent duplicates of
  files
*/
app.patch("/file", function(req,res,next){
  fs.readdir(path, function(err,items){
    console.log(items);
    console.log(req.body.newName);
    // Check to see if new name is already present in directory
    for(var i = 0; items.length > i; i++){
      if(items[i] == req.body.newName){
        res.status(409).send("File alredy exists!");
        return next();
      }
    }
    // Check to see if file exists an updates
    for(var i = 0; items.length > i; i++){
      if(items[i] == req.body.currentName){
        fs.rename(path + "/" + req.body.currentName, path + "/" + req.body.newName);
        res.status(200).send("File updated");
        return next();
      }
    }
    // If no file found, return 404
    res.status(404).send("File not found");
    return next();
  });
});
/*
  Allows users to request a file to be deleted by supplying
  a location
*/
app.delete("/file", function(req,res,next){
  console.log("got delete request")
  var file = req.query.file;
  if(file == undefined){
    res.status(404).send("No file selected.");
    console.log("No file selected");
    return next();
  }
  else{
    fs.readdir(path, function(err, items){
      console.log(items);
      console.log(file);
      for(var i = 0; items.length > i; i++){
        if(items[i] == file){
          fs.unlink(path + "/" + file);
          res.status(200).send("File " + file + " deleted!");//TODO use err call instead of for loop
          console.log("File deleted");
          return next();
        }
      }
      res.status(404).send("File not found.");
      console.log("File not found");
      return next();
    })
  }
})
/*
  Allows upload to the server under the /uploads/content folder
*/
app.post("/file/upload", upload.single("uploadFile"), function(req,res, next){
  if(!req.file){
    res.status(400).send("No file uploaded, please upload a file to use /file/upload");
    return next();
  }
  else if(req.file.originalname.length > 50){
    res.status(414).send("File name too long! 40 characters or less");
    fs.unlink("./uploads/content/" + req.file.filename);
    return next();
  }
  //res.status(201).redirect("/");
  res.status(200).send();
  fs.rename("./uploads/content/" + req.file.filename, "./uploads/content/" + req.file.originalname)
});

app.use(express.static(__dirname + "/webpage"));
// Set to 8080 for developmennt purposes
//TODO Will be set to 80 for release
app.listen(8080, function(){
  console.log("Started on port 8080");
});

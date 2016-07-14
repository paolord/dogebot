'use strict';

const Bot = require('slackbots');
const request = require('requestretry');
const xmlreader = require('xmlreader');
const ping = require('ping');
const validator = require('validator');
const moment = require('moment');

const todolist = [];
const trash = [];

class Dogebot extends Bot {
  constructor(settings){
    super(settings);
    this.settings = settings;
  }
  run(){

    this.on('start', this.onStart);

    this.on('message', (message) => {

      let id = this.user.id.toLowerCase();

      if (this.isChatMessage(message) &&
          this.isChannelConversation(message) &&
          !this.isFromDogeBot(message) &&
          this.isMentioningDogeBot(message)) { ;

            if(this.isAskingForJoke(message)){
              this.replyWithRandomJoke(message);
            }
            if(this.isAskingForWhat(message)){
              this.replyWithAnswer(message);
            }
      }

      if (this.isChatMessage(message) &&
          this.isChannelConversation(message) &&
          !this.isFromDogeBot(message) &&
          this.isAskingForChuck(message)) {
            this.replyWithRandomChuck(message);
      }

      if (this.isChatMessage(message) &&
          this.isChannelConversation(message) &&
          !this.isFromDogeBot(message) &&
          this.isSiteCheck(message)) {
            this.replyWithStatusCheck(message);
      }

      if (this.isChatMessage(message) &&
          this.isChannelConversation(message) &&
          !this.isFromDogeBot(message) &&
          this.isMentioningDogeBot(message) &&
          this.isTodoList(message)) {
            this.replyForTodo(message);
      }
    });
  }
  onStart(){
    let self = this;
    this.user = this.users.filter( (user) => {
        return user.name === self.name;
    })[0];
  }
  getChannelById(channelId){
    return this.channels.filter( (item) => {
      return item.id === channelId;
    })[0];
  }
  isChatMessage(message){
    return message.type === 'message' && Boolean(message.text);
  }
  isChannelConversation(message){
    return typeof message.channel === 'string' && message.channel[0] === 'C';
  }
  isFromDogeBot(message){
    return message.user === this.user.id;
  }
  isMentioningDogeBot(message){
    return message.text.toLowerCase().indexOf('<@'+this.user.id.toLowerCase()+'>') > -1;
  }
  isAskingForJoke(message){
    return message.text.toLowerCase().indexOf('tell a joke') > -1;
  }
  isAskingForChuck(message){
    return message.text.toLowerCase().indexOf('do you know chuck norris?') > -1;
  }
  isAskingForWhat(message){
    return message.text.toLowerCase().indexOf('what is') > -1;
  }
  isSiteCheck(message){
    let re = new RegExp("is +(.*)+ down\\?", "g");
    return message.text.match(re) !== null;
  }
  replyWithStatusCheck(message){
    let self = this;
    let channel = self.getChannelById(message.channel);

    let start = message.text.indexOf('is <')+4;
    let end = message.text.indexOf('> down?')-1;
    let website = message.text.substr(start, end);

    website = website.split('> down?')[0]; // sanity check
    website = website.split('|')[0];

    console.log('checking status of: '+website);

    if(validator.isURL(website, {protocols: ['http', 'https']}) || validator.isIP(website)){
      request({
        url: website,
        retryDelay: 1000,
        retryStrategy: request.RetryStrategies.HTTPOrNetworkError,
        maxAttempts: 5,
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
        }
      }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          self.postMessageToChannel(channel.name, website+" is up", {as_user: true});
        }
        if(error){
          self.postMessageToChannel(channel.name, website+" is down", {as_user: true});
        }

        if(response) {
          console.log('Request attempt: '+response.attempts);
        }
      });
    } else {
      self.postMessageToChannel(channel.name, "not a valid url or IP address", {as_user: true});
    }
  }
  replyWithRandomJoke(message){
    let self = this;
    let channel = self.getChannelById(message.channel);

    console.log('replying for joke');
    request({
      url: 'https://raw.githubusercontent.com/joshbuchea/yo-mama/master/jokes.json',
      retryDelay: 5000,
      retryStrategy: retryStrategyOnError,
      maxAttempts: 5,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
      }
    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        let jokes = JSON.parse(body);
        self.postMessageToChannel(channel.name, randomJoke(jokes), {as_user: true});
      }
      if(error){
        console.log(error);
      }

      if(response) {
        console.log('Jokes attempt: '+response.attempts);
      }
    });
  }
  replyWithRandomChuck(message){
    let self = this;
    let channel = self.getChannelById(message.channel);

    console.log('replying for chuck norris');

    request({
      url: 'https://api.predator.wtf/joke/?arguments=%20nerdy%20/%20explicit',
      retryDelay: 3000,
      retryStrategy: retryStrategyOnError,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
      }
    }, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        //let fact = JSON.parse(body).value;
        self.postMessageToChannel(channel.name, "<@"+message.user+"> "+body, {as_user: true});
      }
      if(error) {
        console.log("chuck error: "+error);
      }
      if(response) {
        console.log('Chuck Norris attempt: '+response.attempts);
      }
    });
  }
  replyWithAnswer(message){
    let self = this;
    let appid = this.settings.wolframalpha;
    let channel = self.getChannelById(message.channel);

    let start = message.text.indexOf('what is');
    let end = message.text.length;
    let question = message.text.substr(start, end);

    console.log('querying wolfram-alpha for: '+question);

    request({
      url: 'http://api.wolframalpha.com/v2/query?appid='+appid+'&input='+encodeURIComponent(question)+'&format=image,plaintext',
      retryDelay: 3000,
      // retryStrategy: request.RetryStrategies.HTTPOrNetworkError
      retryStrategy: retryStrategyOnError
    }, (error, response, body) => {
      if (!error && response.statusCode == 200) {
        xmlreader.read(body, (err, res) => {
          if(err) return console.log(err);
          try{
            let title = res.queryresult.pod.at(0).subpod.plaintext.text();
            let definition = res.queryresult.pod.at(1).subpod.plaintext.text();

            self.postMessageToChannel(channel.name, title+'\n'+definition, {as_user: true});
          } catch (err){
            console.log(err);
            self.postMessageToChannel(channel.name, "Please be more specific", {as_user: true});
          }
        });
      }
      if(error){
        console.log("Wolfram Error");
        console.log(error);
      }
      if(response) {
        console.log('Wolfram-Alpha attempt: '+response.attempts);
      }
    });
  }
  isTodoList(message){
      return message.text.toLowerCase().indexOf('todo') > -1 || message.text.toLowerCase().indexOf('done') > -1 ||
      message.text.toLowerCase().indexOf('delete') > -1 ||
      message.text.toLowerCase().indexOf('undo') > -1;
  }
  replyForTodo(message){
    let self = this;
    let channel = self.getChannelById(message.channel);
    console.log('replying for todo');
    if(message.text.toLowerCase().indexOf('todo list') > -1){
      if(todolist.length === 0){
        self.postMessageToChannel(channel.name, "> no tasks!", {as_user: true});
      } else {
        let list = "> much tasks! (no particular order)";
        todolist.forEach((item, index) => {
          list += "\n"+(index+1)+". '"+item.text+ "' added on "+item.date+" by <@"+item.user+">";
        });
        self.postMessageToChannel(channel.name, list, {as_user: true});
      }
    } else if(message.text.toLowerCase().indexOf('todo') > -1){
      let text = message.text;
      let start = text.toLowerCase().indexOf('todo ')+5;
      let end = message.text.length;
      let task = text.substr(start, end);
      self.postMessageToChannel(channel.name, "wow! added ''"+task+"'' to public todo list", {as_user: true});
      todolist.push({text: task, date: moment().format("dddd, MMMM Do YYYY, h:mm a"), user: message.user});
    } else if(message.text.toLowerCase().indexOf('done') > -1){
      let text = message.text;
      let start = text.toLowerCase().indexOf('done ')+5;
      let end = message.text.length;
      let task = text.substr(start, end);
      self.postMessageToChannel(channel.name, "such done! task '"+todolist[task-1].text+"' by <@"+message.user+">", {as_user: true});
      let done = todolist.splice(task-1,1);
      trash.push({item: done[0], method: 'done'});
    } else if(message.text.toLowerCase().indexOf('delete') > -1){
      let text = message.text;
      let start = text.toLowerCase().indexOf("delete ")+7;
      let end = message.text.length;
      let task = text.substr(start, end);
      let item = "";
      let index = 0;
      if(validator.isInt(task)){
        index = task;
        item = todolist[index-1].text;
      } else {

        if(typeof self.todolistFindByText(task) === null){
          self.postMessageToChannel(channel.name, "can't find task", {as_user: true});
          return;
        }
        item = task;
        index = self.todolistFindByText(task);
      }
      self.postMessageToChannel(channel.name, "so delete: '"+item+"' by <@"+message.user+">", {as_user: true});
      let done = todolist.splice(trash.length-1,1);
      trash.push({item: done[0], method: 'delete'});
    } else if(message.text.toLowerCase().indexOf('undo') > -1){
      let done = trash.splice(trash.length-1,1);
      let task = done[0].item;
      todolist.push(task);
      let msg = "";
      if(done[0].method === "delete"){
        msg = "very undo: restored '"+task.text+"' by <@"+message.user+">";
      } else if(done[0].method === "done"){
        msg = "very undo: marked '"+task.text+"' by <@"+message.user+"> as not done";
      }
      self.postMessageToChannel(channel.name, msg, {as_user: true});
    }
  }
  todolistFindByText(text){
    todolist.forEach((item, index) => {
      if(text.indexOf(item.text) > -1){
        return index;
      }
    });
    return null;
  }
}

function retryStrategyOnError(err, response, body){
  console.log('retrying');
  return err;
}

function randomJoke(jokes){
  let obj_keys = Object.keys(jokes);
  let ran_key = obj_keys[Math.floor(Math.random() *obj_keys.length)];
  return jokes[ran_key][randRange(0,jokes[ran_key].length)];
}

function randRange(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = Dogebot;

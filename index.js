'use strict';

const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('./config/settings.json', 'utf-8'));
const Dogebot = require('./lib/dogebot.js');

const bot = new Dogebot(settings);

bot.run();

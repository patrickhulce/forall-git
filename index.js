#!/usr/bin/env node
require('colors');
var fs = require('fs');
var shell = require('shelljs');
var readlineSync = require('readline-sync');

var getChildDirectories = function (dir) {
  var children = fs.readdirSync(dir);
  return children.filter(function (name) {
    return fs.statSync(`${dir}/${name}/.git`).isDirectory();
  });
};

var argv = require('yargs').
  usage('Usage: $0 <command> [options]').
  command('status', 'Prints status of child repositories.').
  command('master', 'Checkout master and pull latest.').
  demand(1).
  alias('h', 'help').
  argv;

var command = argv._[0];
var workingDir = shell.pwd();
var childRepositories = getChildDirectories(workingDir);

childRepositories.forEach(function (name) {
  var git = function (command, loud) {
    var dir = `${workingDir}/${name}`;
    var env = `GIT_DIR=${dir}/.git GIT_WORK_TREE=${dir}`;
    var result = shell.exec(`${env} git ${command}`, {silent: !loud});
    return result;
  };

  var status = git('status -s');
  if (status.code !== 0) { return; }

  var hash = git('rev-parse HEAD').stdout.trim();
  var branch = git('rev-parse --abbrev-ref HEAD').stdout.trim();
  var isClean = status.stdout.length === 0;
  var remote = process.env.REMOTE || 'origin';

  var getIsCurrent = function (remote) {
    var remoteHash = git(`ls-remote ${remote} ${branch}`).stdout.split(/\s+/)[0];
    return hash === remoteHash;
  };

  if (command === 'status') {
    var message = git('log -n 1 --oneline').stdout.substr(8).trim();
    var isCurrent = getIsCurrent(remote);

    var statement = `${name} ${branch}(${hash.substr(0, 6)}) ${message}`;
    if (isClean && isCurrent) {
      console.log(statement.green);
    } else if (isCurrent) {
      console.log(statement.yellow);
    } else {
      console.log(statement.red);
    }
  } else if (command === 'master') {
    if (isClean && branch !== 'master') {
      if (readlineSync.keyInYN(`Checkout and pull master on ${name}?`)) {
        git('checkout master');
        git('pull');
        console.log('Done');
      } else {
        console.log('Skipping...');
      }
    } else {
      console.log(`Skipping ${name}...`);
    }
  } else if (command === 'deploy') {
    if (branch === 'master' && isClean && getIsCurrent('origin')) {
      var force = process.env.USE_FORCE ? ' -f' : '';

      var remotes = git('remote').stdout.split(/\s+/g);
      if (remotes.indexOf(remote) === -1) {
        console.log(`Remote ${remote} not available on ${name}, skipping...`);
      } else {
        git(`push ${remote} master${force}`, true);
      }
    } else {
      console.log(`Skipping ${name}...`);
    }
  } else {
    console.log(`========== ${name} ==========`);
    git(command, true);
  }
});

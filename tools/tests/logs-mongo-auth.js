var _ = require('underscore');
var selftest = require('../selftest.js');
var Sandbox = selftest.Sandbox;

// Run 'meteor logs' or 'meteor mongo' against an app. Options:
//  - legacy: boolean
//  - passwordProtected: if legacy is true, then true if the app has a
//    password set
//  - loggedIn: if true, the user is currently logged in, so we should
//    not expect a login prompt
//  - authorized: if loggedIn is true, then this boolean should indicate
//    whether the current user is authorized for the app
//  - username: the username to use if given a login prompt (defaults to
//    'test')
//  - password: the password to use if given a login prompt (defaults to
//   'testtest');
var logsOrMongoForApp = function (sandbox, command, appName, options) {
  var runArgs = [command, appName];
  var matchString;
  if (command === 'mongo') {
    runArgs.push('--url');
    matchString = 'mongodb://';
  } else if (command === 'logs') {
    matchString = 'Starting application';
  } else {
    throw new Error('Command must be "logs" or "mongo"');
  }

  var run = sandbox.run.apply(sandbox, runArgs);
  run.waitSecs(10);

  var expectSuccess = function () {
    run.match(matchString);
    run.expectExit(0);
  };

  var expectUnauthorized = function () {
    run.matchErr('belongs to a different user');
    run.expectExit(1);
  };

  if (options.legacy) {
    if (options.passwordProtected) {
      run.matchErr('meteor claim');
      run.expectExit(1);
    } else {
      // Getting logs or mongo for a non-password-protected legacy app
      // should just work, without a login or registration prompt.
      expectSuccess();
    }
  } else {
    if (options.loggedIn) {
      if (options.authorized) {
        expectSuccess();
      } else {
        expectUnauthorized();
      }
    } else {
      // If we are not logged in and this is not a legacy app, then we
      // expect a login prompt.
      run.matchErr('Username: ');
      run.write((options.username || 'test') + '\n');
      run.matchErr('Password: ');
      run.write((options.password || 'testtest') + '\n');
      run.waitSecs(5);
      if (options.authorized) {
        expectSuccess();
      } else {
        expectUnauthorized();
      }
    }
  }
};


_.each([false, true], function (loggedIn) {
  _.each(['logs', 'mongo'], function (command) {
    selftest.define(
      command + ' - ' + (loggedIn ? 'logged in' : 'logged out'),
      ['net'],
      function () {
        var s = new Sandbox;
        if (loggedIn) {
          var run = s.run('login');
          run.waitSecs(2);
          run.matchErr('Username:');
          run.write('test\n');
          run.matchErr('Password:');
          run.write('testtest\n');
          run.waitSecs(5);
          run.matchErr('Logged in as test.');
          run.expectExit(0);
        }

        logsOrMongoForApp(s, command,
                          'legacy-no-password-app-for-selftest', {
                            legacy: true,
                            passwordProtected: false,
                            loggedIn: loggedIn
                          });

        logsOrMongoForApp(s, command,
                          'legacy-password-app-for-selftest', {
                            legacy: true,
                            passwordProtected: true,
                            loggedIn: loggedIn
                          });

        logsOrMongoForApp(s, command,
                          'app-for-selftest-not-test-owned', {
                            loggedIn: loggedIn,
                            authorized: false
                          });

        if (! loggedIn) {
          // We logged in as a result of running the previous command,
          // so log out again.
          run = s.run('logout');
          run.waitSecs(5);
          run.matchErr('Logged out');
          run.expectExit(0);
        }

        logsOrMongoForApp(s, command,
                          'app-for-selftest-test-owned', {
                            loggedIn: loggedIn,
                            authorized: true
                          });
      });
  });
});

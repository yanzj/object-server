(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var Random = Package.random.Random;
var Blaze = Package.blaze.Blaze;
var UI = Package.blaze.UI;
var Handlebars = Package.blaze.Handlebars;
var BlazeLayout = Package['kadira:blaze-layout'].BlazeLayout;
var FlowRouter = Package['kadira:flow-router'].FlowRouter;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var check = Package.check.check;
var Match = Package.check.Match;
var Async = Package['meteorhacks:async'].Async;
var JsonRoutes = Package['simple:json-routes'].JsonRoutes;
var RestMiddleware = Package['simple:json-routes'].RestMiddleware;
var SubsManager = Package['meteorhacks:subs-manager'].SubsManager;
var HTTP = Package.http.HTTP;
var HTTPInternals = Package.http.HTTPInternals;
var ServerSession = Package['steedos:base'].ServerSession;
var Selector = Package['steedos:base'].Selector;
var Steedos = Package['steedos:base'].Steedos;
var AjaxCollection = Package['steedos:base'].AjaxCollection;
var SteedosDataManager = Package['steedos:base'].SteedosDataManager;
var SteedosOffice = Package['steedos:base'].SteedosOffice;
var billingManager = Package['steedos:base'].billingManager;
var _i18n = Package['universe:i18n']._i18n;
var i18n = Package['universe:i18n'].i18n;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var HTML = Package.htmljs.HTML;

/* Package-scope variables */
var refreshTokensCollection, authCodesCollection, spaceId, oAuth2Server, MeteorModel, client, __coffeescriptShare;

(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/lib/common.js                                                                 //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
db.OAuth2Clients = new Meteor.Collection('OAuth2Clients');
db.OAuth2Clients.allow({
    insert: function(userId, doc) {
        return true;
    },
    update: function(userId, doc, fieldNames, modifier) {
        return true;
    },
    remove: function(userId, doc) {
        return true;
    }
});

refreshTokensCollection = new Meteor.Collection('OAuth2RefreshTokens');
refreshTokensCollection.allow({
    insert: function(userId, doc) {
        return Meteor.isServer && userId && userId === doc.userId;
    },
    update: function(userId, doc, fieldNames, modifier) {
        return false;
    },
    remove: function(userId, doc) {
        return userId && userId === doc.userId;
    }
});

authCodesCollection = new Meteor.Collection('OAuth2AuthCodes');
authCodesCollection.allow({
    insert: function(userId, doc) {
        return Meteor.isServer && userId && userId === doc.userId;
    },
    update: function(userId, doc, fieldNames, modifier) {
        return false;
    },
    remove: function(userId, doc) {
        return userId && userId === doc.userId;
    }
});

if(Meteor.isServer){
    authCodesCollection.before.insert(function(userId, doc){
        spaceId = db.space_users.findOne({user: doc.userId}).space;
        doc.spaceId = spaceId;
    });
}


oAuth2Server = {
    pubSubNames: {
        authCodes: 'oauth2/authCodes',
        refreshTokens: 'oauth2/refreshTokens'
    },
    methodNames: {
        authCodeGrant: 'oauth2/authCodeGrant'
    },
    collections: {
        refreshToken: refreshTokensCollection,
        authCode: authCodesCollection,
        clients: db.OAuth2Clients
    }
};
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/lib/meteor-model.js                                                           //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
/**
 * A oauth2-server model for dealing with the meteor collections. Original code
 * from: https://github.com/RocketChat/rocketchat-oauth2-server/blob/master/model.coffee
 * Modifications and improvements have been made.
 * This class is used a callback model for oauth2-server. oauth2-server runs it's calls
 * in a different context and fiber. Doing so can get really messy when attempting to
 * run Meteor code, like Collection calls. We work-around this problem by creating
 * instance methods are runtime that are proxied through Meteor.bindEnvironment.
 * This strategy allows us to specify the this context.
 * Defining the class with prototype methods defined by Meteor.bindEnvironment
 * would ensure we lose our this context when the method executes.
 */
MeteorModel = (function() {
    function MeteorModel(accessTokenCollection,
                         refreshTokenCollection,
                         authCodeCollection,
                         clientsCollection,
                         debug) {
        this.accessTokenCollection = accessTokenCollection;
        this.refreshTokenCollection = refreshTokenCollection;
        this.authCodeCollection = authCodeCollection;
        this.clientsCollection = clientsCollection;
        this.debug = debug;

        ///////////////////
        // Defining the methods.
        ///////////////////

        this.getAccessToken = Meteor.bindEnvironment(
                function (bearerToken, callback) {
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in getAccessToken (bearerToken:', bearerToken, ')');
                }

                try {
                    var token = this.accessTokenCollection.findOne({
                        accessToken: bearerToken
                    });

                    callback(null, token);

                } catch (e) {
                    callback(e);
                }
            },
            null, // exception handler
            this // this context.
        );

        this.getClient = Meteor.bindEnvironment(
            function (clientId, clientSecret, callback) {
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in getClient (clientId:', clientId, ', clientSecret:', clientSecret, ')');
                }

                try {
                    var collection = this.clientsCollection;
                    if (clientSecret == null) {
                        client = collection.findOne({
                            active: true,
                            clientId: clientId
                        });
                    } else {
                        client = collection.findOne({
                            active: true,
                            clientId: clientId,
                            clientSecret: clientSecret
                        });
                    }
                    callback(null, client);
                } catch (e) {
                    callback(e);
                }
            },
            null, // exception handler
            this // this context.
        );


        this.grantTypeAllowed = Meteor.bindEnvironment(
            function (clientId, grantType, callback) {
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in grantTypeAllowed (clientId:', clientId, ', grantType:', grantType + ')');
                }

                callback(false, grantType === 'authorization_code');
            },
            null, // exception handler
            this // this context.
        );

        this.saveAccessToken = Meteor.bindEnvironment(
            function (token, clientId, expires, user, callback) {
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in saveAccessToken (token:', token, ', clientId:', clientId, ', user:', user, ', expires:', expires, ')');
                }
                
                try {
                    // 有效期（默认一小时）
                    var collection = this.clientsCollection;
                    var clientObj = collection.findOne({clientId: clientId});
                    if(clientObj && clientObj.expires && clientObj.expires>1){
                        expires.setHours(expires.getHours()+clientObj.expires-1);
                    }
                    var tokenId = this.accessTokenCollection.insert({
                        accessToken: token,
                        clientId: clientId,
                        userId: user.id,
                        expires: expires
                    });

                    callback(null, tokenId);

                } catch (e) {
                    callback(e);
                }
            },
            null, // exception handler
            this // this context.
        );

        this.getAuthCode = Meteor.bindEnvironment(
            function (authCode, callback) {
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in getAuthCode (authCode: ' + authCode + ')');
                }

                try {
                    var code = this.authCodeCollection.findOne({
                        authCode: authCode
                    });

                    callback(null, code);

                } catch (e) {
                    callback(e);
                }
            },
            null, // exception handler
            this // this context.
        );

        this.saveAuthCode = Meteor.bindEnvironment(
            function (code, clientId, expires, user, callback) {
                Meteor.bindEnvironment(code, clientId, expires, user, callback)
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in saveAuthCode (code:', code, ', clientId:', clientId, ', expires:', expires, ', user:', user, ')');
                }

                try {
                    this.authCodeCollection.remove({authCode: code});
                    var codeId = this.authCodeCollection.insert({
                        authCode: code,
                        clientId: clientId,
                        userId: user.id,
                        expires: expires
                    });

                    callback(null, codeId);

                } catch (e) {
                    callback(e);
                }
            },
            null, // exception handler
            this // this context.
        );

        this.saveRefreshToken = Meteor.bindEnvironment(
            function (token, clientId, expires, user, callback) {
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in saveRefreshToken (token:', token, ', clientId:', clientId, ', user:', user, ', expires:', expires, ')');
                }

                try {
                    this.refreshTokenCollection.remove({refreshToken: token});
                    var tokenId = this.refreshTokenCollection.insert({
                        refreshToken: token,
                        clientId: clientId,
                        userId: user.id,
                        expires: expires
                    });

                    callback(null, tokenId);

                } catch (e) {
                    callback(e);
                }
            },
            null, // exception handler
            this // this context.
        );

        this.getRefreshToken = Meteor.bindEnvironment(
            function (refreshToken, callback) {
                if (this.debug === true) {
                    console.log('[OAuth2Server]', 'in getRefreshToken (refreshToken: ' + refreshToken + ')');
                }

                try {
                    var token = this.refreshTokenCollection.findOne({
                        refreshToken: refreshToken
                    });

                    callback(null, token);

                } catch (e) {
                    callback(e);
                }
            },
            null, // exception handler
            this // this context.
        );
    };

    return MeteorModel;
})();

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/lib/server.js                                                                 //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
// get the node modules.
var express = Npm.require('express'),
    bodyParser = Npm.require('body-parser'),
    oauthserver = Npm.require('oauth2-server');


// configure the server-side collections. The rest of the collections
// exist in common.js and are for both client and server.
db.OAuth2AccessTokens = new Meteor.Collection('OAuth2AccessTokens');

if(Meteor.isServer){
    db.OAuth2AccessTokens.before.insert(function(userId, doc){
        spaceId = db.space_users.findOne({user: doc.userId}).space;
        doc.spaceId = spaceId;
    });
}

// setup the node oauth2 model.
var meteorModel = new MeteorModel(
    db.OAuth2AccessTokens,
    refreshTokensCollection,
    authCodesCollection,
    db.OAuth2Clients,
    true
);


// setup the exported object.
oAuth2Server.oauthserver = oauthserver({
    model: meteorModel,
    grants: ['authorization_code'],
    debug: true
});

oAuth2Server.collections.accessToken = db.OAuth2AccessTokens;

// configure a url handler for the /steedos/oauth2/token path.
var app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.all('/oauth2/token', oAuth2Server.oauthserver.grant());

WebApp.rawConnectHandlers.use(app);


/////////////////////
// Configure really basic identity service
////////////////////
JsonRoutes.Middleware.use(
    '/oauth2/getIdentity',
    oAuth2Server.oauthserver.authorise()
);

JsonRoutes.add('get', '/oauth2/getIdentity', function(req, res, next) {
    var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
    
    var accessToken = oAuth2Server.collections.accessToken.findOne({accessToken: accessTokenStr});

    var user = Meteor.users.findOne(accessToken.userId);

    JsonRoutes.sendResult(
        res,
        {
            data: {
                id: user._id,
                name: user.name,
                username: user.username
            }
        }
    );
});



////////////////////
// Meteor publish.
///////////////////
Meteor.publish(oAuth2Server.pubSubNames.authCodes, function() {
    if (!this.userId) {
        return this.ready();
    }

    return oAuth2Server.collections.authCode.find({
        userId: this.userId,
        expires: {
            $gt: new Date()
        }
    });
});

Meteor.publish(oAuth2Server.pubSubNames.refreshTokens, function() {
    if (!this.userId) {
        return this.ready();
    }

    return oAuth2Server.collections.refreshToken.find({
        userId: this.userId,
        expires: {
            $gt: new Date()
        }
    });
});

////////////
// configure the meteor methods.
//////////////
var methods = {};
methods[oAuth2Server.methodNames.authCodeGrant] = function(clientId, redirectUri, responseType, scope, state) {
    // validate parameters.
    check(clientId, String);
    check(redirectUri, String);
    check(responseType, String);
    check(scope, Match.Optional(Match.OneOf(null, [String])));
    check(state, Match.Optional(Match.OneOf(null, String)));

    if (!scope) {
        scope = [];
    }

    // validate the user is authenticated.
    var userId = this.userId;
    if (!userId) {
        return {
            success: false,
            error: 'User not authenticated.'
        };
    }

    // The oauth2-server project relies heavily on express to validate and
    // manipulate the oauth2 grant. A forthcoming version will abstract this
    // behaviour into promises.
    // That being the case, we need to get run an authorization grant as if
    // it were a promise. Warning, the following code is difficult to follow.
    // What we are doing is mocking and express app but never attaching it to
    // Meteor. This allows oauth2-server to behave as it would as if it was
    // natively attached to the webapp. The following code mocks express,
    // request, response, check and next in order to retrive the data we need.
    // Further, we are also running this in a synchronous manner. Enjoy! :)

    // create check callback that returns the user.
    var checkCallback = function (req, callback) {
        callback(
            null, // error.
            true, // user authorizes the code creation.
            {
                id: userId
            }
        );
    };

    // retrieve the grant function from oauth2-server. This method setups up the
    // this context and such. The returned method is what express would normally
    // expect when handling a URL. eg. function(req, res, next)
    var authCodeGrantFn = oAuth2Server.oauthserver.authCodeGrant(checkCallback);

    // make the grant function run synchronously.
    var authCodeGrantFnSync = Async.wrap(function (done) {
        // the return object.
        var response = {
            success: false,
            error: null,
            authorizationCode: null,
            redirectToUri: null
        };

        // create mock express app.
        var mockApp = express();
        var req = mockApp.request;

        // set the request body values. In a typical express setup, the body
        // would be parsed by the body-parser package. We are cutting out
        // the middle man, so to speak.
        req.body = {
            client_id: clientId,
            response_type: responseType,
            redirect_uri: redirectUri
        };
        req.query = {};

        // listen for redirect calls.
        var res = mockApp.response;
        res.redirect = function (uri) {
            response.redirectToUri = uri;

            // we have what we need, trigger the done function with the response data.
            done(null, response);
        };

        // listen for errors.
        var next = function (err) {
            response.error = err;

            // we have what we need, trigger the done function with the response data.
            done(null, response);
        };

        // call the async function with the mocked params.
        authCodeGrantFn(req, res, next);
    });

    // run the auth code grant function in a synchronous manner.
    var result = authCodeGrantFnSync();


    // update the success flag.
    result.success = !result.error && !(/[?&]error=/g).test(result.redirectToUri);

    // set the authorization code.
    if (result.redirectToUri) {
        var match = result.redirectToUri.match(/[?&]code=([0-9a-f]+)/);
        if (match.length > 1) {
            result.authorizationCode = match[1];
        }

        // add the state to the url.
        if (state) {
            result.redirectToUri += '&state=' + state;
        }
    }
//console.log(result);

    return result;
};

Meteor.methods(methods);

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/i18n/en.i18n.json.js                                                          //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
Package['universe:i18n'].i18n.addTranslations('en','',{"authorize":"Authorize","get_user_info":"Get your account information","get_follow_permission":"will get the follow permission"});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/i18n/zh-CN.i18n.json.js                                                       //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
Package['universe:i18n'].i18n.addTranslations('zh-CN','',{"authorize":"授权","get_user_info":"获取您的账户信息","get_follow_permission":"将获得以下权限"});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/client/subscribe.coffee                                                       //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var subClients;
subClients = new SubsManager();
Meteor.startup(function () {
  return Tracker.autorun(function (c) {
    var client_id;

    if (subClients.ready()) {
      client_id = FlowRouter.getQueryParam("client_id");

      if (client_id) {
        return subClients.subscribe("OAuth2Clients", client_id);
      }
    }
  });
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/server/rest.coffee                                                            //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
var Cookies;
Cookies = Npm.require("cookies");
JsonRoutes.Middleware.use('/oauth2/sso', oAuth2Server.oauthserver.authorise());
JsonRoutes.add('get', '/oauth2/sso', function (req, res, next) {
  var accessToken, accessTokenStr, authToken, cookies, hashedToken, redirectUrl, ref, ref1, ref2, ref3, userId;
  redirectUrl = (req != null ? (ref = req.params) != null ? ref.redirect_url : void 0 : void 0) || (req != null ? (ref1 = req.query) != null ? ref1.redirect_url : void 0 : void 0) || '/';
  accessTokenStr = (req != null ? (ref2 = req.params) != null ? ref2.access_token : void 0 : void 0) || (req != null ? (ref3 = req.query) != null ? ref3.access_token : void 0 : void 0);
  accessToken = oAuth2Server.collections.accessToken.findOne({
    accessToken: accessTokenStr
  });
  cookies = new Cookies(req, res);
  userId = cookies.get("X-User-Id");
  authToken = cookies.get("X-Auth-Token");

  if (userId && authToken) {
    if (accessToken.userId !== userId) {
      Setup.clearAuthCookies(req, res);
      hashedToken = Accounts._hashLoginToken(authToken);
      Accounts.destroyToken(userId, hashedToken);
    } else {
      res.writeHead(301, {
        'Location': redirectUrl
      });
      return res.end('');
    }
  }

  authToken = Accounts._generateStampedLoginToken();
  hashedToken = Accounts._hashStampedToken(authToken);

  Accounts._insertHashedLoginToken(accessToken.userId, hashedToken);

  Setup.setAuthCookies(req, res, accessToken.userId, authToken.token);
  res.writeHead(301, {
    'Location': redirectUrl
  });
  return res.end('');
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/server/publications/oauth2clients.coffee                                      //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
Meteor.publish("OAuth2Clients", function (clientId) {
  var collection;
  collection = oAuth2Server.collections.client;
  return collection.find({
    'clientId': clientId
  }, {
    fields: {
      clientName: 1
    }
  });
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/steedos_oauth2-server/server/methods/oauth2authcodes.coffee                                         //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
Meteor.methods({
  isAuthorized: function (userId, clientId) {
    var count;
    count = authCodesCollection.find({
      'userId': userId,
      'clientId': clientId
    }).count();

    if (count > 0) {
      return true;
    } else {
      return false;
    }
  }
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
Package._define("steedos:oauth2-server", {
  oAuth2Server: oAuth2Server,
  Random: Random
});

})();

//# sourceURL=meteor://💻app/packages/steedos_oauth2-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvc19vYXV0aDItc2VydmVyL2NsaWVudC9zdWJzY3JpYmUuY29mZmVlIiwibWV0ZW9yOi8v8J+Su2FwcC9jbGllbnQvc3Vic2NyaWJlLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvc19vYXV0aDItc2VydmVyL3NlcnZlci9yZXN0LmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvc2VydmVyL3Jlc3QuY29mZmVlIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zdGVlZG9zX29hdXRoMi1zZXJ2ZXIvc2VydmVyL3B1YmxpY2F0aW9ucy9vYXV0aDJjbGllbnRzLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvc19vYXV0aDItc2VydmVyL3NlcnZlci9tZXRob2RzL29hdXRoMmF1dGhjb2Rlcy5jb2ZmZWUiLCJtZXRlb3I6Ly/wn5K7YXBwL3NlcnZlci9tZXRob2RzL29hdXRoMmF1dGhjb2Rlcy5jb2ZmZWUiXSwibmFtZXMiOlsic3ViQ2xpZW50cyIsIlN1YnNNYW5hZ2VyIiwiTWV0ZW9yIiwic3RhcnR1cCIsIlRyYWNrZXIiLCJhdXRvcnVuIiwiYyIsImNsaWVudF9pZCIsInJlYWR5IiwiRmxvd1JvdXRlciIsImdldFF1ZXJ5UGFyYW0iLCJzdWJzY3JpYmUiLCJDb29raWVzIiwiTnBtIiwicmVxdWlyZSIsIkpzb25Sb3V0ZXMiLCJNaWRkbGV3YXJlIiwidXNlIiwib0F1dGgyU2VydmVyIiwib2F1dGhzZXJ2ZXIiLCJhdXRob3Jpc2UiLCJhZGQiLCJyZXEiLCJyZXMiLCJuZXh0IiwiYWNjZXNzVG9rZW4iLCJhY2Nlc3NUb2tlblN0ciIsImF1dGhUb2tlbiIsImNvb2tpZXMiLCJoYXNoZWRUb2tlbiIsInJlZGlyZWN0VXJsIiwicmVmIiwicmVmMSIsInJlZjIiLCJyZWYzIiwidXNlcklkIiwicGFyYW1zIiwicmVkaXJlY3RfdXJsIiwicXVlcnkiLCJhY2Nlc3NfdG9rZW4iLCJjb2xsZWN0aW9ucyIsImZpbmRPbmUiLCJnZXQiLCJTZXR1cCIsImNsZWFyQXV0aENvb2tpZXMiLCJBY2NvdW50cyIsIl9oYXNoTG9naW5Ub2tlbiIsImRlc3Ryb3lUb2tlbiIsIndyaXRlSGVhZCIsImVuZCIsIl9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuIiwiX2hhc2hTdGFtcGVkVG9rZW4iLCJfaW5zZXJ0SGFzaGVkTG9naW5Ub2tlbiIsInNldEF1dGhDb29raWVzIiwidG9rZW4iLCJwdWJsaXNoIiwiY2xpZW50SWQiLCJjb2xsZWN0aW9uIiwiY2xpZW50IiwiZmluZCIsImZpZWxkcyIsImNsaWVudE5hbWUiLCJtZXRob2RzIiwiaXNBdXRob3JpemVkIiwiY291bnQiLCJhdXRoQ29kZXNDb2xsZWN0aW9uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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WVUsTUFBekMsRUFBZ0RSLFVBQVUyQixLQUExRDtBQUNBL0IsTUFBSXlCLFNBQUosQ0FBYyxHQUFkLEVBQW1CO0FBQUMsZ0JBQVlsQjtBQUFiLEdBQW5CO0FBQ0EsU0FBT1AsSUFBSTBCLEdBQUosQ0FBUSxFQUFSLENBQVA7QUEvQkQsRzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBRVBBL0MsT0FBT3FELE9BQVAsQ0FBZSxlQUFmLEVBQWdDLFVBQUNDLFFBQUQ7QUFDL0IsTUFBQUMsVUFBQTtBQUFBQSxlQUFhdkMsYUFBYXNCLFdBQWIsQ0FBeUJrQixNQUF0QztBQUNBLFNBQU9ELFdBQVdFLElBQVgsQ0FBZ0I7QUFBQyxnQkFBWUg7QUFBYixHQUFoQixFQUF3QztBQUFDSSxZQUFPO0FBQUNDLGtCQUFXO0FBQVo7QUFBUixHQUF4QyxDQUFQO0FBRkQsRzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQ0FBM0QsT0FBTzRELE9BQVAsQ0FDQztBQUFBQyxnQkFBYyxVQUFDNUIsTUFBRCxFQUFRcUIsUUFBUjtBQUNQLFFBQUFRLEtBQUE7QUFBQUEsWUFBUUMsb0JBQW9CTixJQUFwQixDQUF5QjtBQUFDLGdCQUFTeEIsTUFBVjtBQUFpQixrQkFBV3FCO0FBQTVCLEtBQXpCLEVBQWdFUSxLQUFoRSxFQUFSOztBQUNBLFFBQUdBLFFBQVEsQ0FBWDtBQUNJLGFBQU8sSUFBUDtBQURKO0FBR0ksYUFBTyxLQUFQO0FDS1A7QURWSjtBQUFBLENBREQsRSIsImZpbGUiOiIvcGFja2FnZXMvc3RlZWRvc19vYXV0aDItc2VydmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsic3ViQ2xpZW50cyA9IG5ldyBTdWJzTWFuYWdlcigpXG5cbk1ldGVvci5zdGFydHVwIC0+XG5cdFRyYWNrZXIuYXV0b3J1biAoYyktPlxuICAgICAgICBpZiBzdWJDbGllbnRzLnJlYWR5KClcbiAgICAgICAgICAgIGNsaWVudF9pZCA9IEZsb3dSb3V0ZXIuZ2V0UXVlcnlQYXJhbShcImNsaWVudF9pZFwiKVxuICAgICAgICAgICAgaWYgY2xpZW50X2lkXG4gICAgICAgICAgICAgICAgc3ViQ2xpZW50cy5zdWJzY3JpYmUgXCJPQXV0aDJDbGllbnRzXCIsY2xpZW50X2lkIiwidmFyIHN1YkNsaWVudHM7XG5cbnN1YkNsaWVudHMgPSBuZXcgU3Vic01hbmFnZXIoKTtcblxuTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG4gIHJldHVybiBUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24oYykge1xuICAgIHZhciBjbGllbnRfaWQ7XG4gICAgaWYgKHN1YkNsaWVudHMucmVhZHkoKSkge1xuICAgICAgY2xpZW50X2lkID0gRmxvd1JvdXRlci5nZXRRdWVyeVBhcmFtKFwiY2xpZW50X2lkXCIpO1xuICAgICAgaWYgKGNsaWVudF9pZCkge1xuICAgICAgICByZXR1cm4gc3ViQ2xpZW50cy5zdWJzY3JpYmUoXCJPQXV0aDJDbGllbnRzXCIsIGNsaWVudF9pZCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcbn0pO1xuIiwiQ29va2llcyA9IE5wbS5yZXF1aXJlKFwiY29va2llc1wiKVxuXG5Kc29uUm91dGVzLk1pZGRsZXdhcmUudXNlKFxuXHQnL29hdXRoMi9zc28nLFxuXHRvQXV0aDJTZXJ2ZXIub2F1dGhzZXJ2ZXIuYXV0aG9yaXNlKClcbilcblxuSnNvblJvdXRlcy5hZGQgJ2dldCcsICcvb2F1dGgyL3NzbycsIChyZXEsIHJlcywgbmV4dCktPlxuXG5cdHJlZGlyZWN0VXJsID0gcmVxPy5wYXJhbXM/LnJlZGlyZWN0X3VybCB8fCByZXE/LnF1ZXJ5Py5yZWRpcmVjdF91cmwgfHwgJy8nXG5cdFxuXHRhY2Nlc3NUb2tlblN0ciA9IHJlcT8ucGFyYW1zPy5hY2Nlc3NfdG9rZW4gfHwgcmVxPy5xdWVyeT8uYWNjZXNzX3Rva2VuXG5cdFxuXHRhY2Nlc3NUb2tlbiA9IG9BdXRoMlNlcnZlci5jb2xsZWN0aW9ucy5hY2Nlc3NUb2tlbi5maW5kT25lKFxuXHRcdHthY2Nlc3NUb2tlbjogYWNjZXNzVG9rZW5TdHJ9XG5cdClcblx0XG5cdGNvb2tpZXMgPSBuZXcgQ29va2llcyggcmVxLCByZXMgKTtcblx0dXNlcklkID0gY29va2llcy5nZXQoXCJYLVVzZXItSWRcIilcblx0YXV0aFRva2VuID0gY29va2llcy5nZXQoXCJYLUF1dGgtVG9rZW5cIilcblxuXHQjIOWmguaenOacrOWcsOW3sue7j+aciWNvb2tpZXNcblx0aWYgdXNlcklkIGFuZCBhdXRoVG9rZW5cblx0XHQjIOavlOi+g+acrOWcsOaVsOaNruWSjOW9k+WJjeeUqOaIt+aYr+WQpuS4gOiHtFxuXHRcdGlmIGFjY2Vzc1Rva2VuLnVzZXJJZCE9dXNlcklkXG5cdFx0XHQjIOS4jeS4gOiHtO+8jOa4hemZpOS/oeaBr1xuXHRcdFx0U2V0dXAuY2xlYXJBdXRoQ29va2llcyhyZXEsIHJlcylcblx0XHRcdGhhc2hlZFRva2VuID0gQWNjb3VudHMuX2hhc2hMb2dpblRva2VuKGF1dGhUb2tlbilcblx0XHRcdEFjY291bnRzLmRlc3Ryb3lUb2tlbih1c2VySWQsIGhhc2hlZFRva2VuKVxuXHRcdGVsc2Vcblx0XHRcdHJlcy53cml0ZUhlYWQgMzAxLCB7J0xvY2F0aW9uJzogcmVkaXJlY3RVcmwgfVxuXHRcdFx0cmV0dXJuIHJlcy5lbmQgJydcblx0IyDpqozor4HmiJDlip/vvIznmbvlvZVcblx0YXV0aFRva2VuID0gQWNjb3VudHMuX2dlbmVyYXRlU3RhbXBlZExvZ2luVG9rZW4oKVxuXHRoYXNoZWRUb2tlbiA9IEFjY291bnRzLl9oYXNoU3RhbXBlZFRva2VuIGF1dGhUb2tlblxuXHRBY2NvdW50cy5faW5zZXJ0SGFzaGVkTG9naW5Ub2tlbiBhY2Nlc3NUb2tlbi51c2VySWQsaGFzaGVkVG9rZW5cblx0U2V0dXAuc2V0QXV0aENvb2tpZXMgcmVxLHJlcyxhY2Nlc3NUb2tlbi51c2VySWQsYXV0aFRva2VuLnRva2VuXG5cdHJlcy53cml0ZUhlYWQgMzAxLCB7J0xvY2F0aW9uJzogcmVkaXJlY3RVcmwgfVxuXHRyZXR1cm4gcmVzLmVuZCAnJ1xuXG5cblxuIiwidmFyIENvb2tpZXM7XG5cbkNvb2tpZXMgPSBOcG0ucmVxdWlyZShcImNvb2tpZXNcIik7XG5cbkpzb25Sb3V0ZXMuTWlkZGxld2FyZS51c2UoJy9vYXV0aDIvc3NvJywgb0F1dGgyU2VydmVyLm9hdXRoc2VydmVyLmF1dGhvcmlzZSgpKTtcblxuSnNvblJvdXRlcy5hZGQoJ2dldCcsICcvb2F1dGgyL3NzbycsIGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gIHZhciBhY2Nlc3NUb2tlbiwgYWNjZXNzVG9rZW5TdHIsIGF1dGhUb2tlbiwgY29va2llcywgaGFzaGVkVG9rZW4sIHJlZGlyZWN0VXJsLCByZWYsIHJlZjEsIHJlZjIsIHJlZjMsIHVzZXJJZDtcbiAgcmVkaXJlY3RVcmwgPSAocmVxICE9IG51bGwgPyAocmVmID0gcmVxLnBhcmFtcykgIT0gbnVsbCA/IHJlZi5yZWRpcmVjdF91cmwgOiB2b2lkIDAgOiB2b2lkIDApIHx8IChyZXEgIT0gbnVsbCA/IChyZWYxID0gcmVxLnF1ZXJ5KSAhPSBudWxsID8gcmVmMS5yZWRpcmVjdF91cmwgOiB2b2lkIDAgOiB2b2lkIDApIHx8ICcvJztcbiAgYWNjZXNzVG9rZW5TdHIgPSAocmVxICE9IG51bGwgPyAocmVmMiA9IHJlcS5wYXJhbXMpICE9IG51bGwgPyByZWYyLmFjY2Vzc190b2tlbiA6IHZvaWQgMCA6IHZvaWQgMCkgfHwgKHJlcSAhPSBudWxsID8gKHJlZjMgPSByZXEucXVlcnkpICE9IG51bGwgPyByZWYzLmFjY2Vzc190b2tlbiA6IHZvaWQgMCA6IHZvaWQgMCk7XG4gIGFjY2Vzc1Rva2VuID0gb0F1dGgyU2VydmVyLmNvbGxlY3Rpb25zLmFjY2Vzc1Rva2VuLmZpbmRPbmUoe1xuICAgIGFjY2Vzc1Rva2VuOiBhY2Nlc3NUb2tlblN0clxuICB9KTtcbiAgY29va2llcyA9IG5ldyBDb29raWVzKHJlcSwgcmVzKTtcbiAgdXNlcklkID0gY29va2llcy5nZXQoXCJYLVVzZXItSWRcIik7XG4gIGF1dGhUb2tlbiA9IGNvb2tpZXMuZ2V0KFwiWC1BdXRoLVRva2VuXCIpO1xuICBpZiAodXNlcklkICYmIGF1dGhUb2tlbikge1xuICAgIGlmIChhY2Nlc3NUb2tlbi51c2VySWQgIT09IHVzZXJJZCkge1xuICAgICAgU2V0dXAuY2xlYXJBdXRoQ29va2llcyhyZXEsIHJlcyk7XG4gICAgICBoYXNoZWRUb2tlbiA9IEFjY291bnRzLl9oYXNoTG9naW5Ub2tlbihhdXRoVG9rZW4pO1xuICAgICAgQWNjb3VudHMuZGVzdHJveVRva2VuKHVzZXJJZCwgaGFzaGVkVG9rZW4pO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXMud3JpdGVIZWFkKDMwMSwge1xuICAgICAgICAnTG9jYXRpb24nOiByZWRpcmVjdFVybFxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzLmVuZCgnJyk7XG4gICAgfVxuICB9XG4gIGF1dGhUb2tlbiA9IEFjY291bnRzLl9nZW5lcmF0ZVN0YW1wZWRMb2dpblRva2VuKCk7XG4gIGhhc2hlZFRva2VuID0gQWNjb3VudHMuX2hhc2hTdGFtcGVkVG9rZW4oYXV0aFRva2VuKTtcbiAgQWNjb3VudHMuX2luc2VydEhhc2hlZExvZ2luVG9rZW4oYWNjZXNzVG9rZW4udXNlcklkLCBoYXNoZWRUb2tlbik7XG4gIFNldHVwLnNldEF1dGhDb29raWVzKHJlcSwgcmVzLCBhY2Nlc3NUb2tlbi51c2VySWQsIGF1dGhUb2tlbi50b2tlbik7XG4gIHJlcy53cml0ZUhlYWQoMzAxLCB7XG4gICAgJ0xvY2F0aW9uJzogcmVkaXJlY3RVcmxcbiAgfSk7XG4gIHJldHVybiByZXMuZW5kKCcnKTtcbn0pO1xuIiwiTWV0ZW9yLnB1Ymxpc2ggXCJPQXV0aDJDbGllbnRzXCIsIChjbGllbnRJZCktPlxuXHRjb2xsZWN0aW9uID0gb0F1dGgyU2VydmVyLmNvbGxlY3Rpb25zLmNsaWVudFxuXHRyZXR1cm4gY29sbGVjdGlvbi5maW5kKHsnY2xpZW50SWQnOiBjbGllbnRJZH0sIHtmaWVsZHM6e2NsaWVudE5hbWU6MX19KSIsIk1ldGVvci5tZXRob2RzXG5cdGlzQXV0aG9yaXplZDogKHVzZXJJZCxjbGllbnRJZCkgLT5cbiAgICAgICAgY291bnQgPSBhdXRoQ29kZXNDb2xsZWN0aW9uLmZpbmQoeyd1c2VySWQnOnVzZXJJZCwnY2xpZW50SWQnOmNsaWVudElkfSkuY291bnQoKVxuICAgICAgICBpZiBjb3VudCA+IDBcbiAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJldHVybiBmYWxzZSIsIk1ldGVvci5tZXRob2RzKHtcbiAgaXNBdXRob3JpemVkOiBmdW5jdGlvbih1c2VySWQsIGNsaWVudElkKSB7XG4gICAgdmFyIGNvdW50O1xuICAgIGNvdW50ID0gYXV0aENvZGVzQ29sbGVjdGlvbi5maW5kKHtcbiAgICAgICd1c2VySWQnOiB1c2VySWQsXG4gICAgICAnY2xpZW50SWQnOiBjbGllbnRJZFxuICAgIH0pLmNvdW50KCk7XG4gICAgaWYgKGNvdW50ID4gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn0pO1xuIl19

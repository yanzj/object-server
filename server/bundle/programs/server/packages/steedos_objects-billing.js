(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var ReactiveDict = Package['reactive-dict'].ReactiveDict;
var Random = Package.random.Random;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var check = Package.check.check;
var Match = Package.check.Match;
var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
var _ = Package.underscore._;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var ECMAScript = Package.ecmascript.ECMAScript;
var SimpleSchema = Package['aldeed:simple-schema'].SimpleSchema;
var MongoObject = Package['aldeed:simple-schema'].MongoObject;
var _i18n = Package['universe:i18n']._i18n;
var i18n = Package['universe:i18n'].i18n;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var meteorInstall = Package.modules.meteorInstall;
var FS = Package['steedos:cfs-base-package'].FS;

/* Package-scope variables */
var __coffeescriptShare;

var require = meteorInstall({"node_modules":{"meteor":{"steedos:objects-billing":{"models":{"billings.coffee":function(){

///////////////////////////////////////////////////////////////////////////////////////
//                                                                                   //
// packages/steedos_objects-billing/models/billings.coffee                           //
//                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////
                                                                                     //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
db.billings = new Meteor.Collection('billings');
db.billings.helpers({
  transaction_i18n: function () {
    var d, t;
    t = this.transaction;
    d = "";

    if (t === "Starting balance") {
      d = TAPi18n.__('billing_tranDetail.starting');
    } else if (t === "Payment") {
      d = TAPi18n.__('billing_tranDetail.payment');
    } else if (t === "Service adjustment") {
      d = TAPi18n.__('billing_tranDetail.adjustment');
    } else if (t === "workflow") {
      d = TAPi18n.__('billing_tranDetail.workflow');
    } else if (t === "workflow.professional") {
      d = TAPi18n.__('billing_tranDetail.workflow');
    } else if (t === "chat.professional") {
      d = TAPi18n.__('billing_tranDetail.chat');
    } else {
      d = t;
    }

    return d;
  }
});

if (Meteor.isServer) {
  db.billings._ensureIndex({
    "space": 1
  }, {
    background: true
  });
}
///////////////////////////////////////////////////////////////////////////////////////

},"billing_pay_records.coffee":function(){

///////////////////////////////////////////////////////////////////////////////////////
//                                                                                   //
// packages/steedos_objects-billing/models/billing_pay_records.coffee                //
//                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////
                                                                                     //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
db.billing_pay_records = new Meteor.Collection('billing_pay_records');
db.billing_pay_records.helpers({
  order_created: function () {
    return moment(this.created).format('YYYY-MM-DD HH:mm:ss');
  },
  order_paid: function () {
    if (this.paid) {
      return TAPi18n.__("billing.has_paid");
    } else {
      return TAPi18n.__("billing.not_paid");
    }
  },
  order_total_fee: function () {
    return (this.total_fee / 100).toString();
  }
});
Creator.Objects.billing_pay_records = {
  name: "billing_pay_records",
  label: "订单",
  icon: "apps",
  fields: {
    info: {
      label: "详单详情",
      type: "object",
      blackbox: true,
      omit: true,
      hidden: true
    },
    total_fee: {
      label: "金额￥",
      type: "number",
      defaultValue: 100,
      omit: true
    },
    paid: {
      label: "已付款",
      type: "boolean",
      omit: true,
      defaultValue: false
    },
    modules: {
      label: "模块",
      type: "[text]",
      blackbox: true,
      omit: true
    },
    end_date: {
      label: "租用日期至",
      type: "date",
      omit: true
    },
    user_count: {
      label: "名额",
      type: "number",
      omit: true
    }
  },
  list_views: {
    all: {
      label: "所有",
      filter_scope: "space",
      columns: ["modules", "user_count", "end_date", "total_fee", "paid", "created"]
    }
  },
  permission_set: {
    user: {
      allowCreate: false,
      allowDelete: false,
      allowEdit: false,
      allowRead: false,
      modifyAllRecords: false,
      viewAllRecords: false
    },
    admin: {
      allowCreate: false,
      allowDelete: false,
      allowEdit: false,
      allowRead: true,
      modifyAllRecords: false,
      viewAllRecords: true
    }
  }
};
///////////////////////////////////////////////////////////////////////////////////////

},"modules.coffee":function(){

///////////////////////////////////////////////////////////////////////////////////////
//                                                                                   //
// packages/steedos_objects-billing/models/modules.coffee                            //
//                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////
                                                                                     //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
db.modules = new Meteor.Collection('modules');
///////////////////////////////////////////////////////////////////////////////////////

},"modules_changelogs.coffee":function(){

///////////////////////////////////////////////////////////////////////////////////////
//                                                                                   //
// packages/steedos_objects-billing/models/modules_changelogs.coffee                 //
//                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////
                                                                                     //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
db.modules_changelogs = new Meteor.Collection('modules_changelogs');
///////////////////////////////////////////////////////////////////////////////////////

},"users_changelogs.coffee":function(){

///////////////////////////////////////////////////////////////////////////////////////
//                                                                                   //
// packages/steedos_objects-billing/models/users_changelogs.coffee                   //
//                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////
                                                                                     //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
db.users_changelogs = new Meteor.Collection('users_changelogs');
db.users_changelogs._simpleSchema = new SimpleSchema({
  change_date: {
    type: Date
  },
  operator: {
    type: String
  },
  space: {
    type: String
  },
  operation: {
    type: String
  },
  user: {
    type: String
  },
  user_count: {
    type: Number
  },
  created: {
    type: Date
  },
  created_by: {
    type: String
  }
});

if (Meteor.isServer) {
  db.users_changelogs.before.insert(function (userId, doc) {
    doc.change_date = moment().format('YYYYMMDD');
    doc.created = new Date();
    return doc.created_by = userId;
  });
}
///////////////////////////////////////////////////////////////////////////////////////

},"steedos_statistics.coffee":function(){

///////////////////////////////////////////////////////////////////////////////////////
//                                                                                   //
// packages/steedos_objects-billing/models/steedos_statistics.coffee                 //
//                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////
                                                                                     //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
db.steedos_statistics = new Meteor.Collection('steedos_statistics');
///////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json",
    ".coffee"
  ]
});

require("/node_modules/meteor/steedos:objects-billing/models/billings.coffee");
require("/node_modules/meteor/steedos:objects-billing/models/billing_pay_records.coffee");
require("/node_modules/meteor/steedos:objects-billing/models/modules.coffee");
require("/node_modules/meteor/steedos:objects-billing/models/modules_changelogs.coffee");
require("/node_modules/meteor/steedos:objects-billing/models/users_changelogs.coffee");
require("/node_modules/meteor/steedos:objects-billing/models/steedos_statistics.coffee");

/* Exports */
Package._define("steedos:objects-billing");

})();

//# sourceURL=meteor://💻app/packages/steedos_objects-billing.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvc19vYmplY3RzLWJpbGxpbmcvbW9kZWxzL2JpbGxpbmdzLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvbW9kZWxzL2JpbGxpbmdzLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvc19vYmplY3RzLWJpbGxpbmcvbW9kZWxzL2JpbGxpbmdfcGF5X3JlY29yZHMuY29mZmVlIiwibWV0ZW9yOi8v8J+Su2FwcC9tb2RlbHMvYmlsbGluZ19wYXlfcmVjb3Jkcy5jb2ZmZWUiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3N0ZWVkb3Nfb2JqZWN0cy1iaWxsaW5nL21vZGVscy9tb2R1bGVzLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvc19vYmplY3RzLWJpbGxpbmcvbW9kZWxzL21vZHVsZXNfY2hhbmdlbG9ncy5jb2ZmZWUiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3N0ZWVkb3Nfb2JqZWN0cy1iaWxsaW5nL21vZGVscy91c2Vyc19jaGFuZ2Vsb2dzLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvbW9kZWxzL3VzZXJzX2NoYW5nZWxvZ3MuY29mZmVlIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zdGVlZG9zX29iamVjdHMtYmlsbGluZy9tb2RlbHMvc3RlZWRvc19zdGF0aXN0aWNzLmNvZmZlZSJdLCJuYW1lcyI6WyJkYiIsImJpbGxpbmdzIiwiTWV0ZW9yIiwiQ29sbGVjdGlvbiIsImhlbHBlcnMiLCJ0cmFuc2FjdGlvbl9pMThuIiwiZCIsInQiLCJ0cmFuc2FjdGlvbiIsIlRBUGkxOG4iLCJfXyIsImlzU2VydmVyIiwiX2Vuc3VyZUluZGV4IiwiYmFja2dyb3VuZCIsImJpbGxpbmdfcGF5X3JlY29yZHMiLCJvcmRlcl9jcmVhdGVkIiwibW9tZW50IiwiY3JlYXRlZCIsImZvcm1hdCIsIm9yZGVyX3BhaWQiLCJwYWlkIiwib3JkZXJfdG90YWxfZmVlIiwidG90YWxfZmVlIiwidG9TdHJpbmciLCJDcmVhdG9yIiwiT2JqZWN0cyIsIm5hbWUiLCJsYWJlbCIsImljb24iLCJmaWVsZHMiLCJpbmZvIiwidHlwZSIsImJsYWNrYm94Iiwib21pdCIsImhpZGRlbiIsImRlZmF1bHRWYWx1ZSIsIm1vZHVsZXMiLCJlbmRfZGF0ZSIsInVzZXJfY291bnQiLCJsaXN0X3ZpZXdzIiwiYWxsIiwiZmlsdGVyX3Njb3BlIiwiY29sdW1ucyIsInBlcm1pc3Npb25fc2V0IiwidXNlciIsImFsbG93Q3JlYXRlIiwiYWxsb3dEZWxldGUiLCJhbGxvd0VkaXQiLCJhbGxvd1JlYWQiLCJtb2RpZnlBbGxSZWNvcmRzIiwidmlld0FsbFJlY29yZHMiLCJhZG1pbiIsIm1vZHVsZXNfY2hhbmdlbG9ncyIsInVzZXJzX2NoYW5nZWxvZ3MiLCJfc2ltcGxlU2NoZW1hIiwiU2ltcGxlU2NoZW1hIiwiY2hhbmdlX2RhdGUiLCJEYXRlIiwib3BlcmF0b3IiLCJTdHJpbmciLCJzcGFjZSIsIm9wZXJhdGlvbiIsIk51bWJlciIsImNyZWF0ZWRfYnkiLCJiZWZvcmUiLCJpbnNlcnQiLCJ1c2VySWQiLCJkb2MiLCJzdGVlZG9zX3N0YXRpc3RpY3MiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBQSxHQUFHQyxRQUFILEdBQWMsSUFBSUMsT0FBT0MsVUFBWCxDQUFzQixVQUF0QixDQUFkO0FBR0FILEdBQUdDLFFBQUgsQ0FBWUcsT0FBWixDQUNDO0FBQUFDLG9CQUFrQjtBQUNqQixRQUFBQyxDQUFBLEVBQUFDLENBQUE7QUFBQUEsUUFBSSxLQUFLQyxXQUFUO0FBQ0FGLFFBQUksRUFBSjs7QUFDQSxRQUFHQyxNQUFLLGtCQUFSO0FBQ0NELFVBQUlHLFFBQVFDLEVBQVIsQ0FBVyw2QkFBWCxDQUFKO0FBREQsV0FFSyxJQUFHSCxNQUFLLFNBQVI7QUFDSkQsVUFBSUcsUUFBUUMsRUFBUixDQUFXLDRCQUFYLENBQUo7QUFE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QkFBdEIsQ0FBeEIsQyIsImZpbGUiOiIvcGFja2FnZXMvc3RlZWRvc19vYmplY3RzLWJpbGxpbmcuanMiLCJzb3VyY2VzQ29udGVudCI6WyJkYi5iaWxsaW5ncyA9IG5ldyBNZXRlb3IuQ29sbGVjdGlvbignYmlsbGluZ3MnKVxuXG5cbmRiLmJpbGxpbmdzLmhlbHBlcnNcblx0dHJhbnNhY3Rpb25faTE4bjogKCktPlxuXHRcdHQgPSB0aGlzLnRyYW5zYWN0aW9uXG5cdFx0ZCA9IFwiXCJcblx0XHRpZiB0IGlzIFwiU3RhcnRpbmcgYmFsYW5jZVwiXG5cdFx0XHRkID0gVEFQaTE4bi5fXygnYmlsbGluZ190cmFuRGV0YWlsLnN0YXJ0aW5nJylcblx0XHRlbHNlIGlmIHQgaXMgXCJQYXltZW50XCJcblx0XHRcdGQgPSBUQVBpMThuLl9fKCdiaWxsaW5nX3RyYW5EZXRhaWwucGF5bWVudCcpXG5cdFx0ZWxzZSBpZiB0IGlzIFwiU2VydmljZSBhZGp1c3RtZW50XCJcblx0XHRcdGQgPSBUQVBpMThuLl9fKCdiaWxsaW5nX3RyYW5EZXRhaWwuYWRqdXN0bWVudCcpXG5cdFx0ZWxzZSBpZiB0IGlzIFwid29ya2Zsb3dcIlxuXHRcdFx0ZCA9IFRBUGkxOG4uX18oJ2JpbGxpbmdfdHJhbkRldGFpbC53b3JrZmxvdycpXG5cdFx0ZWxzZSBpZiB0IGlzIFwid29ya2Zsb3cucHJvZmVzc2lvbmFsXCJcblx0XHRcdGQgPSBUQVBpMThuLl9fKCdiaWxsaW5nX3RyYW5EZXRhaWwud29ya2Zsb3cnKVxuXHRcdGVsc2UgaWYgdCBpcyBcImNoYXQucHJvZmVzc2lvbmFsXCJcblx0XHRcdGQgPSBUQVBpMThuLl9fKCdiaWxsaW5nX3RyYW5EZXRhaWwuY2hhdCcpXG5cdFx0ZWxzZVxuXHRcdFx0ZCA9IHRcblxuXHRcdHJldHVybiBkXG5cbmlmIE1ldGVvci5pc1NlcnZlclxuXHRkYi5iaWxsaW5ncy5fZW5zdXJlSW5kZXgoe1xuXHRcdFwic3BhY2VcIjogMVxuXHR9LHtiYWNrZ3JvdW5kOiB0cnVlfSkiLCJkYi5iaWxsaW5ncyA9IG5ldyBNZXRlb3IuQ29sbGVjdGlvbignYmlsbGluZ3MnKTtcblxuZGIuYmlsbGluZ3MuaGVscGVycyh7XG4gIHRyYW5zYWN0aW9uX2kxOG46IGZ1bmN0aW9uKCkge1xuICAgIHZhciBkLCB0O1xuICAgIHQgPSB0aGlzLnRyYW5zYWN0aW9uO1xuICAgIGQgPSBcIlwiO1xuICAgIGlmICh0ID09PSBcIlN0YXJ0aW5nIGJhbGFuY2VcIikge1xuICAgICAgZCA9IFRBUGkxOG4uX18oJ2JpbGxpbmdfdHJhbkRldGFpbC5zdGFydGluZycpO1xuICAgIH0gZWxzZSBpZiAodCA9PT0gXCJQYXltZW50XCIpIHtcbiAgICAgIGQgPSBUQVBpMThuLl9fKCdiaWxsaW5nX3RyYW5EZXRhaWwucGF5bWVudCcpO1xuICAgIH0gZWxzZSBpZiAodCA9PT0gXCJTZXJ2aWNlIGFkanVzdG1lbnRcIikge1xuICAgICAgZCA9IFRBUGkxOG4uX18oJ2JpbGxpbmdfdHJhbkRldGFpbC5hZGp1c3RtZW50Jyk7XG4gICAgfSBlbHNlIGlmICh0ID09PSBcIndvcmtmbG93XCIpIHtcbiAgICAgIGQgPSBUQVBpMThuLl9fKCdiaWxsaW5nX3RyYW5EZXRhaWwud29ya2Zsb3cnKTtcbiAgICB9IGVsc2UgaWYgKHQgPT09IFwid29ya2Zsb3cucHJvZmVzc2lvbmFsXCIpIHtcbiAgICAgIGQgPSBUQVBpMThuLl9fKCdiaWxsaW5nX3RyYW5EZXRhaWwud29ya2Zsb3cnKTtcbiAgICB9IGVsc2UgaWYgKHQgPT09IFwiY2hhdC5wcm9mZXNzaW9uYWxcIikge1xuICAgICAgZCA9IFRBUGkxOG4uX18oJ2JpbGxpbmdfdHJhbkRldGFpbC5jaGF0Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGQgPSB0O1xuICAgIH1cbiAgICByZXR1cm4gZDtcbiAgfVxufSk7XG5cbmlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgZGIuYmlsbGluZ3MuX2Vuc3VyZUluZGV4KHtcbiAgICBcInNwYWNlXCI6IDFcbiAgfSwge1xuICAgIGJhY2tncm91bmQ6IHRydWVcbiAgfSk7XG59XG4iLCJkYi5iaWxsaW5nX3BheV9yZWNvcmRzID0gbmV3IE1ldGVvci5Db2xsZWN0aW9uKCdiaWxsaW5nX3BheV9yZWNvcmRzJylcblxuZGIuYmlsbGluZ19wYXlfcmVjb3Jkcy5oZWxwZXJzXG5cdG9yZGVyX2NyZWF0ZWQ6ICgpLT5cblx0XHRyZXR1cm4gbW9tZW50KHRoaXMuY3JlYXRlZCkuZm9ybWF0KCdZWVlZLU1NLUREIEhIOm1tOnNzJylcblxuXHRvcmRlcl9wYWlkOiAoKS0+XG5cdFx0cmV0dXJuIGlmIHRoaXMucGFpZCB0aGVuIFRBUGkxOG4uX18oXCJiaWxsaW5nLmhhc19wYWlkXCIpIGVsc2UgVEFQaTE4bi5fXyhcImJpbGxpbmcubm90X3BhaWRcIilcblxuXHRvcmRlcl90b3RhbF9mZWU6ICgpLT5cblx0XHRyZXR1cm4gKHRoaXMudG90YWxfZmVlLzEwMCkudG9TdHJpbmcoKVxuXG5DcmVhdG9yLk9iamVjdHMuYmlsbGluZ19wYXlfcmVjb3JkcyA9IFxuXHRuYW1lOiBcImJpbGxpbmdfcGF5X3JlY29yZHNcIlxuXHRsYWJlbDogXCLorqLljZVcIlxuXHRpY29uOiBcImFwcHNcIlxuXHRmaWVsZHM6XG5cdFx0aW5mbzpcblx0XHRcdGxhYmVsOlwi6K+m5Y2V6K+m5oOFXCJcblx0XHRcdHR5cGU6IFwib2JqZWN0XCJcblx0XHRcdGJsYWNrYm94OiB0cnVlXG5cdFx0XHRvbWl0OiB0cnVlXG5cdFx0XHRoaWRkZW46IHRydWVcblx0XHRcblx0XHR0b3RhbF9mZWU6XG5cdFx0XHRsYWJlbDpcIumHkemine+/pVwiXG5cdFx0XHR0eXBlOiBcIm51bWJlclwiXG5cdFx0XHRkZWZhdWx0VmFsdWU6IDEwMFxuXHRcdFx0b21pdDogdHJ1ZVxuXHRcdFxuXHRcdHBhaWQ6XG5cdFx0XHRsYWJlbDpcIuW3suS7mOasvlwiXG5cdFx0XHR0eXBlOiBcImJvb2xlYW5cIlxuXHRcdFx0b21pdDogdHJ1ZVxuXHRcdFx0ZGVmYXVsdFZhbHVlOiBmYWxzZVxuXHRcdFxuXHRcdG1vZHVsZXM6XG5cdFx0XHRsYWJlbDpcIuaooeWdl1wiXG5cdFx0XHR0eXBlOiBcIlt0ZXh0XVwiXG5cdFx0XHRibGFja2JveDogdHJ1ZVxuXHRcdFx0b21pdDogdHJ1ZVxuXHRcdFxuXHRcdGVuZF9kYXRlOlxuXHRcdFx0bGFiZWw6XCLnp5/nlKjml6XmnJ/oh7NcIlxuXHRcdFx0dHlwZTogXCJkYXRlXCJcblx0XHRcdG9taXQ6IHRydWVcblx0XHRcblx0XHR1c2VyX2NvdW50OlxuXHRcdFx0bGFiZWw6XCLlkI3pop1cIlxuXHRcdFx0dHlwZTogXCJudW1iZXJcIlxuXHRcdFx0b21pdDogdHJ1ZVxuXG5cdGxpc3Rfdmlld3M6XG5cdFx0YWxsOlxuXHRcdFx0bGFiZWw6IFwi5omA5pyJXCJcblx0XHRcdGZpbHRlcl9zY29wZTogXCJzcGFjZVwiXG5cdFx0XHRjb2x1bW5zOiBbXCJtb2R1bGVzXCIsIFwidXNlcl9jb3VudFwiLCBcImVuZF9kYXRlXCIsIFwidG90YWxfZmVlXCIsIFwicGFpZFwiLCBcImNyZWF0ZWRcIl1cblx0XG5cdHBlcm1pc3Npb25fc2V0OlxuXHRcdHVzZXI6XG5cdFx0XHRhbGxvd0NyZWF0ZTogZmFsc2Vcblx0XHRcdGFsbG93RGVsZXRlOiBmYWxzZVxuXHRcdFx0YWxsb3dFZGl0OiBmYWxzZVxuXHRcdFx0YWxsb3dSZWFkOiBmYWxzZVxuXHRcdFx0bW9kaWZ5QWxsUmVjb3JkczogZmFsc2Vcblx0XHRcdHZpZXdBbGxSZWNvcmRzOiBmYWxzZSBcblx0XHRhZG1pbjpcblx0XHRcdGFsbG93Q3JlYXRlOiBmYWxzZVxuXHRcdFx0YWxsb3dEZWxldGU6IGZhbHNlXG5cdFx0XHRhbGxvd0VkaXQ6IGZhbHNlXG5cdFx0XHRhbGxvd1JlYWQ6IHRydWVcblx0XHRcdG1vZGlmeUFsbFJlY29yZHM6IGZhbHNlXG5cdFx0XHR2aWV3QWxsUmVjb3JkczogdHJ1ZSIsImRiLmJpbGxpbmdfcGF5X3JlY29yZHMgPSBuZXcgTWV0ZW9yLkNvbGxlY3Rpb24oJ2JpbGxpbmdfcGF5X3JlY29yZHMnKTtcblxuZGIuYmlsbGluZ19wYXlfcmVjb3Jkcy5oZWxwZXJzKHtcbiAgb3JkZXJfY3JlYXRlZDogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG1vbWVudCh0aGlzLmNyZWF0ZWQpLmZvcm1hdCgnWVlZWS1NTS1ERCBISDptbTpzcycpO1xuICB9LFxuICBvcmRlcl9wYWlkOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5wYWlkKSB7XG4gICAgICByZXR1cm4gVEFQaTE4bi5fXyhcImJpbGxpbmcuaGFzX3BhaWRcIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBUQVBpMThuLl9fKFwiYmlsbGluZy5ub3RfcGFpZFwiKTtcbiAgICB9XG4gIH0sXG4gIG9yZGVyX3RvdGFsX2ZlZTogZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuICh0aGlzLnRvdGFsX2ZlZSAvIDEwMCkudG9TdHJpbmcoKTtcbiAgfVxufSk7XG5cbkNyZWF0b3IuT2JqZWN0cy5iaWxsaW5nX3BheV9yZWNvcmRzID0ge1xuICBuYW1lOiBcImJpbGxpbmdfcGF5X3JlY29yZHNcIixcbiAgbGFiZWw6IFwi6K6i5Y2VXCIsXG4gIGljb246IFwiYXBwc1wiLFxuICBmaWVsZHM6IHtcbiAgICBpbmZvOiB7XG4gICAgICBsYWJlbDogXCLor6bljZXor6bmg4VcIixcbiAgICAgIHR5cGU6IFwib2JqZWN0XCIsXG4gICAgICBibGFja2JveDogdHJ1ZSxcbiAgICAgIG9taXQ6IHRydWUsXG4gICAgICBoaWRkZW46IHRydWVcbiAgICB9LFxuICAgIHRvdGFsX2ZlZToge1xuICAgICAgbGFiZWw6IFwi6YeR6aKd77+lXCIsXG4gICAgICB0eXBlOiBcIm51bWJlclwiLFxuICAgICAgZGVmYXVsdFZhbHVlOiAxMDAsXG4gICAgICBvbWl0OiB0cnVlXG4gICAgfSxcbiAgICBwYWlkOiB7XG4gICAgICBsYWJlbDogXCLlt7Lku5jmrL5cIixcbiAgICAgIHR5cGU6IFwiYm9vbGVhblwiLFxuICAgICAgb21pdDogdHJ1ZSxcbiAgICAgIGRlZmF1bHRWYWx1ZTogZmFsc2VcbiAgICB9LFxuICAgIG1vZHVsZXM6IHtcbiAgICAgIGxhYmVsOiBcIuaooeWdl1wiLFxuICAgICAgdHlwZTogXCJbdGV4dF1cIixcbiAgICAgIGJsYWNrYm94OiB0cnVlLFxuICAgICAgb21pdDogdHJ1ZVxuICAgIH0sXG4gICAgZW5kX2RhdGU6IHtcbiAgICAgIGxhYmVsOiBcIuenn+eUqOaXpeacn+iHs1wiLFxuICAgICAgdHlwZTogXCJkYXRlXCIsXG4gICAgICBvbWl0OiB0cnVlXG4gICAgfSxcbiAgICB1c2VyX2NvdW50OiB7XG4gICAgICBsYWJlbDogXCLlkI3pop1cIixcbiAgICAgIHR5cGU6IFwibnVtYmVyXCIsXG4gICAgICBvbWl0OiB0cnVlXG4gICAgfVxuICB9LFxuICBsaXN0X3ZpZXdzOiB7XG4gICAgYWxsOiB7XG4gICAgICBsYWJlbDogXCLmiYDmnIlcIixcbiAgICAgIGZpbHRlcl9zY29wZTogXCJzcGFjZVwiLFxuICAgICAgY29sdW1uczogW1wibW9kdWxlc1wiLCBcInVzZXJfY291bnRcIiwgXCJlbmRfZGF0ZVwiLCBcInRvdGFsX2ZlZVwiLCBcInBhaWRcIiwgXCJjcmVhdGVkXCJdXG4gICAgfVxuICB9LFxuICBwZXJtaXNzaW9uX3NldDoge1xuICAgIHVzZXI6IHtcbiAgICAgIGFsbG93Q3JlYXRlOiBmYWxzZSxcbiAgICAgIGFsbG93RGVsZXRlOiBmYWxzZSxcbiAgICAgIGFsbG93RWRpdDogZmFsc2UsXG4gICAgICBhbGxvd1JlYWQ6IGZhbHNlLFxuICAgICAgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UsXG4gICAgICB2aWV3QWxsUmVjb3JkczogZmFsc2VcbiAgICB9LFxuICAgIGFkbWluOiB7XG4gICAgICBhbGxvd0NyZWF0ZTogZmFsc2UsXG4gICAgICBhbGxvd0RlbGV0ZTogZmFsc2UsXG4gICAgICBhbGxvd0VkaXQ6IGZhbHNlLFxuICAgICAgYWxsb3dSZWFkOiB0cnVlLFxuICAgICAgbW9kaWZ5QWxsUmVjb3JkczogZmFsc2UsXG4gICAgICB2aWV3QWxsUmVjb3JkczogdHJ1ZVxuICAgIH1cbiAgfVxufTtcbiIsImRiLm1vZHVsZXMgPSBuZXcgTWV0ZW9yLkNvbGxlY3Rpb24oJ21vZHVsZXMnKSIsImRiLm1vZHVsZXNfY2hhbmdlbG9ncyA9IG5ldyBNZXRlb3IuQ29sbGVjdGlvbignbW9kdWxlc19jaGFuZ2Vsb2dzJykiLCJkYi51c2Vyc19jaGFuZ2Vsb2dzID0gbmV3IE1ldGVvci5Db2xsZWN0aW9uKCd1c2Vyc19jaGFuZ2Vsb2dzJylcblxuZGIudXNlcnNfY2hhbmdlbG9ncy5fc2ltcGxlU2NoZW1hID0gbmV3IFNpbXBsZVNjaGVtYVxuICAjIOaXpeacn++8jOiusOW9leS6i+S7tuWPkeeUn+eahOaXtumXtO+8jOagvOW8j++8mllZWVlNTUREXG4gIGNoYW5nZV9kYXRlOlxuICAgIHR5cGU6IERhdGVcbiAgIyDmk43kvZzogIVcbiAgb3BlcmF0b3I6XG4gICAgdHlwZTogU3RyaW5nXG4gICMg5bel5L2c5Yy6XG4gIHNwYWNlOlxuICAgIHR5cGU6IFN0cmluZ1xuICAjIGFkZO+8iOWinuWKoO+8iWRlbGV0Ze+8iOWIoOmZpO+8iWVuYWJsZe+8iOWQr+eUqO+8iWRpc2FibGXvvIjlgZznlKjvvIlcbiAgb3BlcmF0aW9uOlxuICAgIHR5cGU6IFN0cmluZ1xuICAjIOWvueixoe+8jHVzZXJfaWRcbiAgdXNlcjpcbiAgICB0eXBlOiBTdHJpbmdcbiAgIyDlt6XkvZzljLrkuK3lkK/nlKjnmoTnlKjmiLfmlbBcbiAgdXNlcl9jb3VudDpcbiAgICB0eXBlOiBOdW1iZXJcbiAgIyDliJvlu7rml7bpl7RcbiAgY3JlYXRlZDpcbiAgICB0eXBlOiBEYXRlXG4gICMg5Yib5bu65Lq6XG4gIGNyZWF0ZWRfYnk6XG4gICAgdHlwZTogU3RyaW5nXG5cblxuaWYgTWV0ZW9yLmlzU2VydmVyXG4gIGRiLnVzZXJzX2NoYW5nZWxvZ3MuYmVmb3JlLmluc2VydCAodXNlcklkLCBkb2MpIC0+XG4gICAgZG9jLmNoYW5nZV9kYXRlID0gbW9tZW50KCkuZm9ybWF0KCdZWVlZTU1ERCcpO1xuICAgIGRvYy5jcmVhdGVkID0gbmV3IERhdGUoKTtcbiAgICBkb2MuY3JlYXRlZF9ieSA9IHVzZXJJZDtcblxuIiwiZGIudXNlcnNfY2hhbmdlbG9ncyA9IG5ldyBNZXRlb3IuQ29sbGVjdGlvbigndXNlcnNfY2hhbmdlbG9ncycpO1xuXG5kYi51c2Vyc19jaGFuZ2Vsb2dzLl9zaW1wbGVTY2hlbWEgPSBuZXcgU2ltcGxlU2NoZW1hKHtcbiAgY2hhbmdlX2RhdGU6IHtcbiAgICB0eXBlOiBEYXRlXG4gIH0sXG4gIG9wZXJhdG9yOiB7XG4gICAgdHlwZTogU3RyaW5nXG4gIH0sXG4gIHNwYWNlOiB7XG4gICAgdHlwZTogU3RyaW5nXG4gIH0sXG4gIG9wZXJhdGlvbjoge1xuICAgIHR5cGU6IFN0cmluZ1xuICB9LFxuICB1c2VyOiB7XG4gICAgdHlwZTogU3RyaW5nXG4gIH0sXG4gIHVzZXJfY291bnQ6IHtcbiAgICB0eXBlOiBOdW1iZXJcbiAgfSxcbiAgY3JlYXRlZDoge1xuICAgIHR5cGU6IERhdGVcbiAgfSxcbiAgY3JlYXRlZF9ieToge1xuICAgIHR5cGU6IFN0cmluZ1xuICB9XG59KTtcblxuaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICBkYi51c2Vyc19jaGFuZ2Vsb2dzLmJlZm9yZS5pbnNlcnQoZnVuY3Rpb24odXNlcklkLCBkb2MpIHtcbiAgICBkb2MuY2hhbmdlX2RhdGUgPSBtb21lbnQoKS5mb3JtYXQoJ1lZWVlNTUREJyk7XG4gICAgZG9jLmNyZWF0ZWQgPSBuZXcgRGF0ZSgpO1xuICAgIHJldHVybiBkb2MuY3JlYXRlZF9ieSA9IHVzZXJJZDtcbiAgfSk7XG59XG4iLCJkYi5zdGVlZG9zX3N0YXRpc3RpY3MgPSBuZXcgTWV0ZW9yLkNvbGxlY3Rpb24oJ3N0ZWVkb3Nfc3RhdGlzdGljcycpXG4iXX0=

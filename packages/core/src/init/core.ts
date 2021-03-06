const objectql = require("@steedos/objectql");
const steedosAuth = require("@steedos/auth");
const express = require('express');
const graphqlHTTP = require('express-graphql');
const _ = require("underscore");
const app = express();
const router = express.Router();
var path = require('path');

import { Publish } from '../publish'
import { getSteedosSchema } from '@steedos/objectql';
import { coreExpress } from '../express-middleware'


const extendSimpleSchema = () => {
    SimpleSchema.extendOptions({
        filtersFunction: Match.Optional(Match.OneOf(Function, String))
    });
    SimpleSchema.extendOptions({
        optionsFunction: Match.Optional(Match.OneOf(Function, String))
    });
    SimpleSchema.extendOptions({
        createFunction: Match.Optional(Match.OneOf(Function, String))
    });
}

export const initCreator = () => {
    extendSimpleSchema();
    Creator.baseObject = objectql.getObjectConfig(objectql.MONGO_BASE_OBJECT)
    Creator.steedosSchema = getSteedosSchema()
    // 不需要加载 Creator 中定义的objects
    // _.each(Creator.Objects, function (obj, object_name) {
    //     obj.name = object_name
    //     objectql.addObjectConfig(obj, 'default')
    // });
    objectql.addAppConfigFiles(path.join(process.cwd(), "src/**"))

    let allObjects = objectql.getObjectConfigs('default');
    _.each(allObjects, function (obj) {
        Creator.Objects[obj.name] = obj;
    });

    let allApps = objectql.getAppConfigs();
    _.each(allApps, function (app) {
        if (!app._id)
          app._id = app.name
        Creator.Apps[app._id] = app
    });

    let allServerScripts = objectql.getServerScripts();
    _.each(allServerScripts, function (scriptFile) {
        require(scriptFile)
    });

    let clientScripts = objectql.getClientScripts();
    let clientCodes = getClientBaseObject();
    _.each(clientScripts, function (code) {
        clientCodes += code
        clientCodes += "\r\n";
    });
    WebAppInternals.addStaticJs(clientCodes)

    _.each(allObjects, function (obj) {
        if (obj.name != 'users')
            Creator.loadObjects(obj, obj.name);
    });
}

const getClientBaseObject = () => {
    let baseObject = JSON.stringify(Creator.baseObject, function (key, val) {
        if (typeof val === 'function') {
            return "$FS$" + val.toString().replace(/\"/g, "'")+"$FE$";
        }
        return val;
    });
    let code = "Creator.baseObject=" + baseObject;
    code = code.replace(/"\$FS\$/g, "").replace(/\$FE\$"/g, "").replace(/'\$FS\$/g, "").replace(/\$FE\$'/g, "").replace(/\\r/g, "").replace(/\\n/g, "")
    code = code + ";\r\n";
    return code;
}

export class Core {

    static run() {
        this.initGraphqlAPI();
        this.initPublishAPI()
        this.initRoutes();
    }

    transformTriggerWhen(triggerWhen: string){
        let when = triggerWhen;
        switch (triggerWhen) {
            case 'beforeInsert':
                when = 'before.insert'
                break;
            case 'beforeUpdate':
                when = 'before.update'
                break;
            case 'beforeDelete':
                when = 'before.delete'
                break;
            case 'afterInsert':
                when = 'after.insert'
                break;
            case 'afterUpdate':
                when = 'after.update'
                break;
            case 'afterDelete':
                when = 'after.delete'
                break;
            default:
                break;
        }
        return when
    }

    private static initGraphqlAPI() {
        router.use("/", steedosAuth.setRequestUser);
        router.use("/", function (req, res, next) {
            if (req.user) {
                return next();
            } else {
                return res.status(401).send({
                    errors: [
                        {
                            'message': 'You must be logged in to do this.'
                        }
                    ]
                });
            }
        });

        router.use("/", graphqlHTTP({
            schema: objectql.buildGraphQLSchema(objectql.getSteedosSchema()),
            graphiql: true
        }));
        app.use('/graphql', router);
        return WebApp.connectHandlers.use(app);
    }

    private static initPublishAPI() {
        Publish.init();
    }

    private static initRoutes() {
        // /api/v4/users/login, /api/v4/users/validate
        app.use(steedosAuth.authExpress);
        app.use(coreExpress);
        
        let routers = objectql.getRouterConfigs()
        _.each(routers, (item)=>{
            app.use(item.prefix, item.router)
        })

        WebApp.connectHandlers.use(app);
    }

}

export const initDesignSystem = () => {
    const router = express.Router()

    let dsPath = require.resolve("@salesforce-ux/design-system/package.json")
    dsPath = dsPath.replace("package.json", 'assets')
    let routerPath = "/assets/"
    if (__meteor_runtime_config__ && __meteor_runtime_config__.ROOT_URL_PATH_PREFIX)
        routerPath = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + "/assets/";
    const cacheTime = 86400000*1; // one day
    router.use(routerPath, express.static(dsPath, { maxAge: cacheTime }));
    WebApp.rawConnectHandlers.use(router);
}
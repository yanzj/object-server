(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EventState = Package['raix:eventstate'].EventState;
var check = Package.check.check;
var Match = Package.check.Match;
var MongoInternals = Package.mongo.MongoInternals;
var Mongo = Package.mongo.Mongo;
var _ = Package.underscore._;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorBabelHelpers = Package['babel-runtime'].meteorBabelHelpers;
var Promise = Package.promise.Promise;
var meteorInstall = Package.modules.meteorInstall;

/* Package-scope variables */
var InstanceRecordQueue, tableToRelatedMap, tableIds, __coffeescriptShare;

var require = meteorInstall({"node_modules":{"meteor":{"steedos:instance-record-queue":{"lib":{"common":{"main.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/steedos_instance-record-queue/lib/common/main.js                                                      //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
InstanceRecordQueue = new EventState();
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"docs.js":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/steedos_instance-record-queue/lib/common/docs.js                                                      //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
InstanceRecordQueue.collection = db.instance_record_queue = new Mongo.Collection('instance_record_queue');

var _validateDocument = function (doc) {
  check(doc, {
    info: Object,
    sent: Match.Optional(Boolean),
    sending: Match.Optional(Match.Integer),
    createdAt: Date,
    createdBy: Match.OneOf(String, null)
  });
};

InstanceRecordQueue.send = function (options) {
  var currentUser = Meteor.isClient && Meteor.userId && Meteor.userId() || Meteor.isServer && (options.createdBy || '<SERVER>') || null;

  var doc = _.extend({
    createdAt: new Date(),
    createdBy: currentUser
  });

  if (Match.test(options, Object)) {
    doc.info = _.pick(options, 'instance_id', 'records', 'sync_date', 'instance_finish_date', 'step_name');
  }

  doc.sent = false;
  doc.sending = 0;

  _validateDocument(doc);

  return InstanceRecordQueue.collection.insert(doc);
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"server":{"api.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/steedos_instance-record-queue/lib/server/api.js                                                       //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
var _eval = require('eval');

var isConfigured = false;

var sendWorker = function (task, interval) {
  if (InstanceRecordQueue.debug) {
    console.log('InstanceRecordQueue: Send worker started, using interval: ' + interval);
  }

  return Meteor.setInterval(function () {
    try {
      task();
    } catch (error) {
      console.log('InstanceRecordQueue: Error while sending: ' + error.message);
    }
  }, interval);
};
/*
	options: {
		// Controls the sending interval
		sendInterval: Match.Optional(Number),
		// Controls the sending batch size per interval
		sendBatchSize: Match.Optional(Number),
		// Allow optional keeping notifications in collection
		keepDocs: Match.Optional(Boolean)
	}
*/


InstanceRecordQueue.Configure = function (options) {
  var self = this;
  options = _.extend({
    sendTimeout: 60000 // Timeout period

  }, options); // Block multiple calls

  if (isConfigured) {
    throw new Error('InstanceRecordQueue.Configure should not be called more than once!');
  }

  isConfigured = true; // Add debug info

  if (InstanceRecordQueue.debug) {
    console.log('InstanceRecordQueue.Configure', options);
  }

  self.syncAttach = function (sync_attachment, insId, spaceId, newRecordId, objectName) {
    if (sync_attachment == "lastest") {
      cfs.instances.find({
        'metadata.instance': insId,
        'metadata.current': true
      }).forEach(function (f) {
        var newFile = new FS.File(),
            cmsFileId = Creator.getCollection('cms_files')._makeNewID();

        newFile.attachData(f.createReadStream('instances'), {
          type: f.original.type
        }, function (err) {
          if (err) {
            throw new Meteor.Error(err.error, err.reason);
          }

          newFile.name(f.name());
          newFile.size(f.size());
          var metadata = {
            owner: f.metadata.owner,
            owner_name: f.metadata.owner_name,
            space: spaceId,
            record_id: newRecordId,
            object_name: objectName,
            parent: cmsFileId
          };
          newFile.metadata = metadata;
          var fileObj = cfs.files.insert(newFile);

          if (fileObj) {
            Creator.getCollection('cms_files').insert({
              _id: cmsFileId,
              parent: {
                o: objectName,
                ids: [newRecordId]
              },
              size: fileObj.size(),
              name: fileObj.name(),
              extention: fileObj.extension(),
              space: spaceId,
              versions: [fileObj._id],
              owner: f.metadata.owner,
              created_by: f.metadata.owner,
              modified_by: f.metadata.owner
            });
          }
        });
      });
    } else if (sync_attachment == "all") {
      var parents = [];
      cfs.instances.find({
        'metadata.instance': insId
      }).forEach(function (f) {
        var newFile = new FS.File(),
            cmsFileId = f.metadata.parent;

        if (!parents.includes(cmsFileId)) {
          parents.push(cmsFileId);
          Creator.getCollection('cms_files').insert({
            _id: cmsFileId,
            parent: {
              o: objectName,
              ids: [newRecordId]
            },
            space: spaceId,
            versions: [],
            owner: f.metadata.owner,
            created_by: f.metadata.owner,
            modified_by: f.metadata.owner
          });
        }

        newFile.attachData(f.createReadStream('instances'), {
          type: f.original.type
        }, function (err) {
          if (err) {
            throw new Meteor.Error(err.error, err.reason);
          }

          newFile.name(f.name());
          newFile.size(f.size());
          var metadata = {
            owner: f.metadata.owner,
            owner_name: f.metadata.owner_name,
            space: spaceId,
            record_id: newRecordId,
            object_name: objectName,
            parent: cmsFileId
          };
          newFile.metadata = metadata;
          var fileObj = cfs.files.insert(newFile);

          if (fileObj) {
            if (f.metadata.current == true) {
              Creator.getCollection('cms_files').update(cmsFileId, {
                $set: {
                  size: fileObj.size(),
                  name: fileObj.name(),
                  extention: fileObj.extension()
                },
                $addToSet: {
                  versions: fileObj._id
                }
              });
            } else {
              Creator.getCollection('cms_files').update(cmsFileId, {
                $addToSet: {
                  versions: fileObj._id
                }
              });
            }
          }
        });
      });
    }
  };

  self.syncInsFields = ['name', 'submitter_name', 'applicant_name', 'applicant_organization_name', 'applicant_organization_fullname', 'state', 'current_step_name', 'flow_name', 'category_name', 'submit_date', 'finish_date', 'final_decision', 'applicant_organization', 'applicant_company'];

  self.syncValues = function (field_map_back, values, ins, objectInfo, field_map_back_script, record) {
    var obj = {},
        tableFieldCodes = [],
        tableFieldMap = [];
    tableToRelatedMap = {};
    field_map_back = field_map_back || [];
    var spaceId = ins.space;
    var form = Creator.getCollection("forms").findOne(ins.form);
    var formFields = null;

    if (form.current._id === ins.form_version) {
      formFields = form.current.fields || [];
    } else {
      var formVersion = _.find(form.historys, function (h) {
        return h._id === ins.form_version;
      });

      formFields = formVersion ? formVersion.fields : [];
    }

    var objectFields = objectInfo.fields;

    var objectFieldKeys = _.keys(objectFields);

    var relatedObjects = Creator.getRelatedObjects(objectInfo.name, spaceId);

    var relatedObjectsKeys = _.pluck(relatedObjects, 'object_name');

    var formTableFields = _.filter(formFields, function (formField) {
      return formField.type === 'table';
    });

    var formTableFieldsCode = _.pluck(formTableFields, 'code');

    var getRelatedObjectField = function (key) {
      return _.find(relatedObjectsKeys, function (relatedObjectsKey) {
        return key.startsWith(relatedObjectsKey + '.');
      });
    };

    var getFormTableField = function (key) {
      return _.find(formTableFieldsCode, function (formTableFieldCode) {
        return key.startsWith(formTableFieldCode + '.');
      });
    };

    var getFormField = function (_formFields, _fieldCode) {
      var formField = null;

      _.each(_formFields, function (ff) {
        if (!formField) {
          if (ff.code === _fieldCode) {
            formField = ff;
          } else if (ff.type === 'section') {
            _.each(ff.fields, function (f) {
              if (!formField) {
                if (f.code === _fieldCode) {
                  formField = f;
                }
              }
            });
          } else if (ff.type === 'table') {
            _.each(ff.fields, function (f) {
              if (!formField) {
                if (f.code === _fieldCode) {
                  formField = f;
                }
              }
            });
          }
        }
      });

      return formField;
    };

    field_map_back.forEach(function (fm) {
      //workflow 的子表到creator object 的相关对象
      var relatedObjectField = getRelatedObjectField(fm.object_field);
      var formTableField = getFormTableField(fm.workflow_field);

      if (relatedObjectField) {
        var oTableCode = fm.object_field.split('.')[0];
        var oTableFieldCode = fm.object_field.split('.')[1];
        var tableToRelatedMapKey = oTableCode;

        if (!tableToRelatedMap[tableToRelatedMapKey]) {
          tableToRelatedMap[tableToRelatedMapKey] = {};
        }

        if (formTableField) {
          var wTableCode = fm.workflow_field.split('.')[0];
          tableToRelatedMap[tableToRelatedMapKey]['_FROM_TABLE_CODE'] = wTableCode;
        }

        tableToRelatedMap[tableToRelatedMapKey][oTableFieldCode] = fm.workflow_field;
      } // 判断是否是子表字段
      else if (fm.workflow_field.indexOf('.$.') > 0 && fm.object_field.indexOf('.$.') > 0) {
          var wTableCode = fm.workflow_field.split('.$.')[0];
          var oTableCode = fm.object_field.split('.$.')[0];

          if (values.hasOwnProperty(wTableCode) && _.isArray(values[wTableCode])) {
            tableFieldCodes.push(JSON.stringify({
              workflow_table_field_code: wTableCode,
              object_table_field_code: oTableCode
            }));
            tableFieldMap.push(fm);
          }
        } else if (values.hasOwnProperty(fm.workflow_field)) {
          var wField = null;

          _.each(formFields, function (ff) {
            if (!wField) {
              if (ff.code === fm.workflow_field) {
                wField = ff;
              } else if (ff.type === 'section') {
                _.each(ff.fields, function (f) {
                  if (!wField) {
                    if (f.code === fm.workflow_field) {
                      wField = f;
                    }
                  }
                });
              }
            }
          });

          var oField = objectFields[fm.object_field];

          if (oField) {
            if (!wField) {
              console.log('fm.workflow_field: ', fm.workflow_field);
            } // 表单选人选组字段 至 对象 lookup master_detail类型字段同步


            if (!wField.is_multiselect && ['user', 'group'].includes(wField.type) && !oField.multiple && ['lookup', 'master_detail'].includes(oField.type) && ['users', 'organizations'].includes(oField.reference_to)) {
              obj[fm.object_field] = values[fm.workflow_field]['id'];
            } else if (!oField.multiple && ['lookup', 'master_detail'].includes(oField.type) && _.isString(oField.reference_to) && _.isString(values[fm.workflow_field])) {
              var oCollection = Creator.getCollection(oField.reference_to, spaceId);
              var referObject = Creator.getObject(oField.reference_to, spaceId);

              if (oCollection && referObject) {
                // 先认为此值是referObject _id字段值
                var referData = oCollection.findOne(values[fm.workflow_field], {
                  fields: {
                    _id: 1
                  }
                });

                if (referData) {
                  obj[fm.object_field] = referData._id;
                } // 其次认为此值是referObject NAME_FIELD_KEY值


                if (!referData) {
                  var nameFieldKey = referObject.NAME_FIELD_KEY;
                  var selector = {};
                  selector[nameFieldKey] = values[fm.workflow_field];
                  referData = oCollection.findOne(selector, {
                    fields: {
                      _id: 1
                    }
                  });

                  if (referData) {
                    obj[fm.object_field] = referData._id;
                  }
                }
              }
            } else {
              if (oField.type === "boolean") {
                var tmp_field_value = values[fm.workflow_field];

                if (['true', '是'].includes(tmp_field_value)) {
                  obj[fm.object_field] = true;
                } else if (['false', '否'].includes(tmp_field_value)) {
                  obj[fm.object_field] = false;
                } else {
                  obj[fm.object_field] = tmp_field_value;
                }
              } else if (['lookup', 'master_detail'].includes(oField.type) && wField.type === 'odata') {
                if (oField.multiple && wField.is_multiselect) {
                  obj[fm.object_field] = _.compact(_.pluck(values[fm.workflow_field], '_id'));
                } else if (!oField.multiple && !wField.is_multiselect) {
                  if (!_.isEmpty(values[fm.workflow_field])) {
                    obj[fm.object_field] = values[fm.workflow_field]._id;
                  }
                } else {
                  obj[fm.object_field] = values[fm.workflow_field];
                }
              } else {
                obj[fm.object_field] = values[fm.workflow_field];
              }
            }
          } else {
            if (fm.object_field.indexOf('.') > -1) {
              var temObjFields = fm.object_field.split('.');

              if (temObjFields.length === 2) {
                var objField = temObjFields[0];
                var referObjField = temObjFields[1];
                var oField = objectFields[objField];

                if (!oField.multiple && ['lookup', 'master_detail'].includes(oField.type) && _.isString(oField.reference_to)) {
                  var oCollection = Creator.getCollection(oField.reference_to, spaceId);

                  if (oCollection && record && record[objField]) {
                    var referSetObj = {};
                    referSetObj[referObjField] = values[fm.workflow_field];
                    oCollection.update(record[objField], {
                      $set: referSetObj
                    });
                  }
                }
              }
            } // else{
            // 	var relatedObject = _.find(relatedObjects, function(_relatedObject){
            // 		return _relatedObject.object_name === fm.object_field
            // 	})
            //
            // 	if(relatedObject){
            // 		obj[fm.object_field] = values[fm.workflow_field];
            // 	}
            // }

          }
        } else {
          if (fm.workflow_field.startsWith('instance.')) {
            var insField = fm.workflow_field.split('instance.')[1];

            if (self.syncInsFields.includes(insField)) {
              if (fm.object_field.indexOf('.') < 0) {
                obj[fm.object_field] = ins[insField];
              } else {
                var temObjFields = fm.object_field.split('.');

                if (temObjFields.length === 2) {
                  var objField = temObjFields[0];
                  var referObjField = temObjFields[1];
                  var oField = objectFields[objField];

                  if (!oField.multiple && ['lookup', 'master_detail'].includes(oField.type) && _.isString(oField.reference_to)) {
                    var oCollection = Creator.getCollection(oField.reference_to, spaceId);

                    if (oCollection && record && record[objField]) {
                      var referSetObj = {};
                      referSetObj[referObjField] = ins[insField];
                      oCollection.update(record[objField], {
                        $set: referSetObj
                      });
                    }
                  }
                }
              }
            }
          } else {
            if (ins[fm.workflow_field]) {
              obj[fm.object_field] = ins[fm.workflow_field];
            }
          }
        }
    });

    _.uniq(tableFieldCodes).forEach(function (tfc) {
      var c = JSON.parse(tfc);
      obj[c.object_table_field_code] = [];
      values[c.workflow_table_field_code].forEach(function (tr) {
        var newTr = {};

        _.each(tr, function (v, k) {
          tableFieldMap.forEach(function (tfm) {
            if (tfm.workflow_field == c.workflow_table_field_code + '.$.' + k) {
              var oTdCode = tfm.object_field.split('.$.')[1];
              newTr[oTdCode] = v;
            }
          });
        });

        if (!_.isEmpty(newTr)) {
          obj[c.object_table_field_code].push(newTr);
        }
      });
    });

    var relatedObjs = {};

    var getRelatedFieldValue = function (valueKey, parent) {
      return valueKey.split('.').reduce(function (o, x) {
        return o[x];
      }, parent);
    };

    _.each(tableToRelatedMap, function (map, key) {
      var tableCode = map._FROM_TABLE_CODE;

      if (!tableCode) {
        console.warn('tableToRelated: [' + key + '] missing corresponding table.');
      } else {
        var relatedObjectName = key;
        var relatedObjectValues = [];
        var relatedObject = Creator.getObject(relatedObjectName, spaceId);

        _.each(values[tableCode], function (tableValueItem) {
          var relatedObjectValue = {};

          _.each(map, function (valueKey, fieldKey) {
            if (fieldKey != '_FROM_TABLE_CODE') {
              if (valueKey.startsWith('instance.')) {
                relatedObjectValue[fieldKey] = getRelatedFieldValue(valueKey, {
                  'instance': ins
                });
              } else {
                var relatedObjectFieldValue, formFieldKey;

                if (valueKey.startsWith(tableCode + '.')) {
                  formFieldKey = valueKey.split(".")[1];
                  relatedObjectFieldValue = getRelatedFieldValue(valueKey, {
                    [tableCode]: tableValueItem
                  });
                } else {
                  formFieldKey = valueKey;
                  relatedObjectFieldValue = getRelatedFieldValue(valueKey, values);
                }

                var formField = getFormField(formFields, formFieldKey);
                var relatedObjectField = relatedObject.fields[fieldKey];

                if (formField.type == 'odata' && ['lookup', 'master_detail'].includes(relatedObjectField.type)) {
                  if (!_.isEmpty(relatedObjectFieldValue)) {
                    if (relatedObjectField.multiple && formField.is_multiselect) {
                      relatedObjectFieldValue = _.compact(_.pluck(relatedObjectFieldValue, '_id'));
                    } else if (!relatedObjectField.multiple && !formField.is_multiselect) {
                      relatedObjectFieldValue = relatedObjectFieldValue._id;
                    }
                  }
                }

                relatedObjectValue[fieldKey] = relatedObjectFieldValue;
              }
            }
          });

          relatedObjectValue['_table'] = {
            _id: tableValueItem["_id"],
            _code: tableCode
          };
          relatedObjectValues.push(relatedObjectValue);
        });

        relatedObjs[relatedObjectName] = relatedObjectValues;
      }
    });

    if (field_map_back_script) {
      _.extend(obj, self.evalFieldMapBackScript(field_map_back_script, ins));
    } // 过滤掉非法的key


    var filterObj = {};

    _.each(_.keys(obj), function (k) {
      if (objectFieldKeys.includes(k)) {
        filterObj[k] = obj[k];
      } // else if(relatedObjectsKeys.includes(k) && _.isArray(obj[k])){
      // 	if(_.isArray(relatedObjs[k])){
      // 		relatedObjs[k] = relatedObjs[k].concat(obj[k])
      // 	}else{
      // 		relatedObjs[k] = obj[k]
      // 	}
      // }

    });

    return {
      mainObjectValue: filterObj,
      relatedObjectsValue: relatedObjs
    };
  };

  self.evalFieldMapBackScript = function (field_map_back_script, ins) {
    var script = "module.exports = function (instance) { " + field_map_back_script + " }";

    var func = _eval(script, "field_map_script");

    var values = func(ins);

    if (_.isObject(values)) {
      return values;
    } else {
      console.error("evalFieldMapBackScript: 脚本返回值类型不是对象");
    }

    return {};
  };

  self.syncRelatedObjectsValue = function (mainRecordId, relatedObjects, relatedObjectsValue, spaceId, ins) {
    var insId = ins._id;

    _.each(relatedObjects, function (relatedObject) {
      var objectCollection = Creator.getCollection(relatedObject.object_name, spaceId);
      var tableMap = {};

      _.each(relatedObjectsValue[relatedObject.object_name], function (relatedObjectValue) {
        var table_id = relatedObjectValue._table._id;
        var table_code = relatedObjectValue._table._code;

        if (!tableMap[table_code]) {
          tableMap[table_code] = [];
        }

        ;
        tableMap[table_code].push(table_id);
        var oldRelatedRecord = Creator.getCollection(relatedObject.object_name, spaceId).findOne({
          [relatedObject.foreign_key]: mainRecordId,
          "instances._id": insId,
          _table: relatedObjectValue._table
        }, {
          fields: {
            _id: 1
          }
        });

        if (oldRelatedRecord) {
          Creator.getCollection(relatedObject.object_name, spaceId).update({
            _id: oldRelatedRecord._id
          }, {
            $set: relatedObjectValue
          });
        } else {
          relatedObjectValue[relatedObject.foreign_key] = mainRecordId;
          relatedObjectValue.space = spaceId;
          relatedObjectValue.owner = ins.applicant;
          relatedObjectValue.created_by = ins.applicant;
          relatedObjectValue.modified_by = ins.applicant;
          relatedObjectValue._id = objectCollection._makeNewID();
          var instance_state = ins.state;

          if (ins.state === 'completed' && ins.final_decision) {
            instance_state = ins.final_decision;
          }

          relatedObjectValue.instances = [{
            _id: insId,
            state: instance_state
          }];
          relatedObjectValue.instance_state = instance_state;
          Creator.getCollection(relatedObject.object_name, spaceId).insert(relatedObjectValue, {
            validate: false,
            filter: false
          });
        }
      }); //清理申请单上被删除子表记录对应的相关表记录


      _.each(tableMap, function (tableIds, tableCode) {
        objectCollection.remove({
          [relatedObject.foreign_key]: mainRecordId,
          "instances._id": insId,
          "_table._code": tableCode,
          "_table._id": {
            $nin: tableIds
          }
        });
      });
    });

    tableIds = _.compact(tableIds);
  };

  self.sendDoc = function (doc) {
    if (InstanceRecordQueue.debug) {
      console.log("sendDoc");
      console.log(doc);
    }

    var insId = doc.info.instance_id,
        records = doc.info.records;
    var fields = {
      flow: 1,
      values: 1,
      applicant: 1,
      space: 1,
      form: 1,
      form_version: 1
    };
    self.syncInsFields.forEach(function (f) {
      fields[f] = 1;
    });
    var ins = Creator.getCollection('instances').findOne(insId, {
      fields: fields
    });
    var values = ins.values,
        spaceId = ins.space;

    if (records && !_.isEmpty(records)) {
      // 此情况属于从creator中发起审批，或者已经从Apps同步到了creator
      var objectName = records[0].o;
      var ow = Creator.getCollection('object_workflows').findOne({
        object_name: objectName,
        flow_id: ins.flow
      });
      var objectCollection = Creator.getCollection(objectName, spaceId),
          sync_attachment = ow.sync_attachment;
      var objectInfo = Creator.getObject(objectName, spaceId);
      objectCollection.find({
        _id: {
          $in: records[0].ids
        }
      }).forEach(function (record) {
        try {
          var syncValues = self.syncValues(ow.field_map_back, values, ins, objectInfo, ow.field_map_back_script, record);
          var setObj = syncValues.mainObjectValue;
          setObj.locked = false;
          var instance_state = ins.state;

          if (ins.state === 'completed' && ins.final_decision) {
            instance_state = ins.final_decision;
          }

          setObj['instances.$.state'] = setObj.instance_state = instance_state;
          objectCollection.update({
            _id: record._id,
            'instances._id': insId
          }, {
            $set: setObj
          });
          var relatedObjects = Creator.getRelatedObjects(ow.object_name, spaceId);
          var relatedObjectsValue = syncValues.relatedObjectsValue;
          self.syncRelatedObjectsValue(record._id, relatedObjects, relatedObjectsValue, spaceId, ins); // 以最终申请单附件为准，旧的record中附件删除

          Creator.getCollection('cms_files').remove({
            'parent': {
              o: objectName,
              ids: [record._id]
            }
          });
          cfs.files.remove({
            'metadata.record_id': record._id
          }); // 同步新附件

          self.syncAttach(sync_attachment, insId, record.space, record._id, objectName);
        } catch (error) {
          console.error(error.stack);
          objectCollection.update({
            _id: record._id,
            'instances._id': insId
          }, {
            $set: {
              'instances.$.state': 'pending',
              'locked': true,
              'instance_state': 'pending'
            }
          });
          Creator.getCollection('cms_files').remove({
            'parent': {
              o: objectName,
              ids: [record._id]
            }
          });
          cfs.files.remove({
            'metadata.record_id': record._id
          });
          throw new Error(error);
        }
      });
    } else {
      // 此情况属于从apps中发起审批
      Creator.getCollection('object_workflows').find({
        flow_id: ins.flow
      }).forEach(function (ow) {
        try {
          var objectCollection = Creator.getCollection(ow.object_name, spaceId),
              sync_attachment = ow.sync_attachment,
              newRecordId = objectCollection._makeNewID(),
              objectName = ow.object_name;

          var objectInfo = Creator.getObject(ow.object_name, spaceId);
          var syncValues = self.syncValues(ow.field_map_back, values, ins, objectInfo, ow.field_map_back_script);
          var newObj = syncValues.mainObjectValue;
          newObj._id = newRecordId;
          newObj.space = spaceId;
          newObj.name = newObj.name || ins.name;
          var instance_state = ins.state;

          if (ins.state === 'completed' && ins.final_decision) {
            instance_state = ins.final_decision;
          }

          newObj.instances = [{
            _id: insId,
            state: instance_state
          }];
          newObj.instance_state = instance_state;
          newObj.owner = ins.applicant;
          newObj.created_by = ins.applicant;
          newObj.modified_by = ins.applicant;
          var r = objectCollection.insert(newObj);

          if (r) {
            Creator.getCollection('instances').update(ins._id, {
              $push: {
                record_ids: {
                  o: objectName,
                  ids: [newRecordId]
                }
              }
            });
            var relatedObjects = Creator.getRelatedObjects(ow.object_name, spaceId);
            var relatedObjectsValue = syncValues.relatedObjectsValue;
            self.syncRelatedObjectsValue(newRecordId, relatedObjects, relatedObjectsValue, spaceId, ins); // workflow里发起审批后，同步时也可以修改相关表的字段值 #1183

            var record = objectCollection.findOne(newRecordId);
            self.syncValues(ow.field_map_back, values, ins, objectInfo, ow.field_map_back_script, record);
          } // 附件同步


          self.syncAttach(sync_attachment, insId, spaceId, newRecordId, objectName);
        } catch (error) {
          console.error(error.stack);
          objectCollection.remove({
            _id: newRecordId,
            space: spaceId
          });
          Creator.getCollection('instances').update(ins._id, {
            $pull: {
              record_ids: {
                o: objectName,
                ids: [newRecordId]
              }
            }
          });
          Creator.getCollection('cms_files').remove({
            'parent': {
              o: objectName,
              ids: [newRecordId]
            }
          });
          cfs.files.remove({
            'metadata.record_id': newRecordId
          });
          throw new Error(error);
        }
      });
    }

    InstanceRecordQueue.collection.update(doc._id, {
      $set: {
        'info.sync_date': new Date()
      }
    });
  }; // Universal send function


  var _querySend = function (doc) {
    if (self.sendDoc) {
      self.sendDoc(doc);
    }

    return {
      doc: [doc._id]
    };
  };

  self.serverSend = function (doc) {
    doc = doc || {};
    return _querySend(doc);
  }; // This interval will allow only one doc to be sent at a time, it
  // will check for new docs at every `options.sendInterval`
  // (default interval is 15000 ms)
  //
  // It looks in docs collection to see if theres any pending
  // docs, if so it will try to reserve the pending doc.
  // If successfully reserved the send is started.
  //
  // If doc.query is type string, it's assumed to be a json string
  // version of the query selector. Making it able to carry `$` properties in
  // the mongo collection.
  //
  // Pr. default docs are removed from the collection after send have
  // completed. Setting `options.keepDocs` will update and keep the
  // doc eg. if needed for historical reasons.
  //
  // After the send have completed a "send" event will be emitted with a
  // status object containing doc id and the send result object.
  //


  var isSendingDoc = false;

  if (options.sendInterval !== null) {
    // This will require index since we sort docs by createdAt
    InstanceRecordQueue.collection._ensureIndex({
      createdAt: 1
    });

    InstanceRecordQueue.collection._ensureIndex({
      sent: 1
    });

    InstanceRecordQueue.collection._ensureIndex({
      sending: 1
    });

    var sendDoc = function (doc) {
      // Reserve doc
      var now = +new Date();
      var timeoutAt = now + options.sendTimeout;
      var reserved = InstanceRecordQueue.collection.update({
        _id: doc._id,
        sent: false,
        // xxx: need to make sure this is set on create
        sending: {
          $lt: now
        }
      }, {
        $set: {
          sending: timeoutAt
        }
      }); // Make sure we only handle docs reserved by this
      // instance

      if (reserved) {
        // Send
        var result = InstanceRecordQueue.serverSend(doc);

        if (!options.keepDocs) {
          // Pr. Default we will remove docs
          InstanceRecordQueue.collection.remove({
            _id: doc._id
          });
        } else {
          // Update
          InstanceRecordQueue.collection.update({
            _id: doc._id
          }, {
            $set: {
              // Mark as sent
              sent: true,
              // Set the sent date
              sentAt: new Date(),
              // Not being sent anymore
              sending: 0
            }
          });
        } // // Emit the send
        // self.emit('send', {
        // 	doc: doc._id,
        // 	result: result
        // });

      } // Else could not reserve

    }; // EO sendDoc


    sendWorker(function () {
      if (isSendingDoc) {
        return;
      } // Set send fence


      isSendingDoc = true;
      var batchSize = options.sendBatchSize || 1;
      var now = +new Date(); // Find docs that are not being or already sent

      var pendingDocs = InstanceRecordQueue.collection.find({
        $and: [// Message is not sent
        {
          sent: false
        }, // And not being sent by other instances
        {
          sending: {
            $lt: now
          }
        }, // And no error
        {
          errMsg: {
            $exists: false
          }
        }]
      }, {
        // Sort by created date
        sort: {
          createdAt: 1
        },
        limit: batchSize
      });
      pendingDocs.forEach(function (doc) {
        try {
          sendDoc(doc);
        } catch (error) {
          console.error(error.stack);
          console.log('InstanceRecordQueue: Could not send doc id: "' + doc._id + '", Error: ' + error.message);
          InstanceRecordQueue.collection.update({
            _id: doc._id
          }, {
            $set: {
              // error message
              errMsg: error.message
            }
          });
        }
      }); // EO forEach
      // Remove the send fence

      isSendingDoc = false;
    }, options.sendInterval || 15000); // Default every 15th sec
  } else {
    if (InstanceRecordQueue.debug) {
      console.log('InstanceRecordQueue: Send server is disabled');
    }
  }
};
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"server":{"startup.coffee":function(){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/steedos_instance-record-queue/server/startup.coffee                                                   //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
__coffeescriptShare = typeof __coffeescriptShare === 'object' ? __coffeescriptShare : {}; var share = __coffeescriptShare;
Meteor.startup(function () {
  var ref;

  if ((ref = Meteor.settings.cron) != null ? ref.instancerecordqueue_interval : void 0) {
    return InstanceRecordQueue.Configure({
      sendInterval: Meteor.settings.cron.instancerecordqueue_interval,
      sendBatchSize: 10,
      keepDocs: true
    });
  }
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"checkNpm.js":function(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/steedos_instance-record-queue/server/checkNpm.js                                                      //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
let checkNpmVersions;
module.link("meteor/tmeasday:check-npm-versions", {
  checkNpmVersions(v) {
    checkNpmVersions = v;
  }

}, 0);
checkNpmVersions({
  "eval": "^0.1.2"
}, 'steedos:instance-record-queue');
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json",
    ".coffee"
  ]
});

require("/node_modules/meteor/steedos:instance-record-queue/lib/common/main.js");
require("/node_modules/meteor/steedos:instance-record-queue/lib/common/docs.js");
require("/node_modules/meteor/steedos:instance-record-queue/lib/server/api.js");
require("/node_modules/meteor/steedos:instance-record-queue/server/startup.coffee");
require("/node_modules/meteor/steedos:instance-record-queue/server/checkNpm.js");

/* Exports */
Package._define("steedos:instance-record-queue", {
  InstanceRecordQueue: InstanceRecordQueue
});

})();

//# sourceURL=meteor://💻app/packages/steedos_instance-record-queue.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvczppbnN0YW5jZS1yZWNvcmQtcXVldWUvbGliL2NvbW1vbi9tYWluLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zdGVlZG9zOmluc3RhbmNlLXJlY29yZC1xdWV1ZS9saWIvY29tbW9uL2RvY3MuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3N0ZWVkb3M6aW5zdGFuY2UtcmVjb3JkLXF1ZXVlL2xpYi9zZXJ2ZXIvYXBpLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zdGVlZG9zX2luc3RhbmNlLXJlY29yZC1xdWV1ZS9zZXJ2ZXIvc3RhcnR1cC5jb2ZmZWUiLCJtZXRlb3I6Ly/wn5K7YXBwL3NlcnZlci9zdGFydHVwLmNvZmZlZSIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3RlZWRvczppbnN0YW5jZS1yZWNvcmQtcXVldWUvc2VydmVyL2NoZWNrTnBtLmpzIl0sIm5hbWVzIjpbIkluc3RhbmNlUmVjb3JkUXVldWUiLCJFdmVudFN0YXRlIiwiY29sbGVjdGlvbiIsImRiIiwiaW5zdGFuY2VfcmVjb3JkX3F1ZXVlIiwiTW9uZ28iLCJDb2xsZWN0aW9uIiwiX3ZhbGlkYXRlRG9jdW1lbnQiLCJkb2MiLCJjaGVjayIsImluZm8iLCJPYmplY3QiLCJzZW50IiwiTWF0Y2giLCJPcHRpb25hbCIsIkJvb2xlYW4iLCJzZW5kaW5nIiwiSW50ZWdlciIsImNyZWF0ZWRBdCIsIkRhdGUiLCJjcmVhdGVkQnkiLCJPbmVPZiIsIlN0cmluZyIsInNlbmQiLCJvcHRpb25zIiwiY3VycmVudFVzZXIiLCJNZXRlb3IiLCJpc0NsaWVudCIsInVzZXJJZCIsImlzU2VydmVyIiwiXyIsImV4dGVuZCIsInRlc3QiLCJwaWNrIiwiaW5zZXJ0IiwiX2V2YWwiLCJyZXF1aXJlIiwiaXNDb25maWd1cmVkIiwic2VuZFdvcmtlciIsInRhc2siLCJpbnRlcnZhbCIsImRlYnVnIiwiY29uc29sZSIsImxvZyIsInNldEludGVydmFsIiwiZXJyb3IiLCJtZXNzYWdlIiwiQ29uZmlndXJlIiwic2VsZiIsInNlbmRUaW1lb3V0IiwiRXJyb3IiLCJzeW5jQXR0YWNoIiwic3luY19hdHRhY2htZW50IiwiaW5zSWQiLCJzcGFjZUlkIiwibmV3UmVjb3JkSWQiLCJvYmplY3ROYW1lIiwiY2ZzIiwiaW5zdGFuY2VzIiwiZmluZCIsImZvckVhY2giLCJmIiwibmV3RmlsZSIsIkZTIiwiRmlsZSIsImNtc0ZpbGVJZCIsIkNyZWF0b3IiLCJnZXRDb2xsZWN0aW9uIiwiX21ha2VOZXdJRCIsImF0dGFjaERhdGEiLCJjcmVhdGVSZWFkU3RyZWFtIiwidHlwZSIsIm9yaWdpbmFsIiwiZXJyIiwicmVhc29uIiwibmFtZSIsInNpemUiLCJtZXRhZGF0YSIsIm93bmVyIiwib3duZXJfbmFtZSIsInNwYWNlIiwicmVjb3JkX2lkIiwib2JqZWN0X25hbWUiLCJwYXJlbnQiLCJmaWxlT2JqIiwiZmlsZXMiLCJfaWQiLCJvIiwiaWRzIiwiZXh0ZW50aW9uIiwiZXh0ZW5zaW9uIiwidmVyc2lvbnMiLCJjcmVhdGVkX2J5IiwibW9kaWZpZWRfYnkiLCJwYXJlbnRzIiwiaW5jbHVkZXMiLCJwdXNoIiwiY3VycmVudCIsInVwZGF0ZSIsIiRzZXQiLCIkYWRkVG9TZXQiLCJzeW5jSW5zRmllbGRzIiwic3luY1ZhbHVlcyIsImZpZWxkX21hcF9iYWNrIiwidmFsdWVzIiwiaW5zIiwib2JqZWN0SW5mbyIsImZpZWxkX21hcF9iYWNrX3NjcmlwdCIsInJlY29yZCIsIm9iaiIsInRhYmxlRmllbGRDb2RlcyIsInRhYmxlRmllbGRNYXAiLCJ0YWJsZVRvUmVsYXRlZE1hcCIsImZvcm0iLCJmaW5kT25lIiwiZm9ybUZpZWxkcyIsImZvcm1fdmVyc2lvbiIsImZpZWxkcyIsImZvcm1WZXJzaW9uIiwiaGlzdG9yeXMiLCJoIiwib2JqZWN0RmllbGRzIiwib2JqZWN0RmllbGRLZXlzIiwia2V5cyIsInJlbGF0ZWRPYmplY3RzIiwiZ2V0UmVsYXRlZE9iamVjdHMiLCJyZWxhdGVkT2JqZWN0c0tleXMiLCJwbHVjayIsImZvcm1UYWJsZUZpZWxkcyIsImZpbHRlciIsImZvcm1GaWVsZCIsImZvcm1UYWJsZUZpZWxkc0NvZGUiLCJnZXRSZWxhdGVkT2JqZWN0RmllbGQiLCJrZXkiLCJyZWxhdGVkT2JqZWN0c0tleSIsInN0YXJ0c1dpdGgiLCJnZXRGb3JtVGFibGVGaWVsZCIsImZvcm1UYWJsZUZpZWxkQ29kZSIsImdldEZvcm1GaWVsZCIsIl9mb3JtRmllbGRzIiwiX2ZpZWxkQ29kZSIsImVhY2giLCJmZiIsImNvZGUiLCJmbSIsInJlbGF0ZWRPYmplY3RGaWVsZCIsIm9iamVjdF9maWVsZCIsImZvcm1UYWJsZUZpZWxkIiwid29ya2Zsb3dfZmllbGQiLCJvVGFibGVDb2RlIiwic3BsaXQiLCJvVGFibGVGaWVsZENvZGUiLCJ0YWJsZVRvUmVsYXRlZE1hcEtleSIsIndUYWJsZUNvZGUiLCJpbmRleE9mIiwiaGFzT3duUHJvcGVydHkiLCJpc0FycmF5IiwiSlNPTiIsInN0cmluZ2lmeSIsIndvcmtmbG93X3RhYmxlX2ZpZWxkX2NvZGUiLCJvYmplY3RfdGFibGVfZmllbGRfY29kZSIsIndGaWVsZCIsIm9GaWVsZCIsImlzX211bHRpc2VsZWN0IiwibXVsdGlwbGUiLCJyZWZlcmVuY2VfdG8iLCJpc1N0cmluZyIsIm9Db2xsZWN0aW9uIiwicmVmZXJPYmplY3QiLCJnZXRPYmplY3QiLCJyZWZlckRhdGEiLCJuYW1lRmllbGRLZXkiLCJOQU1FX0ZJRUxEX0tFWSIsInNlbGVjdG9yIiwidG1wX2ZpZWxkX3ZhbHVlIiwiY29tcGFjdCIsImlzRW1wdHkiLCJ0ZW1PYmpGaWVsZHMiLCJsZW5ndGgiLCJvYmpGaWVsZCIsInJlZmVyT2JqRmllbGQiLCJyZWZlclNldE9iaiIsImluc0ZpZWxkIiwidW5pcSIsInRmYyIsImMiLCJwYXJzZSIsInRyIiwibmV3VHIiLCJ2IiwiayIsInRmbSIsIm9UZENvZGUiLCJyZWxhdGVkT2JqcyIsImdldFJlbGF0ZWRGaWVsZFZhbHVlIiwidmFsdWVLZXkiLCJyZWR1Y2UiLCJ4IiwibWFwIiwidGFibGVDb2RlIiwiX0ZST01fVEFCTEVfQ09ERSIsIndhcm4iLCJyZWxhdGVkT2JqZWN0TmFtZSIsInJlbGF0ZWRPYmplY3RWYWx1ZXMiLCJyZWxhdGVkT2JqZWN0IiwidGFibGVWYWx1ZUl0ZW0iLCJyZWxhdGVkT2JqZWN0VmFsdWUiLCJmaWVsZEtleSIsInJlbGF0ZWRPYmplY3RGaWVsZFZhbHVlIiwiZm9ybUZpZWxkS2V5IiwiX2NvZGUiLCJldmFsRmllbGRNYXBCYWNrU2NyaXB0IiwiZmlsdGVyT2JqIiwibWFpbk9iamVjdFZhbHVlIiwicmVsYXRlZE9iamVjdHNWYWx1ZSIsInNjcmlwdCIsImZ1bmMiLCJpc09iamVjdCIsInN5bmNSZWxhdGVkT2JqZWN0c1ZhbHVlIiwibWFpblJlY29yZElkIiwib2JqZWN0Q29sbGVjdGlvbiIsInRhYmxlTWFwIiwidGFibGVfaWQiLCJfdGFibGUiLCJ0YWJsZV9jb2RlIiwib2xkUmVsYXRlZFJlY29yZCIsImZvcmVpZ25fa2V5IiwiYXBwbGljYW50IiwiaW5zdGFuY2Vfc3RhdGUiLCJzdGF0ZSIsImZpbmFsX2RlY2lzaW9uIiwidmFsaWRhdGUiLCJ0YWJsZUlkcyIsInJlbW92ZSIsIiRuaW4iLCJzZW5kRG9jIiwiaW5zdGFuY2VfaWQiLCJyZWNvcmRzIiwiZmxvdyIsIm93IiwiZmxvd19pZCIsIiRpbiIsInNldE9iaiIsImxvY2tlZCIsInN0YWNrIiwibmV3T2JqIiwiciIsIiRwdXNoIiwicmVjb3JkX2lkcyIsIiRwdWxsIiwiX3F1ZXJ5U2VuZCIsInNlcnZlclNlbmQiLCJpc1NlbmRpbmdEb2MiLCJzZW5kSW50ZXJ2YWwiLCJfZW5zdXJlSW5kZXgiLCJub3ciLCJ0aW1lb3V0QXQiLCJyZXNlcnZlZCIsIiRsdCIsInJlc3VsdCIsImtlZXBEb2NzIiwic2VudEF0IiwiYmF0Y2hTaXplIiwic2VuZEJhdGNoU2l6ZSIsInBlbmRpbmdEb2NzIiwiJGFuZCIsImVyck1zZyIsIiRleGlzdHMiLCJzb3J0IiwibGltaXQiLCJzdGFydHVwIiwicmVmIiwic2V0dGluZ3MiLCJjcm9uIiwiaW5zdGFuY2VyZWNvcmRxdWV1ZV9pbnRlcnZhbCIsImNoZWNrTnBtVmVyc2lvbnMiLCJtb2R1bGUiLCJsaW5rIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLG1CQUFtQixHQUFHLElBQUlDLFVBQUosRUFBdEIsQzs7Ozs7Ozs7Ozs7QUNBQUQsbUJBQW1CLENBQUNFLFVBQXBCLEdBQWlDQyxFQUFFLENBQUNDLHFCQUFILEdBQTJCLElBQUlDLEtBQUssQ0FBQ0MsVUFBVixDQUFxQix1QkFBckIsQ0FBNUQ7O0FBRUEsSUFBSUMsaUJBQWlCLEdBQUcsVUFBU0MsR0FBVCxFQUFjO0FBRXJDQyxPQUFLLENBQUNELEdBQUQsRUFBTTtBQUNWRSxRQUFJLEVBQUVDLE1BREk7QUFFVkMsUUFBSSxFQUFFQyxLQUFLLENBQUNDLFFBQU4sQ0FBZUMsT0FBZixDQUZJO0FBR1ZDLFdBQU8sRUFBRUgsS0FBSyxDQUFDQyxRQUFOLENBQWVELEtBQUssQ0FBQ0ksT0FBckIsQ0FIQztBQUlWQyxhQUFTLEVBQUVDLElBSkQ7QUFLVkMsYUFBUyxFQUFFUCxLQUFLLENBQUNRLEtBQU4sQ0FBWUMsTUFBWixFQUFvQixJQUFwQjtBQUxELEdBQU4sQ0FBTDtBQVFBLENBVkQ7O0FBWUF0QixtQkFBbUIsQ0FBQ3VCLElBQXBCLEdBQTJCLFVBQVNDLE9BQVQsRUFBa0I7QUFDNUMsTUFBSUMsV0FBVyxHQUFHQyxNQUFNLENBQUNDLFFBQVAsSUFBbUJELE1BQU0sQ0FBQ0UsTUFBMUIsSUFBb0NGLE1BQU0sQ0FBQ0UsTUFBUCxFQUFwQyxJQUF1REYsTUFBTSxDQUFDRyxRQUFQLEtBQW9CTCxPQUFPLENBQUNKLFNBQVIsSUFBcUIsVUFBekMsQ0FBdkQsSUFBK0csSUFBakk7O0FBQ0EsTUFBSVosR0FBRyxHQUFHc0IsQ0FBQyxDQUFDQyxNQUFGLENBQVM7QUFDbEJiLGFBQVMsRUFBRSxJQUFJQyxJQUFKLEVBRE87QUFF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UixvQkFBb0IrQyxTQUFwQixDQUNDO0FBQUE4TSxvQkFBY25PLE9BQU9zUCxRQUFQLENBQWdCQyxJQUFoQixDQUFxQkMsNEJBQW5DO0FBQ0FYLHFCQUFlLEVBRGY7QUFFQUgsZ0JBQVU7QUFGVixLQURELENDQ0U7QUFLRDtBRFJILEc7Ozs7Ozs7Ozs7O0FFQUEsSUFBSWUsZ0JBQUo7QUFBcUJDLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZLG9DQUFaLEVBQWlEO0FBQUNGLGtCQUFnQixDQUFDdEYsQ0FBRCxFQUFHO0FBQUNzRixvQkFBZ0IsR0FBQ3RGLENBQWpCO0FBQW1COztBQUF4QyxDQUFqRCxFQUEyRixDQUEzRjtBQUNyQnNGLGdCQUFnQixDQUFDO0FBQ2hCLFVBQVE7QUFEUSxDQUFELEVBRWIsK0JBRmEsQ0FBaEIsQyIsImZpbGUiOiIvcGFja2FnZXMvc3RlZWRvc19pbnN0YW5jZS1yZWNvcmQtcXVldWUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJJbnN0YW5jZVJlY29yZFF1ZXVlID0gbmV3IEV2ZW50U3RhdGUoKTsiLCJJbnN0YW5jZVJlY29yZFF1ZXVlLmNvbGxlY3Rpb24gPSBkYi5pbnN0YW5jZV9yZWNvcmRfcXVldWUgPSBuZXcgTW9uZ28uQ29sbGVjdGlvbignaW5zdGFuY2VfcmVjb3JkX3F1ZXVlJyk7XG5cbnZhciBfdmFsaWRhdGVEb2N1bWVudCA9IGZ1bmN0aW9uKGRvYykge1xuXG5cdGNoZWNrKGRvYywge1xuXHRcdGluZm86IE9iamVjdCxcblx0XHRzZW50OiBNYXRjaC5PcHRpb25hbChCb29sZWFuKSxcblx0XHRzZW5kaW5nOiBNYXRjaC5PcHRpb25hbChNYXRjaC5JbnRlZ2VyKSxcblx0XHRjcmVhdGVkQXQ6IERhdGUsXG5cdFx0Y3JlYXRlZEJ5OiBNYXRjaC5PbmVPZihTdHJpbmcsIG51bGwpXG5cdH0pO1xuXG59O1xuXG5JbnN0YW5jZVJlY29yZFF1ZXVlLnNlbmQgPSBmdW5jdGlvbihvcHRpb25zKSB7XG5cdHZhciBjdXJyZW50VXNlciA9IE1ldGVvci5pc0NsaWVudCAmJiBNZXRlb3IudXNlcklkICYmIE1ldGVvci51c2VySWQoKSB8fCBNZXRlb3IuaXNTZXJ2ZXIgJiYgKG9wdGlvbnMuY3JlYXRlZEJ5IHx8ICc8U0VSVkVSPicpIHx8IG51bGxcblx0dmFyIGRvYyA9IF8uZXh0ZW5kKHtcblx0XHRjcmVhdGVkQXQ6IG5ldyBEYXRlKCksXG5cdFx0Y3JlYXRlZEJ5OiBjdXJyZW50VXNlclxuXHR9KTtcblxuXHRpZiAoTWF0Y2gudGVzdChvcHRpb25zLCBPYmplY3QpKSB7XG5cdFx0ZG9jLmluZm8gPSBfLnBpY2sob3B0aW9ucywgJ2luc3RhbmNlX2lkJywgJ3JlY29yZHMnLCAnc3luY19kYXRlJywgJ2luc3RhbmNlX2ZpbmlzaF9kYXRlJywgJ3N0ZXBfbmFtZScpO1xuXHR9XG5cblx0ZG9jLnNlbnQgPSBmYWxzZTtcblx0ZG9jLnNlbmRpbmcgPSAwO1xuXG5cdF92YWxpZGF0ZURvY3VtZW50KGRvYyk7XG5cblx0cmV0dXJuIEluc3RhbmNlUmVjb3JkUXVldWUuY29sbGVjdGlvbi5pbnNlcnQoZG9jKTtcbn07IiwidmFyIF9ldmFsID0gcmVxdWlyZSgnZXZhbCcpO1xudmFyIGlzQ29uZmlndXJlZCA9IGZhbHNlO1xudmFyIHNlbmRXb3JrZXIgPSBmdW5jdGlvbiAodGFzaywgaW50ZXJ2YWwpIHtcblxuXHRpZiAoSW5zdGFuY2VSZWNvcmRRdWV1ZS5kZWJ1Zykge1xuXHRcdGNvbnNvbGUubG9nKCdJbnN0YW5jZVJlY29yZFF1ZXVlOiBTZW5kIHdvcmtlciBzdGFydGVkLCB1c2luZyBpbnRlcnZhbDogJyArIGludGVydmFsKTtcblx0fVxuXG5cdHJldHVybiBNZXRlb3Iuc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xuXHRcdHRyeSB7XG5cdFx0XHR0YXNrKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJbnN0YW5jZVJlY29yZFF1ZXVlOiBFcnJvciB3aGlsZSBzZW5kaW5nOiAnICsgZXJyb3IubWVzc2FnZSk7XG5cdFx0fVxuXHR9LCBpbnRlcnZhbCk7XG59O1xuXG4vKlxuXHRvcHRpb25zOiB7XG5cdFx0Ly8gQ29udHJvbHMgdGhlIHNlbmRpbmcgaW50ZXJ2YWxcblx0XHRzZW5kSW50ZXJ2YWw6IE1hdGNoLk9wdGlvbmFsKE51bWJlciksXG5cdFx0Ly8gQ29udHJvbHMgdGhlIHNlbmRpbmcgYmF0Y2ggc2l6ZSBwZXIgaW50ZXJ2YWxcblx0XHRzZW5kQmF0Y2hTaXplOiBNYXRjaC5PcHRpb25hbChOdW1iZXIpLFxuXHRcdC8vIEFsbG93IG9wdGlvbmFsIGtlZXBpbmcgbm90aWZpY2F0aW9ucyBpbiBjb2xsZWN0aW9uXG5cdFx0a2VlcERvY3M6IE1hdGNoLk9wdGlvbmFsKEJvb2xlYW4pXG5cdH1cbiovXG5JbnN0YW5jZVJlY29yZFF1ZXVlLkNvbmZpZ3VyZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0b3B0aW9ucyA9IF8uZXh0ZW5kKHtcblx0XHRzZW5kVGltZW91dDogNjAwMDAsIC8vIFRpbWVvdXQgcGVyaW9kXG5cdH0sIG9wdGlvbnMpO1xuXG5cdC8vIEJsb2NrIG11bHRpcGxlIGNhbGxzXG5cdGlmIChpc0NvbmZpZ3VyZWQpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0luc3RhbmNlUmVjb3JkUXVldWUuQ29uZmlndXJlIHNob3VsZCBub3QgYmUgY2FsbGVkIG1vcmUgdGhhbiBvbmNlIScpO1xuXHR9XG5cblx0aXNDb25maWd1cmVkID0gdHJ1ZTtcblxuXHQvLyBBZGQgZGVidWcgaW5mb1xuXHRpZiAoSW5zdGFuY2VSZWNvcmRRdWV1ZS5kZWJ1Zykge1xuXHRcdGNvbnNvbGUubG9nKCdJbnN0YW5jZVJlY29yZFF1ZXVlLkNvbmZpZ3VyZScsIG9wdGlvbnMpO1xuXHR9XG5cblx0c2VsZi5zeW5jQXR0YWNoID0gZnVuY3Rpb24gKHN5bmNfYXR0YWNobWVudCwgaW5zSWQsIHNwYWNlSWQsIG5ld1JlY29yZElkLCBvYmplY3ROYW1lKSB7XG5cdFx0aWYgKHN5bmNfYXR0YWNobWVudCA9PSBcImxhc3Rlc3RcIikge1xuXHRcdFx0Y2ZzLmluc3RhbmNlcy5maW5kKHtcblx0XHRcdFx0J21ldGFkYXRhLmluc3RhbmNlJzogaW5zSWQsXG5cdFx0XHRcdCdtZXRhZGF0YS5jdXJyZW50JzogdHJ1ZVxuXHRcdFx0fSkuZm9yRWFjaChmdW5jdGlvbiAoZikge1xuXHRcdFx0XHR2YXIgbmV3RmlsZSA9IG5ldyBGUy5GaWxlKCksXG5cdFx0XHRcdFx0Y21zRmlsZUlkID0gQ3JlYXRvci5nZXRDb2xsZWN0aW9uKCdjbXNfZmlsZXMnKS5fbWFrZU5ld0lEKCk7XG5cblx0XHRcdFx0bmV3RmlsZS5hdHRhY2hEYXRhKGYuY3JlYXRlUmVhZFN0cmVhbSgnaW5zdGFuY2VzJyksIHtcblx0XHRcdFx0XHR0eXBlOiBmLm9yaWdpbmFsLnR5cGVcblx0XHRcdFx0fSwgZnVuY3Rpb24gKGVycikge1xuXHRcdFx0XHRcdGlmIChlcnIpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBNZXRlb3IuRXJyb3IoZXJyLmVycm9yLCBlcnIucmVhc29uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bmV3RmlsZS5uYW1lKGYubmFtZSgpKTtcblx0XHRcdFx0XHRuZXdGaWxlLnNpemUoZi5zaXplKCkpO1xuXHRcdFx0XHRcdHZhciBtZXRhZGF0YSA9IHtcblx0XHRcdFx0XHRcdG93bmVyOiBmLm1ldGFkYXRhLm93bmVyLFxuXHRcdFx0XHRcdFx0b3duZXJfbmFtZTogZi5tZXRhZGF0YS5vd25lcl9uYW1lLFxuXHRcdFx0XHRcdFx0c3BhY2U6IHNwYWNlSWQsXG5cdFx0XHRcdFx0XHRyZWNvcmRfaWQ6IG5ld1JlY29yZElkLFxuXHRcdFx0XHRcdFx0b2JqZWN0X25hbWU6IG9iamVjdE5hbWUsXG5cdFx0XHRcdFx0XHRwYXJlbnQ6IGNtc0ZpbGVJZFxuXHRcdFx0XHRcdH07XG5cblx0XHRcdFx0XHRuZXdGaWxlLm1ldGFkYXRhID0gbWV0YWRhdGE7XG5cdFx0XHRcdFx0dmFyIGZpbGVPYmogPSBjZnMuZmlsZXMuaW5zZXJ0KG5ld0ZpbGUpO1xuXHRcdFx0XHRcdGlmIChmaWxlT2JqKSB7XG5cdFx0XHRcdFx0XHRDcmVhdG9yLmdldENvbGxlY3Rpb24oJ2Ntc19maWxlcycpLmluc2VydCh7XG5cdFx0XHRcdFx0XHRcdF9pZDogY21zRmlsZUlkLFxuXHRcdFx0XHRcdFx0XHRwYXJlbnQ6IHtcblx0XHRcdFx0XHRcdFx0XHRvOiBvYmplY3ROYW1lLFxuXHRcdFx0XHRcdFx0XHRcdGlkczogW25ld1JlY29yZElkXVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRzaXplOiBmaWxlT2JqLnNpemUoKSxcblx0XHRcdFx0XHRcdFx0bmFtZTogZmlsZU9iai5uYW1lKCksXG5cdFx0XHRcdFx0XHRcdGV4dGVudGlvbjogZmlsZU9iai5leHRlbnNpb24oKSxcblx0XHRcdFx0XHRcdFx0c3BhY2U6IHNwYWNlSWQsXG5cdFx0XHRcdFx0XHRcdHZlcnNpb25zOiBbZmlsZU9iai5faWRdLFxuXHRcdFx0XHRcdFx0XHRvd25lcjogZi5tZXRhZGF0YS5vd25lcixcblx0XHRcdFx0XHRcdFx0Y3JlYXRlZF9ieTogZi5tZXRhZGF0YS5vd25lcixcblx0XHRcdFx0XHRcdFx0bW9kaWZpZWRfYnk6IGYubWV0YWRhdGEub3duZXJcblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KVxuXHRcdFx0fSlcblx0XHR9IGVsc2UgaWYgKHN5bmNfYXR0YWNobWVudCA9PSBcImFsbFwiKSB7XG5cdFx0XHR2YXIgcGFyZW50cyA9IFtdO1xuXHRcdFx0Y2ZzLmluc3RhbmNlcy5maW5kKHtcblx0XHRcdFx0J21ldGFkYXRhLmluc3RhbmNlJzogaW5zSWRcblx0XHRcdH0pLmZvckVhY2goZnVuY3Rpb24gKGYpIHtcblx0XHRcdFx0dmFyIG5ld0ZpbGUgPSBuZXcgRlMuRmlsZSgpLFxuXHRcdFx0XHRcdGNtc0ZpbGVJZCA9IGYubWV0YWRhdGEucGFyZW50O1xuXG5cdFx0XHRcdGlmICghcGFyZW50cy5pbmNsdWRlcyhjbXNGaWxlSWQpKSB7XG5cdFx0XHRcdFx0cGFyZW50cy5wdXNoKGNtc0ZpbGVJZCk7XG5cdFx0XHRcdFx0Q3JlYXRvci5nZXRDb2xsZWN0aW9uKCdjbXNfZmlsZXMnKS5pbnNlcnQoe1xuXHRcdFx0XHRcdFx0X2lkOiBjbXNGaWxlSWQsXG5cdFx0XHRcdFx0XHRwYXJlbnQ6IHtcblx0XHRcdFx0XHRcdFx0bzogb2JqZWN0TmFtZSxcblx0XHRcdFx0XHRcdFx0aWRzOiBbbmV3UmVjb3JkSWRdXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0c3BhY2U6IHNwYWNlSWQsXG5cdFx0XHRcdFx0XHR2ZXJzaW9uczogW10sXG5cdFx0XHRcdFx0XHRvd25lcjogZi5tZXRhZGF0YS5vd25lcixcblx0XHRcdFx0XHRcdGNyZWF0ZWRfYnk6IGYubWV0YWRhdGEub3duZXIsXG5cdFx0XHRcdFx0XHRtb2RpZmllZF9ieTogZi5tZXRhZGF0YS5vd25lclxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRuZXdGaWxlLmF0dGFjaERhdGEoZi5jcmVhdGVSZWFkU3RyZWFtKCdpbnN0YW5jZXMnKSwge1xuXHRcdFx0XHRcdHR5cGU6IGYub3JpZ2luYWwudHlwZVxuXHRcdFx0XHR9LCBmdW5jdGlvbiAoZXJyKSB7XG5cdFx0XHRcdFx0aWYgKGVycikge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IE1ldGVvci5FcnJvcihlcnIuZXJyb3IsIGVyci5yZWFzb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRuZXdGaWxlLm5hbWUoZi5uYW1lKCkpO1xuXHRcdFx0XHRcdG5ld0ZpbGUuc2l6ZShmLnNpemUoKSk7XG5cdFx0XHRcdFx0dmFyIG1ldGFkYXRhID0ge1xuXHRcdFx0XHRcdFx0b3duZXI6IGYubWV0YWRhdGEub3duZXIsXG5cdFx0XHRcdFx0XHRvd25lcl9uYW1lOiBmLm1ldGFkYXRhLm93bmVyX25hbWUsXG5cdFx0XHRcdFx0XHRzcGFjZTogc3BhY2VJZCxcblx0XHRcdFx0XHRcdHJlY29yZF9pZDogbmV3UmVjb3JkSWQsXG5cdFx0XHRcdFx0XHRvYmplY3RfbmFtZTogb2JqZWN0TmFtZSxcblx0XHRcdFx0XHRcdHBhcmVudDogY21zRmlsZUlkXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdG5ld0ZpbGUubWV0YWRhdGEgPSBtZXRhZGF0YTtcblx0XHRcdFx0XHR2YXIgZmlsZU9iaiA9IGNmcy5maWxlcy5pbnNlcnQobmV3RmlsZSk7XG5cdFx0XHRcdFx0aWYgKGZpbGVPYmopIHtcblxuXHRcdFx0XHRcdFx0aWYgKGYubWV0YWRhdGEuY3VycmVudCA9PSB0cnVlKSB7XG5cdFx0XHRcdFx0XHRcdENyZWF0b3IuZ2V0Q29sbGVjdGlvbignY21zX2ZpbGVzJykudXBkYXRlKGNtc0ZpbGVJZCwge1xuXHRcdFx0XHRcdFx0XHRcdCRzZXQ6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHNpemU6IGZpbGVPYmouc2l6ZSgpLFxuXHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogZmlsZU9iai5uYW1lKCksXG5cdFx0XHRcdFx0XHRcdFx0XHRleHRlbnRpb246IGZpbGVPYmouZXh0ZW5zaW9uKCksXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHQkYWRkVG9TZXQ6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHZlcnNpb25zOiBmaWxlT2JqLl9pZFxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdENyZWF0b3IuZ2V0Q29sbGVjdGlvbignY21zX2ZpbGVzJykudXBkYXRlKGNtc0ZpbGVJZCwge1xuXHRcdFx0XHRcdFx0XHRcdCRhZGRUb1NldDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmVyc2lvbnM6IGZpbGVPYmouX2lkXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSlcblx0XHRcdH0pXG5cdFx0fVxuXHR9XG5cblx0c2VsZi5zeW5jSW5zRmllbGRzID0gWyduYW1lJywgJ3N1Ym1pdHRlcl9uYW1lJywgJ2FwcGxpY2FudF9uYW1lJywgJ2FwcGxpY2FudF9vcmdhbml6YXRpb25fbmFtZScsICdhcHBsaWNhbnRfb3JnYW5pemF0aW9uX2Z1bGxuYW1lJywgJ3N0YXRlJyxcblx0XHQnY3VycmVudF9zdGVwX25hbWUnLCAnZmxvd19uYW1lJywgJ2NhdGVnb3J5X25hbWUnLCAnc3VibWl0X2RhdGUnLCAnZmluaXNoX2RhdGUnLCAnZmluYWxfZGVjaXNpb24nLCAnYXBwbGljYW50X29yZ2FuaXphdGlvbicsICdhcHBsaWNhbnRfY29tcGFueSdcblx0XTtcblx0c2VsZi5zeW5jVmFsdWVzID0gZnVuY3Rpb24gKGZpZWxkX21hcF9iYWNrLCB2YWx1ZXMsIGlucywgb2JqZWN0SW5mbywgZmllbGRfbWFwX2JhY2tfc2NyaXB0LCByZWNvcmQpIHtcblx0XHR2YXJcblx0XHRcdG9iaiA9IHt9LFxuXHRcdFx0dGFibGVGaWVsZENvZGVzID0gW10sXG5cdFx0XHR0YWJsZUZpZWxkTWFwID0gW107XG5cdFx0XHR0YWJsZVRvUmVsYXRlZE1hcCA9IHt9O1xuXG5cdFx0ZmllbGRfbWFwX2JhY2sgPSBmaWVsZF9tYXBfYmFjayB8fCBbXTtcblxuXHRcdHZhciBzcGFjZUlkID0gaW5zLnNwYWNlO1xuXG5cdFx0dmFyIGZvcm0gPSBDcmVhdG9yLmdldENvbGxlY3Rpb24oXCJmb3Jtc1wiKS5maW5kT25lKGlucy5mb3JtKTtcblx0XHR2YXIgZm9ybUZpZWxkcyA9IG51bGw7XG5cdFx0aWYgKGZvcm0uY3VycmVudC5faWQgPT09IGlucy5mb3JtX3ZlcnNpb24pIHtcblx0XHRcdGZvcm1GaWVsZHMgPSBmb3JtLmN1cnJlbnQuZmllbGRzIHx8IFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR2YXIgZm9ybVZlcnNpb24gPSBfLmZpbmQoZm9ybS5oaXN0b3J5cywgZnVuY3Rpb24gKGgpIHtcblx0XHRcdFx0cmV0dXJuIGguX2lkID09PSBpbnMuZm9ybV92ZXJzaW9uO1xuXHRcdFx0fSlcblx0XHRcdGZvcm1GaWVsZHMgPSBmb3JtVmVyc2lvbiA/IGZvcm1WZXJzaW9uLmZpZWxkcyA6IFtdO1xuXHRcdH1cblxuXHRcdHZhciBvYmplY3RGaWVsZHMgPSBvYmplY3RJbmZvLmZpZWxkcztcblx0XHR2YXIgb2JqZWN0RmllbGRLZXlzID0gXy5rZXlzKG9iamVjdEZpZWxkcyk7XG5cdFx0dmFyIHJlbGF0ZWRPYmplY3RzID0gQ3JlYXRvci5nZXRSZWxhdGVkT2JqZWN0cyhvYmplY3RJbmZvLm5hbWUsc3BhY2VJZCk7XG5cdFx0dmFyIHJlbGF0ZWRPYmplY3RzS2V5cyA9IF8ucGx1Y2socmVsYXRlZE9iamVjdHMsICdvYmplY3RfbmFtZScpO1xuXHRcdHZhciBmb3JtVGFibGVGaWVsZHMgPSBfLmZpbHRlcihmb3JtRmllbGRzLCBmdW5jdGlvbihmb3JtRmllbGQpe1xuXHRcdFx0cmV0dXJuIGZvcm1GaWVsZC50eXBlID09PSAndGFibGUnXG5cdFx0fSk7XG5cdFx0dmFyIGZvcm1UYWJsZUZpZWxkc0NvZGUgPSAgXy5wbHVjayhmb3JtVGFibGVGaWVsZHMsICdjb2RlJyk7XG5cblx0XHR2YXIgZ2V0UmVsYXRlZE9iamVjdEZpZWxkID0gZnVuY3Rpb24oa2V5KXtcblx0XHRcdHJldHVybiBfLmZpbmQocmVsYXRlZE9iamVjdHNLZXlzLCBmdW5jdGlvbihyZWxhdGVkT2JqZWN0c0tleSl7XG5cdFx0XHRcdHJldHVybiBrZXkuc3RhcnRzV2l0aChyZWxhdGVkT2JqZWN0c0tleSArICcuJyk7XG5cdFx0XHR9KVxuXHRcdH07XG5cblx0XHR2YXIgZ2V0Rm9ybVRhYmxlRmllbGQgPSBmdW5jdGlvbiAoa2V5KSB7XG5cdFx0XHRyZXR1cm4gXy5maW5kKGZvcm1UYWJsZUZpZWxkc0NvZGUsIGZ1bmN0aW9uKGZvcm1UYWJsZUZpZWxkQ29kZSl7XG5cdFx0XHRcdHJldHVybiBrZXkuc3RhcnRzV2l0aChmb3JtVGFibGVGaWVsZENvZGUgKyAnLicpO1xuXHRcdFx0fSlcblx0XHR9O1xuXG5cdFx0dmFyIGdldEZvcm1GaWVsZCA9IGZ1bmN0aW9uKF9mb3JtRmllbGRzLCBfZmllbGRDb2RlKXtcblx0XHRcdHZhciBmb3JtRmllbGQgPSBudWxsO1xuXHRcdFx0Xy5lYWNoKF9mb3JtRmllbGRzLCBmdW5jdGlvbiAoZmYpIHtcblx0XHRcdFx0aWYgKCFmb3JtRmllbGQpIHtcblx0XHRcdFx0XHRpZiAoZmYuY29kZSA9PT0gX2ZpZWxkQ29kZSkge1xuXHRcdFx0XHRcdFx0Zm9ybUZpZWxkID0gZmY7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChmZi50eXBlID09PSAnc2VjdGlvbicpIHtcblx0XHRcdFx0XHRcdF8uZWFjaChmZi5maWVsZHMsIGZ1bmN0aW9uIChmKSB7XG5cdFx0XHRcdFx0XHRcdGlmICghZm9ybUZpZWxkKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGYuY29kZSA9PT0gX2ZpZWxkQ29kZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Zm9ybUZpZWxkID0gZjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0fWVsc2UgaWYgKGZmLnR5cGUgPT09ICd0YWJsZScpIHtcblx0XHRcdFx0XHRcdF8uZWFjaChmZi5maWVsZHMsIGZ1bmN0aW9uIChmKSB7XG5cdFx0XHRcdFx0XHRcdGlmICghZm9ybUZpZWxkKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGYuY29kZSA9PT0gX2ZpZWxkQ29kZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Zm9ybUZpZWxkID0gZjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBmb3JtRmllbGQ7XG5cdFx0fVxuXG5cdFx0ZmllbGRfbWFwX2JhY2suZm9yRWFjaChmdW5jdGlvbiAoZm0pIHtcblx0XHRcdC8vd29ya2Zsb3cg55qE5a2Q6KGo5YiwY3JlYXRvciBvYmplY3Qg55qE55u45YWz5a+56LGhXG5cdFx0XHR2YXIgcmVsYXRlZE9iamVjdEZpZWxkID0gZ2V0UmVsYXRlZE9iamVjdEZpZWxkKGZtLm9iamVjdF9maWVsZCk7XG5cdFx0XHR2YXIgZm9ybVRhYmxlRmllbGQgPSBnZXRGb3JtVGFibGVGaWVsZChmbS53b3JrZmxvd19maWVsZCk7XG5cdFx0XHRpZiAocmVsYXRlZE9iamVjdEZpZWxkKXtcblx0XHRcdFx0dmFyIG9UYWJsZUNvZGUgPSBmbS5vYmplY3RfZmllbGQuc3BsaXQoJy4nKVswXTtcblx0XHRcdFx0dmFyIG9UYWJsZUZpZWxkQ29kZSA9IGZtLm9iamVjdF9maWVsZC5zcGxpdCgnLicpWzFdO1xuXHRcdFx0XHR2YXIgdGFibGVUb1JlbGF0ZWRNYXBLZXkgPSBvVGFibGVDb2RlO1xuXHRcdFx0XHRpZighdGFibGVUb1JlbGF0ZWRNYXBbdGFibGVUb1JlbGF0ZWRNYXBLZXldKXtcblx0XHRcdFx0XHR0YWJsZVRvUmVsYXRlZE1hcFt0YWJsZVRvUmVsYXRlZE1hcEtleV0gPSB7fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYoZm9ybVRhYmxlRmllbGQpe1xuXHRcdFx0XHRcdHZhciB3VGFibGVDb2RlID0gZm0ud29ya2Zsb3dfZmllbGQuc3BsaXQoJy4nKVswXTtcblx0XHRcdFx0XHR0YWJsZVRvUmVsYXRlZE1hcFt0YWJsZVRvUmVsYXRlZE1hcEtleV1bJ19GUk9NX1RBQkxFX0NPREUnXSA9IHdUYWJsZUNvZGVcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRhYmxlVG9SZWxhdGVkTWFwW3RhYmxlVG9SZWxhdGVkTWFwS2V5XVtvVGFibGVGaWVsZENvZGVdID0gZm0ud29ya2Zsb3dfZmllbGRcblx0XHRcdH1cblx0XHRcdC8vIOWIpOaWreaYr+WQpuaYr+WtkOihqOWtl+autVxuXHRcdFx0ZWxzZSBpZiAoZm0ud29ya2Zsb3dfZmllbGQuaW5kZXhPZignLiQuJykgPiAwICYmIGZtLm9iamVjdF9maWVsZC5pbmRleE9mKCcuJC4nKSA+IDApIHtcblx0XHRcdFx0dmFyIHdUYWJsZUNvZGUgPSBmbS53b3JrZmxvd19maWVsZC5zcGxpdCgnLiQuJylbMF07XG5cdFx0XHRcdHZhciBvVGFibGVDb2RlID0gZm0ub2JqZWN0X2ZpZWxkLnNwbGl0KCcuJC4nKVswXTtcblx0XHRcdFx0aWYgKHZhbHVlcy5oYXNPd25Qcm9wZXJ0eSh3VGFibGVDb2RlKSAmJiBfLmlzQXJyYXkodmFsdWVzW3dUYWJsZUNvZGVdKSkge1xuXHRcdFx0XHRcdHRhYmxlRmllbGRDb2Rlcy5wdXNoKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0XHRcdHdvcmtmbG93X3RhYmxlX2ZpZWxkX2NvZGU6IHdUYWJsZUNvZGUsXG5cdFx0XHRcdFx0XHRvYmplY3RfdGFibGVfZmllbGRfY29kZTogb1RhYmxlQ29kZVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR0YWJsZUZpZWxkTWFwLnB1c2goZm0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKHZhbHVlcy5oYXNPd25Qcm9wZXJ0eShmbS53b3JrZmxvd19maWVsZCkpIHtcblx0XHRcdFx0dmFyIHdGaWVsZCA9IG51bGw7XG5cblx0XHRcdFx0Xy5lYWNoKGZvcm1GaWVsZHMsIGZ1bmN0aW9uIChmZikge1xuXHRcdFx0XHRcdGlmICghd0ZpZWxkKSB7XG5cdFx0XHRcdFx0XHRpZiAoZmYuY29kZSA9PT0gZm0ud29ya2Zsb3dfZmllbGQpIHtcblx0XHRcdFx0XHRcdFx0d0ZpZWxkID0gZmY7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGZmLnR5cGUgPT09ICdzZWN0aW9uJykge1xuXHRcdFx0XHRcdFx0XHRfLmVhY2goZmYuZmllbGRzLCBmdW5jdGlvbiAoZikge1xuXHRcdFx0XHRcdFx0XHRcdGlmICghd0ZpZWxkKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoZi5jb2RlID09PSBmbS53b3JrZmxvd19maWVsZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR3RmllbGQgPSBmO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pXG5cblx0XHRcdFx0dmFyIG9GaWVsZCA9IG9iamVjdEZpZWxkc1tmbS5vYmplY3RfZmllbGRdO1xuXG5cdFx0XHRcdGlmIChvRmllbGQpIHtcblx0XHRcdFx0XHRpZiAoIXdGaWVsZCkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ2ZtLndvcmtmbG93X2ZpZWxkOiAnLCBmbS53b3JrZmxvd19maWVsZClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8g6KGo5Y2V6YCJ5Lq66YCJ57uE5a2X5q61IOiHsyDlr7nosaEgbG9va3VwIG1hc3Rlcl9kZXRhaWznsbvlnovlrZfmrrXlkIzmraVcblx0XHRcdFx0XHRpZiAoIXdGaWVsZC5pc19tdWx0aXNlbGVjdCAmJiBbJ3VzZXInLCAnZ3JvdXAnXS5pbmNsdWRlcyh3RmllbGQudHlwZSkgJiYgIW9GaWVsZC5tdWx0aXBsZSAmJiBbJ2xvb2t1cCcsICdtYXN0ZXJfZGV0YWlsJ10uaW5jbHVkZXMob0ZpZWxkLnR5cGUpICYmIFsndXNlcnMnLCAnb3JnYW5pemF0aW9ucyddLmluY2x1ZGVzKG9GaWVsZC5yZWZlcmVuY2VfdG8pKSB7XG5cdFx0XHRcdFx0XHRvYmpbZm0ub2JqZWN0X2ZpZWxkXSA9IHZhbHVlc1tmbS53b3JrZmxvd19maWVsZF1bJ2lkJ107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2UgaWYgKCFvRmllbGQubXVsdGlwbGUgJiYgWydsb29rdXAnLCAnbWFzdGVyX2RldGFpbCddLmluY2x1ZGVzKG9GaWVsZC50eXBlKSAmJiBfLmlzU3RyaW5nKG9GaWVsZC5yZWZlcmVuY2VfdG8pICYmIF8uaXNTdHJpbmcodmFsdWVzW2ZtLndvcmtmbG93X2ZpZWxkXSkpIHtcblx0XHRcdFx0XHRcdHZhciBvQ29sbGVjdGlvbiA9IENyZWF0b3IuZ2V0Q29sbGVjdGlvbihvRmllbGQucmVmZXJlbmNlX3RvLCBzcGFjZUlkKVxuXHRcdFx0XHRcdFx0dmFyIHJlZmVyT2JqZWN0ID0gQ3JlYXRvci5nZXRPYmplY3Qob0ZpZWxkLnJlZmVyZW5jZV90bywgc3BhY2VJZClcblx0XHRcdFx0XHRcdGlmIChvQ29sbGVjdGlvbiAmJiByZWZlck9iamVjdCkge1xuXHRcdFx0XHRcdFx0XHQvLyDlhYjorqTkuLrmraTlgLzmmK9yZWZlck9iamVjdCBfaWTlrZfmrrXlgLxcblx0XHRcdFx0XHRcdFx0dmFyIHJlZmVyRGF0YSA9IG9Db2xsZWN0aW9uLmZpbmRPbmUodmFsdWVzW2ZtLndvcmtmbG93X2ZpZWxkXSwge1xuXHRcdFx0XHRcdFx0XHRcdGZpZWxkczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0X2lkOiAxXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0aWYgKHJlZmVyRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdG9ialtmbS5vYmplY3RfZmllbGRdID0gcmVmZXJEYXRhLl9pZDtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdC8vIOWFtuasoeiupOS4uuatpOWAvOaYr3JlZmVyT2JqZWN0IE5BTUVfRklFTERfS0VZ5YC8XG5cdFx0XHRcdFx0XHRcdGlmICghcmVmZXJEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIG5hbWVGaWVsZEtleSA9IHJlZmVyT2JqZWN0Lk5BTUVfRklFTERfS0VZO1xuXHRcdFx0XHRcdFx0XHRcdHZhciBzZWxlY3RvciA9IHt9O1xuXHRcdFx0XHRcdFx0XHRcdHNlbGVjdG9yW25hbWVGaWVsZEtleV0gPSB2YWx1ZXNbZm0ud29ya2Zsb3dfZmllbGRdO1xuXHRcdFx0XHRcdFx0XHRcdHJlZmVyRGF0YSA9IG9Db2xsZWN0aW9uLmZpbmRPbmUoc2VsZWN0b3IsIHtcblx0XHRcdFx0XHRcdFx0XHRcdGZpZWxkczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRfaWQ6IDFcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRpZiAocmVmZXJEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRvYmpbZm0ub2JqZWN0X2ZpZWxkXSA9IHJlZmVyRGF0YS5faWQ7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRpZiAob0ZpZWxkLnR5cGUgPT09IFwiYm9vbGVhblwiKSB7XG5cdFx0XHRcdFx0XHRcdHZhciB0bXBfZmllbGRfdmFsdWUgPSB2YWx1ZXNbZm0ud29ya2Zsb3dfZmllbGRdO1xuXHRcdFx0XHRcdFx0XHRpZiAoWyd0cnVlJywgJ+aYryddLmluY2x1ZGVzKHRtcF9maWVsZF92YWx1ZSkpIHtcblx0XHRcdFx0XHRcdFx0XHRvYmpbZm0ub2JqZWN0X2ZpZWxkXSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoWydmYWxzZScsICflkKYnXS5pbmNsdWRlcyh0bXBfZmllbGRfdmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdFx0b2JqW2ZtLm9iamVjdF9maWVsZF0gPSBmYWxzZTtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRvYmpbZm0ub2JqZWN0X2ZpZWxkXSA9IHRtcF9maWVsZF92YWx1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSBpZihbJ2xvb2t1cCcsICdtYXN0ZXJfZGV0YWlsJ10uaW5jbHVkZXMob0ZpZWxkLnR5cGUpICYmIHdGaWVsZC50eXBlID09PSAnb2RhdGEnKXtcblx0XHRcdFx0XHRcdFx0aWYob0ZpZWxkLm11bHRpcGxlICYmIHdGaWVsZC5pc19tdWx0aXNlbGVjdCl7XG5cdFx0XHRcdFx0XHRcdFx0b2JqW2ZtLm9iamVjdF9maWVsZF0gPSBfLmNvbXBhY3QoXy5wbHVjayh2YWx1ZXNbZm0ud29ya2Zsb3dfZmllbGRdLCAnX2lkJykpXG5cdFx0XHRcdFx0XHRcdH1lbHNlIGlmKCFvRmllbGQubXVsdGlwbGUgJiYgIXdGaWVsZC5pc19tdWx0aXNlbGVjdCl7XG5cdFx0XHRcdFx0XHRcdFx0aWYoIV8uaXNFbXB0eSh2YWx1ZXNbZm0ud29ya2Zsb3dfZmllbGRdKSl7XG5cdFx0XHRcdFx0XHRcdFx0XHRvYmpbZm0ub2JqZWN0X2ZpZWxkXSA9IFx0dmFsdWVzW2ZtLndvcmtmbG93X2ZpZWxkXS5faWRcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdFx0XHRcdG9ialtmbS5vYmplY3RfZmllbGRdID0gdmFsdWVzW2ZtLndvcmtmbG93X2ZpZWxkXTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0XHRcdG9ialtmbS5vYmplY3RfZmllbGRdID0gdmFsdWVzW2ZtLndvcmtmbG93X2ZpZWxkXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGZtLm9iamVjdF9maWVsZC5pbmRleE9mKCcuJykgPiAtMSkge1xuXHRcdFx0XHRcdFx0dmFyIHRlbU9iakZpZWxkcyA9IGZtLm9iamVjdF9maWVsZC5zcGxpdCgnLicpO1xuXHRcdFx0XHRcdFx0aWYgKHRlbU9iakZpZWxkcy5sZW5ndGggPT09IDIpIHtcblx0XHRcdFx0XHRcdFx0dmFyIG9iakZpZWxkID0gdGVtT2JqRmllbGRzWzBdO1xuXHRcdFx0XHRcdFx0XHR2YXIgcmVmZXJPYmpGaWVsZCA9IHRlbU9iakZpZWxkc1sxXTtcblx0XHRcdFx0XHRcdFx0dmFyIG9GaWVsZCA9IG9iamVjdEZpZWxkc1tvYmpGaWVsZF07XG5cdFx0XHRcdFx0XHRcdGlmICghb0ZpZWxkLm11bHRpcGxlICYmIFsnbG9va3VwJywgJ21hc3Rlcl9kZXRhaWwnXS5pbmNsdWRlcyhvRmllbGQudHlwZSkgJiYgXy5pc1N0cmluZyhvRmllbGQucmVmZXJlbmNlX3RvKSkge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBvQ29sbGVjdGlvbiA9IENyZWF0b3IuZ2V0Q29sbGVjdGlvbihvRmllbGQucmVmZXJlbmNlX3RvLCBzcGFjZUlkKVxuXHRcdFx0XHRcdFx0XHRcdGlmIChvQ29sbGVjdGlvbiAmJiByZWNvcmQgJiYgcmVjb3JkW29iakZpZWxkXSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIHJlZmVyU2V0T2JqID0ge307XG5cdFx0XHRcdFx0XHRcdFx0XHRyZWZlclNldE9ialtyZWZlck9iakZpZWxkXSA9IHZhbHVlc1tmbS53b3JrZmxvd19maWVsZF07XG5cdFx0XHRcdFx0XHRcdFx0XHRvQ29sbGVjdGlvbi51cGRhdGUocmVjb3JkW29iakZpZWxkXSwge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHQkc2V0OiByZWZlclNldE9ialxuXHRcdFx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly8gZWxzZXtcblx0XHRcdFx0XHQvLyBcdHZhciByZWxhdGVkT2JqZWN0ID0gXy5maW5kKHJlbGF0ZWRPYmplY3RzLCBmdW5jdGlvbihfcmVsYXRlZE9iamVjdCl7XG5cdFx0XHRcdFx0Ly8gXHRcdHJldHVybiBfcmVsYXRlZE9iamVjdC5vYmplY3RfbmFtZSA9PT0gZm0ub2JqZWN0X2ZpZWxkXG5cdFx0XHRcdFx0Ly8gXHR9KVxuXHRcdFx0XHRcdC8vXG5cdFx0XHRcdFx0Ly8gXHRpZihyZWxhdGVkT2JqZWN0KXtcblx0XHRcdFx0XHQvLyBcdFx0b2JqW2ZtLm9iamVjdF9maWVsZF0gPSB2YWx1ZXNbZm0ud29ya2Zsb3dfZmllbGRdO1xuXHRcdFx0XHRcdC8vIFx0fVxuXHRcdFx0XHRcdC8vIH1cblx0XHRcdFx0fVxuXG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0aWYgKGZtLndvcmtmbG93X2ZpZWxkLnN0YXJ0c1dpdGgoJ2luc3RhbmNlLicpKSB7XG5cdFx0XHRcdFx0dmFyIGluc0ZpZWxkID0gZm0ud29ya2Zsb3dfZmllbGQuc3BsaXQoJ2luc3RhbmNlLicpWzFdO1xuXHRcdFx0XHRcdGlmIChzZWxmLnN5bmNJbnNGaWVsZHMuaW5jbHVkZXMoaW5zRmllbGQpKSB7XG5cdFx0XHRcdFx0XHRpZiAoZm0ub2JqZWN0X2ZpZWxkLmluZGV4T2YoJy4nKSA8IDApIHtcblx0XHRcdFx0XHRcdFx0b2JqW2ZtLm9iamVjdF9maWVsZF0gPSBpbnNbaW5zRmllbGRdO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dmFyIHRlbU9iakZpZWxkcyA9IGZtLm9iamVjdF9maWVsZC5zcGxpdCgnLicpO1xuXHRcdFx0XHRcdFx0XHRpZiAodGVtT2JqRmllbGRzLmxlbmd0aCA9PT0gMikge1xuXHRcdFx0XHRcdFx0XHRcdHZhciBvYmpGaWVsZCA9IHRlbU9iakZpZWxkc1swXTtcblx0XHRcdFx0XHRcdFx0XHR2YXIgcmVmZXJPYmpGaWVsZCA9IHRlbU9iakZpZWxkc1sxXTtcblx0XHRcdFx0XHRcdFx0XHR2YXIgb0ZpZWxkID0gb2JqZWN0RmllbGRzW29iakZpZWxkXTtcblx0XHRcdFx0XHRcdFx0XHRpZiAoIW9GaWVsZC5tdWx0aXBsZSAmJiBbJ2xvb2t1cCcsICdtYXN0ZXJfZGV0YWlsJ10uaW5jbHVkZXMob0ZpZWxkLnR5cGUpICYmIF8uaXNTdHJpbmcob0ZpZWxkLnJlZmVyZW5jZV90bykpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBvQ29sbGVjdGlvbiA9IENyZWF0b3IuZ2V0Q29sbGVjdGlvbihvRmllbGQucmVmZXJlbmNlX3RvLCBzcGFjZUlkKVxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKG9Db2xsZWN0aW9uICYmIHJlY29yZCAmJiByZWNvcmRbb2JqRmllbGRdKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHZhciByZWZlclNldE9iaiA9IHt9O1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyZWZlclNldE9ialtyZWZlck9iakZpZWxkXSA9IGluc1tpbnNGaWVsZF07XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG9Db2xsZWN0aW9uLnVwZGF0ZShyZWNvcmRbb2JqRmllbGRdLCB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0JHNldDogcmVmZXJTZXRPYmpcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoaW5zW2ZtLndvcmtmbG93X2ZpZWxkXSkge1xuXHRcdFx0XHRcdFx0b2JqW2ZtLm9iamVjdF9maWVsZF0gPSBpbnNbZm0ud29ya2Zsb3dfZmllbGRdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pXG5cblx0XHRfLnVuaXEodGFibGVGaWVsZENvZGVzKS5mb3JFYWNoKGZ1bmN0aW9uICh0ZmMpIHtcblx0XHRcdHZhciBjID0gSlNPTi5wYXJzZSh0ZmMpO1xuXHRcdFx0b2JqW2Mub2JqZWN0X3RhYmxlX2ZpZWxkX2NvZGVdID0gW107XG5cdFx0XHR2YWx1ZXNbYy53b3JrZmxvd190YWJsZV9maWVsZF9jb2RlXS5mb3JFYWNoKGZ1bmN0aW9uICh0cikge1xuXHRcdFx0XHR2YXIgbmV3VHIgPSB7fTtcblx0XHRcdFx0Xy5lYWNoKHRyLCBmdW5jdGlvbiAodiwgaykge1xuXHRcdFx0XHRcdHRhYmxlRmllbGRNYXAuZm9yRWFjaChmdW5jdGlvbiAodGZtKSB7XG5cdFx0XHRcdFx0XHRpZiAodGZtLndvcmtmbG93X2ZpZWxkID09IChjLndvcmtmbG93X3RhYmxlX2ZpZWxkX2NvZGUgKyAnLiQuJyArIGspKSB7XG5cdFx0XHRcdFx0XHRcdHZhciBvVGRDb2RlID0gdGZtLm9iamVjdF9maWVsZC5zcGxpdCgnLiQuJylbMV07XG5cdFx0XHRcdFx0XHRcdG5ld1RyW29UZENvZGVdID0gdjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9KVxuXHRcdFx0XHRpZiAoIV8uaXNFbXB0eShuZXdUcikpIHtcblx0XHRcdFx0XHRvYmpbYy5vYmplY3RfdGFibGVfZmllbGRfY29kZV0ucHVzaChuZXdUcik7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0fSk7XG5cdFx0dmFyIHJlbGF0ZWRPYmpzID0ge307XG5cdFx0dmFyIGdldFJlbGF0ZWRGaWVsZFZhbHVlID0gZnVuY3Rpb24odmFsdWVLZXksIHBhcmVudCkge1xuXHRcdFx0cmV0dXJuIHZhbHVlS2V5LnNwbGl0KCcuJykucmVkdWNlKGZ1bmN0aW9uKG8sIHgpIHtcblx0XHRcdFx0cmV0dXJuIG9beF07XG5cdFx0XHR9LCBwYXJlbnQpO1xuXHRcdH07XG5cdFx0Xy5lYWNoKHRhYmxlVG9SZWxhdGVkTWFwLCBmdW5jdGlvbihtYXAsIGtleSl7XG5cdFx0XHR2YXIgdGFibGVDb2RlID0gbWFwLl9GUk9NX1RBQkxFX0NPREU7XG5cdFx0XHRpZighdGFibGVDb2RlKXtcblx0XHRcdFx0Y29uc29sZS53YXJuKCd0YWJsZVRvUmVsYXRlZDogWycgKyBrZXkgKyAnXSBtaXNzaW5nIGNvcnJlc3BvbmRpbmcgdGFibGUuJylcblx0XHRcdH1lbHNle1xuXHRcdFx0XHR2YXIgcmVsYXRlZE9iamVjdE5hbWUgPSBrZXk7XG5cdFx0XHRcdHZhciByZWxhdGVkT2JqZWN0VmFsdWVzID0gW107XG5cdFx0XHRcdHZhciByZWxhdGVkT2JqZWN0ID0gQ3JlYXRvci5nZXRPYmplY3QocmVsYXRlZE9iamVjdE5hbWUsIHNwYWNlSWQpO1xuXHRcdFx0XHRfLmVhY2godmFsdWVzW3RhYmxlQ29kZV0sIGZ1bmN0aW9uICh0YWJsZVZhbHVlSXRlbSkge1xuXHRcdFx0XHRcdHZhciByZWxhdGVkT2JqZWN0VmFsdWUgPSB7fTtcblx0XHRcdFx0XHRfLmVhY2gobWFwLCBmdW5jdGlvbih2YWx1ZUtleSwgZmllbGRLZXkpe1xuXHRcdFx0XHRcdFx0aWYoZmllbGRLZXkgIT0gJ19GUk9NX1RBQkxFX0NPREUnKXtcblx0XHRcdFx0XHRcdFx0aWYodmFsdWVLZXkuc3RhcnRzV2l0aCgnaW5zdGFuY2UuJykpe1xuXHRcdFx0XHRcdFx0XHRcdHJlbGF0ZWRPYmplY3RWYWx1ZVtmaWVsZEtleV0gPSBnZXRSZWxhdGVkRmllbGRWYWx1ZSh2YWx1ZUtleSwgeydpbnN0YW5jZSc6IGluc30pO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGVsc2V7XG5cdFx0XHRcdFx0XHRcdFx0dmFyIHJlbGF0ZWRPYmplY3RGaWVsZFZhbHVlLCBmb3JtRmllbGRLZXk7XG5cdFx0XHRcdFx0XHRcdFx0aWYodmFsdWVLZXkuc3RhcnRzV2l0aCh0YWJsZUNvZGUgKyAnLicpKXtcblx0XHRcdFx0XHRcdFx0XHRcdGZvcm1GaWVsZEtleSA9IHZhbHVlS2V5LnNwbGl0KFwiLlwiKVsxXTtcblx0XHRcdFx0XHRcdFx0XHRcdHJlbGF0ZWRPYmplY3RGaWVsZFZhbHVlID0gZ2V0UmVsYXRlZEZpZWxkVmFsdWUodmFsdWVLZXksIHtbdGFibGVDb2RlXTp0YWJsZVZhbHVlSXRlbX0pO1xuXHRcdFx0XHRcdFx0XHRcdH1lbHNle1xuXHRcdFx0XHRcdFx0XHRcdFx0Zm9ybUZpZWxkS2V5ID0gdmFsdWVLZXk7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZWxhdGVkT2JqZWN0RmllbGRWYWx1ZSA9IGdldFJlbGF0ZWRGaWVsZFZhbHVlKHZhbHVlS2V5LCB2YWx1ZXMpXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHZhciBmb3JtRmllbGQgPSBnZXRGb3JtRmllbGQoZm9ybUZpZWxkcywgZm9ybUZpZWxkS2V5KTtcblx0XHRcdFx0XHRcdFx0XHR2YXIgcmVsYXRlZE9iamVjdEZpZWxkID0gcmVsYXRlZE9iamVjdC5maWVsZHNbZmllbGRLZXldO1xuXHRcdFx0XHRcdFx0XHRcdGlmKGZvcm1GaWVsZC50eXBlID09ICdvZGF0YScgJiYgWydsb29rdXAnLCAnbWFzdGVyX2RldGFpbCddLmluY2x1ZGVzKHJlbGF0ZWRPYmplY3RGaWVsZC50eXBlKSl7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZighXy5pc0VtcHR5KHJlbGF0ZWRPYmplY3RGaWVsZFZhbHVlKSl7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGlmKHJlbGF0ZWRPYmplY3RGaWVsZC5tdWx0aXBsZSAmJiBmb3JtRmllbGQuaXNfbXVsdGlzZWxlY3Qpe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJlbGF0ZWRPYmplY3RGaWVsZFZhbHVlID0gXy5jb21wYWN0KF8ucGx1Y2socmVsYXRlZE9iamVjdEZpZWxkVmFsdWUsICdfaWQnKSlcblx0XHRcdFx0XHRcdFx0XHRcdFx0fWVsc2UgaWYoIXJlbGF0ZWRPYmplY3RGaWVsZC5tdWx0aXBsZSAmJiAhZm9ybUZpZWxkLmlzX211bHRpc2VsZWN0KXtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyZWxhdGVkT2JqZWN0RmllbGRWYWx1ZSA9IHJlbGF0ZWRPYmplY3RGaWVsZFZhbHVlLl9pZFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdHJlbGF0ZWRPYmplY3RWYWx1ZVtmaWVsZEtleV0gPSByZWxhdGVkT2JqZWN0RmllbGRWYWx1ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHJlbGF0ZWRPYmplY3RWYWx1ZVsnX3RhYmxlJ10gPSB7XG5cdFx0XHRcdFx0XHRfaWQ6IHRhYmxlVmFsdWVJdGVtW1wiX2lkXCJdLFxuXHRcdFx0XHRcdFx0X2NvZGU6IHRhYmxlQ29kZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0cmVsYXRlZE9iamVjdFZhbHVlcy5wdXNoKHJlbGF0ZWRPYmplY3RWYWx1ZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZWxhdGVkT2Jqc1tyZWxhdGVkT2JqZWN0TmFtZV0gPSByZWxhdGVkT2JqZWN0VmFsdWVzO1xuXHRcdFx0fVxuXHRcdH0pXG5cblx0XHRpZiAoZmllbGRfbWFwX2JhY2tfc2NyaXB0KSB7XG5cdFx0XHRfLmV4dGVuZChvYmosIHNlbGYuZXZhbEZpZWxkTWFwQmFja1NjcmlwdChmaWVsZF9tYXBfYmFja19zY3JpcHQsIGlucykpO1xuXHRcdH1cblx0XHQvLyDov4fmu6TmjonpnZ7ms5XnmoRrZXlcblx0XHR2YXIgZmlsdGVyT2JqID0ge307XG5cblx0XHRfLmVhY2goXy5rZXlzKG9iaiksIGZ1bmN0aW9uIChrKSB7XG5cdFx0XHRpZiAob2JqZWN0RmllbGRLZXlzLmluY2x1ZGVzKGspKSB7XG5cdFx0XHRcdGZpbHRlck9ialtrXSA9IG9ialtrXTtcblx0XHRcdH1cblx0XHRcdC8vIGVsc2UgaWYocmVsYXRlZE9iamVjdHNLZXlzLmluY2x1ZGVzKGspICYmIF8uaXNBcnJheShvYmpba10pKXtcblx0XHRcdC8vIFx0aWYoXy5pc0FycmF5KHJlbGF0ZWRPYmpzW2tdKSl7XG5cdFx0XHQvLyBcdFx0cmVsYXRlZE9ianNba10gPSByZWxhdGVkT2Jqc1trXS5jb25jYXQob2JqW2tdKVxuXHRcdFx0Ly8gXHR9ZWxzZXtcblx0XHRcdC8vIFx0XHRyZWxhdGVkT2Jqc1trXSA9IG9ialtrXVxuXHRcdFx0Ly8gXHR9XG5cdFx0XHQvLyB9XG5cdFx0fSlcblx0XHRyZXR1cm4ge1xuXHRcdFx0bWFpbk9iamVjdFZhbHVlOiBmaWx0ZXJPYmosXG5cdFx0XHRyZWxhdGVkT2JqZWN0c1ZhbHVlOiByZWxhdGVkT2Jqc1xuXHRcdH07XG5cdH1cblxuXHRzZWxmLmV2YWxGaWVsZE1hcEJhY2tTY3JpcHQgPSBmdW5jdGlvbiAoZmllbGRfbWFwX2JhY2tfc2NyaXB0LCBpbnMpIHtcblx0XHR2YXIgc2NyaXB0ID0gXCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChpbnN0YW5jZSkgeyBcIiArIGZpZWxkX21hcF9iYWNrX3NjcmlwdCArIFwiIH1cIjtcblx0XHR2YXIgZnVuYyA9IF9ldmFsKHNjcmlwdCwgXCJmaWVsZF9tYXBfc2NyaXB0XCIpO1xuXHRcdHZhciB2YWx1ZXMgPSBmdW5jKGlucyk7XG5cdFx0aWYgKF8uaXNPYmplY3QodmFsdWVzKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlcztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5lcnJvcihcImV2YWxGaWVsZE1hcEJhY2tTY3JpcHQ6IOiEmuacrOi/lOWbnuWAvOexu+Wei+S4jeaYr+WvueixoVwiKTtcblx0XHR9XG5cdFx0cmV0dXJuIHt9XG5cdH1cblxuXHRzZWxmLnN5bmNSZWxhdGVkT2JqZWN0c1ZhbHVlID0gZnVuY3Rpb24obWFpblJlY29yZElkLCByZWxhdGVkT2JqZWN0cywgcmVsYXRlZE9iamVjdHNWYWx1ZSwgc3BhY2VJZCwgaW5zKXtcblx0XHR2YXIgaW5zSWQgPSBpbnMuX2lkO1xuXG5cdFx0Xy5lYWNoKHJlbGF0ZWRPYmplY3RzLCBmdW5jdGlvbihyZWxhdGVkT2JqZWN0KXtcblx0XHRcdHZhciBvYmplY3RDb2xsZWN0aW9uID0gQ3JlYXRvci5nZXRDb2xsZWN0aW9uKHJlbGF0ZWRPYmplY3Qub2JqZWN0X25hbWUsIHNwYWNlSWQpO1xuXHRcdFx0dmFyIHRhYmxlTWFwID0ge307XG5cdFx0XHRfLmVhY2gocmVsYXRlZE9iamVjdHNWYWx1ZVtyZWxhdGVkT2JqZWN0Lm9iamVjdF9uYW1lXSwgZnVuY3Rpb24ocmVsYXRlZE9iamVjdFZhbHVlKXtcblx0XHRcdFx0dmFyIHRhYmxlX2lkID0gcmVsYXRlZE9iamVjdFZhbHVlLl90YWJsZS5faWQ7XG5cdFx0XHRcdHZhciB0YWJsZV9jb2RlID0gcmVsYXRlZE9iamVjdFZhbHVlLl90YWJsZS5fY29kZTtcblx0XHRcdFx0aWYoIXRhYmxlTWFwW3RhYmxlX2NvZGVdKXtcblx0XHRcdFx0XHR0YWJsZU1hcFt0YWJsZV9jb2RlXSA9IFtdXG5cdFx0XHRcdH07XG5cdFx0XHRcdHRhYmxlTWFwW3RhYmxlX2NvZGVdLnB1c2godGFibGVfaWQpO1xuXHRcdFx0XHR2YXIgb2xkUmVsYXRlZFJlY29yZCA9IENyZWF0b3IuZ2V0Q29sbGVjdGlvbihyZWxhdGVkT2JqZWN0Lm9iamVjdF9uYW1lLCBzcGFjZUlkKS5maW5kT25lKHtbcmVsYXRlZE9iamVjdC5mb3JlaWduX2tleV06IG1haW5SZWNvcmRJZCwgXCJpbnN0YW5jZXMuX2lkXCI6IGluc0lkLCBfdGFibGU6IHJlbGF0ZWRPYmplY3RWYWx1ZS5fdGFibGV9LCB7ZmllbGRzOiB7X2lkOjF9fSlcblx0XHRcdFx0aWYob2xkUmVsYXRlZFJlY29yZCl7XG5cdFx0XHRcdFx0Q3JlYXRvci5nZXRDb2xsZWN0aW9uKHJlbGF0ZWRPYmplY3Qub2JqZWN0X25hbWUsIHNwYWNlSWQpLnVwZGF0ZSh7X2lkOiBvbGRSZWxhdGVkUmVjb3JkLl9pZH0sIHskc2V0OiByZWxhdGVkT2JqZWN0VmFsdWV9KVxuXHRcdFx0XHR9ZWxzZXtcblx0XHRcdFx0XHRyZWxhdGVkT2JqZWN0VmFsdWVbcmVsYXRlZE9iamVjdC5mb3JlaWduX2tleV0gPSBtYWluUmVjb3JkSWQ7XG5cdFx0XHRcdFx0cmVsYXRlZE9iamVjdFZhbHVlLnNwYWNlID0gc3BhY2VJZDtcblx0XHRcdFx0XHRyZWxhdGVkT2JqZWN0VmFsdWUub3duZXIgPSBpbnMuYXBwbGljYW50O1xuXHRcdFx0XHRcdHJlbGF0ZWRPYmplY3RWYWx1ZS5jcmVhdGVkX2J5ID0gaW5zLmFwcGxpY2FudDtcblx0XHRcdFx0XHRyZWxhdGVkT2JqZWN0VmFsdWUubW9kaWZpZWRfYnkgPSBpbnMuYXBwbGljYW50O1xuXHRcdFx0XHRcdHJlbGF0ZWRPYmplY3RWYWx1ZS5faWQgPSBvYmplY3RDb2xsZWN0aW9uLl9tYWtlTmV3SUQoKTtcblx0XHRcdFx0XHR2YXIgaW5zdGFuY2Vfc3RhdGUgPSBpbnMuc3RhdGU7XG5cdFx0XHRcdFx0aWYgKGlucy5zdGF0ZSA9PT0gJ2NvbXBsZXRlZCcgJiYgaW5zLmZpbmFsX2RlY2lzaW9uKSB7XG5cdFx0XHRcdFx0XHRpbnN0YW5jZV9zdGF0ZSA9IGlucy5maW5hbF9kZWNpc2lvbjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVsYXRlZE9iamVjdFZhbHVlLmluc3RhbmNlcyA9IFt7XG5cdFx0XHRcdFx0XHRfaWQ6IGluc0lkLFxuXHRcdFx0XHRcdFx0c3RhdGU6IGluc3RhbmNlX3N0YXRlXG5cdFx0XHRcdFx0fV07XG5cdFx0XHRcdFx0cmVsYXRlZE9iamVjdFZhbHVlLmluc3RhbmNlX3N0YXRlID0gaW5zdGFuY2Vfc3RhdGU7XG5cdFx0XHRcdFx0Q3JlYXRvci5nZXRDb2xsZWN0aW9uKHJlbGF0ZWRPYmplY3Qub2JqZWN0X25hbWUsIHNwYWNlSWQpLmluc2VydChyZWxhdGVkT2JqZWN0VmFsdWUsIHt2YWxpZGF0ZTogZmFsc2UsIGZpbHRlcjogZmFsc2V9KVxuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdFx0Ly/muIXnkIbnlLPor7fljZXkuIrooqvliKDpmaTlrZDooajorrDlvZXlr7nlupTnmoTnm7jlhbPooajorrDlvZVcblx0XHRcdF8uZWFjaCh0YWJsZU1hcCwgZnVuY3Rpb24odGFibGVJZHMsIHRhYmxlQ29kZSl7XG5cdFx0XHRcdG9iamVjdENvbGxlY3Rpb24ucmVtb3ZlKHtcblx0XHRcdFx0XHRbcmVsYXRlZE9iamVjdC5mb3JlaWduX2tleV06IG1haW5SZWNvcmRJZCxcblx0XHRcdFx0XHRcImluc3RhbmNlcy5faWRcIjogaW5zSWQsXG5cdFx0XHRcdFx0XCJfdGFibGUuX2NvZGVcIjogdGFibGVDb2RlLFxuXHRcdFx0XHRcdFwiX3RhYmxlLl9pZFwiOiB7JG5pbjogdGFibGVJZHN9XG5cdFx0XHRcdH0pXG5cdFx0XHR9KVxuXHRcdH0pO1xuXG5cdFx0dGFibGVJZHMgPSBfLmNvbXBhY3QodGFibGVJZHMpO1xuXG5cblx0fVxuXG5cdHNlbGYuc2VuZERvYyA9IGZ1bmN0aW9uIChkb2MpIHtcblx0XHRpZiAoSW5zdGFuY2VSZWNvcmRRdWV1ZS5kZWJ1Zykge1xuXHRcdFx0Y29uc29sZS5sb2coXCJzZW5kRG9jXCIpO1xuXHRcdFx0Y29uc29sZS5sb2coZG9jKTtcblx0XHR9XG5cblx0XHR2YXIgaW5zSWQgPSBkb2MuaW5mby5pbnN0YW5jZV9pZCxcblx0XHRcdHJlY29yZHMgPSBkb2MuaW5mby5yZWNvcmRzO1xuXHRcdHZhciBmaWVsZHMgPSB7XG5cdFx0XHRmbG93OiAxLFxuXHRcdFx0dmFsdWVzOiAxLFxuXHRcdFx0YXBwbGljYW50OiAxLFxuXHRcdFx0c3BhY2U6IDEsXG5cdFx0XHRmb3JtOiAxLFxuXHRcdFx0Zm9ybV92ZXJzaW9uOiAxXG5cdFx0fTtcblx0XHRzZWxmLnN5bmNJbnNGaWVsZHMuZm9yRWFjaChmdW5jdGlvbiAoZikge1xuXHRcdFx0ZmllbGRzW2ZdID0gMTtcblx0XHR9KVxuXHRcdHZhciBpbnMgPSBDcmVhdG9yLmdldENvbGxlY3Rpb24oJ2luc3RhbmNlcycpLmZpbmRPbmUoaW5zSWQsIHtcblx0XHRcdGZpZWxkczogZmllbGRzXG5cdFx0fSk7XG5cdFx0dmFyIHZhbHVlcyA9IGlucy52YWx1ZXMsXG5cdFx0XHRzcGFjZUlkID0gaW5zLnNwYWNlO1xuXG5cdFx0aWYgKHJlY29yZHMgJiYgIV8uaXNFbXB0eShyZWNvcmRzKSkge1xuXHRcdFx0Ly8g5q2k5oOF5Ya15bGe5LqO5LuOY3JlYXRvcuS4reWPkei1t+WuoeaJue+8jOaIluiAheW3sue7j+S7jkFwcHPlkIzmraXliLDkuoZjcmVhdG9yXG5cdFx0XHR2YXIgb2JqZWN0TmFtZSA9IHJlY29yZHNbMF0ubztcblx0XHRcdHZhciBvdyA9IENyZWF0b3IuZ2V0Q29sbGVjdGlvbignb2JqZWN0X3dvcmtmbG93cycpLmZpbmRPbmUoe1xuXHRcdFx0XHRvYmplY3RfbmFtZTogb2JqZWN0TmFtZSxcblx0XHRcdFx0Zmxvd19pZDogaW5zLmZsb3dcblx0XHRcdH0pO1xuXHRcdFx0dmFyXG5cdFx0XHRcdG9iamVjdENvbGxlY3Rpb24gPSBDcmVhdG9yLmdldENvbGxlY3Rpb24ob2JqZWN0TmFtZSwgc3BhY2VJZCksXG5cdFx0XHRcdHN5bmNfYXR0YWNobWVudCA9IG93LnN5bmNfYXR0YWNobWVudDtcblx0XHRcdHZhciBvYmplY3RJbmZvID0gQ3JlYXRvci5nZXRPYmplY3Qob2JqZWN0TmFtZSwgc3BhY2VJZCk7XG5cdFx0XHRvYmplY3RDb2xsZWN0aW9uLmZpbmQoe1xuXHRcdFx0XHRfaWQ6IHtcblx0XHRcdFx0XHQkaW46IHJlY29yZHNbMF0uaWRzXG5cdFx0XHRcdH1cblx0XHRcdH0pLmZvckVhY2goZnVuY3Rpb24gKHJlY29yZCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHZhciBzeW5jVmFsdWVzID0gc2VsZi5zeW5jVmFsdWVzKG93LmZpZWxkX21hcF9iYWNrLCB2YWx1ZXMsIGlucywgb2JqZWN0SW5mbywgb3cuZmllbGRfbWFwX2JhY2tfc2NyaXB0LCByZWNvcmQpXG5cdFx0XHRcdFx0dmFyIHNldE9iaiA9IHN5bmNWYWx1ZXMubWFpbk9iamVjdFZhbHVlO1xuXHRcdFx0XHRcdHNldE9iai5sb2NrZWQgPSBmYWxzZTtcblxuXHRcdFx0XHRcdHZhciBpbnN0YW5jZV9zdGF0ZSA9IGlucy5zdGF0ZTtcblx0XHRcdFx0XHRpZiAoaW5zLnN0YXRlID09PSAnY29tcGxldGVkJyAmJiBpbnMuZmluYWxfZGVjaXNpb24pIHtcblx0XHRcdFx0XHRcdGluc3RhbmNlX3N0YXRlID0gaW5zLmZpbmFsX2RlY2lzaW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzZXRPYmpbJ2luc3RhbmNlcy4kLnN0YXRlJ10gPSBzZXRPYmouaW5zdGFuY2Vfc3RhdGUgPSBpbnN0YW5jZV9zdGF0ZTtcblxuXHRcdFx0XHRcdG9iamVjdENvbGxlY3Rpb24udXBkYXRlKHtcblx0XHRcdFx0XHRcdF9pZDogcmVjb3JkLl9pZCxcblx0XHRcdFx0XHRcdCdpbnN0YW5jZXMuX2lkJzogaW5zSWRcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHQkc2V0OiBzZXRPYmpcblx0XHRcdFx0XHR9KVxuXG5cdFx0XHRcdFx0dmFyIHJlbGF0ZWRPYmplY3RzID0gQ3JlYXRvci5nZXRSZWxhdGVkT2JqZWN0cyhvdy5vYmplY3RfbmFtZSwgc3BhY2VJZCk7XG5cdFx0XHRcdFx0dmFyIHJlbGF0ZWRPYmplY3RzVmFsdWUgPSBzeW5jVmFsdWVzLnJlbGF0ZWRPYmplY3RzVmFsdWU7XG5cdFx0XHRcdFx0c2VsZi5zeW5jUmVsYXRlZE9iamVjdHNWYWx1ZShyZWNvcmQuX2lkLCByZWxhdGVkT2JqZWN0cywgcmVsYXRlZE9iamVjdHNWYWx1ZSwgc3BhY2VJZCwgaW5zKTtcblxuXG5cdFx0XHRcdFx0Ly8g5Lul5pyA57uI55Sz6K+35Y2V6ZmE5Lu25Li65YeG77yM5pen55qEcmVjb3Jk5Lit6ZmE5Lu25Yig6ZmkXG5cdFx0XHRcdFx0Q3JlYXRvci5nZXRDb2xsZWN0aW9uKCdjbXNfZmlsZXMnKS5yZW1vdmUoe1xuXHRcdFx0XHRcdFx0J3BhcmVudCc6IHtcblx0XHRcdFx0XHRcdFx0bzogb2JqZWN0TmFtZSxcblx0XHRcdFx0XHRcdFx0aWRzOiBbcmVjb3JkLl9pZF1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdGNmcy5maWxlcy5yZW1vdmUoe1xuXHRcdFx0XHRcdFx0J21ldGFkYXRhLnJlY29yZF9pZCc6IHJlY29yZC5faWRcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdC8vIOWQjOatpeaWsOmZhOS7tlxuXHRcdFx0XHRcdHNlbGYuc3luY0F0dGFjaChzeW5jX2F0dGFjaG1lbnQsIGluc0lkLCByZWNvcmQuc3BhY2UsIHJlY29yZC5faWQsIG9iamVjdE5hbWUpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3Iuc3RhY2spO1xuXHRcdFx0XHRcdG9iamVjdENvbGxlY3Rpb24udXBkYXRlKHtcblx0XHRcdFx0XHRcdF9pZDogcmVjb3JkLl9pZCxcblx0XHRcdFx0XHRcdCdpbnN0YW5jZXMuX2lkJzogaW5zSWRcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHQkc2V0OiB7XG5cdFx0XHRcdFx0XHRcdCdpbnN0YW5jZXMuJC5zdGF0ZSc6ICdwZW5kaW5nJyxcblx0XHRcdFx0XHRcdFx0J2xvY2tlZCc6IHRydWUsXG5cdFx0XHRcdFx0XHRcdCdpbnN0YW5jZV9zdGF0ZSc6ICdwZW5kaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pXG5cblx0XHRcdFx0XHRDcmVhdG9yLmdldENvbGxlY3Rpb24oJ2Ntc19maWxlcycpLnJlbW92ZSh7XG5cdFx0XHRcdFx0XHQncGFyZW50Jzoge1xuXHRcdFx0XHRcdFx0XHRvOiBvYmplY3ROYW1lLFxuXHRcdFx0XHRcdFx0XHRpZHM6IFtyZWNvcmQuX2lkXVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Y2ZzLmZpbGVzLnJlbW92ZSh7XG5cdFx0XHRcdFx0XHQnbWV0YWRhdGEucmVjb3JkX2lkJzogcmVjb3JkLl9pZFxuXHRcdFx0XHRcdH0pXG5cblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyb3IpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIOatpOaDheWGteWxnuS6juS7jmFwcHPkuK3lj5HotbflrqHmiblcblx0XHRcdENyZWF0b3IuZ2V0Q29sbGVjdGlvbignb2JqZWN0X3dvcmtmbG93cycpLmZpbmQoe1xuXHRcdFx0XHRmbG93X2lkOiBpbnMuZmxvd1xuXHRcdFx0fSkuZm9yRWFjaChmdW5jdGlvbiAob3cpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHR2YXJcblx0XHRcdFx0XHRcdG9iamVjdENvbGxlY3Rpb24gPSBDcmVhdG9yLmdldENvbGxlY3Rpb24ob3cub2JqZWN0X25hbWUsIHNwYWNlSWQpLFxuXHRcdFx0XHRcdFx0c3luY19hdHRhY2htZW50ID0gb3cuc3luY19hdHRhY2htZW50LFxuXHRcdFx0XHRcdFx0bmV3UmVjb3JkSWQgPSBvYmplY3RDb2xsZWN0aW9uLl9tYWtlTmV3SUQoKSxcblx0XHRcdFx0XHRcdG9iamVjdE5hbWUgPSBvdy5vYmplY3RfbmFtZTtcblxuXHRcdFx0XHRcdHZhciBvYmplY3RJbmZvID0gQ3JlYXRvci5nZXRPYmplY3Qob3cub2JqZWN0X25hbWUsIHNwYWNlSWQpO1xuXHRcdFx0XHRcdHZhciBzeW5jVmFsdWVzID0gc2VsZi5zeW5jVmFsdWVzKG93LmZpZWxkX21hcF9iYWNrLCB2YWx1ZXMsIGlucywgb2JqZWN0SW5mbywgb3cuZmllbGRfbWFwX2JhY2tfc2NyaXB0KTtcblx0XHRcdFx0XHR2YXIgbmV3T2JqID0gc3luY1ZhbHVlcy5tYWluT2JqZWN0VmFsdWU7XG5cblx0XHRcdFx0XHRuZXdPYmouX2lkID0gbmV3UmVjb3JkSWQ7XG5cdFx0XHRcdFx0bmV3T2JqLnNwYWNlID0gc3BhY2VJZDtcblx0XHRcdFx0XHRuZXdPYmoubmFtZSA9IG5ld09iai5uYW1lIHx8IGlucy5uYW1lO1xuXG5cdFx0XHRcdFx0dmFyIGluc3RhbmNlX3N0YXRlID0gaW5zLnN0YXRlO1xuXHRcdFx0XHRcdGlmIChpbnMuc3RhdGUgPT09ICdjb21wbGV0ZWQnICYmIGlucy5maW5hbF9kZWNpc2lvbikge1xuXHRcdFx0XHRcdFx0aW5zdGFuY2Vfc3RhdGUgPSBpbnMuZmluYWxfZGVjaXNpb247XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5ld09iai5pbnN0YW5jZXMgPSBbe1xuXHRcdFx0XHRcdFx0X2lkOiBpbnNJZCxcblx0XHRcdFx0XHRcdHN0YXRlOiBpbnN0YW5jZV9zdGF0ZVxuXHRcdFx0XHRcdH1dO1xuXHRcdFx0XHRcdG5ld09iai5pbnN0YW5jZV9zdGF0ZSA9IGluc3RhbmNlX3N0YXRlO1xuXG5cdFx0XHRcdFx0bmV3T2JqLm93bmVyID0gaW5zLmFwcGxpY2FudDtcblx0XHRcdFx0XHRuZXdPYmouY3JlYXRlZF9ieSA9IGlucy5hcHBsaWNhbnQ7XG5cdFx0XHRcdFx0bmV3T2JqLm1vZGlmaWVkX2J5ID0gaW5zLmFwcGxpY2FudDtcblx0XHRcdFx0XHR2YXIgciA9IG9iamVjdENvbGxlY3Rpb24uaW5zZXJ0KG5ld09iaik7XG5cdFx0XHRcdFx0aWYgKHIpIHtcblx0XHRcdFx0XHRcdENyZWF0b3IuZ2V0Q29sbGVjdGlvbignaW5zdGFuY2VzJykudXBkYXRlKGlucy5faWQsIHtcblx0XHRcdFx0XHRcdFx0JHB1c2g6IHtcblx0XHRcdFx0XHRcdFx0XHRyZWNvcmRfaWRzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRvOiBvYmplY3ROYW1lLFxuXHRcdFx0XHRcdFx0XHRcdFx0aWRzOiBbbmV3UmVjb3JkSWRdXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0dmFyIHJlbGF0ZWRPYmplY3RzID0gQ3JlYXRvci5nZXRSZWxhdGVkT2JqZWN0cyhvdy5vYmplY3RfbmFtZSxzcGFjZUlkKTtcblx0XHRcdFx0XHRcdHZhciByZWxhdGVkT2JqZWN0c1ZhbHVlID0gc3luY1ZhbHVlcy5yZWxhdGVkT2JqZWN0c1ZhbHVlO1xuXHRcdFx0XHRcdFx0c2VsZi5zeW5jUmVsYXRlZE9iamVjdHNWYWx1ZShuZXdSZWNvcmRJZCwgcmVsYXRlZE9iamVjdHMsIHJlbGF0ZWRPYmplY3RzVmFsdWUsIHNwYWNlSWQsIGlucyk7XG5cdFx0XHRcdFx0XHQvLyB3b3JrZmxvd+mHjOWPkei1t+WuoeaJueWQju+8jOWQjOatpeaXtuS5n+WPr+S7peS/ruaUueebuOWFs+ihqOeahOWtl+auteWAvCAjMTE4M1xuXHRcdFx0XHRcdFx0dmFyIHJlY29yZCA9IG9iamVjdENvbGxlY3Rpb24uZmluZE9uZShuZXdSZWNvcmRJZCk7XG5cdFx0XHRcdFx0XHRzZWxmLnN5bmNWYWx1ZXMob3cuZmllbGRfbWFwX2JhY2ssIHZhbHVlcywgaW5zLCBvYmplY3RJbmZvLCBvdy5maWVsZF9tYXBfYmFja19zY3JpcHQsIHJlY29yZCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8g6ZmE5Lu25ZCM5q2lXG5cdFx0XHRcdFx0c2VsZi5zeW5jQXR0YWNoKHN5bmNfYXR0YWNobWVudCwgaW5zSWQsIHNwYWNlSWQsIG5ld1JlY29yZElkLCBvYmplY3ROYW1lKTtcblxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3Iuc3RhY2spO1xuXG5cdFx0XHRcdFx0b2JqZWN0Q29sbGVjdGlvbi5yZW1vdmUoe1xuXHRcdFx0XHRcdFx0X2lkOiBuZXdSZWNvcmRJZCxcblx0XHRcdFx0XHRcdHNwYWNlOiBzcGFjZUlkXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Q3JlYXRvci5nZXRDb2xsZWN0aW9uKCdpbnN0YW5jZXMnKS51cGRhdGUoaW5zLl9pZCwge1xuXHRcdFx0XHRcdFx0JHB1bGw6IHtcblx0XHRcdFx0XHRcdFx0cmVjb3JkX2lkczoge1xuXHRcdFx0XHRcdFx0XHRcdG86IG9iamVjdE5hbWUsXG5cdFx0XHRcdFx0XHRcdFx0aWRzOiBbbmV3UmVjb3JkSWRdXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdENyZWF0b3IuZ2V0Q29sbGVjdGlvbignY21zX2ZpbGVzJykucmVtb3ZlKHtcblx0XHRcdFx0XHRcdCdwYXJlbnQnOiB7XG5cdFx0XHRcdFx0XHRcdG86IG9iamVjdE5hbWUsXG5cdFx0XHRcdFx0XHRcdGlkczogW25ld1JlY29yZElkXVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0Y2ZzLmZpbGVzLnJlbW92ZSh7XG5cdFx0XHRcdFx0XHQnbWV0YWRhdGEucmVjb3JkX2lkJzogbmV3UmVjb3JkSWRcblx0XHRcdFx0XHR9KVxuXG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGVycm9yKTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9KVxuXHRcdH1cblxuXHRcdEluc3RhbmNlUmVjb3JkUXVldWUuY29sbGVjdGlvbi51cGRhdGUoZG9jLl9pZCwge1xuXHRcdFx0JHNldDoge1xuXHRcdFx0XHQnaW5mby5zeW5jX2RhdGUnOiBuZXcgRGF0ZSgpXG5cdFx0XHR9XG5cdFx0fSlcblxuXHR9XG5cblx0Ly8gVW5pdmVyc2FsIHNlbmQgZnVuY3Rpb25cblx0dmFyIF9xdWVyeVNlbmQgPSBmdW5jdGlvbiAoZG9jKSB7XG5cblx0XHRpZiAoc2VsZi5zZW5kRG9jKSB7XG5cdFx0XHRzZWxmLnNlbmREb2MoZG9jKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZG9jOiBbZG9jLl9pZF1cblx0XHR9O1xuXHR9O1xuXG5cdHNlbGYuc2VydmVyU2VuZCA9IGZ1bmN0aW9uIChkb2MpIHtcblx0XHRkb2MgPSBkb2MgfHwge307XG5cdFx0cmV0dXJuIF9xdWVyeVNlbmQoZG9jKTtcblx0fTtcblxuXG5cdC8vIFRoaXMgaW50ZXJ2YWwgd2lsbCBhbGxvdyBvbmx5IG9uZSBkb2MgdG8gYmUgc2VudCBhdCBhIHRpbWUsIGl0XG5cdC8vIHdpbGwgY2hlY2sgZm9yIG5ldyBkb2NzIGF0IGV2ZXJ5IGBvcHRpb25zLnNlbmRJbnRlcnZhbGBcblx0Ly8gKGRlZmF1bHQgaW50ZXJ2YWwgaXMgMTUwMDAgbXMpXG5cdC8vXG5cdC8vIEl0IGxvb2tzIGluIGRvY3MgY29sbGVjdGlvbiB0byBzZWUgaWYgdGhlcmVzIGFueSBwZW5kaW5nXG5cdC8vIGRvY3MsIGlmIHNvIGl0IHdpbGwgdHJ5IHRvIHJlc2VydmUgdGhlIHBlbmRpbmcgZG9jLlxuXHQvLyBJZiBzdWNjZXNzZnVsbHkgcmVzZXJ2ZWQgdGhlIHNlbmQgaXMgc3RhcnRlZC5cblx0Ly9cblx0Ly8gSWYgZG9jLnF1ZXJ5IGlzIHR5cGUgc3RyaW5nLCBpdCdzIGFzc3VtZWQgdG8gYmUgYSBqc29uIHN0cmluZ1xuXHQvLyB2ZXJzaW9uIG9mIHRoZSBxdWVyeSBzZWxlY3Rvci4gTWFraW5nIGl0IGFibGUgdG8gY2FycnkgYCRgIHByb3BlcnRpZXMgaW5cblx0Ly8gdGhlIG1vbmdvIGNvbGxlY3Rpb24uXG5cdC8vXG5cdC8vIFByLiBkZWZhdWx0IGRvY3MgYXJlIHJlbW92ZWQgZnJvbSB0aGUgY29sbGVjdGlvbiBhZnRlciBzZW5kIGhhdmVcblx0Ly8gY29tcGxldGVkLiBTZXR0aW5nIGBvcHRpb25zLmtlZXBEb2NzYCB3aWxsIHVwZGF0ZSBhbmQga2VlcCB0aGVcblx0Ly8gZG9jIGVnLiBpZiBuZWVkZWQgZm9yIGhpc3RvcmljYWwgcmVhc29ucy5cblx0Ly9cblx0Ly8gQWZ0ZXIgdGhlIHNlbmQgaGF2ZSBjb21wbGV0ZWQgYSBcInNlbmRcIiBldmVudCB3aWxsIGJlIGVtaXR0ZWQgd2l0aCBhXG5cdC8vIHN0YXR1cyBvYmplY3QgY29udGFpbmluZyBkb2MgaWQgYW5kIHRoZSBzZW5kIHJlc3VsdCBvYmplY3QuXG5cdC8vXG5cdHZhciBpc1NlbmRpbmdEb2MgPSBmYWxzZTtcblxuXHRpZiAob3B0aW9ucy5zZW5kSW50ZXJ2YWwgIT09IG51bGwpIHtcblxuXHRcdC8vIFRoaXMgd2lsbCByZXF1aXJlIGluZGV4IHNpbmNlIHdlIHNvcnQgZG9jcyBieSBjcmVhdGVkQXRcblx0XHRJbnN0YW5jZVJlY29yZFF1ZXVlLmNvbGxlY3Rpb24uX2Vuc3VyZUluZGV4KHtcblx0XHRcdGNyZWF0ZWRBdDogMVxuXHRcdH0pO1xuXHRcdEluc3RhbmNlUmVjb3JkUXVldWUuY29sbGVjdGlvbi5fZW5zdXJlSW5kZXgoe1xuXHRcdFx0c2VudDogMVxuXHRcdH0pO1xuXHRcdEluc3RhbmNlUmVjb3JkUXVldWUuY29sbGVjdGlvbi5fZW5zdXJlSW5kZXgoe1xuXHRcdFx0c2VuZGluZzogMVxuXHRcdH0pO1xuXG5cblx0XHR2YXIgc2VuZERvYyA9IGZ1bmN0aW9uIChkb2MpIHtcblx0XHRcdC8vIFJlc2VydmUgZG9jXG5cdFx0XHR2YXIgbm93ID0gK25ldyBEYXRlKCk7XG5cdFx0XHR2YXIgdGltZW91dEF0ID0gbm93ICsgb3B0aW9ucy5zZW5kVGltZW91dDtcblx0XHRcdHZhciByZXNlcnZlZCA9IEluc3RhbmNlUmVjb3JkUXVldWUuY29sbGVjdGlvbi51cGRhdGUoe1xuXHRcdFx0XHRfaWQ6IGRvYy5faWQsXG5cdFx0XHRcdHNlbnQ6IGZhbHNlLCAvLyB4eHg6IG5lZWQgdG8gbWFrZSBzdXJlIHRoaXMgaXMgc2V0IG9uIGNyZWF0ZVxuXHRcdFx0XHRzZW5kaW5nOiB7XG5cdFx0XHRcdFx0JGx0OiBub3dcblx0XHRcdFx0fVxuXHRcdFx0fSwge1xuXHRcdFx0XHQkc2V0OiB7XG5cdFx0XHRcdFx0c2VuZGluZzogdGltZW91dEF0LFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gTWFrZSBzdXJlIHdlIG9ubHkgaGFuZGxlIGRvY3MgcmVzZXJ2ZWQgYnkgdGhpc1xuXHRcdFx0Ly8gaW5zdGFuY2Vcblx0XHRcdGlmIChyZXNlcnZlZCkge1xuXG5cdFx0XHRcdC8vIFNlbmRcblx0XHRcdFx0dmFyIHJlc3VsdCA9IEluc3RhbmNlUmVjb3JkUXVldWUuc2VydmVyU2VuZChkb2MpO1xuXG5cdFx0XHRcdGlmICghb3B0aW9ucy5rZWVwRG9jcykge1xuXHRcdFx0XHRcdC8vIFByLiBEZWZhdWx0IHdlIHdpbGwgcmVtb3ZlIGRvY3Ncblx0XHRcdFx0XHRJbnN0YW5jZVJlY29yZFF1ZXVlLmNvbGxlY3Rpb24ucmVtb3ZlKHtcblx0XHRcdFx0XHRcdF9pZDogZG9jLl9pZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdFx0Ly8gVXBkYXRlXG5cdFx0XHRcdFx0SW5zdGFuY2VSZWNvcmRRdWV1ZS5jb2xsZWN0aW9uLnVwZGF0ZSh7XG5cdFx0XHRcdFx0XHRfaWQ6IGRvYy5faWRcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHQkc2V0OiB7XG5cdFx0XHRcdFx0XHRcdC8vIE1hcmsgYXMgc2VudFxuXHRcdFx0XHRcdFx0XHRzZW50OiB0cnVlLFxuXHRcdFx0XHRcdFx0XHQvLyBTZXQgdGhlIHNlbnQgZGF0ZVxuXHRcdFx0XHRcdFx0XHRzZW50QXQ6IG5ldyBEYXRlKCksXG5cdFx0XHRcdFx0XHRcdC8vIE5vdCBiZWluZyBzZW50IGFueW1vcmVcblx0XHRcdFx0XHRcdFx0c2VuZGluZzogMFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyAvLyBFbWl0IHRoZSBzZW5kXG5cdFx0XHRcdC8vIHNlbGYuZW1pdCgnc2VuZCcsIHtcblx0XHRcdFx0Ly8gXHRkb2M6IGRvYy5faWQsXG5cdFx0XHRcdC8vIFx0cmVzdWx0OiByZXN1bHRcblx0XHRcdFx0Ly8gfSk7XG5cblx0XHRcdH0gLy8gRWxzZSBjb3VsZCBub3QgcmVzZXJ2ZVxuXHRcdH07IC8vIEVPIHNlbmREb2NcblxuXHRcdHNlbmRXb3JrZXIoZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRpZiAoaXNTZW5kaW5nRG9jKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdC8vIFNldCBzZW5kIGZlbmNlXG5cdFx0XHRpc1NlbmRpbmdEb2MgPSB0cnVlO1xuXG5cdFx0XHR2YXIgYmF0Y2hTaXplID0gb3B0aW9ucy5zZW5kQmF0Y2hTaXplIHx8IDE7XG5cblx0XHRcdHZhciBub3cgPSArbmV3IERhdGUoKTtcblxuXHRcdFx0Ly8gRmluZCBkb2NzIHRoYXQgYXJlIG5vdCBiZWluZyBvciBhbHJlYWR5IHNlbnRcblx0XHRcdHZhciBwZW5kaW5nRG9jcyA9IEluc3RhbmNlUmVjb3JkUXVldWUuY29sbGVjdGlvbi5maW5kKHtcblx0XHRcdFx0JGFuZDogW1xuXHRcdFx0XHRcdC8vIE1lc3NhZ2UgaXMgbm90IHNlbnRcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZW50OiBmYWxzZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Ly8gQW5kIG5vdCBiZWluZyBzZW50IGJ5IG90aGVyIGluc3RhbmNlc1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlbmRpbmc6IHtcblx0XHRcdFx0XHRcdFx0JGx0OiBub3dcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdC8vIEFuZCBubyBlcnJvclxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGVyck1zZzoge1xuXHRcdFx0XHRcdFx0XHQkZXhpc3RzOiBmYWxzZVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fSwge1xuXHRcdFx0XHQvLyBTb3J0IGJ5IGNyZWF0ZWQgZGF0ZVxuXHRcdFx0XHRzb3J0OiB7XG5cdFx0XHRcdFx0Y3JlYXRlZEF0OiAxXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxpbWl0OiBiYXRjaFNpemVcblx0XHRcdH0pO1xuXG5cdFx0XHRwZW5kaW5nRG9jcy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRzZW5kRG9jKGRvYyk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcihlcnJvci5zdGFjayk7XG5cdFx0XHRcdFx0Y29uc29sZS5sb2coJ0luc3RhbmNlUmVjb3JkUXVldWU6IENvdWxkIG5vdCBzZW5kIGRvYyBpZDogXCInICsgZG9jLl9pZCArICdcIiwgRXJyb3I6ICcgKyBlcnJvci5tZXNzYWdlKTtcblx0XHRcdFx0XHRJbnN0YW5jZVJlY29yZFF1ZXVlLmNvbGxlY3Rpb24udXBkYXRlKHtcblx0XHRcdFx0XHRcdF9pZDogZG9jLl9pZFxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdCRzZXQ6IHtcblx0XHRcdFx0XHRcdFx0Ly8gZXJyb3IgbWVzc2FnZVxuXHRcdFx0XHRcdFx0XHRlcnJNc2c6IGVycm9yLm1lc3NhZ2Vcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7IC8vIEVPIGZvckVhY2hcblxuXHRcdFx0Ly8gUmVtb3ZlIHRoZSBzZW5kIGZlbmNlXG5cdFx0XHRpc1NlbmRpbmdEb2MgPSBmYWxzZTtcblx0XHR9LCBvcHRpb25zLnNlbmRJbnRlcnZhbCB8fCAxNTAwMCk7IC8vIERlZmF1bHQgZXZlcnkgMTV0aCBzZWNcblxuXHR9IGVsc2Uge1xuXHRcdGlmIChJbnN0YW5jZVJlY29yZFF1ZXVlLmRlYnVnKSB7XG5cdFx0XHRjb25zb2xlLmxvZygnSW5zdGFuY2VSZWNvcmRRdWV1ZTogU2VuZCBzZXJ2ZXIgaXMgZGlzYWJsZWQnKTtcblx0XHR9XG5cdH1cblxufTsiLCJNZXRlb3Iuc3RhcnR1cCAtPlxuXHRpZiBNZXRlb3Iuc2V0dGluZ3MuY3Jvbj8uaW5zdGFuY2VyZWNvcmRxdWV1ZV9pbnRlcnZhbFxuXHRcdEluc3RhbmNlUmVjb3JkUXVldWUuQ29uZmlndXJlXG5cdFx0XHRzZW5kSW50ZXJ2YWw6IE1ldGVvci5zZXR0aW5ncy5jcm9uLmluc3RhbmNlcmVjb3JkcXVldWVfaW50ZXJ2YWxcblx0XHRcdHNlbmRCYXRjaFNpemU6IDEwXG5cdFx0XHRrZWVwRG9jczogdHJ1ZVxuIiwiTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG4gIHZhciByZWY7XG4gIGlmICgocmVmID0gTWV0ZW9yLnNldHRpbmdzLmNyb24pICE9IG51bGwgPyByZWYuaW5zdGFuY2VyZWNvcmRxdWV1ZV9pbnRlcnZhbCA6IHZvaWQgMCkge1xuICAgIHJldHVybiBJbnN0YW5jZVJlY29yZFF1ZXVlLkNvbmZpZ3VyZSh7XG4gICAgICBzZW5kSW50ZXJ2YWw6IE1ldGVvci5zZXR0aW5ncy5jcm9uLmluc3RhbmNlcmVjb3JkcXVldWVfaW50ZXJ2YWwsXG4gICAgICBzZW5kQmF0Y2hTaXplOiAxMCxcbiAgICAgIGtlZXBEb2NzOiB0cnVlXG4gICAgfSk7XG4gIH1cbn0pO1xuIiwiaW1wb3J0IHsgY2hlY2tOcG1WZXJzaW9ucyB9IGZyb20gJ21ldGVvci90bWVhc2RheTpjaGVjay1ucG0tdmVyc2lvbnMnO1xuY2hlY2tOcG1WZXJzaW9ucyh7XG5cdFwiZXZhbFwiOiBcIl4wLjEuMlwiXG59LCAnc3RlZWRvczppbnN0YW5jZS1yZWNvcmQtcXVldWUnKTtcbiJdfQ==

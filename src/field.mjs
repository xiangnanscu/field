import Validator from "@xiangnanscu/validator";

const TABLE_MAX_ROWS = 1;
const CHOICES_ERROR_DISPLAY_COUNT = 30;
const ERROR_MESSAGES = { required: "此项必填", choices: "无效选项" };
const NULL = {};
const NOT_DEFIEND = {};

function assert(bool, errMsg) {
  if (!bool) {
    throw new Error(errMsg)
  } else {
    return bool
  }
}
function getLocalTime(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`
}
function cleanChoice(c) {
  let v;
  if (c.value !== undefined) {
    v = c.value;
  } else {
    v = c[0];
  }
  assert(v !== undefined, "you must provide a value for a choice");
  let l;
  if (c.label !== undefined) {
    l = c.label;
  } else if (c[1] !== undefined) {
    l = c[1];
  } else {
    l = v;
  }
  return [v, l, c.hint || c[2]];
}
function getChoices(rawChoices) {
  let choices = [];
  for (let [i, c] of rawChoices.entries()) {
    if (typeof c === "string" || typeof c === "number") {
      c = { value: c, label: c };
    } else if (typeof c === "object") {
      let [value, label, hint] = cleanChoice(c);
      c = { value, label, hint };
    } else {
      throw new Error("invalid choice type:" + typeof c);
    }
    choices.push(c);
  }
  return choices;
}
function serializeChoice(choice) {
  return String(choice.value);
}
function getChoicesErrorMessage(choices) {
  let validChoices = choices.map(serializeChoice).join("，");
  return `限下列选项：${validChoices}`;
}
function getChoicesValidator(choices, message) {
  if (choices.length <= CHOICES_ERROR_DISPLAY_COUNT) {
    message = `${message}，${getChoicesErrorMessage(choices)}`;
  }
  let isChoice = [];
  for (let [_, c] of choices.entries()) {
    isChoice[c.value] = true;
  }
  function choicesValidator(value) {
    if (!isChoice[value]) {
      throw new Error(message);
    } else {
      return value;
    }
  }
  return choicesValidator;
}
let databaseOptionNames = ["primaryKey", "null", "unique", "index", "dbType"];
let baseOptionNames =
  ["name", "type", "required", "label", "choices", "strict", "default", "errorMessages", "validators", ...databaseOptionNames];

class basefield {
  static getLocalTime = getLocalTime
  static NOT_DEFIEND = NOT_DEFIEND;
  required = false;
  static new(options) {
    let self = new this({ ...options });
    self.finalValidators = self.getValidators([...options.validators || []]);
    return self;
  }
  constructor(options) {
    Object.assign(this, this.getOptions(options))
    if (this.dbType === undefined) {
      this.dbType = this.type;
    }
    if (this.label === undefined) {
      this.label = this.name;
    }
    if (this.null === undefined) {
      if (!this.required && this.type !== "string") {
        this.null = true;
      } else {
        this.null = false;
      }
    }
    if (this.choices) {
      if (this.strict === undefined) {
        this.strict = true;
      }
      this.choices = getChoices(this.choices);
    }
    this.errorMessages = { ...ERROR_MESSAGES, ...this.errorMessages };
    return this;
  }
  getOptions(ctx = this) {
    let options = {};
    for (let name of this.getOptionNames()) {
      if (ctx[name] !== undefined) {
        options[name] = ctx[name];
      }
    }
    return options;
  }
  getValidators(validators) {
    if (this.required) {
      validators.unshift(Validator.required(this.errorMessages.required));
    } else {
      validators.unshift(Validator.notRequired);
    }
    if (this.choices && this.strict) {
      validators.push(
        getChoicesValidator(this.choices, this.errorMessages.choices)
      );
    }
    return validators;
  }
  json() {
    let json = this.getOptions();
    delete json.errorMessages
    if (typeof json.default === "function") {
      json.default = undefined;
    }
    if (!json.tag) {
      if (json.choices && json.choices.length > 0 && !json.autocomplete) {
        json.tag = "select";
      } else {
        json.tag = "input";
      }
    }
    if (json.tag === "input" && json.lazy === undefined) {
      json.lazy = true;
    }
    if (typeof json.choices === "function") {
      json.choices = undefined
    }
    return json;
  }
  widgetAttrs(extraAttrs) {
    return { required: this.required, readonly: this.disabled, ...extraAttrs }
  }
  validate(value, ctx) {
    if (typeof value === "function") {
      return value;
    }
    for (let validator of this.finalValidators) {
      try {
        value = validator(value, ctx);
        if (value === undefined) {
          return
        }
      } catch (error) {
        if (error instanceof Validator.SkipValidateError) {
          return value
        } else {
          throw error
        }
      }
    }
    return value;
  }
  getDefault(ctx) {
    if (typeof this.default !== "function") {
      return this.default;
    } else {
      return this.default(ctx);
    }
  }
}
function getMaxChoiceLength(choices) {
  let n = 0;
  for (let c of choices) {
    let value = c.value;
    let n1 = value.length;
    if (n1 > n) {
      n = n1;
    }
  }
  return n;
}
let stringOptionNames = [
  ...baseOptionNames,
  "compact",
  "trim",
  "pattern",
  "length",
  "minlength",
  "maxlength",
  "sfzh",
];
let stringValidatorNames = [
  "pattern",
  "length",
  "minlength",
  "maxlength",
]
class string extends basefield {
  type = "string";
  dbType = "varchar";
  compact = true;
  trim = true;
  constructor(options) {
    if (
      !options.choices &&
      !options.length &&
      !options.maxlength &&
      !options.sfzh
    ) {
      throw new Error(
        `field ${options.name} must define maxlength or choices or length`
      );
    }
    super(options);
    if (this.compact === undefined) {
      this.compact = true;
    }
    if (this.sfzh) {
      this.length = 18;
    }
    if (this.default === undefined && !this.primaryKey && !this.unique) {
      this.default = "";
    }
    if (this.choices && this.choices.length > 0) {
      let n = getMaxChoiceLength(this.choices);
      assert(
        n > 0,
        "invalid string choices(empty choices or zero length value):" +
        this.name
      );
      let m = this.length || this.maxlength;
      if (!m || n > m) {
        this.maxlength = n;
      }
    }
    return this;
  }
  getOptionNames() {
    return stringOptionNames
  }
  getValidators(validators) {
    if (this.sfzh) {
      validators.unshift(Validator.sfzh);
    }
    if (this.compact) {
      validators.unshift(Validator.deleteSpaces);
    } else if (this.trim) {
      validators.unshift(Validator.trim);
    }
    for (let e of stringValidatorNames) {
      if (this[e]) {
        validators.unshift(Validator[e](this[e], this.errorMessages[e]));
      }
    }
    validators.unshift(Validator.string);
    return super.getValidators(validators);
  }
  json() {
    let json = super.json();
    return json;
  }
  widgetAttrs(extraAttrs) {
    let attrs = { minlength: this.minlength };
    return { ...super.widgetAttrs(), ...attrs, ...extraAttrs };
  }
}
class sfzh extends string {
  type = "sfzh";
  dbType = "varchar";
  constructor(options) {
    options.sfzh = true;
    super(options);
    return this;
  }
}

let integerOptionNames = [...baseOptionNames, "min", "max", "serial"];
let intergerValidatorNames = ["min", "max"];
class integer extends basefield {
  type = "integer";
  dbType = "integer";
  addMinOrMaxValidators(validators) {
    for (let e of intergerValidatorNames) {
      if (this[e]) {
        validators.unshift(Validator[e](this[e], this.errorMessages[e]));
      }
    }
  }
  getOptionNames() {
    return integerOptionNames
  }
  getValidators(validators) {
    this.addMinOrMaxValidators(validators);
    validators.unshift(Validator.integer);
    return super.getValidators(validators);
  }
  json() {
    let json = super.json();
    if (json.primaryKey && json.disabled === undefined) {
      json.disabled = true;
    }
    return json;
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
}
class text extends basefield {
  type = "text";
  dbType = "text";
}
let floatValidatorNames = ["min", "max"];
let floatOptionNames = [...baseOptionNames, "min", "max", "precision"];
class float extends basefield {
  type = "float";
  dbType = "float";
  addMinOrMaxValidators(validators) {
    for (let e of floatValidatorNames) {
      if (this[e]) {
        validators.unshift(Validator[e](this[e], this.errorMessages[e]));
      }
    }
  }
  getOptionNames() {
    return floatOptionNames
  }
  getValidators(validators) {
    this.addMinOrMaxValidators(validators);
    validators.unshift(Validator.number);
    return super.getValidators(validators);
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
}
let DEFAULT_BOOLEAN_CHOICES = [
  { label: "是", value: true },
  { label: "否", value: false },
];
let booleanOptionNames = [...baseOptionNames, "cn"];
class boolean extends basefield {
  type = "boolean";
  dbType = "boolean";
  constructor(options) {
    super(options);
    if (this.choices === undefined) {
      this.choices = DEFAULT_BOOLEAN_CHOICES;
    }
    return this;
  }
  getOptionNames() {
    return booleanOptionNames
  }
  getValidators(validators) {
    if (this.cn) {
      validators.unshift(Validator.booleanCn);
    } else {
      validators.unshift(Validator.boolean);
    }
    return super.getValidators(validators);
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
}
const jsonOptionNames = [...baseOptionNames]
class json extends basefield {
  type = "json";
  dbType = "jsonb";
  getOptionNames() {
    return jsonOptionNames
  }
  json() {
    let json = super.json();
    json.tag = "textarea";
    return json;
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return Validator.encode(value);
    }
  }
}
function skipValidateWhenString(v) {
  if (typeof v === "string") {
    throw new Validator.SkipValidateError()
  } else {
    return v;
  }
}
function checkArrayType(v) {
  if (!(v instanceof Array)) {
    throw new Error("value of array field must be a array");
  } else {
    return v;
  }
}
function nonEmptyArrayRequired(message) {
  message = message || "此项必填";
  function arrayValidator(v) {
    if (v.length === 0) {
      throw new Error(message);
    } else {
      return v;
    }
  }
  return arrayValidator;
}
class array extends json {
  type = "array";
  dbType = "jsonb";
  getValidators(validators) {
    if (this.required) {
      validators.unshift(nonEmptyArrayRequired(this.errorMessages.required));
    }
    validators.unshift(checkArrayType);
    validators.unshift(skipValidateWhenString);
    return super.getValidators(validators);
  }
  getEmptyValueToUpdate() {
    return [];
  }
}
function makeEmptyArray() {
  return [];
}
let tableOptionNames = [...baseOptionNames, "model", "subfields", "maxRows"];
class table extends array {
  type = "table";
  maxRows = TABLE_MAX_ROWS;
  constructor(options) {
    super(options);
    if (!this.default || this.default === "") {
      this.default = makeEmptyArray;
    }
    return this;
  }
  getOptionNames() {
    return tableOptionNames
  }
  getValidators(validators) {
    function validateByEachField(rows) {
      for (let [i, row] of rows.entries()) {
        assert(
          typeof row === "object",
          "elements of table field must be object"
        );
        try {
          row = this.model.validateCreate(row);
        } catch (err) {
          err.index = i;
          throw err;
        }
        rows[i] = row;
      }
      return rows;
    }
    validators.unshift(validateByEachField);
    return super.getValidators(validators);
  }
  json() {
    let ret = super.json();
    let model = {fieldNames:[],fields:{}};
    for (let name of this.model.fieldNames) {
      let field = this.model.fields[name];
      model.fieldNames.push(name)
      model.fields[name] = field
    }
    ret.model = model;
    return ret;
  }
  getSubfields() {
    return this.model.fieldNames.map((name) => {
      return this.model.fields[name];
    });
  }
  load(rows) {
    if (! rows instanceof Array) {
      throw new Error("value of table field must be table, not " + typeof rows);
    }
    for (let i = 0; i < rows.length; i = i + 1) {
      rows[i] = this.model.load(rows[i]);
    }
    return rows;
  }
}
const datetimeOptionNames = [...baseOptionNames, "auto_now_add", "auto_now", "precision", "timezone"];
class datetime extends basefield {
  type = "datetime";
  dbType = "timestamp";
  precision = 0;
  timezone = true;
  constructor(options) {
    super(options);
    if (this.autoNowAdd) {
      this.default = getLocalTime;
    }
    return this;
  }
  getOptionNames() {
    return datetimeOptionNames
  }
  getValidators(validators) {
    validators.unshift(Validator.datetime);
    return super.getValidators(validators);
  }
  json() {
    let ret = super.json();
    if (ret.disabled === undefined && (ret.autoNow || ret.autoNowAdd)) {
      ret.disabled = true;
    }
    return ret;
  }
  prepareForDb(value) {
    if (this.autoNow) {
      return getLocalTime();
    } else if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
}
const dateOptionNames = [...baseOptionNames]
class date extends basefield {
  type = "date";
  dbType = "date";
  getOptionNames() {
    return dateOptionNames
  }
  getValidators(validators) {
    validators.unshift(Validator.date);
    return super.getValidators(validators);
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
}
const timeOptionNames = [...baseOptionNames, "precision", "timezone"]
class time extends basefield {
  type = "time";
  dbType = "time";
  precision = 0;
  timezone = true;
  getOptionNames() {
    return timeOptionNames
  }
  getValidators(validators) {
    validators.unshift(Validator.time);
    return super.getValidators(validators);
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
}
let VALID_FOREIGN_KEY_TYPES = {
  foreignkey: String,
  string: String,
  sfzh: String,
  integer: Validator.integer,
  float: Number,
  datetime: Validator.datetime,
  date: Validator.date,
  time: Validator.time,
};
let foreignkeyOptionNames = [
  ...baseOptionNames,
  "reference",
  "reference_column",
  "realtime",
  "keywordQueryName",
  "limitQueryName",
  "autocomplete",
  "url",
];
class foreignkey extends basefield {
  type = "foreignkey";
  convert = String;
  adminUrlName = 'admin';
  modelsUrlName = 'models';
  constructor(options) {
    if (options.dbType === undefined) {
      options.dbType = NOT_DEFIEND;
    }
    super(options);
    let fkModel = this.reference;
    if (fkModel === "self") {
      return this;
    }
    assert(
      typeof fkModel === "function",
      `a foreignkey must define reference model. not ${fkModel}(type: ${typeof fkModel})`
    );
    let rc = this.referenceColumn;
    if (!rc) {
      let pk = fkModel.primaryKey || "id";
      rc = pk;
      this.referenceColumn = pk;
    }
    let fk = fkModel.fields[rc];
    assert(
      fk,
      `invalid foreignkey name ${rc} for foreign model ${fkModel.tableName || "[TABLE NAME NOT DEFINED YET]"}`
    );
    this.convert = assert(
      VALID_FOREIGN_KEY_TYPES[fk.type],
      `invalid foreignkey (name:${fk.name}, type:${fk.type})`
    );
    assert(
      fk.primaryKey || fk.unique,
      "foreignkey must be a primary key or unique key"
    );
    if (this.dbType === NOT_DEFIEND) {
      this.dbType = fk.dbType || fk.type;
    }
    return this;
  }
  getOptionNames() {
    return foreignkeyOptionNames
  }
  getValidators(validators) {
    let fkName = this.referenceColumn;
    let convert = this.convert;
    function foreignkeyValidator(v) {
      if (typeof v === "object") {
        v = v[fkName];
      }
      try {
        v = convert(v);
      } catch (error) {
        throw new Error("error when converting foreign key:" + error.message);
      }
      return v;
    }
    validators.unshift(foreignkeyValidator);
    return super.getValidators(validators);
  }
  load(value) {
    let fkName = this.referenceColumn;
    let fkModel = this.reference;
    function __index(t, key) {
      if (fkModel[key]) {
        return fkModel[key];
      } else if (fkModel.fields[key]) {
        let pk = rawget(t, fkName);
        if (!pk) {
          return undefined;
        }
        let res = fkModel.get({ [fkName]: pk });
        if (!res) {
          return undefined;
        }
        for (let [k, v] of Object.entries(res)) {
          rawset(t, k, v);
        }
        fkModel(t);
        return t[key];
      } else {
        return undefined;
      }
    }
    // return setmetatable({ [fkName]: value }, { __index: __index });
    return { [fkName]: value }
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
  json() {
    let ret = super.json();
    ret.reference = this.reference.tableName;
    ret.autocomplete = true;
    if (ret.realtime === undefined) {
      ret.realtime = true;
    }
    if (ret.keywordQueryName === undefined) {
      ret.keywordQueryName = "__keyword";
    }
    if (ret.limitQueryName === undefined) {
      ret.limitQueryName = "__limit";
    }
    if (ret.url === undefined) {
      ret.url = `/${this.adminUrlName}/${this.modelsUrlName}/foreignkey/${ret.tableName}?__name=${this.name}`;
    }
    return ret;
  }
}
function getEnv(key) {
  return ""
}
function byteSizeParser(key) {
  return ""
}
let OSS_ACCESS_KEY_ID = getEnv("OSS_ACCESS_KEY_ID");
let OSS_ACCESS_KEY_SECRET = getEnv("OSS_ACCESS_KEY_SECRET");
let OSS_BUCKET = getEnv("OSS_BUCKET");
let OSS_REGION = getEnv("OSS_REGION");
let OSS_SIZE = byteSizeParser(getEnv("OSS_SIZE") || "7MB");
let OSS_EXPIRATION_DAYS = Number(getEnv("OSS_EXPIRATION_DAYS") || 180);
function getPolicyTime(seconds) {
  return (
    seconds +
    "T12:00:00.000Z"
  );
}
let DEFAULT_POLICY = {
  expiration: getPolicyTime(3600 * 24 * OSS_EXPIRATION_DAYS),
  conditions: [["content-length-range", 1, OSS_SIZE]],
};
function getPolicy(policy) {
  policy = { ...DEFAULT_POLICY, ...policy };
  let size = byteSizeParser(policy.size || OSS_SIZE);
  policy.size = undefined;
  if (!policy.conditions) {
    policy.conditions = [];
  }
  let modified = undefined;
  for (let e of policy.conditions) {
    if (typeof e === "object" && e[1] === "content-length-range") {
      e[3] = size;
      modified = true;
    }
  }
  if (!modified) {
    policy.conditions.push(["content-length-range", 0, size]);
  }
  return policy;
}
function getPayload(kwargs = {}) {
  let data = [];
  let policy = getPolicy(kwargs.policy);
  data.policy = encodeBase64(cjsonEncode(policy));
  data.signature = encodeBase64(
    hmacSha1(kwargs.keySecret || OSS_ACCESS_KEY_SECRET, data.policy)
  );
  data.OSSAccessKeyId = kwargs.keyId || OSS_ACCESS_KEY_ID;
  data.successActionStatus = 200;
  return data;
}
let aliossOptionNames = [
  ...baseOptionNames,
  "size",
  "policy",
  "sizeArg",
  "times",
  "payload",
  "url",
  "input_type",
];
class alioss extends string {
  type = "alioss";
  dbType = "varchar";
  payload = getPayload();
  getPayload = getPayload;
  getPolicy = getPolicy;
  constructor(options) {
    if (options.maxlength === undefined) {
      options.maxlength = 300;
    }
    super(options);
    if (this.size) {
      this.policy = this.policy || [];
      this.sizeArg = this.size;
      this.size = byteSizeParser(this.size);
      this.policy.size = this.size;
    }
    if (this.times) {
      this.policy.expiration = getPolicyTime(timeParser(this.times));
    }
    this.payload = getPayload({
      key: this.keySecret,
      policy: this.policy,
      id: this.keyId,
    });
    this.url = `//${this.bucket || OSS_BUCKET}.${this.region || OSS_REGION
      }.aliyuncs.com/`;
    this.policy = undefined;
    return this;
  }
  getOptionNames() {
    return aliossOptionNames
  }
  getValidators(validators) {
    validators.unshift(Validator.url);
    return string.getValidators.call(this, validators);
  }
  json() {
    let ret = string.json.call(this);
    if (ret.inputType === undefined) {
      ret.inputType = "file";
    }
    return ret;
  }
}

export default {
  basefield,
  string,
  text,
  integer,
  float,
  datetime,
  date,
  time,
  json,
  array,
  table,
  foreignkey,
  boolean,
  alioss,
  sfzh,
};
export {
  basefield,
  string,
  text,
  integer,
  float,
  datetime,
  date,
  time,
  json,
  array,
  table,
  foreignkey,
  boolean,
  alioss,
  sfzh,
};
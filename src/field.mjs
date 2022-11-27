import Validator from "@xiangnanscu/validator";
import hmacsha1 from "crypto-js/hmac-sha1.js";

const TABLE_MAX_ROWS = 1;
const CHOICES_ERROR_DISPLAY_COUNT = 30;
const ERROR_MESSAGES = { required: "此项必填", choices: "无效选项" };
const NULL = {};
const NOT_DEFIEND = {};

const repr = (e) => JSON.stringify(e);
function assert(bool, errMsg) {
  if (!bool) {
    throw new Error(errMsg);
  } else {
    return bool;
  }
}
function getLocalTime(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1
    }-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
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
  const choices = [];
  for (let [i, c] of rawChoices.entries()) {
    if (typeof c === "string" || typeof c === "number") {
      c = { value: c, label: c };
    } else if (typeof c === "object") {
      const [value, label, hint] = cleanChoice(c);
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
  const validChoices = choices.map(serializeChoice).join("，");
  return `限下列选项：${validChoices}`;
}
function getChoicesValidator(choices, message) {
  if (choices.length <= CHOICES_ERROR_DISPLAY_COUNT) {
    message = `${message}，${getChoicesErrorMessage(choices)}`;
  }
  const isChoice = [];
  for (const [_, c] of choices.entries()) {
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
const databaseOptionNames = ["primaryKey", "null", "unique", "index", "dbType"];
const baseOptionNames = [
  ...databaseOptionNames,
  "required",
  "label",
  "choices",
  "strict",
  "disabled",
  "error_messages",
  "default",
  "hint",
  "lazy",
  "tag",
  "autocomplete",
  "image",
  "url",
  "columns",
  "verifyUrl",
  "post_names",
  "code_lifetime",
];

class basefield {
  static getLocalTime = getLocalTime;
  static NOT_DEFIEND = NOT_DEFIEND;
  __is_field_class__ = true;
  required = false;
  getOptionNames() {
    return baseOptionNames;
  }
  static new(options) {
    const self = new this(options);
    self.validators = self.getValidators([]);
    return self;
  }
  constructor(options) {
    Object.assign(this, this.getOptions(options));
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

  getOptions(options) {
    if (!options) {
      options = this;
    }
    const ret = {
      name: options.name,
      type: options.type,
    };
    for (const name of this.getOptionNames()) {
      if (options[name] !== undefined) {
        ret[name] = options[name];
      }
    }
    return ret;
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
    const json = this.getOptions();
    delete json.errorMessages;
    if (typeof json.default === "function") {
      delete json.default;
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
      delete json.choices;
    }
    return json;
  }
  widgetAttrs(extraAttrs) {
    return { required: this.required, readonly: this.disabled, ...extraAttrs };
  }
  validate(value, ctx) {
    if (typeof value === "function") {
      return value;
    }
    for (const validator of this.validators) {
      try {
        value = validator(value, ctx);
        if (value === undefined) {
          return;
        }
      } catch (error) {
        if (error instanceof Validator.SkipValidateError) {
          return value;
        } else {
          throw error;
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
  for (const c of choices) {
    const value = c.value;
    const n1 = value.length;
    if (n1 > n) {
      n = n1;
    }
  }
  return n;
}
const stringOptionNames = [
  ...baseOptionNames,
  "compact",
  "trim",
  "pattern",
  "length",
  "minlength",
  "maxlength",
];
const stringValidatorNames = ["pattern", "length", "minlength", "maxlength"];
class string extends basefield {
  type = "string";
  dbType = "varchar";
  compact = true;
  trim = true;
  getOptionNames() {
    return stringOptionNames;
  }
  constructor(options) {
    if (!options.choices && !options.length && !options.maxlength) {
      throw new Error(
        `field ${options.name} must define maxlength or choices or length`
      );
    }
    super(options);
    if (this.compact === undefined) {
      this.compact = true;
    }
    if (this.default === undefined && !this.primaryKey && !this.unique) {
      this.default = "";
    }
    if (this.choices && this.choices.length > 0) {
      const n = getMaxChoiceLength(this.choices);
      assert(
        n > 0,
        "invalid string choices(empty choices or zero length value):" +
        this.name
      );
      const m = this.length || this.maxlength;
      if (!m || n > m) {
        this.maxlength = n;
      }
    }
    return this;
  }
  getValidators(validators) {
    if (this.compact) {
      validators.unshift(Validator.deleteSpaces);
    } else if (this.trim) {
      validators.unshift(Validator.trim);
    }
    for (const e of stringValidatorNames) {
      if (this[e]) {
        validators.unshift(Validator[e](this[e], this.errorMessages[e]));
      }
    }
    validators.unshift(Validator.string);
    return super.getValidators(validators);
  }
  widgetAttrs(extraAttrs) {
    const attrs = { minlength: this.minlength };
    return { ...super.widgetAttrs(), ...attrs, ...extraAttrs };
  }
}

class sfzh extends string {
  type = "sfzh";
  dbType = "varchar";
  constructor(options) {
    options.length = 18;
    super(options);
    return this;
  }
  getValidators(validators) {
    validators.unshift(Validator.sfzh);
    return super.getValidators(validators);
  }
}

const integerOptionNames = [...baseOptionNames, "min", "max", "serial"];
const intergerValidatorNames = ["min", "max"];
class integer extends basefield {
  type = "integer";
  dbType = "integer";
  getOptionNames() {
    return integerOptionNames;
  }
  addMinOrMaxValidators(validators) {
    for (const e of intergerValidatorNames) {
      if (this[e]) {
        validators.unshift(Validator[e](this[e], this.errorMessages[e]));
      }
    }
  }
  getValidators(validators) {
    this.addMinOrMaxValidators(validators);
    validators.unshift(Validator.integer);
    return super.getValidators(validators);
  }
  json() {
    const json = super.json();
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

const floatValidatorNames = ["min", "max"];
const floatOptionNames = [...baseOptionNames, "min", "max", "precision"];
class float extends basefield {
  type = "float";
  dbType = "float";
  getOptionNames() {
    return floatOptionNames;
  }
  addMinOrMaxValidators(validators) {
    for (const e of floatValidatorNames) {
      if (this[e]) {
        validators.unshift(Validator[e](this[e], this.errorMessages[e]));
      }
    }
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

const DEFAULT_BOOLEAN_CHOICES = [
  { label: "是", value: true },
  { label: "否", value: false },
];
const booleanOptionNames = [...baseOptionNames, "cn"];
class boolean extends basefield {
  type = "boolean";
  dbType = "boolean";
  getOptionNames() {
    return booleanOptionNames;
  }
  constructor(options) {
    super(options);
    if (this.choices === undefined) {
      this.choices = DEFAULT_BOOLEAN_CHOICES;
    }
    return this;
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

const jsonOptionNames = [...baseOptionNames];
class json extends basefield {
  type = "json";
  dbType = "jsonb";
  getOptionNames() {
    return jsonOptionNames;
  }
  json() {
    const json = super.json();
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
    throw new Validator.SkipValidateError();
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

const tableOptionNames = [
  ...baseOptionNames,
  "model",
  "subfields",
  "maxRows",
  "uploadable",
];
class table extends array {
  type = "table";
  maxRows = TABLE_MAX_ROWS;
  getOptionNames() {
    return tableOptionNames;
  }
  constructor(options) {
    super(options);
    if (typeof this.model !== "object" || !this.model.__is_model_class__) {
      throw new Error("please define model for a table field: " + this.name);
    }
    if (!this.default || this.default === "") {
      this.default = makeEmptyArray;
    }
    return this;
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
    const ret = super.json();
    const model = { fieldNames: [], fields: {} };
    for (const name of this.model.fieldNames) {
      const field = this.model.fields[name];
      model.fieldNames.push(name);
      model.fields[name] = field.json();
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
    if (!(rows instanceof Array)) {
      throw new Error("value of table field must be table, not " + typeof rows);
    }
    for (let i = 0; i < rows.length; i = i + 1) {
      rows[i] = this.model.load(rows[i]);
    }
    return rows;
  }
}

const datetimeOptionNames = [
  ...baseOptionNames,
  "autoNowAdd",
  "autoNow",
  "precision",
  "timezone",
];
class datetime extends basefield {
  type = "datetime";
  dbType = "timestamp";
  precision = 0;
  timezone = true;
  getOptionNames() {
    return datetimeOptionNames;
  }
  constructor(options) {
    super(options);
    if (this.autoNowAdd) {
      this.default = getLocalTime;
    }
    return this;
  }

  getValidators(validators) {
    validators.unshift(Validator.datetime);
    return super.getValidators(validators);
  }
  json() {
    const ret = super.json();
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

const dateOptionNames = [...baseOptionNames];
class date extends basefield {
  type = "date";
  dbType = "date";
  getOptionNames() {
    return dateOptionNames;
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
const timeOptionNames = [...baseOptionNames, "precision", "timezone"];
class time extends basefield {
  type = "time";
  dbType = "time";
  precision = 0;
  timezone = true;
  getOptionNames() {
    return timeOptionNames;
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
const VALID_FOREIGN_KEY_TYPES = {
  foreignkey: String,
  string: String,
  sfzh: String,
  integer: Validator.integer,
  float: Number,
  datetime: Validator.datetime,
  date: Validator.date,
  time: Validator.time,
};
const foreignkeyOptionNames = [
  ...baseOptionNames,
  "reference",
  "referenceColumn",
  "realtime",
  "adminUrlName",
  "modelUrlName",
  "keywordQueryName",
  "limitQueryName",
  "autocomplete",
  "url",
];
class foreignkey extends basefield {
  type = "foreignkey";
  adminUrlName = "admin";
  modelsUrlName = "models";
  convert = String;
  getOptionNames() {
    return foreignkeyOptionNames;
  }
  constructor(options) {
    if (options.dbType === undefined) {
      options.dbType = NOT_DEFIEND;
    }
    super(options);
    const fkModel = this.reference;
    if (fkModel === "self") {
      return this;
    }
    assert(
      fkModel.__is_model_class__,
      `a foreignkey must define reference model. not ${fkModel}(type: ${typeof fkModel})`
    );
    let rc = this.referenceColumn;
    if (!rc) {
      const pk = fkModel.primaryKey || "id";
      rc = pk;
      this.referenceColumn = pk;
    }
    const fk = fkModel.fields[rc];
    assert(
      fk,
      `invalid foreignkey name ${rc} for foreign model ${fkModel.tableName || "[TABLE NAME NOT DEFINED YET]"
      }`
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

  getValidators(validators) {
    const fkName = this.referenceColumn;
    function foreignkeyValidator(v) {
      if (typeof v === "object") {
        v = v[fkName];
      }
      try {
        v = this.convert(v);
      } catch (error) {
        throw new Error("error when converting foreign key:" + error.message);
      }
      return v;
    }
    validators.unshift(foreignkeyValidator);
    return super.getValidators(validators);
  }
  load(value) {
    //** todo 用Proxy改写
    const fkName = this.referenceColumn;
    const fkModel = this.reference;
    // function __index(t, key) {
    //   if (fkModel[key]) {
    //     return fkModel[key];
    //   } else if (fkModel.fields[key]) {
    //     let pk = rawget(t, fkName);
    //     if (!pk) {
    //       return undefined;
    //     }
    //     let res = fkModel.get({ [fkName]: pk });
    //     if (!res) {
    //       return undefined;
    //     }
    //     for (let [k, v] of Object.entries(res)) {
    //       rawset(t, k, v);
    //     }
    //     fkModel(t);
    //     return t[key];
    //   } else {
    //     return undefined;
    //   }
    // }
    // return setmetatable({ [fkName]: value }, { __index: __index });
    return fkModel.newRecord({ [fkName]: value });
  }
  prepareForDb(value) {
    if (value === "" || value === undefined) {
      return NULL;
    } else {
      return value;
    }
  }
  json() {
    const ret = super.json();
    ret.reference = this.reference.tableName;
    ret.autocomplete = true;
    if (ret.realtime === undefined) {
      ret.realtime = true;
    }
    if (ret.keywordQueryName === undefined) {
      ret.keywordQueryName = "keyword";
    }
    if (ret.limitQueryName === undefined) {
      ret.limitQueryName = "limit";
    }
    if (ret.url === undefined) {
      ret.url = `/${this.adminUrlName}/${this.modelsUrlName}/foreignkey/${ret.tableName}?name=${this.name}`;
    }
    return ret;
  }
}

function getEnv(key) {
  return process.env[key];
}

const sizeTable = {
  k: 1024,
  m: 1024 * 1024,
  g: 1024 * 1024 * 1024,
  kb: 1024,
  mb: 1024 * 1024,
  gb: 1024 * 1024 * 1024,
};
function byteSizeParser(t) {
  if (typeof t === "string") {
    const unit = t.replaceAll(/^(\d+)([^\d]+)$/g, "$2").toLowerCase();
    const ts = t.replaceAll(/^(\d+)([^\d]+)$/g, "$1").toLowerCase();
    const bytes = sizeTable[unit];
    assert(bytes, "invalid size unit: " + unit);
    const num = Number(ts);
    assert(num, "can't convert `" + (ts + "` to a number"));
    return num * bytes;
  } else if (typeof t === "number") {
    return t;
  } else {
    throw new Error("invalid type:" + typeof t);
  }
}

const ALI_OSS_ACCESS_KEY_ID = getEnv("ALI_OSS_ACCESS_KEY_ID") || "";
const ALI_OSS_ACCESS_KEY_SECRET = getEnv("ALI_OSS_ACCESS_KEY_SECRET") || "";
const ALI_OSS_BUCKET = getEnv("ALI_OSS_BUCKET") || "";
const ALI_OSS_REGION = getEnv("ALI_OSS_REGION") || "";
const ALI_OSS_SIZE = byteSizeParser(getEnv("ALI_OSS_SIZE") || "1MB");
const ALI_OSS_LIFETIME = Number(getEnv("ALI_OSS_LIFETIME")) || 30;
const ALI_OSS_EXPIRATION_DAYS = Number(
  getEnv("ALI_OSS_EXPIRATION_DAYS") || 180
);
function getPolicyTime(seconds) {
  const now = new Date();
  return new Date(now + seconds * 1000).toISOString();
}
function getPolicy(options) {
  const conditions = [];
  const policy = {
    conditions: conditions,
    expiration: getPolicyTime(options.lifetime || ALI_OSS_LIFETIME),
  };
  if (options.bucket) {
    conditions.push({ bucket: options.bucket });
  }
  const size = options.size;
  if (typeof size === "object") {
    conditions.push(["content-length-range", size[0], size[1]]);
  } else if (typeof size === "string" || typeof size === "number") {
    conditions.push(["content-length-range", 1, byteSizeParser(size)]);
  } else {
    conditions.push(["content-length-range", 1, ALI_OSS_SIZE]);
  }
  if (options.key) {
    conditions.push(["eq", "$key", options.key]);
  }
  return policy;
}
function getPayload(options) {
  const data = [];
  data.policy = btoa(JSON.stringify(getPolicy(options)));
  data.signature = btoa(
    hmacsha1(options.keySecret || ALI_OSS_ACCESS_KEY_SECRET, data.policy)
  );
  data.OSSAccessKeyId = options.keyId || ALI_OSS_ACCESS_KEY_ID;
  if (options.successActionStatus) {
    data.successActionStatus = options.successActionStatus;
  }
  return data;
}
const aliossOptionNames = [
  ...baseOptionNames,
  "size",
  "policy",
  "sizeArg",
  "times",
  "payload",
  "url",
  "input_type",
  "image",
  "maxlength",
  "width",
  "prefix",
  "hash",
];
class alioss extends string {
  type = "alioss";
  dbType = "varchar";
  optionNames = aliossOptionNames;
  constructor(options) {
    if (options.maxlength === undefined) {
      options.maxlength = 300;
    }
    super(options);
    this.keySecret = options.keySecret;
    this.keyId = options.keyId;
    this.sizeArg = options.size;
    this.size = byteSizeParser(options.size);
    this.lifetime = options.lifetime;
    this.url = `//${options.bucket || ALI_OSS_BUCKET}.${options.region || ALI_OSS_REGION
      }.aliyuncs.com/`;
    return this;
  }
  getPayload(options) {
    return getPayload({ ...this, ...options });
  }
  getValidators(validators) {
    validators.unshift(Validator.url);
    return super.getValidators(validators);
  }
  json() {
    const ret = super.json();
    if (ret.inputType === undefined) {
      ret.inputType = "file";
    }
    if (ret.image) {
      ret.type = "aliossImage";
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

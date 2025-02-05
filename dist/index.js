// src/plugins/massPayments.ts
import { Coinbase as Coinbase3 } from "@coinbase/coinbase-sdk";
import {
  composeContext,
  elizaLogger as elizaLogger2,
  generateObject,
  ModelClass
} from "@elizaos/core";

// src/types.ts
import { Coinbase } from "@coinbase/coinbase-sdk";

// ../../node_modules/zod/lib/index.mjs
var util;
(function(util2) {
  util2.assertEqual = (val) => val;
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  get errors() {
    return this.issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var overrideErrorMap = errorMap;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var makeIssue = (params) => {
  const { data, path: path6, errorMaps, issueData } = params;
  const fullPath = [...path6, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil || (errorUtil = {}));
var _ZodEnum_cache;
var _ZodNativeEnum_cache;
var ParseInputLazyPath = class {
  constructor(parent, value, path6, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path6;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    var _a, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
        async: true
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this, this._def);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv6Regex = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
  if (args.precision) {
    regex = `${regex}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    regex = `${regex}(\\.\\d+)?`;
  }
  return regex;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    var _a, _b;
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false,
      local: (_b = options === null || options === void 0 ? void 0 : options.local) !== null && _b !== void 0 ? _b : false,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options === null || options === void 0 ? void 0 : options.position,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * @deprecated Use z.string().min(1) instead.
   * @see {@link ZodString.min}
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  var _a;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = BigInt(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  var _a;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodEnum_cache.set(this, void 0);
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
_ZodEnum_cache = /* @__PURE__ */ new WeakMap();
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  constructor() {
    super(...arguments);
    _ZodNativeEnum_cache.set(this, void 0);
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
_ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function custom(check, params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      var _a, _b;
      if (!check(data)) {
        const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
        const _fatal = (_b = (_a = p.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
        const p2 = typeof p === "string" ? { message: p } : p;
        ctx.addIssue({ code: "custom", ...p2, fatal: _fatal });
      }
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
var NEVER = INVALID;
var z = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  datetimeRegex,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  "enum": enumType,
  "function": functionType,
  "instanceof": instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  "null": nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  "undefined": undefinedType,
  union: unionType,
  unknown: unknownType,
  "void": voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});

// src/types.ts
import {
  WebhookEventType
} from "@coinbase/coinbase-sdk/dist/client";
var ChargeSchema = z.object({
  id: z.string().nullable(),
  price: z.number(),
  type: z.string(),
  currency: z.string().min(3).max(3),
  name: z.string().min(1),
  description: z.string().min(1)
});
var isChargeContent = (object) => {
  if (ChargeSchema.safeParse(object).success) {
    return true;
  }
  console.error("Invalid content: ", object);
  return false;
};
var TransferSchema = z.object({
  network: z.string().toLowerCase(),
  receivingAddresses: z.array(z.string()),
  transferAmount: z.number(),
  assetId: z.string().toLowerCase()
});
var isTransferContent = (object) => {
  return TransferSchema.safeParse(object).success;
};
var assetValues = Object.values(Coinbase.assets);
var TradeSchema = z.object({
  network: z.string().toLowerCase(),
  amount: z.number(),
  sourceAsset: z.enum(assetValues),
  targetAsset: z.enum(assetValues),
  side: z.enum(["BUY", "SELL"])
});
var isTradeContent = (object) => {
  return TradeSchema.safeParse(object).success;
};
var TokenContractSchema = z.object({
  contractType: z.enum(["ERC20", "ERC721", "ERC1155"]).describe("The type of token contract to deploy"),
  name: z.string().describe("The name of the token"),
  symbol: z.string().describe("The symbol of the token"),
  network: z.string().describe("The blockchain network to deploy on"),
  baseURI: z.string().optional().describe(
    "The base URI for token metadata (required for ERC721 and ERC1155)"
  ),
  totalSupply: z.number().optional().describe("The total supply of tokens (only for ERC20)")
}).refine(
  (data) => {
    if (data.contractType === "ERC20") {
      return typeof data.totalSupply === "number" || data.totalSupply === void 0;
    }
    if (["ERC721", "ERC1155"].includes(data.contractType)) {
      return typeof data.baseURI === "string" || data.baseURI === void 0;
    }
    return true;
  },
  {
    message: "Invalid token contract content",
    path: ["contractType"]
  }
);
var isTokenContractContent = (obj) => {
  return TokenContractSchema.safeParse(obj).success;
};
var ContractInvocationSchema = z.object({
  contractAddress: z.string().describe("The address of the contract to invoke"),
  method: z.string().describe("The method to invoke on the contract"),
  abi: z.array(z.any()).describe("The ABI of the contract"),
  args: z.record(z.string(), z.any()).optional().describe("The arguments to pass to the contract method"),
  amount: z.string().optional().describe(
    "The amount of the asset to send (as string to handle large numbers)"
  ),
  assetId: z.string().describe("The ID of the asset to send (e.g., 'USDC')"),
  networkId: z.string().describe("The network ID to use (e.g., 'ethereum-mainnet')")
});
var isContractInvocationContent = (obj) => {
  return ContractInvocationSchema.safeParse(obj).success;
};
var WebhookSchema = z.object({
  networkId: z.string(),
  eventType: z.nativeEnum(WebhookEventType),
  eventTypeFilter: z.custom().optional(),
  eventFilters: z.array(z.custom()).optional()
});
var isWebhookContent = (object) => {
  return WebhookSchema.safeParse(object).success;
};
var AdvancedTradeSchema = z.object({
  productId: z.string(),
  side: z.enum(["BUY", "SELL"]),
  amount: z.number(),
  orderType: z.enum(["MARKET", "LIMIT"]),
  limitPrice: z.number().optional()
});
var isAdvancedTradeContent = (object) => {
  return AdvancedTradeSchema.safeParse(object).success;
};
var ReadContractSchema = z.object({
  contractAddress: z.string().describe("The address of the contract to read from"),
  method: z.string().describe("The view/pure method to call on the contract"),
  networkId: z.string().describe("The network ID to use"),
  args: z.record(z.string(), z.any()).describe("The arguments to pass to the contract method"),
  abi: z.array(z.any()).optional().describe("The contract ABI (optional)")
});
var isReadContractContent = (obj) => {
  return ReadContractSchema.safeParse(obj).success;
};

// src/templates.ts
var chargeTemplate = `
Extract the following details to create a Coinbase charge:
- **price** (number): The amount for the charge (e.g., 100.00).
- **currency** (string): The 3-letter ISO 4217 currency code (e.g., USD, EUR).
- **type** (string): The pricing type for the charge (e.g., fixed_price, dynamic_price). Assume price type is fixed unless otherwise stated
- **name** (string): A non-empty name for the charge (e.g., "The Human Fund").
- **description** (string): A non-empty description of the charge (e.g., "Money For People").

Provide the values in the following JSON format:

\`\`\`json
{
    "price": <number>,
    "currency": "<currency>",
    "type": "<type>",
    "name": "<name>",
    "description": "<description>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var getChargeTemplate = `
Extract the details for a Coinbase charge using the provided charge ID:
- **charge_id** (string): The unique identifier of the charge (e.g., "2b364ef7-ad60-4fcd-958b-e550a3c47dc6").

Provide the charge details in the following JSON format after retrieving the charge details:

\`\`\`json
{
    "charge_id": "<charge_id>",
    "price": <number>,
    "currency": "<currency>",
    "type": "<type>",
    "name": "<name>",
    "description": "<description>",
    "status": "<status>",
    "created_at": "<ISO8601 timestamp>",
    "expires_at": "<ISO8601 timestamp>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var transferTemplate = `
Extract the following details for processing a mass payout using the Coinbase SDK:
- **receivingAddresses** (array): A list of wallet addresses receiving the funds.
- **transferAmount** (number): The amount to transfer to each address.
- **assetId** (string): The asset ID to transfer (e.g., ETH, BTC).
- **network** (string): The blockchain network to use. Allowed values are:
    static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };

Provide the details in the following JSON format:

\`\`\`json
{
    "receivingAddresses": ["<receiving_address_1>", "<receiving_address_2>"],
    "transferAmount": <amount>,
    "assetId": "<asset_id>",
    "network": "<network>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var tradeTemplate = `
Extract the following details for processing a trade using the Coinbase SDK:
- **network** (string): The blockchain network to use (e.g., base, sol, eth, arb, pol).
- **amount** (number): The amount to trade.
- **sourceAsset** (string): The asset ID to trade from (must be one of: ETH, SOL, USDC, WETH, GWEI, LAMPORT).
- **targetAsset** (string): The asset ID to trade to (must be one of: ETH, SOL, USDC, WETH, GWEI, LAMPORT).
- **side** (string): The side of the trade (must be either "BUY" or "SELL").

Ensure that:
1. **network** is one of the supported networks: "base", "sol", "eth", "arb", or "pol".
2. **sourceAsset** and **targetAsset** are valid assets from the provided list.
3. **amount** is a positive number.
4. **side** is either "BUY" or "SELL".

Provide the details in the following JSON format:

\`\`\`json
{
    "network": "<network>",
    "amount": <amount>,
    "sourceAsset": "<source_asset_id>",
    "targetAsset": "<target_asset_id>",
    "side": "<side>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var advancedTradeTemplate = `
Extract the following details for processing an advanced trade using the Coinbase Advanced Trading API:
- **productId** (string): The trading pair ID (e.g., "BTC-USD", "ETH-USD", "SOL-USD")
- **side** (string): The side of the trade (must be either "BUY" or "SELL")
- **amount** (number): The amount to trade
- **orderType** (string): The type of order (must be either "MARKET" or "LIMIT")
- **limitPrice** (number, optional): The limit price for limit orders

Ensure that:
1. **productId** follows the format "ASSET-USD" (e.g., "BTC-USD")
2. **side** is either "BUY" or "SELL"
3. **amount** is a positive number
4. **orderType** is either "MARKET" or "LIMIT"
5. **limitPrice** is provided when orderType is "LIMIT"

Provide the details in the following JSON format:

\`\`\`json
{
    "productId": "<product_id>",
    "side": "<side>",
    "amount": <amount>,
    "orderType": "<order_type>",
    "limitPrice": <limit_price>
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var tokenContractTemplate = `
Extract the following details for deploying a token contract using the Coinbase SDK:
- **contractType** (string): The type of token contract to deploy (ERC20, ERC721, or ERC1155)
- **name** (string): The name of the token
- **symbol** (string): The symbol of the token
- **network** (string): The blockchain network to deploy on (e.g., base, eth, arb, pol)
- **baseURI** (string, optional): The base URI for token metadata (required for ERC721 and ERC1155)
- **totalSupply** (number, optional): The total supply of tokens (only for ERC20)

Provide the details in the following JSON format:

\`\`\`json
{
    "contractType": "<contract_type>",
    "name": "<token_name>",
    "symbol": "<token_symbol>",
    "network": "<network>",
    "baseURI": "<base_uri>",
    "totalSupply": <total_supply>
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var contractInvocationTemplate = `
Extract the following details for invoking a smart contract using the Coinbase SDK:
- **contractAddress** (string): The address of the contract to invoke
- **method** (string): The method to invoke on the contract
- **abi** (array): The ABI of the contract
- **args** (object, optional): The arguments to pass to the contract method
- **amount** (string, optional): The amount of the asset to send (as string to handle large numbers)
- **assetId** (string, required): The ID of the asset to send (e.g., 'USDC')
- **networkId** (string, required): The network ID to use in format "chain-network".
 static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };

Provide the details in the following JSON format:

\`\`\`json
{
    "contractAddress": "<contract_address>",
    "method": "<method_name>",
    "abi": [<contract_abi>],
    "args": {
        "<arg_name>": "<arg_value>"
    },
    "amount": "<amount_as_string>",
    "assetId": "<asset_id>",
    "networkId": "<network_id>"
}
\`\`\`

Example for invoking a transfer method on the USDC contract:

\`\`\`json
{
    "contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "method": "transfer",
    "abi": [
        {
            "constant": false,
            "inputs": [
                {
                    "name": "to",
                    "type": "address"
                },
                {
                    "name": "amount",
                    "type": "uint256"
                }
            ],
            "name": "transfer",
            "outputs": [
                {
                    "name": "",
                    "type": "bool"
                }
            ],
            "payable": false,
            "stateMutability": "nonpayable",
            "type": "function"
        }
    ],
    "args": {
        "to": "0xbcF7C64B880FA89a015970dC104E848d485f99A3",
        "amount": "1000000" // 1 USDC (6 decimals)
    },
    "networkId": "ethereum-mainnet",
    "assetId": "USDC"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var webhookTemplate = `
Extract the following details for creating a webhook:
- **networkId** (string): The network ID for which the webhook is created.
Allowed values are:
    static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };
- **eventType** (string): The type of event for the webhook.
export declare const WebhookEventType: {
    readonly Unspecified: "unspecified";
    readonly Erc20Transfer: "erc20_transfer";
    readonly Erc721Transfer: "erc721_transfer";
    readonly WalletActivity: "wallet_activity";
};
- **eventTypeFilter** (string, optional): Filter for wallet activity event type.
export interface WebhookEventTypeFilter {
    /**
     * A list of wallet addresses to filter on.
     * @type {Array<string>}
     * @memberof WebhookWalletActivityFilter
     */
    'addresses'?: Array<string>;
    /**
     * The ID of the wallet that owns the webhook.
     * @type {string}
     * @memberof WebhookWalletActivityFilter
     */
    'wallet_id'?: string;
}
- **eventFilters** (array, optional): Filters applied to the events that determine which specific events trigger the webhook.
export interface Array<WebhookEventFilter> {
    /**
     * The onchain contract address of the token for which the events should be tracked.
     * @type {string}
     * @memberof WebhookEventFilter
     */
    'contract_address'?: string;
    /**
     * The onchain address of the sender. Set this filter to track all transfer events originating from your address.
     * @type {string}
     * @memberof WebhookEventFilter
     */
    'from_address'?: string;
    /**
     * The onchain address of the receiver. Set this filter to track all transfer events sent to your address.
     * @type {string}
     * @memberof WebhookEventFilter
     */
    'to_address'?: string;
}
Provide the details in the following JSON format:
\`\`\`json
{
    "networkId": "<networkId>",
    "eventType": "<eventType>",
    "eventTypeFilter": "<eventTypeFilter>",
    "eventFilters": [<eventFilter1>, <eventFilter2>]
}
\`\`\`



Example for creating a webhook on the Sepolia testnet for ERC20 transfers originating from a specific wallet 0x1234567890123456789012345678901234567890 on transfers from 0xbcF7C64B880FA89a015970dC104E848d485f99A3

\`\`\`javascript

    networkId: 'base-sepolia', // Listening on sepolia testnet transactions
    eventType: 'erc20_transfer',
    eventTypeFilter: {
      addresses: ['0x1234567890123456789012345678901234567890']
    },
    eventFilters: [{
      from_address: '0xbcF7C64B880FA89a015970dC104E848d485f99A3',
    }],
});
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
var readContractTemplate = `
Extract the following details for reading from a smart contract using the Coinbase SDK:
- **contractAddress** (string): The address of the contract to read from (must start with 0x)
- **method** (string): The view/pure method to call on the contract
- **networkId** (string): The network ID based on networks configured in Coinbase SDK
Allowed values are:
    static networks: {
        readonly BaseSepolia: "base-sepolia";
        readonly BaseMainnet: "base-mainnet";
        readonly EthereumHolesky: "ethereum-holesky";
        readonly EthereumMainnet: "ethereum-mainnet";
        readonly PolygonMainnet: "polygon-mainnet";
        readonly SolanaDevnet: "solana-devnet";
        readonly SolanaMainnet: "solana-mainnet";
        readonly ArbitrumMainnet: "arbitrum-mainnet";
    };
- **args** (object): The arguments to pass to the contract method
- **abi** (array, optional): The contract ABI if needed for complex interactions

Provide the details in the following JSON format:

\`\`\`json
{
    "contractAddress": "<0x-prefixed-address>",
    "method": "<method_name>",
    "networkId": "<network_id>",
    "args": {
        "<arg_name>": "<arg_value>"
    },
    "abi": [
        // Optional ABI array
    ]
}
\`\`\`

Example for reading the balance of an ERC20 token:

\`\`\`json
{
    "contractAddress": "0x37f2131ebbc8f97717edc3456879ef56b9f4b97b",
    "method": "balanceOf",
    "networkId": "eth-mainnet",
    "args": {
        "account": "0xbcF7C64B880FA89a015970dC104E848d485f99A3"
    }
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

// src/plugins/massPayments.ts
import { readFile } from "fs/promises";
import { parse } from "csv-parse/sync";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import fs2 from "fs";
import { createArrayCsvWriter as createArrayCsvWriter2 } from "csv-writer";

// src/utils.ts
import {
  Coinbase as Coinbase2,
  Wallet
} from "@coinbase/coinbase-sdk";
import { elizaLogger, settings } from "@elizaos/core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createArrayCsvWriter } from "csv-writer";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var baseDir = path.resolve(__dirname, "../../plugin-coinbase/src/plugins");
var tradeCsvFilePath = path.join(baseDir, "trades.csv");
var transactionCsvFilePath = path.join(baseDir, "transactions.csv");
var webhookCsvFilePath = path.join(baseDir, "webhooks.csv");
async function initializeWallet(runtime, networkId = Coinbase2.networks.EthereumMainnet) {
  let wallet;
  const storedSeed = runtime.getSetting("COINBASE_GENERATED_WALLET_HEX_SEED") ?? process.env.COINBASE_GENERATED_WALLET_HEX_SEED;
  const storedWalletId = runtime.getSetting("COINBASE_GENERATED_WALLET_ID") ?? process.env.COINBASE_GENERATED_WALLET_ID;
  if (!storedSeed || !storedWalletId) {
    wallet = await Wallet.create({ networkId });
    const walletData = wallet.export();
    const walletAddress = await wallet.getDefaultAddress();
    try {
      const characterFilePath = `characters/${runtime.character.name.toLowerCase()}.character.json`;
      const walletIDSave = await updateCharacterSecrets(
        characterFilePath,
        "COINBASE_GENERATED_WALLET_ID",
        walletData.walletId
      );
      const seedSave = await updateCharacterSecrets(
        characterFilePath,
        "COINBASE_GENERATED_WALLET_HEX_SEED",
        walletData.seed
      );
      if (walletIDSave && seedSave) {
        elizaLogger.log("Successfully updated character secrets.");
      } else {
        const seedFilePath = `characters/${runtime.character.name.toLowerCase()}-seed.txt`;
        elizaLogger.error(
          `Failed to update character secrets so adding gitignored ${seedFilePath} file please add it your env or character file and delete:`
        );
        wallet.saveSeed(seedFilePath);
      }
      elizaLogger.log(
        "Wallet created and stored new wallet:",
        walletAddress
      );
    } catch (error) {
      elizaLogger.error("Error updating character secrets:", error);
      throw error;
    }
    elizaLogger.log("Created and stored new wallet:", walletAddress);
  } else {
    wallet = await Wallet.import({
      seed: storedSeed,
      walletId: storedWalletId
    });
    const networkId2 = wallet.getNetworkId();
    elizaLogger.log("Imported existing wallet for network:", networkId2);
    elizaLogger.log(
      "Imported existing wallet:",
      await wallet.getDefaultAddress()
    );
  }
  return wallet;
}
async function executeTradeAndCharityTransfer(runtime, network, amount, sourceAsset, targetAsset) {
  const wallet = await initializeWallet(runtime, network);
  elizaLogger.log("Wallet initialized:", {
    network,
    address: await wallet.getDefaultAddress()
  });
  const charityAddress = getCharityAddress(network);
  const charityAmount = charityAddress ? amount * 0.01 : 0;
  const tradeAmount = charityAddress ? amount - charityAmount : amount;
  const assetIdLowercase = sourceAsset.toLowerCase();
  const tradeParams = {
    amount: tradeAmount,
    fromAssetId: assetIdLowercase,
    toAssetId: targetAsset.toLowerCase()
  };
  let transfer;
  if (charityAddress && charityAmount > 0) {
    transfer = await executeTransfer(
      wallet,
      charityAmount,
      assetIdLowercase,
      charityAddress
    );
    elizaLogger.log("Charity Transfer successful:", {
      address: charityAddress,
      transactionUrl: transfer.getTransactionLink()
    });
    await appendTransactionsToCsv([
      {
        address: charityAddress,
        amount: charityAmount,
        status: "Success",
        errorCode: null,
        transactionUrl: transfer.getTransactionLink()
      }
    ]);
  }
  const trade = await wallet.createTrade(tradeParams);
  elizaLogger.log("Trade initiated:", trade.toString());
  await trade.wait();
  elizaLogger.log("Trade completed successfully:", trade.toString());
  await appendTradeToCsv(trade);
  return {
    trade,
    transfer
  };
}
async function appendTradeToCsv(trade) {
  try {
    const csvWriter = createArrayCsvWriter({
      path: tradeCsvFilePath,
      header: [
        "Network",
        "From Amount",
        "Source Asset",
        "To Amount",
        "Target Asset",
        "Status",
        "Transaction URL"
      ],
      append: true
    });
    const formattedTrade = [
      trade.getNetworkId(),
      trade.getFromAmount(),
      trade.getFromAssetId(),
      trade.getToAmount(),
      trade.getToAssetId(),
      trade.getStatus(),
      trade.getTransaction().getTransactionLink() || ""
    ];
    elizaLogger.log("Writing trade to CSV:", formattedTrade);
    await csvWriter.writeRecords([formattedTrade]);
    elizaLogger.log("Trade written to CSV successfully.");
  } catch (error) {
    elizaLogger.error("Error writing trade to CSV:", error);
  }
}
async function appendTransactionsToCsv(transactions) {
  try {
    const csvWriter = createArrayCsvWriter({
      path: transactionCsvFilePath,
      header: [
        "Address",
        "Amount",
        "Status",
        "Error Code",
        "Transaction URL"
      ],
      append: true
    });
    const formattedTransactions = transactions.map((transaction) => [
      transaction.address,
      transaction.amount.toString(),
      transaction.status,
      transaction.errorCode || "",
      transaction.transactionUrl || ""
    ]);
    elizaLogger.log("Writing transactions to CSV:", formattedTransactions);
    await csvWriter.writeRecords(formattedTransactions);
    elizaLogger.log("All transactions written to CSV successfully.");
  } catch (error) {
    elizaLogger.error("Error writing transactions to CSV:", error);
  }
}
async function appendWebhooksToCsv(webhooks) {
  try {
    if (!fs.existsSync(webhookCsvFilePath)) {
      elizaLogger.warn("CSV file not found. Creating a new one.");
      const csvWriter2 = createArrayCsvWriter({
        path: webhookCsvFilePath,
        header: [
          "Webhook ID",
          "Network ID",
          "Event Type",
          "Event Filters",
          "Event Type Filter",
          "Notification URI"
        ]
      });
      await csvWriter2.writeRecords([]);
      elizaLogger.log("New CSV file created with headers.");
    }
    const csvWriter = createArrayCsvWriter({
      path: webhookCsvFilePath,
      header: [
        "Webhook ID",
        "Network ID",
        "Event Type",
        "Event Filters",
        "Event Type Filter",
        "Notification URI"
      ],
      append: true
    });
    const formattedWebhooks = webhooks.map((webhook) => [
      webhook.getId(),
      webhook.getNetworkId(),
      webhook.getEventType(),
      JSON.stringify(webhook.getEventFilters()),
      JSON.stringify(webhook.getEventTypeFilter()),
      webhook.getNotificationURI()
    ]);
    elizaLogger.log("Writing webhooks to CSV:", formattedWebhooks);
    await csvWriter.writeRecords(formattedWebhooks);
    elizaLogger.log("All webhooks written to CSV successfully.");
  } catch (error) {
    elizaLogger.error("Error writing webhooks to CSV:", error);
  }
}
async function updateCharacterSecrets(characterfilePath, key, value) {
  try {
    const characterFilePath = path.resolve(
      process.cwd(),
      characterfilePath
    );
    if (!fs.existsSync(characterFilePath)) {
      elizaLogger.error("Character file not found:", characterFilePath);
      return false;
    }
    const characterData = JSON.parse(
      fs.readFileSync(characterFilePath, "utf-8")
    );
    if (!characterData.settings) {
      characterData.settings = {};
    }
    if (!characterData.settings.secrets) {
      characterData.settings.secrets = {};
    }
    characterData.settings.secrets[key] = value;
    fs.writeFileSync(
      characterFilePath,
      JSON.stringify(characterData, null, 2),
      "utf-8"
    );
    console.log(
      `Updated ${key} in character.settings.secrets for ${characterFilePath}.`
    );
  } catch (error) {
    elizaLogger.error("Error updating character secrets:", error);
    return false;
  }
  return true;
}
var getAssetType = (transaction) => {
  if (transaction.value && transaction.value !== "0") {
    return "ETH";
  }
  if (transaction.token_transfers && transaction.token_transfers.length > 0) {
    return transaction.token_transfers.map((transfer) => {
      return transfer.token_id;
    }).join(", ");
  }
  return "N/A";
};
async function getWalletDetails(runtime, networkId = Coinbase2.networks.EthereumMainnet) {
  try {
    const wallet = await initializeWallet(runtime, networkId);
    const balances = await wallet.listBalances();
    const formattedBalances = Array.from(balances, (balance) => ({
      asset: balance[0],
      amount: balance[1].toString()
    }));
    const transactionsData = [];
    const formattedTransactions = transactionsData.map((transaction) => {
      const content = transaction.content();
      return {
        timestamp: content.block_timestamp || "N/A",
        amount: content.value || "N/A",
        asset: getAssetType(content) || "N/A",
        // Ensure getAssetType is implemented
        status: transaction.getStatus(),
        transactionUrl: transaction.getTransactionLink() || "N/A"
      };
    });
    return {
      balances: formattedBalances,
      transactions: formattedTransactions
    };
  } catch (error) {
    console.error("Error fetching wallet details:", error);
    throw new Error("Unable to retrieve wallet details.");
  }
}
async function executeTransfer(wallet, amount, sourceAsset, targetAddress) {
  const assetIdLowercase = sourceAsset.toLowerCase();
  const transferDetails = {
    amount,
    assetId: assetIdLowercase,
    destination: targetAddress,
    gasless: assetIdLowercase === "usdc" ? true : false
  };
  elizaLogger.log("Initiating transfer:", transferDetails);
  let transfer;
  try {
    transfer = await wallet.createTransfer(transferDetails);
    elizaLogger.log("Transfer initiated:", transfer.toString());
    await transfer.wait({
      intervalSeconds: 1,
      timeoutSeconds: 20
    });
  } catch (error) {
    elizaLogger.error("Error executing transfer:", error);
  }
  return transfer;
}
function getCharityAddress(network, isCharitable = false) {
  const isCharityEnabled = process.env.IS_CHARITABLE === "true" && isCharitable;
  if (!isCharityEnabled) {
    return null;
  }
  const networkKey = `CHARITY_ADDRESS_${network.toUpperCase()}`;
  const charityAddress = settings[networkKey];
  if (!charityAddress) {
    throw new Error(
      `Charity address not configured for network ${network}. Please set ${networkKey} in your environment variables.`
    );
  }
  return charityAddress;
}

// src/plugins/massPayments.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var baseDir2 = path2.resolve(__dirname2, "../../plugin-coinbase/src/plugins");
var csvFilePath = path2.join(baseDir2, "transactions.csv");
var massPayoutProvider = {
  get: async (runtime, _message) => {
    elizaLogger2.debug("Starting massPayoutProvider.get function");
    try {
      Coinbase3.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      elizaLogger2.info("Reading CSV file from:", csvFilePath);
      if (!fs2.existsSync(csvFilePath)) {
        elizaLogger2.warn("CSV file not found. Creating a new one.");
        const csvWriter = createArrayCsvWriter2({
          path: csvFilePath,
          header: [
            "Address",
            "Amount",
            "Status",
            "Error Code",
            "Transaction URL"
          ]
        });
        await csvWriter.writeRecords([]);
        elizaLogger2.info("New CSV file created with headers.");
      }
      const csvData = await readFile(csvFilePath, "utf-8");
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true
      });
      const { balances, transactions } = await getWalletDetails(runtime);
      elizaLogger2.info("Parsed CSV records:", records);
      elizaLogger2.info("Current Balances:", balances);
      elizaLogger2.info("Last Transactions:", transactions);
      return {
        currentTransactions: records.map((record) => ({
          address: record["Address"] || void 0,
          amount: Number.parseFloat(record["Amount"]) || void 0,
          status: record["Status"] || void 0,
          errorCode: record["Error Code"] || "",
          transactionUrl: record["Transaction URL"] || ""
        })),
        balances,
        transactionHistory: transactions
      };
    } catch (error) {
      elizaLogger2.error("Error in massPayoutProvider:", error);
      return { csvRecords: [], balances: [], transactions: [] };
    }
  }
};
async function executeMassPayout(runtime, networkId, receivingAddresses, transferAmount, assetId) {
  elizaLogger2.debug("Starting executeMassPayout function");
  const transactions = [];
  const assetIdLowercase = assetId.toLowerCase();
  let sendingWallet;
  try {
    elizaLogger2.debug("Initializing sending wallet");
    sendingWallet = await initializeWallet(runtime, networkId);
  } catch (error) {
    elizaLogger2.error("Error initializing sending wallet:", error);
    throw error;
  }
  for (const address of receivingAddresses) {
    elizaLogger2.info("Processing payout for address:", address);
    if (address) {
      try {
        const walletBalance = await sendingWallet.getBalance(assetIdLowercase);
        elizaLogger2.info("Wallet balance for asset:", {
          assetId,
          walletBalance
        });
        if (walletBalance.lessThan(transferAmount)) {
          const insufficientFunds = `Insufficient funds for address ${sendingWallet.getDefaultAddress()} to send to ${address}. Required: ${transferAmount}, Available: ${walletBalance}`;
          elizaLogger2.error(insufficientFunds);
          transactions.push({
            address,
            amount: transferAmount,
            status: "Failed",
            errorCode: insufficientFunds,
            transactionUrl: null
          });
          continue;
        }
        const transfer = await executeTransfer(
          sendingWallet,
          transferAmount,
          assetIdLowercase,
          address
        );
        transactions.push({
          address,
          amount: transfer.getAmount().toNumber(),
          status: "Success",
          errorCode: null,
          transactionUrl: transfer.getTransactionLink()
        });
      } catch (error) {
        elizaLogger2.error(
          "Error during transfer for address:",
          address,
          error
        );
        transactions.push({
          address,
          amount: transferAmount,
          status: "Failed",
          errorCode: error?.code || "Unknown Error",
          transactionUrl: null
        });
      }
    } else {
      elizaLogger2.info("Skipping invalid or empty address.");
      transactions.push({
        address: "Invalid or Empty",
        amount: transferAmount,
        status: "Failed",
        errorCode: "Invalid Address",
        transactionUrl: null
      });
    }
  }
  const charityAddress = getCharityAddress(networkId);
  try {
    elizaLogger2.debug("Sending 1% to charity:", charityAddress);
    const charityTransfer = await executeTransfer(
      sendingWallet,
      transferAmount * 0.01,
      assetId,
      charityAddress
    );
    transactions.push({
      address: charityAddress,
      amount: charityTransfer.getAmount().toNumber(),
      status: "Success",
      errorCode: null,
      transactionUrl: charityTransfer.getTransactionLink()
    });
  } catch (error) {
    elizaLogger2.error("Error during charity transfer:", error);
    transactions.push({
      address: charityAddress,
      amount: transferAmount * 0.01,
      status: "Failed",
      errorCode: error?.message || "Unknown Error",
      transactionUrl: null
    });
  }
  await appendTransactionsToCsv(transactions);
  elizaLogger2.info("Finished processing mass payouts.");
  return transactions;
}
var sendMassPayoutAction = {
  name: "SEND_MASS_PAYOUT",
  similes: ["BULK_TRANSFER", "DISTRIBUTE_FUNDS", "SEND_PAYMENTS"],
  description: "Sends mass payouts to a list of receiving addresses using a predefined sending wallet and logs all transactions to a CSV file.",
  validate: async (runtime, _message) => {
    elizaLogger2.info("Validating runtime and message...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger2.debug("Starting SEND_MASS_PAYOUT handler...");
    try {
      Coinbase3.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      if (!state) {
        state = await runtime.composeState(message, {
          providers: [massPayoutProvider]
        });
      } else {
        state = await runtime.updateRecentMessageState(state);
      }
      const context = composeContext({
        state,
        template: transferTemplate
      });
      const transferDetails = await generateObject({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
        schema: TransferSchema
      });
      elizaLogger2.info(
        "Transfer details generated:",
        transferDetails.object
      );
      if (!isTransferContent(transferDetails.object)) {
        callback(
          {
            text: "Invalid transfer details. Please check the inputs."
          },
          []
        );
        return;
      }
      const { receivingAddresses, transferAmount, assetId, network } = transferDetails.object;
      const allowedNetworks = Object.values(Coinbase3.networks);
      if (!network || !allowedNetworks.includes(network.toLowerCase()) || !receivingAddresses?.length || transferAmount <= 0 || !assetId) {
        elizaLogger2.error("Missing or invalid input parameters:", {
          network,
          receivingAddresses,
          transferAmount,
          assetId
        });
        callback(
          {
            text: `Invalid input parameters. Please ensure:
- Network is one of: ${allowedNetworks.join(", ")}.
- Receiving addresses are provided.
- Transfer amount is greater than zero.
- Asset ID is valid.`
          },
          []
        );
        return;
      }
      elizaLogger2.info("\u25CE Starting mass payout...");
      const transactions = await executeMassPayout(
        runtime,
        network,
        receivingAddresses,
        transferAmount,
        assetId
      );
      const successTransactions = transactions.filter(
        (tx) => tx.status === "Success"
      );
      const failedTransactions = transactions.filter(
        (tx) => tx.status === "Failed"
      );
      const successDetails = successTransactions.map(
        (tx) => `Address: ${tx.address}, Amount: ${tx.amount}, Transaction URL: ${tx.transactionUrl || "N/A"}`
      ).join("\n");
      const failedDetails = failedTransactions.map(
        (tx) => `Address: ${tx.address}, Amount: ${tx.amount}, Error Code: ${tx.errorCode || "Unknown Error"}`
      ).join("\n");
      const charityTransactions = transactions.filter(
        (tx) => tx.address === getCharityAddress(network)
      );
      const charityDetails = charityTransactions.map(
        (tx) => `Address: ${tx.address}, Amount: ${tx.amount}, Transaction URL: ${tx.transactionUrl || "N/A"}`
      ).join("\n");
      callback(
        {
          text: `Mass payouts completed successfully.
- Successful Transactions: ${successTransactions.length}
- Failed Transactions: ${failedTransactions.length}

Details:
${successTransactions.length > 0 ? `\u2705 Successful Transactions:
${successDetails}` : "No successful transactions."}
${failedTransactions.length > 0 ? `\u274C Failed Transactions:
${failedDetails}` : "No failed transactions."}
${charityTransactions.length > 0 ? `\u2705 Charity Transactions:
${charityDetails}` : "No charity transactions."}

Check the CSV file for full details.`
        },
        []
      );
    } catch (error) {
      elizaLogger2.error("Error during mass payouts:", error);
      callback(
        { text: "Failed to complete payouts. Please try again." },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Distribute 0.0001 ETH on base to 0xA0ba2ACB5846A54834173fB0DD9444F756810f06 and 0xF14F2c49aa90BaFA223EE074C1C33b59891826bF"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Mass payouts completed successfully.
- Successful Transactions: {{2}}
- Failed Transactions: {{1}}

Details:
\u2705 Successful Transactions:
Address: 0xABC123..., Amount: 0.005, Transaction URL: https://etherscan.io/tx/...
Address: 0xDEF456..., Amount: 0.005, Transaction URL: https://etherscan.io/tx/...

\u274C Failed Transactions:
Address: 0xGHI789..., Amount: 0.005, Error Code: Insufficient Funds

Check the CSV file for full details.`,
          action: "SEND_MASS_PAYOUT"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Airdrop 10 USDC to these community members: 0x789..., 0x101... on base network"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Mass payout completed successfully:\n- Airdropped 10 USDC to 2 addresses on base network\n- Successful Transactions: 2\n- Failed Transactions: 0\nCheck the CSV file for transaction details."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Multi-send 0.25 ETH to team wallets: 0x222..., 0x333... on Ethereum"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Mass payout completed successfully:\n- Multi-sent 0.25 ETH to 2 addresses on Ethereum network\n- Successful Transactions: 2\n- Failed Transactions: 0\nCheck the CSV file for transaction details."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Distribute rewards of 5 SOL each to contest winners: winner1.sol, winner2.sol on Solana"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Mass payout completed successfully:\n- Distributed 5 SOL to 2 addresses on Solana network\n- Successful Transactions: 2\n- Failed Transactions: 0\nCheck the CSV file for transaction details."
        }
      }
    ]
  ]
};
var coinbaseMassPaymentsPlugin = {
  name: "automatedPayments",
  description: "Processes mass payouts using Coinbase SDK and logs all transactions (success and failure) to a CSV file. Provides dynamic transaction data through a provider.",
  actions: [sendMassPayoutAction],
  providers: [massPayoutProvider]
};

// src/plugins/commerce.ts
import {
  composeContext as composeContext2,
  elizaLogger as elizaLogger3,
  generateObject as generateObject2,
  ModelClass as ModelClass2
} from "@elizaos/core";
import { Coinbase as Coinbase4 } from "@coinbase/coinbase-sdk";
var url = "https://api.commerce.coinbase.com/charges";
async function createCharge(apiKey, params) {
  elizaLogger3.debug("Starting createCharge function");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey
      },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      throw new Error(`Failed to create charge: ${response.statusText}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    elizaLogger3.error("Error creating charge:", error);
    throw error;
  }
}
async function getAllCharges(apiKey) {
  elizaLogger3.debug("Starting getAllCharges function");
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey
      }
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch all charges: ${response.statusText}`
      );
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    elizaLogger3.error("Error fetching charges:", error);
    throw error;
  }
}
async function getChargeDetails(apiKey, chargeId) {
  elizaLogger3.debug("Starting getChargeDetails function");
  const getUrl = `${url}/${chargeId}`;
  try {
    const response = await fetch(getUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-CC-Api-Key": apiKey
      }
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch charge details: ${response.statusText}`
      );
    }
    const data = await response.json();
    return data;
  } catch (error) {
    elizaLogger3.error(
      `Error fetching charge details for ID ${chargeId}:`,
      error
    );
    throw error;
  }
}
var createCoinbaseChargeAction = {
  name: "CREATE_CHARGE",
  similes: [
    "MAKE_CHARGE",
    "INITIATE_CHARGE",
    "GENERATE_CHARGE",
    "CREATE_TRANSACTION",
    "COINBASE_CHARGE",
    "GENERATE_INVOICE",
    "CREATE_PAYMENT",
    "SETUP_BILLING",
    "REQUEST_PAYMENT",
    "CREATE_CHECKOUT",
    "GET_CHARGE_STATUS",
    "LIST_CHARGES"
  ],
  description: "Create and manage payment charges using Coinbase Commerce. Supports fixed and dynamic pricing, multiple currencies (USD, EUR, USDC), and provides charge status tracking and management features.",
  validate: async (runtime, _message) => {
    const coinbaseCommerceKeyOk = !!runtime.getSetting(
      "COINBASE_COMMERCE_KEY"
    );
    return coinbaseCommerceKeyOk;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.info("Composing state for message:", message);
    if (!state) {
      state = await runtime.composeState(message);
    } else {
      state = await runtime.updateRecentMessageState(state);
    }
    const context = composeContext2({
      state,
      template: chargeTemplate
    });
    const chargeDetails = await generateObject2({
      runtime,
      context,
      modelClass: ModelClass2.LARGE,
      schema: ChargeSchema
    });
    if (!isChargeContent(chargeDetails.object)) {
      throw new Error("Invalid content");
    }
    const charge = chargeDetails.object;
    if (!charge || !charge.price || !charge.type) {
      callback(
        {
          text: "Invalid charge details provided."
        },
        []
      );
      return;
    }
    elizaLogger3.info("Charge details received:", chargeDetails);
    elizaLogger3.debug("Starting Coinbase Commerce client initialization");
    try {
      const chargeResponse = await createCharge(
        runtime.getSetting("COINBASE_COMMERCE_KEY"),
        {
          local_price: {
            amount: charge.price.toString(),
            currency: charge.currency
          },
          pricing_type: charge.type,
          name: charge.name,
          description: charge.description
        }
      );
      elizaLogger3.info(
        "Coinbase Commerce charge created:",
        chargeResponse
      );
      callback(
        {
          text: `Charge created successfully: ${chargeResponse.hosted_url}`,
          attachments: [
            {
              id: chargeResponse.id,
              url: chargeResponse.hosted_url,
              title: "Coinbase Commerce Charge",
              description: `Charge ID: ${chargeResponse.id}`,
              text: `Pay here: ${chargeResponse.hosted_url}`,
              source: "coinbase"
            }
          ]
        },
        []
      );
    } catch (error) {
      elizaLogger3.error(
        "Error creating Coinbase Commerce charge:",
        error
      );
      callback(
        {
          text: "Failed to create a charge. Please try again."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create a charge for $100 USD for Digital Art NFT with description 'Exclusive digital artwork collection'"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Amount: $100 USD\n- Name: Digital Art NFT\n- Description: Exclusive digital artwork collection\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Set up a dynamic price charge for Premium Membership named 'VIP Access Pass'"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Type: dynamic_price\n- Name: VIP Access Pass\n- Description: Premium Membership\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Generate a payment request for 50 EUR for Workshop Registration"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Amount: 50 EUR\n- Name: Workshop Registration\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create an invoice for 1000 USDC for Consulting Services"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge created successfully:\n- Amount: 1000 USDC\n- Name: Consulting Services\n- Type: fixed_price\n- Charge URL: https://commerce.coinbase.com/charges/..."
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Check the status of charge abc-123-def"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Charge details retrieved:\n- ID: abc-123-def\n- Status: COMPLETED\n- Amount: 100 USD\n- Created: 2024-01-20T10:00:00Z\n- Expires: 2024-01-21T10:00:00Z"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "List all active charges"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Active charges retrieved:\n1. ID: abc-123 - $100 USD - Digital Art NFT\n2. ID: def-456 - 50 EUR - Workshop\n3. ID: ghi-789 - 1000 USDC - Consulting\n\nTotal active charges: 3"
        }
      }
    ]
  ]
};
var getAllChargesAction = {
  name: "GET_ALL_CHARGES",
  similes: ["FETCH_ALL_CHARGES", "RETRIEVE_ALL_CHARGES", "LIST_ALL_CHARGES"],
  description: "Fetch all charges using Coinbase Commerce.",
  validate: async (runtime) => {
    const coinbaseCommerceKeyOk = !!runtime.getSetting(
      "COINBASE_COMMERCE_KEY"
    );
    return coinbaseCommerceKeyOk;
  },
  handler: async (runtime, message, state, _options, callback) => {
    try {
      elizaLogger3.info("Composing state for message:", message);
      if (!state) {
        state = await runtime.composeState(message);
      } else {
        state = await runtime.updateRecentMessageState(state);
      }
      const charges = await getAllCharges(
        runtime.getSetting("COINBASE_COMMERCE_KEY")
      );
      elizaLogger3.info("Fetched all charges:", charges);
      callback(
        {
          text: `Successfully fetched all charges. Total charges: ${charges.length}`,
          attachments: charges
        },
        []
      );
    } catch (error) {
      elizaLogger3.error("Error fetching all charges:", error);
      callback(
        {
          text: "Failed to fetch all charges. Please try again."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Fetch all charges" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Successfully fetched all charges.",
          action: "GET_ALL_CHARGES"
        }
      }
    ]
  ]
};
var getChargeDetailsAction = {
  name: "GET_CHARGE_DETAILS",
  similes: ["FETCH_CHARGE_DETAILS", "RETRIEVE_CHARGE_DETAILS", "GET_CHARGE"],
  description: "Fetch details of a specific charge using Coinbase Commerce.",
  validate: async (runtime) => {
    const coinbaseCommerceKeyOk = !!runtime.getSetting(
      "COINBASE_COMMERCE_KEY"
    );
    return coinbaseCommerceKeyOk;
  },
  handler: async (runtime, message, state, _options, callback) => {
    elizaLogger3.info("Composing state for message:", message);
    if (!state) {
      state = await runtime.composeState(message);
    } else {
      state = await runtime.updateRecentMessageState(state);
    }
    const context = composeContext2({
      state,
      template: getChargeTemplate
    });
    const chargeDetails = await generateObject2({
      runtime,
      context,
      modelClass: ModelClass2.LARGE,
      schema: ChargeSchema
    });
    if (!isChargeContent(chargeDetails.object)) {
      throw new Error("Invalid content");
    }
    const charge = chargeDetails.object;
    if (!charge.id) {
      callback(
        {
          text: "Missing charge ID. Please provide a valid charge ID."
        },
        []
      );
      return;
    }
    try {
      const chargeDetails2 = await getChargeDetails(
        runtime.getSetting("COINBASE_COMMERCE_KEY"),
        charge.id
      );
      elizaLogger3.info("Fetched charge details:", chargeDetails2);
      const chargeData = chargeDetails2.data;
      callback(
        {
          text: `Successfully fetched charge details for ID: ${charge.id}`,
          attachments: [
            {
              id: chargeData.id,
              url: chargeData.hosted_url,
              title: `Charge Details for ${charge.id}`,
              source: "coinbase",
              description: JSON.stringify(chargeDetails2, null, 2),
              text: `Pay here: ${chargeData.hosted_url}`,
              contentType: "application/json"
            }
          ]
        },
        []
      );
    } catch (error) {
      elizaLogger3.error(
        `Error fetching details for charge ID ${charge.id}:`,
        error
      );
      callback(
        {
          text: `Failed to fetch details for charge ID: ${charge.id}. Please try again.`
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Fetch details of charge ID: 123456"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Successfully fetched charge details. {{charge.id}} for {{charge.amount}} {{charge.currency}} to {{charge.name}} for {{charge.description}}",
          action: "GET_CHARGE_DETAILS"
        }
      }
    ]
  ]
};
var chargeProvider = {
  get: async (runtime, _message) => {
    elizaLogger3.debug("Starting chargeProvider.get function");
    const charges = await getAllCharges(
      runtime.getSetting("COINBASE_COMMERCE_KEY")
    );
    const coinbaseAPIKey = runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY;
    const coinbasePrivateKey = runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY;
    const balances = [];
    const transactions = [];
    if (coinbaseAPIKey && coinbasePrivateKey) {
      Coinbase4.configure({
        apiKeyName: coinbaseAPIKey,
        privateKey: coinbasePrivateKey
      });
      const { balances: balances2, transactions: transactions2 } = await getWalletDetails(runtime);
      elizaLogger3.info("Current Balances:", balances2);
      elizaLogger3.info("Last Transactions:", transactions2);
    }
    const formattedCharges = charges.map((charge) => ({
      id: charge.id,
      name: charge.name,
      description: charge.description,
      pricing: charge.pricing
    }));
    elizaLogger3.info("Charges:", formattedCharges);
    return { charges: formattedCharges, balances, transactions };
  }
};
var coinbaseCommercePlugin = {
  name: "coinbaseCommerce",
  description: "Integration with Coinbase Commerce for creating and managing charges.",
  actions: [
    createCoinbaseChargeAction,
    getAllChargesAction,
    getChargeDetailsAction
  ],
  evaluators: [],
  providers: [chargeProvider]
};

// src/plugins/trade.ts
import { Coinbase as Coinbase5 } from "@coinbase/coinbase-sdk";
import {
  elizaLogger as elizaLogger4,
  composeContext as composeContext3,
  generateObject as generateObject3,
  ModelClass as ModelClass3
} from "@elizaos/core";
import { readFile as readFile2 } from "fs/promises";
import { parse as parse2 } from "csv-parse/sync";
import path3 from "path";
import { fileURLToPath as fileURLToPath3 } from "url";
import fs3 from "fs";
import { createArrayCsvWriter as createArrayCsvWriter3 } from "csv-writer";
var __filename3 = fileURLToPath3(import.meta.url);
var __dirname3 = path3.dirname(__filename3);
var baseDir3 = path3.resolve(__dirname3, "../../plugin-coinbase/src/plugins");
var tradeCsvFilePath2 = path3.join(baseDir3, "trades.csv");
var tradeProvider = {
  get: async (runtime, _message) => {
    elizaLogger4.debug("Starting tradeProvider.get function");
    try {
      Coinbase5.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      elizaLogger4.info("Reading CSV file from:", tradeCsvFilePath2);
      if (!fs3.existsSync(tradeCsvFilePath2)) {
        elizaLogger4.warn("CSV file not found. Creating a new one.");
        const csvWriter = createArrayCsvWriter3({
          path: tradeCsvFilePath2,
          header: [
            "Network",
            "From Amount",
            "Source Asset",
            "To Amount",
            "Target Asset",
            "Status",
            "Transaction URL"
          ]
        });
        await csvWriter.writeRecords([]);
        elizaLogger4.info("New CSV file created with headers.");
      }
      const csvData = await readFile2(tradeCsvFilePath2, "utf-8");
      const records = parse2(csvData, {
        columns: true,
        skip_empty_lines: true
      });
      elizaLogger4.info("Parsed CSV records:", records);
      const { balances, transactions } = await getWalletDetails(runtime);
      elizaLogger4.info("Current Balances:", balances);
      elizaLogger4.info("Last Transactions:", transactions);
      return {
        currentTrades: records.map((record) => ({
          network: record["Network"] || void 0,
          amount: Number.parseFloat(record["From Amount"]) || void 0,
          sourceAsset: record["Source Asset"] || void 0,
          toAmount: Number.parseFloat(record["To Amount"]) || void 0,
          targetAsset: record["Target Asset"] || void 0,
          status: record["Status"] || void 0,
          transactionUrl: record["Transaction URL"] || ""
        })),
        balances,
        transactions
      };
    } catch (error) {
      elizaLogger4.error("Error in tradeProvider:", error);
      return [];
    }
  }
};
var executeTradeAction = {
  name: "EXECUTE_TRADE",
  description: "Execute a trade between two assets using the Coinbase SDK and log the result.",
  validate: async (runtime, _message) => {
    elizaLogger4.info("Validating runtime for EXECUTE_TRADE...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger4.debug("Starting EXECUTE_TRADE handler...");
    try {
      Coinbase5.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext3({
        state,
        template: tradeTemplate
      });
      const tradeDetails = await generateObject3({
        runtime,
        context,
        modelClass: ModelClass3.LARGE,
        schema: TradeSchema
      });
      if (!isTradeContent(tradeDetails.object)) {
        callback(
          {
            text: "Invalid trade details. Ensure network, amount, source asset, and target asset are correctly specified."
          },
          []
        );
        return;
      }
      const { network, amount, sourceAsset, targetAsset } = tradeDetails.object;
      const allowedNetworks = ["base", "sol", "eth", "arb", "pol"];
      if (!allowedNetworks.includes(network)) {
        callback(
          {
            text: `Invalid network. Supported networks are: ${allowedNetworks.join(
              ", "
            )}.`
          },
          []
        );
        return;
      }
      const { trade, transfer } = await executeTradeAndCharityTransfer(
        runtime,
        network,
        amount,
        sourceAsset,
        targetAsset
      );
      let responseText = `Trade executed successfully:
- Network: ${network}
- Amount: ${trade.getFromAmount()}
- From: ${sourceAsset}
- To: ${targetAsset}
- Transaction URL: ${trade.getTransaction().getTransactionLink() || ""}
- Charity Transaction URL: ${transfer.getTransactionLink() || ""}`;
      if (transfer) {
        responseText += `
- Charity Amount: ${transfer.getAmount()}`;
      } else {
        responseText += "\n(Note: Charity transfer was not completed)";
      }
      callback({ text: responseText }, []);
    } catch (error) {
      elizaLogger4.error("Error during trade execution:", error);
      callback(
        {
          text: "Failed to execute the trade. Please check the logs for more details."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Swap 1 ETH for USDC on base network"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Swapped 1 ETH for USDC on base network\n- Transaction URL: https://basescan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Convert 1000 USDC to SOL on Solana"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Converted 1000 USDC to SOL on Solana network\n- Transaction URL: https://solscan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Exchange 5 WETH for ETH on Arbitrum"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Exchanged 5 WETH for ETH on Arbitrum network\n- Transaction URL: https://arbiscan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Trade 100 GWEI for USDC on Polygon"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Traded 100 GWEI for USDC on Polygon network\n- Transaction URL: https://polygonscan.com/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Market buy ETH with 500 USDC on base"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Bought ETH with 500 USDC on base network\n- Transaction URL: https://basescan.io/tx/...\n- Status: Completed"
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Sell 2.5 SOL for USDC on Solana mainnet"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Trade executed successfully:\n- Sold 2.5 SOL for USDC on Solana network\n- Transaction URL: https://solscan.io/tx/...\n- Status: Completed"
        }
      }
    ]
  ],
  similes: [
    "EXECUTE_TRADE",
    // Primary action name
    "SWAP_TOKENS",
    // For token swaps
    "CONVERT_CURRENCY",
    // For currency conversion
    "EXCHANGE_ASSETS",
    // For asset exchange
    "MARKET_BUY",
    // For buying assets
    "MARKET_SELL",
    // For selling assets
    "TRADE_CRYPTO"
    // Generic crypto trading
  ]
};
var tradePlugin = {
  name: "tradePlugin",
  description: "Enables asset trading using the Coinbase SDK.",
  actions: [executeTradeAction],
  providers: [tradeProvider]
};

// src/plugins/tokenContract.ts
import { Coinbase as Coinbase6, readContract } from "@coinbase/coinbase-sdk";
import {
  elizaLogger as elizaLogger5,
  composeContext as composeContext4,
  generateObject as generateObject4,
  ModelClass as ModelClass4
} from "@elizaos/core";
import path4 from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { createArrayCsvWriter as createArrayCsvWriter4 } from "csv-writer";
import fs4 from "fs";

// src/constants.ts
var ABI = [
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "spender",
        type: "address",
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "approve",
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "from",
        type: "address",
        internalType: "address"
      },
      {
        name: "to",
        type: "address",
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "transferFrom",
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        name: "",
        type: "uint8",
        internalType: "uint8"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address"
      }
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        name: "to",
        type: "address",
        internalType: "address"
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "transfer",
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address"
      },
      {
        name: "spender",
        type: "address",
        internalType: "address"
      }
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        indexed: true,
        name: "owner",
        type: "address",
        internalType: "address"
      },
      {
        indexed: true,
        name: "spender",
        type: "address",
        internalType: "address"
      },
      {
        indexed: false,
        name: "value",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "Approval",
    type: "event",
    anonymous: false
  },
  {
    inputs: [
      {
        indexed: true,
        name: "from",
        type: "address",
        internalType: "address"
      },
      {
        indexed: true,
        name: "to",
        type: "address",
        internalType: "address"
      },
      {
        indexed: false,
        name: "value",
        type: "uint256",
        internalType: "uint256"
      }
    ],
    name: "Transfer",
    type: "event",
    anonymous: false
  }
];

// src/plugins/tokenContract.ts
var __filename4 = fileURLToPath4(import.meta.url);
var __dirname4 = path4.dirname(__filename4);
var baseDir4 = path4.resolve(__dirname4, "../../plugin-coinbase/src/plugins");
var contractsCsvFilePath = path4.join(baseDir4, "contracts.csv");
var serializeBigInt = (value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, serializeBigInt(v)])
    );
  }
  return value;
};
var deployTokenContractAction = {
  name: "DEPLOY_TOKEN_CONTRACT",
  description: "Deploy an ERC20, ERC721, or ERC1155 token contract using the Coinbase SDK",
  validate: async (runtime, _message) => {
    elizaLogger5.info("Validating runtime for DEPLOY_TOKEN_CONTRACT...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger5.debug("Starting DEPLOY_TOKEN_CONTRACT handler...");
    try {
      Coinbase6.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      if (!fs4.existsSync(contractsCsvFilePath)) {
        const csvWriter2 = createArrayCsvWriter4({
          path: contractsCsvFilePath,
          header: [
            "Contract Type",
            "Name",
            "Symbol",
            "Network",
            "Contract Address",
            "Transaction URL",
            "Base URI",
            "Total Supply"
          ]
        });
        await csvWriter2.writeRecords([]);
      }
      const context = composeContext4({
        state,
        template: tokenContractTemplate
      });
      const contractDetails = await generateObject4({
        runtime,
        context,
        modelClass: ModelClass4.SMALL,
        schema: TokenContractSchema
      });
      elizaLogger5.info("Contract details:", contractDetails.object);
      if (!isTokenContractContent(contractDetails.object)) {
        callback(
          {
            text: "Invalid contract details. Please check the inputs."
          },
          []
        );
        return;
      }
      const {
        contractType,
        name,
        symbol,
        network,
        baseURI,
        totalSupply
      } = contractDetails.object;
      elizaLogger5.info("Contract details:", contractDetails.object);
      const wallet = await initializeWallet(runtime, network);
      let contract;
      let deploymentDetails;
      switch (contractType.toLowerCase()) {
        case "erc20":
          contract = await wallet.deployToken({
            name,
            symbol,
            totalSupply: totalSupply || 1e6
          });
          deploymentDetails = {
            contractType: "ERC20",
            totalSupply,
            baseURI: "N/A"
          };
          break;
        case "erc721":
          contract = await wallet.deployNFT({
            name,
            symbol,
            baseURI: baseURI || ""
          });
          deploymentDetails = {
            contractType: "ERC721",
            totalSupply: "N/A",
            baseURI
          };
          break;
        default:
          throw new Error(
            `Unsupported contract type: ${contractType}`
          );
      }
      await contract.wait();
      elizaLogger5.info("Deployment details:", deploymentDetails);
      elizaLogger5.info("Contract deployed successfully:", contract);
      const csvWriter = createArrayCsvWriter4({
        path: contractsCsvFilePath,
        header: [
          "Contract Type",
          "Name",
          "Symbol",
          "Network",
          "Contract Address",
          "Transaction URL",
          "Base URI",
          "Total Supply"
        ],
        append: true
      });
      const transaction = contract.getTransaction()?.getTransactionLink() || "";
      const contractAddress = contract.getContractAddress();
      await csvWriter.writeRecords([
        [
          deploymentDetails.contractType,
          name,
          symbol,
          network,
          contractAddress,
          transaction,
          deploymentDetails.baseURI,
          deploymentDetails.totalSupply || ""
        ]
      ]);
      callback(
        {
          text: `Token contract deployed successfully:
- Type: ${deploymentDetails.contractType}
- Name: ${name}
- Symbol: ${symbol}
- Network: ${network}
- Contract Address: ${contractAddress}
- Transaction URL: ${transaction}
${deploymentDetails.baseURI !== "N/A" ? `- Base URI: ${deploymentDetails.baseURI}` : ""}
${deploymentDetails.totalSupply !== "N/A" ? `- Total Supply: ${deploymentDetails.totalSupply}` : ""}

Contract deployment has been logged to the CSV file.`
        },
        []
      );
    } catch (error) {
      elizaLogger5.error("Error deploying token contract:", error);
      callback(
        {
          text: "Failed to deploy token contract. Please check the logs for more details."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Deploy an ERC721 token named 'MyNFT' with symbol 'MNFT' on base network with URI 'https://pbs.twimg.com/profile_images/1848823420336934913/oI0-xNGe_400x400.jpg'"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Token contract deployed successfully:
- Type: ERC20
- Name: MyToken
- Symbol: MTK
- Network: base
- Contract Address: 0x...
- Transaction URL: https://basescan.org/tx/...
- Total Supply: 1000000`
        }
      },
      {
        user: "{{user1}}",
        content: {
          text: "Deploy an ERC721 token named 'MyNFT' with symbol 'MNFT' on the base network"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Token contract deployed successfully:
- Type: ERC721
- Name: MyNFT
- Symbol: MNFT
- Network: base
- Contract Address: 0x...
- Transaction URL: https://basescan.org/tx/...
- URI: https://pbs.twimg.com/profile_images/1848823420336934913/oI0-xNGe_400x400.jpg`
        }
      }
    ]
  ],
  similes: ["DEPLOY_CONTRACT", "CREATE_TOKEN", "MINT_TOKEN", "CREATE_NFT"]
};
var invokeContractAction = {
  name: "INVOKE_CONTRACT",
  description: "Invoke a method on a deployed smart contract using the Coinbase SDK",
  validate: async (runtime, _message) => {
    elizaLogger5.info("Validating runtime for INVOKE_CONTRACT...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger5.debug("Starting INVOKE_CONTRACT handler...");
    try {
      Coinbase6.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext4({
        state,
        template: contractInvocationTemplate
      });
      const invocationDetails = await generateObject4({
        runtime,
        context,
        modelClass: ModelClass4.LARGE,
        schema: ContractInvocationSchema
      });
      elizaLogger5.info("Invocation details:", invocationDetails.object);
      if (!isContractInvocationContent(invocationDetails.object)) {
        callback(
          {
            text: "Invalid contract invocation details. Please check the inputs."
          },
          []
        );
        return;
      }
      const {
        contractAddress,
        method: method2,
        args,
        amount,
        assetId,
        networkId
      } = invocationDetails.object;
      const wallet = await initializeWallet(runtime, networkId);
      const invocationOptions = {
        contractAddress,
        method: method2,
        abi: ABI,
        args: {
          ...args,
          amount: args.amount || amount
          // Ensure amount is passed in args
        },
        networkId,
        assetId
      };
      elizaLogger5.info("Invocation options:", invocationOptions);
      const invocation = await wallet.invokeContract(invocationOptions);
      await invocation.wait();
      const csvWriter = createArrayCsvWriter4({
        path: contractsCsvFilePath,
        header: [
          "Contract Address",
          "Method",
          "Network",
          "Status",
          "Transaction URL",
          "Amount",
          "Asset ID"
        ],
        append: true
      });
      await csvWriter.writeRecords([
        [
          contractAddress,
          method2,
          networkId,
          invocation.getStatus(),
          invocation.getTransactionLink() || "",
          amount || "",
          assetId || ""
        ]
      ]);
      callback(
        {
          text: `Contract method invoked successfully:
- Contract Address: ${contractAddress}
- Method: ${method2}
- Network: ${networkId}
- Status: ${invocation.getStatus()}
- Transaction URL: ${invocation.getTransactionLink() || "N/A"}
${amount ? `- Amount: ${amount}` : ""}
${assetId ? `- Asset ID: ${assetId}` : ""}

Contract invocation has been logged to the CSV file.`
        },
        []
      );
    } catch (error) {
      elizaLogger5.error("Error invoking contract method:", error);
      callback(
        {
          text: "Failed to invoke contract method. Please check the logs for more details."
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Call the 'transfer' method on my ERC20 token contract at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 with amount 100 to recipient 0xbcF7C64B880FA89a015970dC104E848d485f99A3"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Contract method invoked successfully:
- Contract Address: 0x123...
- Method: transfer
- Network: base
- Status: SUCCESS
- Transaction URL: https://basescan.org/tx/...
- Amount: 100
- Asset ID: wei

Contract invocation has been logged to the CSV file.`
        }
      }
    ]
  ],
  similes: ["CALL_CONTRACT", "EXECUTE_CONTRACT", "INTERACT_WITH_CONTRACT"]
};
var readContractAction = {
  name: "READ_CONTRACT",
  description: "Read data from a deployed smart contract using the Coinbase SDK",
  validate: async (runtime, _message) => {
    elizaLogger5.info("Validating runtime for READ_CONTRACT...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger5.debug("Starting READ_CONTRACT handler...");
    try {
      Coinbase6.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext4({
        state,
        template: readContractTemplate
      });
      const readDetails = await generateObject4({
        runtime,
        context,
        modelClass: ModelClass4.SMALL,
        schema: ReadContractSchema
      });
      if (!isReadContractContent(readDetails.object)) {
        callback(
          {
            text: "Invalid contract read details. Please check the inputs."
          },
          []
        );
        return;
      }
      const { contractAddress, method: method2, args, networkId, abi } = readDetails.object;
      elizaLogger5.info("Reading contract:", {
        contractAddress,
        method: method2,
        args,
        networkId,
        abi
      });
      const result = await readContract({
        networkId,
        contractAddress,
        method: method2,
        args,
        abi: ABI
      });
      const serializedResult = serializeBigInt(result);
      elizaLogger5.info("Contract read result:", serializedResult);
      callback(
        {
          text: `Contract read successful:
- Contract Address: ${contractAddress}
- Method: ${method2}
- Network: ${networkId}
- Result: ${JSON.stringify(serializedResult, null, 2)}`
        },
        []
      );
    } catch (error) {
      elizaLogger5.error("Error reading contract:", error);
      callback(
        {
          text: `Failed to read contract: ${error instanceof Error ? error.message : "Unknown error"}`
        },
        []
      );
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Read the balance of address 0xbcF7C64B880FA89a015970dC104E848d485f99A3 from the ERC20 contract at 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 on eth"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Contract read successful:
- Contract Address: 0x37f2131ebbc8f97717edc3456879ef56b9f4b97b
- Method: balanceOf
- Network: eth
- Result: "1000000"`
        }
      }
    ]
  ],
  similes: ["READ_CONTRACT", "GET_CONTRACT_DATA", "QUERY_CONTRACT"]
};
var tokenContractPlugin = {
  name: "tokenContract",
  description: "Enables deployment, invocation, and reading of ERC20, ERC721, and ERC1155 token contracts using the Coinbase SDK",
  actions: [
    deployTokenContractAction,
    invokeContractAction,
    readContractAction
  ]
};

// src/plugins/webhooks.ts
import { Coinbase as Coinbase7, Webhook } from "@coinbase/coinbase-sdk";
import {
  elizaLogger as elizaLogger6,
  composeContext as composeContext5,
  generateObject as generateObject5,
  ModelClass as ModelClass5
} from "@elizaos/core";
var webhookProvider = {
  get: async (runtime, _message) => {
    elizaLogger6.debug("Starting webhookProvider.get function");
    try {
      Coinbase7.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const resp = await Webhook.list();
      elizaLogger6.info("Listing all webhooks:", resp.data);
      return {
        webhooks: resp.data.map((webhook) => ({
          id: webhook.getId(),
          networkId: webhook.getNetworkId(),
          eventType: webhook.getEventType(),
          eventFilters: webhook.getEventFilters(),
          eventTypeFilter: webhook.getEventTypeFilter(),
          notificationURI: webhook.getNotificationURI()
        }))
      };
    } catch (error) {
      elizaLogger6.error("Error in webhookProvider:", error);
      return [];
    }
  }
};
var createWebhookAction = {
  name: "CREATE_WEBHOOK",
  description: "Create a new webhook using the Coinbase SDK.",
  validate: async (runtime, _message) => {
    elizaLogger6.info("Validating runtime for CREATE_WEBHOOK...");
    return !!(runtime.character.settings.secrets?.COINBASE_API_KEY || process.env.COINBASE_API_KEY) && !!(runtime.character.settings.secrets?.COINBASE_PRIVATE_KEY || process.env.COINBASE_PRIVATE_KEY) && !!(runtime.character.settings.secrets?.COINBASE_NOTIFICATION_URI || process.env.COINBASE_NOTIFICATION_URI);
  },
  handler: async (runtime, _message, state, _options, callback) => {
    elizaLogger6.debug("Starting CREATE_WEBHOOK handler...");
    try {
      Coinbase7.configure({
        apiKeyName: runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        privateKey: runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      });
      const context = composeContext5({
        state,
        template: webhookTemplate
      });
      const webhookDetails = await generateObject5({
        runtime,
        context,
        modelClass: ModelClass5.LARGE,
        schema: WebhookSchema
      });
      if (!isWebhookContent(webhookDetails.object)) {
        callback(
          {
            text: "Invalid webhook details. Ensure network, URL, event type, and contract address are correctly specified."
          },
          []
        );
        return;
      }
      const { networkId, eventType, eventFilters, eventTypeFilter } = webhookDetails.object;
      const notificationUri = runtime.getSetting("COINBASE_NOTIFICATION_URI") ?? process.env.COINBASE_NOTIFICATION_URI;
      if (!notificationUri) {
        callback(
          {
            text: "Notification URI is not set in the environment variables."
          },
          []
        );
        return;
      }
      elizaLogger6.info("Creating webhook with details:", {
        networkId,
        notificationUri,
        eventType,
        eventTypeFilter,
        eventFilters
      });
      const webhook = await Webhook.create({
        networkId,
        notificationUri,
        eventType,
        eventFilters
      });
      elizaLogger6.info(
        "Webhook created successfully:",
        webhook.toString()
      );
      callback(
        {
          text: `Webhook created successfully: ${webhook.toString()}`
        },
        []
      );
      await appendWebhooksToCsv([webhook]);
      elizaLogger6.info("Webhook appended to CSV successfully");
    } catch (error) {
      elizaLogger6.error("Error during webhook creation:", error);
      callback(
        {
          text: "Failed to create the webhook. Please check the logs for more details."
        },
        []
      );
    }
  },
  similes: ["WEBHOOK", "NOTIFICATION", "EVENT", "TRIGGER", "LISTENER"],
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Create a webhook on base for address 0xbcF7C64B880FA89a015970dC104E848d485f99A3 on the event type: transfers"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Webhook created successfully: Webhook ID: {{webhookId}}, Network ID: {{networkId}}, Notification URI: {{notificationUri}}, Event Type: {{eventType}}`,
          action: "CREATE_WEBHOOK"
        }
      }
    ]
  ]
};
var webhookPlugin = {
  name: "webhookPlugin",
  description: "Manages webhooks using the Coinbase SDK.",
  actions: [createWebhookAction],
  providers: [webhookProvider]
};

// advanced-sdk-ts/src/jwt-generator.ts
import jwt from "jsonwebtoken";

// advanced-sdk-ts/src/constants.ts
var BASE_URL = "api.coinbase.com";
var API_PREFIX = "/api/v3/brokerage";
var ALGORITHM = "ES256";
var VERSION = "0.1.0";
var USER_AGENT = `coinbase-advanced-ts/${VERSION}`;
var JWT_ISSUER = "cdp";

// advanced-sdk-ts/src/jwt-generator.ts
import crypto2 from "crypto";
function generateToken(requestMethod, requestPath, apiKey, apiSecret) {
  const uri = `${requestMethod} ${BASE_URL}${requestPath}`;
  const payload = {
    iss: JWT_ISSUER,
    nbf: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 120,
    sub: apiKey,
    uri
  };
  const header = {
    alg: ALGORITHM,
    kid: apiKey,
    nonce: crypto2.randomBytes(16).toString("hex")
  };
  const options = {
    algorithm: ALGORITHM,
    header
  };
  return jwt.sign(payload, apiSecret, options);
}

// advanced-sdk-ts/src/rest/rest-base.ts
import fetch2, { Headers } from "node-fetch";

// advanced-sdk-ts/src/rest/errors.ts
var CoinbaseError = class extends Error {
  statusCode;
  response;
  constructor(message, statusCode, response) {
    super(message);
    this.name = "CoinbaseError";
    this.statusCode = statusCode;
    this.response = response;
  }
};
function handleException(response, responseText, reason) {
  let message;
  if (400 <= response.status && response.status <= 499 || 500 <= response.status && response.status <= 599) {
    if (response.status == 403 && responseText.includes('"error_details":"Missing required scopes"')) {
      message = `${response.status} Coinbase Error: Missing Required Scopes. Please verify your API keys include the necessary permissions.`;
    } else
      message = `${response.status} Coinbase Error: ${reason} ${responseText}`;
    throw new CoinbaseError(message, response.status, response);
  }
}

// advanced-sdk-ts/src/rest/rest-base.ts
var RESTBase = class {
  apiKey;
  apiSecret;
  constructor(key, secret) {
    if (!key || !secret) {
      console.log(
        "Could not authenticate. Only public endpoints accessible."
      );
    }
    this.apiKey = key;
    this.apiSecret = secret;
  }
  request(options) {
    const { method: method2, endpoint, isPublic } = options;
    let { queryParams, bodyParams } = options;
    queryParams = queryParams ? this.filterParams(queryParams) : {};
    if (bodyParams !== void 0)
      bodyParams = bodyParams ? this.filterParams(bodyParams) : {};
    return this.prepareRequest(
      method2,
      endpoint,
      queryParams,
      bodyParams,
      isPublic
    );
  }
  prepareRequest(httpMethod, urlPath, queryParams, bodyParams, isPublic) {
    const headers = this.setHeaders(httpMethod, urlPath, isPublic);
    const requestOptions = {
      method: httpMethod,
      headers,
      body: JSON.stringify(bodyParams)
    };
    const queryString = this.buildQueryString(queryParams);
    const url2 = `https://${BASE_URL}${urlPath}${queryString}`;
    return this.sendRequest(headers, requestOptions, url2);
  }
  async sendRequest(headers, requestOptions, url2) {
    const response = await fetch2(url2, requestOptions);
    const responseText = await response.text();
    handleException(response, responseText, response.statusText);
    return responseText;
  }
  setHeaders(httpMethod, urlPath, isPublic) {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("User-Agent", USER_AGENT);
    if (this.apiKey !== void 0 && this.apiSecret !== void 0)
      headers.append(
        "Authorization",
        `Bearer ${generateToken(
          httpMethod,
          urlPath,
          this.apiKey,
          this.apiSecret
        )}`
      );
    else if (isPublic == void 0 || isPublic == false)
      throw new Error(
        "Attempting to access authenticated endpoint with invalid API_KEY or API_SECRET."
      );
    return headers;
  }
  filterParams(data) {
    const filteredParams = {};
    for (const key in data) {
      if (data[key] !== void 0) {
        filteredParams[key] = data[key];
      }
    }
    return filteredParams;
  }
  buildQueryString(queryParams) {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return "";
    }
    const queryString = Object.entries(queryParams).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map(
          (item) => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`
        );
      } else {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
    }).join("&");
    return `?${queryString}`;
  }
};

// advanced-sdk-ts/src/rest/accounts.ts
function getAccount({ accountUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/accounts/${accountUuid}`,
    isPublic: false
  });
}
function listAccounts(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/accounts`,
    queryParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/converts.ts
function createConvertQuote(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/convert/quote`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getConvertTrade({ tradeId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/convert/trade/${tradeId}`,
    queryParams: requestParams,
    isPublic: false
  });
}
function commitConvertTrade({ tradeId, ...requestParams }) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/convert/trade/${tradeId}`,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/dataAPI.ts
function getAPIKeyPermissions() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/key_permissions`,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/fees.ts
function getTransactionSummary(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/transaction_summary`,
    queryParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/futures.ts
function getFuturesBalanceSummary() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/balance_summary`,
    isPublic: false
  });
}
function getIntradayMarginSetting() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/intraday/margin_setting`,
    isPublic: false
  });
}
function setIntradayMarginSetting(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/cfm/intraday/margin_setting`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getCurrentMarginWindow(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/intraday/current_margin_window`,
    queryParams: requestParams,
    isPublic: false
  });
}
function listFuturesPositions() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/positions`,
    isPublic: false
  });
}
function getFuturesPosition({ productId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/positions/${productId}`,
    isPublic: false
  });
}
function scheduleFuturesSweep(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/cfm/sweeps/schedule`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function listFuturesSweeps() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/cfm/sweeps`,
    isPublic: false
  });
}
function cancelPendingFuturesSweep() {
  return this.request({
    method: "DELETE" /* DELETE */,
    endpoint: `${API_PREFIX}/cfm/sweeps`,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/orders.ts
function createOrder(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function cancelOrders(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/batch_cancel`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function editOrder(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/edit`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function editOrderPreview(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/edit_preview`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function listOrders(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/orders/historical/batch`,
    queryParams: requestParams,
    isPublic: false
  });
}
function listFills(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/orders/historical/fills`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getOrder({ orderId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/orders/historical/${orderId}`,
    isPublic: false
  });
}
function previewOrder(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/preview`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function closePosition(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/orders/close_position`,
    queryParams: void 0,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/payments.ts
function listPaymentMethods() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/payment_methods`,
    isPublic: false
  });
}
function getPaymentMethod({ paymentMethodId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/payment_methods/${paymentMethodId}`,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/perpetuals.ts
function allocatePortfolio(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/intx/allocate`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getPerpetualsPortfolioSummary({ portfolioUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/portfolio/${portfolioUuid}`,
    isPublic: false
  });
}
function listPerpetualsPositions({ portfolioUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/positions/${portfolioUuid}`,
    isPublic: false
  });
}
function getPerpertualsPosition({ portfolioUuid, symbol }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/positions/${portfolioUuid}/${symbol}`,
    isPublic: false
  });
}
function getPortfolioBalances({ portfolioUuid }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/intx/balances/${portfolioUuid}`,
    isPublic: false
  });
}
function optInOutMultiAssetCollateral(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/intx/multi_asset_collateral`,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/portfolios.ts
function listPortfolios(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/portfolios`,
    queryParams: requestParams,
    isPublic: false
  });
}
function createPortfolio(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/portfolios`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function movePortfolioFunds(requestParams) {
  return this.request({
    method: "POST" /* POST */,
    endpoint: `${API_PREFIX}/portfolios/move_funds`,
    bodyParams: requestParams,
    isPublic: false
  });
}
function getPortfolioBreakdown({ portfolioUuid, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/portfolios/${portfolioUuid}`,
    queryParams: requestParams,
    isPublic: false
  });
}
function deletePortfolio({ portfolioUuid }) {
  return this.request({
    method: "DELETE" /* DELETE */,
    endpoint: `${API_PREFIX}/portfolios/${portfolioUuid}`,
    isPublic: false
  });
}
function editPortfolio({ portfolioUuid, ...requestParams }) {
  return this.request({
    method: "PUT" /* PUT */,
    endpoint: `${API_PREFIX}/portfolios/${portfolioUuid}`,
    bodyParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/products.ts
function getBestBidAsk(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/best_bid_ask`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getProductBook(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/product_book`,
    queryParams: requestParams,
    isPublic: false
  });
}
function listProducts(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getProduct({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getProductCandles({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}/candles`,
    queryParams: requestParams,
    isPublic: false
  });
}
function getMarketTrades({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}/ticker`,
    queryParams: requestParams,
    isPublic: false
  });
}

// advanced-sdk-ts/src/rest/public.ts
function getServerTime() {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/time`,
    isPublic: true
  });
}
function getPublicProductBook(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/product_book`,
    queryParams: requestParams,
    isPublic: true
  });
}
function listPublicProducts(requestParams) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/products`,
    queryParams: requestParams,
    isPublic: true
  });
}
function getPublicProduct({ productId }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/products/${productId}`,
    isPublic: true
  });
}
function getPublicProductCandles({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/market/products/${productId}/candles`,
    queryParams: requestParams,
    isPublic: true
  });
}
function getPublicMarketTrades({ productId, ...requestParams }) {
  return this.request({
    method: "GET" /* GET */,
    endpoint: `${API_PREFIX}/products/${productId}/ticker`,
    queryParams: requestParams,
    isPublic: true
  });
}

// advanced-sdk-ts/src/rest/index.ts
var RESTClient = class extends RESTBase {
  constructor(key, secret) {
    super(key, secret);
  }
  // =============== ACCOUNTS endpoints ===============
  getAccount = getAccount.bind(this);
  listAccounts = listAccounts.bind(this);
  // =============== CONVERTS endpoints ===============
  createConvertQuote = createConvertQuote.bind(this);
  commitConvertTrade = commitConvertTrade.bind(this);
  getConvertTrade = getConvertTrade.bind(this);
  // =============== DATA API endpoints ===============
  getAPIKeyPermissions = getAPIKeyPermissions.bind(this);
  // =============== FEES endpoints ===============
  getTransactionSummary = getTransactionSummary.bind(this);
  // =============== FUTURES endpoints ===============
  getFuturesBalanceSummary = getFuturesBalanceSummary.bind(this);
  getIntradayMarginSetting = getIntradayMarginSetting.bind(this);
  setIntradayMarginSetting = setIntradayMarginSetting.bind(this);
  getCurrentMarginWindow = getCurrentMarginWindow.bind(this);
  listFuturesPositions = listFuturesPositions.bind(this);
  getFuturesPosition = getFuturesPosition.bind(this);
  scheduleFuturesSweep = scheduleFuturesSweep.bind(this);
  listFuturesSweeps = listFuturesSweeps.bind(this);
  cancelPendingFuturesSweep = cancelPendingFuturesSweep.bind(this);
  // =============== ORDERS endpoints ===============
  createOrder = createOrder.bind(this);
  cancelOrders = cancelOrders.bind(this);
  editOrder = editOrder.bind(this);
  editOrderPreview = editOrderPreview.bind(this);
  listOrders = listOrders.bind(this);
  listFills = listFills.bind(this);
  getOrder = getOrder.bind(this);
  previewOrder = previewOrder.bind(this);
  closePosition = closePosition.bind(this);
  // =============== PAYMENTS endpoints ===============
  listPaymentMethods = listPaymentMethods.bind(this);
  getPaymentMethod = getPaymentMethod.bind(this);
  // =============== PERPETUALS endpoints ===============
  allocatePortfolio = allocatePortfolio.bind(this);
  getPerpetualsPortfolioSummary = getPerpetualsPortfolioSummary.bind(this);
  listPerpetualsPositions = listPerpetualsPositions.bind(this);
  getPerpetualsPosition = getPerpertualsPosition.bind(this);
  getPortfolioBalances = getPortfolioBalances.bind(this);
  optInOutMultiAssetCollateral = optInOutMultiAssetCollateral.bind(this);
  // =============== PORTFOLIOS endpoints ===============
  listPortfolios = listPortfolios.bind(this);
  createPortfolio = createPortfolio.bind(this);
  deletePortfolio = deletePortfolio.bind(this);
  editPortfolio = editPortfolio.bind(this);
  movePortfolioFunds = movePortfolioFunds.bind(this);
  getPortfolioBreakdown = getPortfolioBreakdown.bind(this);
  // =============== PRODUCTS endpoints ===============
  getBestBidAsk = getBestBidAsk.bind(this);
  getProductBook = getProductBook.bind(this);
  listProducts = listProducts.bind(this);
  getProduct = getProduct.bind(this);
  getProductCandles = getProductCandles.bind(this);
  getMarketTrades = getMarketTrades.bind(this);
  // =============== PUBLIC endpoints ===============
  getServerTime = getServerTime.bind(this);
  getPublicProductBook = getPublicProductBook.bind(this);
  listPublicProducts = listPublicProducts.bind(this);
  getPublicProduct = getPublicProduct.bind(this);
  getPublicProductCandles = getPublicProductCandles.bind(this);
  getPublicMarketTrades = getPublicMarketTrades.bind(this);
};

// src/plugins/advancedTrade.ts
import {
  elizaLogger as elizaLogger7,
  composeContext as composeContext6,
  generateObject as generateObject6,
  ModelClass as ModelClass6
} from "@elizaos/core";
import { readFile as readFile3 } from "fs/promises";
import { parse as parse3 } from "csv-parse/sync";
import path5 from "path";
import { fileURLToPath as fileURLToPath5 } from "url";
import fs5 from "fs";
import { createArrayCsvWriter as createArrayCsvWriter5 } from "csv-writer";
var __filename5 = fileURLToPath5(import.meta.url);
var __dirname5 = path5.dirname(__filename5);
var baseDir5 = path5.resolve(__dirname5, "../../plugin-coinbase/src/plugins");
var tradeCsvFilePath3 = path5.join(baseDir5, "advanced_trades.csv");
var tradeProvider2 = {
  get: async (runtime, _message) => {
    elizaLogger7.debug("Starting tradeProvider function");
    try {
      const client = new RESTClient(
        runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      );
      let accounts, products;
      try {
        accounts = await client.listAccounts({});
      } catch (error) {
        elizaLogger7.error("Error fetching accounts:", error);
        return [];
      }
      try {
        products = await client.listProducts({});
      } catch (error) {
        elizaLogger7.error("Error fetching products:", error);
        return [];
      }
      if (!fs5.existsSync(tradeCsvFilePath3)) {
        const csvWriter = createArrayCsvWriter5({
          path: tradeCsvFilePath3,
          header: [
            "Order ID",
            "Success",
            "Order Configuration",
            "Response"
          ]
        });
        await csvWriter.writeRecords([]);
      }
      let csvData, records;
      try {
        csvData = await readFile3(tradeCsvFilePath3, "utf-8");
      } catch (error) {
        elizaLogger7.error("Error reading CSV file:", error);
        return [];
      }
      try {
        records = parse3(csvData, {
          columns: true,
          skip_empty_lines: true
        });
      } catch (error) {
        elizaLogger7.error("Error parsing CSV data:", error);
        return [];
      }
      return {
        accounts: accounts.accounts,
        products: products.products,
        trades: records
      };
    } catch (error) {
      elizaLogger7.error("Error in tradeProvider:", error);
      return [];
    }
  }
};
async function appendTradeToCsv2(tradeResult) {
  elizaLogger7.debug("Starting appendTradeToCsv function");
  try {
    const csvWriter = createArrayCsvWriter5({
      path: tradeCsvFilePath3,
      header: ["Order ID", "Success", "Order Configuration", "Response"],
      append: true
    });
    elizaLogger7.info("Trade result:", tradeResult);
    const formattedTrade = [
      tradeResult.success_response?.order_id || tradeResult.failure_response?.order_id || "",
      tradeResult.success
      // JSON.stringify(tradeResult.order_configuration || {}),
      // JSON.stringify(tradeResult.success_response || tradeResult.failure_response || {})
    ];
    elizaLogger7.info("Formatted trade for CSV:", formattedTrade);
    await csvWriter.writeRecords([formattedTrade]);
    elizaLogger7.info("Trade written to CSV successfully");
  } catch (error) {
    elizaLogger7.error("Error writing trade to CSV:", error);
    if (error instanceof Error) {
      elizaLogger7.error("Error details:", error.message);
    }
  }
}
async function hasEnoughBalance(client, currency, amount, side) {
  elizaLogger7.debug("Starting hasEnoughBalance function");
  try {
    const response = await client.listAccounts({});
    const accounts = JSON.parse(response);
    elizaLogger7.info("Accounts:", accounts);
    const checkCurrency = side === "BUY" ? "USD" : currency;
    elizaLogger7.info(
      `Checking balance for ${side} order of ${amount} ${checkCurrency}`
    );
    const account = accounts?.accounts.find(
      (acc) => acc.currency === checkCurrency && (checkCurrency === "USD" ? acc.type === "ACCOUNT_TYPE_FIAT" : acc.type === "ACCOUNT_TYPE_CRYPTO")
    );
    if (!account) {
      elizaLogger7.error(`No ${checkCurrency} account found`);
      return false;
    }
    const available = Number.parseFloat(account.available_balance.value);
    const requiredAmount = side === "BUY" ? amount * 1.01 : amount;
    elizaLogger7.info(
      `Required amount (including buffer): ${requiredAmount} ${checkCurrency}`
    );
    const hasBalance = available >= requiredAmount;
    elizaLogger7.info(`Has sufficient balance: ${hasBalance}`);
    return hasBalance;
  } catch (error) {
    elizaLogger7.error("Balance check failed with error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      currency,
      amount,
      side
    });
    return false;
  }
}
var executeAdvancedTradeAction = {
  name: "EXECUTE_ADVANCED_TRADE",
  description: "Execute a trade using Coinbase Advanced Trading API",
  validate: async (runtime) => {
    return !!(runtime.getSetting("COINBASE_API_KEY") || process.env.COINBASE_API_KEY) && !!(runtime.getSetting("COINBASE_PRIVATE_KEY") || process.env.COINBASE_PRIVATE_KEY);
  },
  similes: [
    "EXECUTE_ADVANCED_TRADE",
    "ADVANCED_MARKET_ORDER",
    "ADVANCED_LIMIT_ORDER",
    "COINBASE_PRO_TRADE",
    "PROFESSIONAL_TRADE"
  ],
  handler: async (runtime, _message, state, _options, callback) => {
    let client;
    elizaLogger7.debug("Starting advanced trade client initialization");
    try {
      client = new RESTClient(
        runtime.getSetting("COINBASE_API_KEY") ?? process.env.COINBASE_API_KEY,
        runtime.getSetting("COINBASE_PRIVATE_KEY") ?? process.env.COINBASE_PRIVATE_KEY
      );
      elizaLogger7.info("Advanced trade client initialized");
    } catch (error) {
      elizaLogger7.error("Client initialization failed:", error);
      callback(
        {
          text: "Failed to initialize trading client. Please check your API credentials."
        },
        []
      );
      return;
    }
    let tradeDetails;
    elizaLogger7.debug("Starting trade details generation");
    try {
      tradeDetails = await generateObject6({
        runtime,
        context: composeContext6({
          state,
          template: advancedTradeTemplate
        }),
        modelClass: ModelClass6.LARGE,
        schema: AdvancedTradeSchema
      });
      elizaLogger7.info("Trade details generated:", tradeDetails.object);
    } catch (error) {
      elizaLogger7.error("Trade details generation failed:", error);
      callback(
        {
          text: "Failed to generate trade details. Please provide valid trading parameters."
        },
        []
      );
      return;
    }
    if (!isAdvancedTradeContent(tradeDetails.object)) {
      elizaLogger7.error("Invalid trade content:", tradeDetails.object);
      callback(
        {
          text: "Invalid trade details. Please check your input parameters."
        },
        []
      );
      return;
    }
    const { productId, amount, side, orderType, limitPrice } = tradeDetails.object;
    let orderConfiguration;
    elizaLogger7.debug("Starting order configuration");
    try {
      if (orderType === "MARKET") {
        orderConfiguration = side === "BUY" ? {
          market_market_ioc: {
            quote_size: amount.toString()
          }
        } : {
          market_market_ioc: {
            base_size: amount.toString()
          }
        };
      } else {
        if (!limitPrice) {
          throw new Error("Limit price is required for limit orders");
        }
        orderConfiguration = {
          limit_limit_gtc: {
            baseSize: amount.toString(),
            limitPrice: limitPrice.toString(),
            postOnly: false
          }
        };
      }
      elizaLogger7.info(
        "Order configuration created:",
        orderConfiguration
      );
    } catch (error) {
      elizaLogger7.error("Order configuration failed:", error);
      callback(
        {
          text: error instanceof Error ? error.message : "Failed to configure order parameters."
        },
        []
      );
      return;
    }
    let order;
    try {
      elizaLogger7.debug("Executing the trade");
      if (!await hasEnoughBalance(
        client,
        productId.split("-")[0],
        amount,
        side
      )) {
        callback(
          {
            text: `Insufficient ${side === "BUY" ? "USD" : productId.split("-")[0]} balance to execute this trade`
          },
          []
        );
        return;
      }
      order = await client.createOrder({
        clientOrderId: crypto.randomUUID(),
        productId,
        side: side === "BUY" ? "BUY" /* BUY */ : "SELL" /* SELL */,
        orderConfiguration
      });
      elizaLogger7.info("Trade executed successfully:", order);
    } catch (error) {
      elizaLogger7.error("Trade execution failed:", error?.message);
      callback(
        {
          text: `Failed to execute trade: ${error instanceof Error ? error.message : "Unknown error occurred"}`
        },
        []
      );
      return;
    }
    try {
      elizaLogger7.info("Trade logged to CSV");
    } catch (csvError) {
      elizaLogger7.warn("Failed to log trade to CSV:", csvError);
    }
    callback(
      {
        text: `Advanced Trade executed successfully:
- Product: ${productId}
- Type: ${orderType} Order
- Side: ${side}
- Amount: ${amount}
- ${orderType === "LIMIT" ? `- Limit Price: ${limitPrice}
` : ""}- Order ID: ${order.order_id}
- Status: ${order.success}
- Order Id:  ${order.order_id}
- Response: ${JSON.stringify(order.response)}
- Order Configuration: ${JSON.stringify(order.order_configuration)}`
      },
      []
    );
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Place an advanced market order to buy $1 worth of BTC"
        }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Advanced Trade executed successfully:
- Product: BTC-USD
- Type: Market Order
- Side: BUY
- Amount: 1000
- Order ID: CB-ADV-12345
- Success: true
- Response: {"success_response":{}}
- Order Configuration: {"market_market_ioc":{"quote_size":"1000"}}`
        }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Set a limit order to sell 0.5 ETH at $2000" }
      },
      {
        user: "{{agentName}}",
        content: {
          text: `Advanced Trade executed successfully:
- Product: ETH-USD
- Type: Limit Order
- Side: SELL
- Amount: 0.5
- Limit Price: 2000
- Order ID: CB-ADV-67890
- Success: true
- Response: {"success_response":{}}
- Order Configuration: {"limit_limit_gtc":{"baseSize":"0.5","limitPrice":"2000","postOnly":false}}`
        }
      }
    ]
  ]
};
var advancedTradePlugin = {
  name: "advancedTradePlugin",
  description: "Enables advanced trading using Coinbase Advanced Trading API",
  actions: [executeAdvancedTradeAction],
  providers: [tradeProvider2]
};

// src/index.ts
var plugins = {
  coinbaseMassPaymentsPlugin,
  coinbaseCommercePlugin,
  tradePlugin,
  tokenContractPlugin,
  webhookPlugin,
  advancedTradePlugin
};
export {
  advancedTradePlugin,
  appendTradeToCsv2 as appendTradeToCsv,
  chargeProvider,
  coinbaseCommercePlugin,
  coinbaseMassPaymentsPlugin,
  createCharge,
  createCoinbaseChargeAction,
  createWebhookAction,
  deployTokenContractAction,
  executeAdvancedTradeAction,
  executeTradeAction,
  getAllCharges,
  getAllChargesAction,
  getChargeDetails,
  getChargeDetailsAction,
  invokeContractAction,
  massPayoutProvider,
  plugins,
  readContractAction,
  sendMassPayoutAction,
  tokenContractPlugin,
  tradePlugin,
  tradeProvider,
  webhookPlugin,
  webhookProvider
};
//# sourceMappingURL=index.js.map